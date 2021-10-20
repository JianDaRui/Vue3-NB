# `Vue3 reactivity `源码深入浅出

> 大家好，我是剑大瑞。前段时间公司用`Vue3`做了一个全新的项目，很荣幸，参与了大部分功能的开发工作，就把`Vue3`全家桶全部实践了一遍。趁热打铁，阅读了下`Vue3`源码中的`reactivity`包的源码。有不少收获，借此机会，将其分享出来。如有不足，还望各位批评指正。



## 新旧对比

 这次分享的主要是Vue3的reactivity的源码部分，故只对比Vue2与Vue3的响应式源码部分。

### 新旧原理对比：`Object.defineProperty`与`Proxy`

**`Object.defineProperty`**：

有了解过Vue2源码的同学都知道。在`Vue2`中，其内部是通过`Object.defineProperty`来实现变化侦测的。该方法可以直接在一个对象上定义一个新属性或者修改一个现有属性。接受三个参数，分别是`targetObject`、`key`及一个针对key的`descriptorObject`，返回值是传递给函数的对象。

descriptorObject可以选择的键值：

- configurable：设置当前属性的可配置性，默认false。
- enumerable：设置当前属性的可枚举性，默认false。
- value：设置当前属性的值，默认undefined。
- writable：设置当前属性是否可更改，默认false。
- **get**：当前属性的getter函数，当访问该属性时，会触发该函数。
- **set**：当前属性的setter函数，当设置当前属性值时，会触发该函数。

这里附上Vue2中defineReactive函数的简略源码，**重点关注**： **get**函数和**set**函数。

```javascript
function defineReactive (obj, key, val, customSetter, shallow) {
  // 省略部分代码...
  
  Object.defineProperty(obj, key, {
    enumerable: true,
    configurable: true,
    get: function reactiveGetter () {
      const value = getter ? getter.call(obj) : val
      if (Dep.target) {
          
        // 依赖收集
        dep.depend()
        if (childOb) {
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
      
      // 新旧值对比
      if (newVal === value || (newVal !== newVal && value !== value)) {
        return
      } 
      if (getter && !setter) return
        
      // 为object设置新值
      if (setter) {
        setter.call(obj, newVal)
      } else {
        val = newVal
      }
        
      // 侦测新值
      childOb = !shallow && observe(newVal)
        
      // 触发依赖，响应
      dep.notify()
    }
  })
}
```

**`Object.defineProperty`的问题**：

- 直接修改`Array`的`length`属性存在兼容性问题。

```js
let demoArray = [1,2,3]
Object.defineProperty(demoArray, 'length', { 
    set: function() { 
        console.log('length changed!')
    } 
})
// Uncaught TypeError: Cannot redefine property: length
// at Function.defineProperty (<anonymous>)
// at <anonymous>:2:8
```

- 直接给`targetObject`添加属性或者删除属性，`Object.defineProperty`无法触发依赖。

```javascript
let obj = { name: "jiandarui", age: 18 };
obj = Object.defineProperty(obj, 'age', {
  	configurable: true,
    get: function() {
        console.log("get value")
    },
    set: function(value) { 
        console.log('set value')
    } 
})
obj.gender = "man"; // 没有触发 Getter
delete obj.age // 没有触发 Setter
```

- 只能对`targetObject`的属性进行侦测，不能针对整个`targetObject`进行侦测。

```js
function defineReactive(data, key, val) {
	Object.defineProperty(data, key, {
        configurable: true,
        enumerable: true,
        get: function() {
            // 在这里做依赖收集
            console.log("依赖收集")
            return val;
        }，
        set: function(newVal) {
        	if(val === newVal) {
                return val;
            }
        	// 在这里做变化侦测
        	console.log("变化侦测")
       		val = newVal;
    	}
    })
}
```

针对这三个问题，`Vue2`中分别采取了不同的措施:

- 针对数组变化，创建数组拦截器。
- 针对新增和删除对象属性问题，创建`$set`、`$delete` API。
- 针对`value`为对象的情况，采用**递归**的方式，深度遍历，进行依赖收集。

