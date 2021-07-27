# 观察者模式与代理模式

## 观察者模式

Vue2内部通过观察者模式处理数据与依赖的关系，观察者模式的特点：

- 一对多。多个对象之间存在一对多的依赖关系，当一个对象的状态发生改变时，所有依赖于他的对象都得到通知并被自动更新
- 降低目标数据与依赖之间的耦合关系
- 属于行为型设计模式

### 简单实现观察者模式

- Subject类：
  - observers属性用于维护所有的观察者
  - add方法用于添加观察者
  - notify方法用于通知所有的观察者
  - remove方法用于移除观察者
- Observer类：
  - update方法用于接受状态的变化

```js
// Subject 对象
class Subject {
    constructor() {
        // 存储观察者
        this.observers = [];
    }
    add(observer) { 
    	this.observers.push(observer);
  	}
    // 状态变化，通知观察者
 	notify(...args) { 
    	var observers = this.observers;
    	for(var i = 0;i < observers.length;i++){
      		observers[i].update(...args);
    	}
  	}
	// 移除观察者
  	remove(observer){
    	var observers = this.observers;
    	for(var i = 0; i < observers.length; i++){
      		if(observers[i] === observer){
        		observers.splice(i,1);
      		}
    	}
  	}
}


// Observer 对象
class Observer{
    constructor(name) {
        this.name = name;
    }
    update(args) {
    	console.log('my name is '+this.name);
	}
}

let sub = new Subject();
let bigRio = new Observer('剑大瑞');
let smallRio = new Observer('剑小瑞');
sub.add(bigRio);
sub.add(smallRio);
sub.notify(); 
```

### Vue2中的观察者模式

<img :src="$withBase('/img/define_reactive.png')" width="600" height="auto" alt="响应原理" title="图片来自于网络，侵删">

Vue2中 数据就是我们要观察的对象，Watcher就是依赖，而Dep只是负责对watcher的收集和派发。

Vue2中watcher也是目标数据。它与Dep是一种多对多的关系，而不是一对多。

#### Observer类

- 用于创建Observer实例
- walk方法遍历被观察的对象，将value中的每一项转为响应式
- observeArray方法用于遍历被观察的数组，将数组中的每一项转为响应式

```js
class Observer {
  constructor (value) {
    this.value = value
    this.dep = new Dep()
    def(value, '__ob__', this)
    if (Array.isArray(value)) {
      this.observeArray(value)
    } else {
      this.walk(value)
    }
  }

  walk (obj) {
    // 遍历对象进行转换
    const keys = Object.keys(obj)
    for (let i = 0; i < keys.length; i++) {
      defineReactive(obj, keys[i])
    }
  }

  observeArray (items) {
    // 遍历数组进行转换
    for (let i = 0, l = items.length; i < l; i++) {
      observe(items[i])
    }
  }
}
```

### observe

- observe方法是用于创建Observer实例的工场方法

```js
function observe (value, asRootData){
  if (!isObject(value) || value instanceof VNode) {
    return
  }
  let ob
  if (hasOwn(value, '__ob__') && value.__ob__ instanceof Observer) {
    ob = value.__ob__
  } else if (
    (Array.isArray(value) || isPlainObject(value)) &&
    Object.isExtensible(value)
  ) {
    ob = new Observer(value)
  }

  return ob
}
```

### defineReactive方法

- 对val进行递归观察
- 对obj[key]进行Getter、Setter拦截
- 进行依赖收集、状态派发

```js
function defineReactive (obj, key, val, customSetter, shallow) {
  const dep = new Dep()

  const property = Object.getOwnPropertyDescriptor(obj, key)
  if (property && property.configurable === false) {
    return
  }

  const getter = property && property.get
  const setter = property && property.set

  // 递归观察val
  let childOb = !shallow && observe(val)
  
  Object.defineProperty(obj, key, {
    enumerable: true,
    configurable: true,
    get: function reactiveGetter () {
      const value = getter ? getter.call(obj) : val
      if (Dep.target) {
        // 依赖收集 为当前Watcher
        dep.depend()
        if (childOb) {
          // 子Observer收集依赖
          childOb.dep.depend()
          if (Array.isArray(value)) {
            dependArray(value)
          }
        }
      }
      return value
    },
    set: function reactiveSetter (newVal) {
      const value = getter ? getter.call(obj) : val
      if (newVal === value || (newVal !== newVal && value !== value)) {
        return
      }

      if (setter) {
        setter.call(obj, newVal)
      } else {
        val = newVal
      }
      childOb = !shallow && observe(newVal)
      // 通知更新
      dep.notify()
    }
  })
}
```

### Dep类

- 相当于Observer与Watcher之间的中介
- 用于维护数据与依赖之间的关系

```js
let uid = 0
class Dep {
  static target;
  id;
  subs;

  constructor () {
    this.id = uid++
    this.subs = []
  }
  // 添加
  addSub (sub) {
    this.subs.push(sub)
  }
  // 移除
  removeSub (sub) {
    remove(this.subs, sub)
  }
  // 收集
  depend () {
    if (Dep.target) {
      Dep.target.addDep(this)
    }
  }
  // 遍历通知
  notify () {
    const subs = this.subs.slice()
    for (let i = 0, l = subs.length; i < l; i++) {
      subs[i].update()
    }
  }
}

Dep.target = null

```