**`Proxy`**：

随着浏览器对ES6支持度的提升，在Vue3中使用了Proxy。

**proxy 可以直接对整个`targetObject`进行拦截**，它接受两个参数，分别是target、handler，并返回一个代理对象。handler可配置的方法有***13***种，涉及属性查找、赋值、枚举、函数调用、原型、属性描述相关方法。

下面我们可以通过代码示例了解下proxy，及Vue3中handler使用到的几种方法：

```js
let obj = { name: "罗翔"}
cosnt handler = {
    get: function(target, key, receiver) {
        console.log("get")
    },
    set: function(target, key, value, receiver) {
        console.log("set")
        return Reflect.set(target, key, value, receiver)
    }
}
let proxy = new Proxy(obj, handler);
proxy.name 
proxy.name = "张三";
```

> 这里说到Proxy，就不得不提一下它的好基友：Reflect。Reflect上的方法基本与Object相同，[但又存在细微的差别](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Reflect/Comparing_Reflect_and_Object_methods)。
>
> Reflect上的方法与Proxy方法命名相同。可以对target进行映射。
>
> 当需要调用Object上的方法时，我们可以直接调用Reflect。Reflect相当于直接对Javascript的操作做了一层拦截。

- `get()`
  - 用于拦截对象属性的读取
  - 接受三个参数target(原对象)、key（要读取的属性）、receiver（Proxy对象实例或者继承Proxy的对象）
  - 返回值可自定义
  - 可继承

```javascript
let p = new Proxy({ name: "罗翔" }, {
  get: function(target, key, receiver) {
    console.log("called: " + key);
    return Reflect.get(target, key, receiver);
  }
});

console.log(p.a); // "called: a"
```

- `set()`
  - 用于设置对象属性的值
  - 接受四个参数target、key、newValue（新设置的值）、receiver
  - 返回true，严格模式返回false会报TypeError异常

```javascript
let p = new Proxy({ name: "罗翔", profession: "司机" }, {
  set: function(target, key, value, receiver) {
    console.log("called: " + key+ ": " + value);
    return Reflect.set(target, key, value, receiver);
  }
});
p.profession = "律师" // called: profession: 律师
p.age = 18 // called: age: 18
console.log(p.age) // 18
```

- `deleteProperty()`
  - 用于拦截对对象属性的delete操作（弥补了Object.definedProperty属性对delete操作无感的问题）。
  - 接受参数：target、key
  - 返回布尔值： true成功，false失败

```javascript
var p = new Proxy({}, {
  deleteProperty: function(target, prop) {
    console.log('called: ' + prop);
    return true;
  }
});

delete p.a; // "called: a"
```

- `has()`
  - 用于拦截in操作
  - 接受参数target、key
  - 返回布尔值，true存在，false不存在
  - 拦截只对`in`运算符生效，对`for...in`循环不生效

```javascript
// ECMAScript 6入门
let stu1 = {name: '张三', score: 59};
let stu2 = {name: '李四', score: 99};

let handler = {
  has(target, prop) {
    if (prop === 'score' && target[prop] < 60) {
      console.log(`${target.name} 不及格`);
      return false;
    }
    return prop in target;
  }
}

let oproxy1 = new Proxy(stu1, handler);
let oproxy2 = new Proxy(stu2, handler);

'score' in oproxy1
// 张三 不及格
// false

'score' in oproxy2
// true

for (let a in oproxy1) {
  console.log(oproxy1[a]);
}
// 张三
// 59

for (let b in oproxy2) {
  console.log(oproxy2[b]);
}
```