### Watcher

- 真正的依赖
- 维护dep与watcher多对多的关系
- 返回新值

```js
const targetStack = []

function pushTarget (target) {
  targetStack.push(target)
  Dep.target = target
}

function popTarget () {
  targetStack.pop()
  Dep.target = targetStack[targetStack.length - 1]
}

class Watcher {
  constructor (vm, expOrFn, cb, options, isRenderWatcher) {
    this.vm = vm
    if (isRenderWatcher) {
      // 渲染watcher
      vm._watcher = this
    }
    vm._watchers.push(this)
    // options
    if (options) {
      this.deep = !!options.deep
      this.user = !!options.user
      this.lazy = !!options.lazy
    }
    this.cb = cb
    this.active = true
    this.dirty = this.lazy 

    // 维护与当前watcher相关的所有依赖
    this.deps = []
 
    this.expression = process.env.NODE_ENV !== 'production'
      ? expOrFn.toString()
      : ''
    // 获取getter
    if (typeof expOrFn === 'function') {
      this.getter = expOrFn
    } else {
      this.getter = parsePath(expOrFn)
    }
    this.value = this.lazy ? undefined : this.get()
  }

  get () {
    pushTarget(this)
    let value
    const vm = this.vm
    try {
      value = this.getter.call(vm, vm)
    } catch (e) {
      if (this.user) {
        handleError(e, vm, `getter for watcher "${this.expression}"`)
      } else {
        throw e
      }
    } finally {
      if (this.deep) {
        traverse(value)
      }
      popTarget()
      this.cleanupDeps()
    }
    return value
  }
  
  // 添加与当前Watcher实例相关的所有dep
  // watcher与dep多对多
  addDep (dep) {
    dep.addSub(this)
  }
    
  // 遍历与当前watcher相关的dep，移除与当前watcher的关系
  cleanupDeps () {
    let i = this.deps.length
    while (i--) {
      const dep = this.deps[i]
      dep.removeSub(this)
    }
  }

  update () {
    this.run()
  }

  run () {
    if (this.active) {
      const value = this.get()
      if (
        value !== this.value ||
        isObject(value) ||
        this.deep
      ) {
        const oldValue = this.value
        this.value = value
        this.cb.call(this.vm, value, oldValue)
      }
    }
  }

  evaluate () {
    this.value = this.get()
    this.dirty = false
  }
    
  //遍历当前Watcher相关的所有deps，即与当前watcher相关的每一个dep，并将当前watcher添加至dep
  depend () {
    let i = this.deps.length
    while (i--) {
      this.deps[i].depend()
    }
  }

  // 从所有dep中移除当前watcher
  teardown () {
    if (this.active) {
      if (!this.vm._isBeingDestroyed) {
        remove(this.vm._watchers, this)
      }
      let i = this.deps.length
      while (i--) {
        this.deps[i].removeSub(this)
      }
      this.active = false
    }
  }
}
```

上面几个类代码中，省略了一些不必要的代码，以便减轻阅读负担。但已经能够展示出Vue2的观察者模式的基本结构。

## 代理模式

Vue3采用的是基于Proxy代理模式。

代理模式属于设计模式中的一种结构型模式。通过代理模式我们可以基于原始对象，创建一个与之拥有相同接口的代理对象，在代理对象的接口中，我们可以做一些扩展性的操作，但是并不破坏原始对象。

当我们需要对原始对象的访问做一些控制或者加强时，就可以使用代理模式。

代理模式的特点：

- 可以控制外部对于原始对象的访问，可以代表原始对象，通过代理对象以控制对原始对象的访问。
- 职责清晰、高扩展性、智能化
  - 代理对象用于控制外界对原始对象的访问
  - 可以借助代理对象，增强或扩展接口功能
- 属于结构型设计模式
- 例：正/反向代理、静/动态代理、属性校验。

例举一个经典例子：使用虚拟代理加载图片

加载原始图片的对象：

- 创建一个原始img标签，并将标签添加至body
- 返回一个对象，对象有个setSrc方法用于设置img标签的属性

代理对象：

- 创建一个Image实例，当img.onload执行时，将原始的img属性src设置为目标url
- 返回一个对象，对象有个setSrc方法，初始时给原始img.src设置为loading.gif
- img.src = src

```js
let rawImage = (function() {
    let imgNode = document.createElement('img');
    document.body.appendChild(imgNode);
    
    return {
        setSrc; function(src) {
            imgNode.src = src;
        }
    }
})()

let proxyImage = (function() {
    let img = new Image;
    img.onload = function(src) {
        // 真实图片加载完成，设置为目标图片
        rawImage.setSrc = img.src;
    }
    
    return {
        setSrc: function(src) {
            myImage.setSrc('loading.gif');
            img.src = src;
        }
    }
})()

// proxyImage去加载图片
proxyImage.setSrc("https://lf1-cdn-tos.bytescm.com/obj/static/xitu_extension/static/baidu.10d6d640.png")
```

ES6提供的Proxy对象，拥有13种拦截方式。在vue3种使用的有:

- set
- get
- has
- deleteProperty
- ownKeys

<img :src="$withBase('/img/proxy.jpg')" width="600" height="auto" alt="代理模式">