- `ownKeys()`
  - 用于拦截对象资深属性的读取操作，可以拦截的操作
    - [`Object.getOwnPropertyNames()`](https://developer.mozilla.org/zh-CN/docs/Web/JavaScript/Reference/Global_Objects/Object/getOwnPropertyNames)
    - [`Object.getOwnPropertySymbols()`](https://developer.mozilla.org/zh-CN/docs/Web/JavaScript/Reference/Global_Objects/Object/getOwnPropertySymbols)
    - [`Object.keys()`](https://developer.mozilla.org/zh-CN/docs/Web/JavaScript/Reference/Global_Objects/Object/keys)
    - [`Reflect.ownKeys()`](https://developer.mozilla.org/zh-CN/docs/Web/JavaScript/Reference/Global_Objects/Reflect/ownKeys)
    - `for...in`循环
  - 参数target
  - 返回结果必须为一个数组

```javascript
let p = new Proxy({}, {
  ownKeys: function(target) {
    console.log('called');
    return ['a', 'b', 'c'];
  }
});

console.log(Object.getOwnPropertyNames(p)); // "called"
```

#### 总结

Proxy相较于Object.defineProperty更加强大。通过上面的示例，可以看出Proxy可以弥补Object.defineProperty在依赖收集，侦测变化方面的缺陷，比如：

- 对Object属性的新增删除操作
- 通过Array下标进行修改或新增元素操作

但是Proxy也有自己的缺陷，这里我们先留个空白，后面会补充。我们接着聊。

### 新旧模式对比

#### 观察者模式与代理模式

#### 观察者模式

Vue2内部通过观察者模式处理数据与依赖的关系，观察者模式的特点：

- **一对多。**多个对象之间存在一对多的依赖关系，当一个对象的状态发生改变时，所有依赖于他的对象都得到通知并被自动更新
- 降低目标数据与依赖之间的耦合关系
- 属于行为型设计模式

**简单实现观察者模式**

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

**Vue2中的观察者模式**

![借用大佬的图，侵删](D:\vue3深入浅出\docs\.vuepress\public\img\define_reactive.png)



- Vue2中 数据就是我们要观察的对象，Watcher就是所谓的依赖，而Dep只是负责对Watcher的收集和派发。

- 另Vue2中watcher也可以是目标数据。它与Dep是一种多对多的关系，而不是一对多。

下面我们再次回顾下Vue2中是如何设计这几个类的：

- **Observer类**：
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
        
      // 侦测数组
      this.observeArray(value)
    } else {
        
      // 侦测对象
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

- **Observe方法**
  - observe方法是用于创建Observer实例的工场方法

```js
function observe (value, asRootData){
  if (!isOObject(value) || value instanceof VNode) {
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

- **defineReactive方法**
  - 对val进行递归观察
  - 通过Object.defineProperty，对obj[key]进行Getter、Setter拦截
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
      // 判断新旧value是否相等
      if (newVal === value || (newVal !== newVal && value !== value)) {
        return
      }

      if (setter) {
        // 设置新值
        setter.call(obj, newVal)
      } else {
        val = newVal
      }
      // 侦测新值
      childOb = !shallow && observe(newVal)
      // 通知更新
      dep.notify()
    }
  })
}
```

- **Dep类**
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
  // 添加依赖
  addSub (sub) {
    this.subs.push(sub)
  }
  // 移除依赖
  removeSub (sub) {
    remove(this.subs, sub)
  }
  // 收集
  depend () {
    if (Dep.target) {
      Dep.target.addDep(this)
    }
  }
  // 遍历通知依赖
  notify () {
    const subs = this.subs.slice()
    for (let i = 0, l = subs.length; i < l; i++) {
      subs[i].update()
    }
  }
}

Dep.target = null

```

- **Watcher类**
  - 真正的依赖，执行callback函数，进行响应
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
  
  // 进行响应
  update () {
    this.run()
  }
  
  // 执行callback函数
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

上面几个类代码中，省略了一些不必要的代码，以便减轻阅读负担。但已经能够展示出Vue2的观察者模式中几个类的基本结构 & 关系。



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

## 变化侦测

### 依赖收集与响应

### 依赖&数据的结构

### Object&Array的变化侦测

### Map&Set的变化侦测

## API实现原理

### reactive

### ref

### computed

### watch

### effect

## 总结

[但又纯在细微的差别]: 