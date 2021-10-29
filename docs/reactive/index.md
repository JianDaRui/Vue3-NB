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

#### 总结（待完善）

Proxy相较于Object.defineProperty更加强大。通过上面的示例，可以看出Proxy可以弥补Object.defineProperty在依赖收集，侦测变化方面的缺陷，比如：

- 对Object属性的新增删除操作
- 通过Array下标进行修改或新增元素操作

但是Proxy也有自己的缺陷，这里我们先留个空白，后面会补充。我们接着聊。

### 新旧模式对比：观察者模式与代理模式

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



#### 代理模式

代理模式属于设计模式中的一种结构型模式。通过代理模式我们可以基于原始对象，创建一个与之拥有相同接口的代理对象，在代理对象的接口中，我们可以做一些扩展性的操作，但是并不破坏原始对象。

当我们需要对原始对象的访问做一些**控制或者加强**时，就可以使用代理模式。

代理模式的特点：

- 可以控制外部对于原始对象的访问，可以代表原始对象，通过代理对象以控制对原始对象的访问。
- 职责清晰、高扩展性、智能化
  - 代理对象用于控制外界对原始对象的访问
  - 可以借助代理对象，增强或扩展接口功能
- 属于结构型设计模式
- 例：使用虚拟代理加载图片、正/反向代理、静/动态代理、属性校验。

Vue3响应式是基于Proxy的代理模式。通过**配置handler**我们就可以对原始对象的访问**进行控制 & 增强**。

![Vue3代理模式](D:\vue3深入浅出\docs\.vuepress\public\img\proxy_module.png)

**增强的hanlder**

- getter时进行Track
  - 确定target与effect的关系
  - 确定activeEffect与Dep的关系
  - 返回value
- setter时进行Trigger
  - 获取对应的effects，遍历执行effect
  - 更新activeEffect
  - 更新value

通过分析，我们不难写出有以下逻辑的代码：

- 通过对target进行判断，是否需要进行代理转换
- 通过new Proxy对target进行代理
- 将代理实例返回

```js
// 配置handler
const handlers = { 
	get(target, key, receiver) {
		const res = Reflect.get(target, key, receiver)
		// get的时候track
        track(target, key);
		return res;
	},
    set(target, key, value, receiver) {
        console.log("set函数")
        trigger(target, key, value, )
        Reflect.set(target, key, value, receiver);
	}
}

// track函数
function track(target, key) {
   // 负责进行依赖收集
    console.log("track")
}

// trigger函数
function trigger(target, key, value) {
    // 负责进行响应
    console.log("trigger")
}

// 响应转换函数
function createReactiveObject(target, handlers, proxyMap) {
    
   // 1. 仅代理对象类型
  if (!isObject(target)) {
    if (__DEV__) {
      console.warn(`value cannot be made reactive: ${String(target)}`)
    }
    return target
  }
 
  // 2. 判断target是否已经经过代理
  const existingProxy = proxyMap.get(target)
  if (existingProxy) {
    return existingProxy
  }
  // 3. 进行代理转换
  const proxy = new Proxy(target,  handlers)
  
  // 4. 创建target与代理实例之间的映射，方便下次进行判断
  proxyMap.set(target, proxy)
    
  // 5.返回代理实例
  return proxy
}

```

通过上面的图，我们可以看出，Vue3中的依赖收集 & 响应派发都是在handler中做的，但是有几个问题需要我们确定下：

- handler针对其他操作类型是如何配置的？比如delete、forEach。
- 针对不同的数据类型，handler的配置方式一样吗？有什么需要注意的？

针对上面的两个问题，我们先留着。下面的内容我们就会说到，咱们接着聊。

## 变化侦测

### Track：依赖收集 

#### 新的依赖

在Vue2中，依赖就是watcher，在Vue3的源码中，我并没有发现Watcher类，而是出现一个新的函数effect，可以称为副作用函数。通过对比watcher与effect及effect与数据的关系。可以确定的称effect相当于Vue2中的watcher，但比Watcher类更简洁。

这里贴上effect代码的简略实现，并分析下它的思路：

- effect接受一个fn作为回调函数通过createReactiveEffect函数进行缓存
- 通过options对effect进行配置
- 执行effect其实就是创建一个缓存了fn的effect函数

```js
export function effect(fn, options) {
  const effect = createReactiveEffect(fn, options)
  if (!options.lazy) {
    effect()
  }
  return effect
}

function createReactiveEffect(fn, options) {
  const effect = function reactiveEffect() {
     // 省略部分代码
    return fn()
  }
  effect.id = uid++
  effect.allowRecurse = !!options.allowRecurse
  effect._isEffect = true
  effect.active = true
  effect.raw = fn
  effect.deps = []
  effect.options = options
  return effect
}
```

#### 收集在哪里？

在Vue2中，为了维护数据与watcher的关系，专门创建了Dep类。而在Vue3中Dep变为了一个简单的Set实例。在Track的时候，当前的activeEffect就存储在dep中。在Trigger的时候，通过key获取对应的dep集合，再去遍历执行即可。

这里贴上track的简略代码：

```js
export function track(target, type, key) {
  if (!shouldTrack || activeEffect === undefined) {
    return
  }
  let depsMap = targetMap.get(target)
  if (!depsMap) {
    targetMap.set(target, (depsMap = new Map()))
  }
  // 1.尝试获取dep
  let dep = depsMap.get(key)
  if (!dep) {
      
    // 2.如果没有就创建
    depsMap.set(key, (dep = new Set()))
  }
  if (!dep.has(activeEffect)) {
      
    // 3.添加当前activeEffect至dep
    dep.add(activeEffect)
      
    // 4.activeEffect.deps是一个数组，用于维护当前activeEffect与其所在的dep之间的关系
    // 这里可以看出：effect与dep也是一种多对多的关系，即：
    //     a. 一个effect可能存在多个dep中
    //     b. dep又存在于effect.deps中
    activeEffect.deps.push(dep)
  }
}
```

#### 数据与依赖之间的关系

在Vue2中，是通过Observe、Dep、Watcher来维持value与watcher之间的关系。

但是Vue3中没有了上面的几个类。那它是如何维持value与effect之间的关系的呢？

我们看一段代码：

```js
import { reactive } from "vue"
let count = reactive(0)
let obj = reactive({
  name: "剑大瑞"，
  age: 18,
  beGoogAt: "createBug",
  otherInfo: {
  	temp1: ["篮球", "足球", "桌球"]
    temp2: {
      brother: ["张三"， "李四"],
      sister: ["李华"， "李丽"],
    }
  }
})
// 更改obj
obj.age = 27
obj.otherInfo.temp1.push("羽毛球")
```

当obj的属性发生变化的时候，我们需要去执行所有与之相关的effect，触发响应。Vue中，state与依赖的关系，可以具体到最基本的 key:value，

![数据与依赖之间的关系](D:\vue3深入浅出\docs\.vuepress\public\img\effect_dep.png)

- targetMap：使用WeakMap实例，用于维护targetObject与KeyToDepMap的关系
- KeyToDepMap：使用Map实例，用于维护key与Dep的关系
- Dep：使用Set实例，用于存储所有与key相关的effect
- effect.deps：使用Array实例，用于存储所有与当前effect的dep实例



### Trigger：响应派发

当我们对经过响应转换的数据进行修改时，会触发Setter函数，这时需要做依赖的派发工作，比如DOM更新、watch/computed的执行。

#### 触发依赖

```html	
<template>
	<div>
    	{{proxy.name}}
	</div>
</template>
```

模板中name是通过Proxy代理产生的，当proxy.name赋新值时，会触发Setter，这时需要动态的去更新DOM，故在Setter中可以做一些依赖的触发操作。我们可以通过创建一个trigger函数，在setter函数中调用。

通过分析，**tigger函数的主要作用**：

- 根据target、key获取要执行的所有effect
- 根据type操作，进行一些情况判断，添加需要遍历执行的effect
- 遍历执行effets，触发响应

```javascript
function trigger(target , type , key , newValue , oldValue , oldTarget) {
  // 1.根据target获取对应的KeyTopDepMaps
  const depsMap = targetMap.get(target)
  if (!depsMap) {
    // never been tracked
    return
  }

  const effects = new Set()
  
  // 2.负责将effect添加至effects
  const add = (effectsToAdd) => {
    if (effectsToAdd) {
      effectsToAdd.forEach(effect => {
        if (effect !== activeEffect) {
          effects.add(effect)
        }
      })
    }
  }

  // schedule runs for SET | ADD | DELETE
  if (key !== void 0) {
      
     // 3.将与key相关的dep传给add，dep中存储着所有与key相关的effect
     add(depsMap.get(key))
  }

  // 5.负责执行effect，这时就会执行当初创建effect时，传递的callBack函数
  const run = (effect) => {
    if (effect.options.scheduler) {
      effect.options.scheduler(effect)
    } else {
      effect()
    }
  }
  // 4. 遍历执行effect
  effects.forEach(run)
}

function createReactiveObject(target, handlers) {
	let proxy = new Proxy(target, handlers)
	return proxy
}
// 配置handler
const handlers = { 
	get(target, key, receiver) {
		const res = Reflect.get(target, key, receiver)
		track(target, key);
		return res;
	},
    set(target, key, newValue, receiver) {
        const res = Reflect.set(target, key, newValue, receiver);
        trigger(target, key, newValue)
        return res
	}
}

let target = { name: "剑大瑞" }

let proxyTarget = createReactiveObject(target, handlers)

const effect = patchDOM() {
    // 负责更新DOM
}
proxyTarget.name  // "track"
proxyTarget.name = "Jiandarui" // "trigger"
```

通过上面的代码示例，我们可以知道，Vue3内部，会在Getter函数中进行track，在Setter函数中进行trigger。上面我们并没有研究这两个关键函数的内部实现，下一小节我们一起研究下现在的响应式是如何处理数据与依赖的？track与trigger的内部实现的细节有哪些？

#### 完善handler & track & trigger

通过对Proxy，handler、track、trigger、effect、依赖与数据的关系这几项分析。接下来我们就可以进行一个简单的组合，写出一个简版的响应式代码

```js
// 1.负责target与依赖的映射
const targetMap = new WeakMap();

// 2.创建effect函数
export function effect(fn, options) {
  const effect = createReactiveEffect(fn, options)
  if (!options.lazy) {
    effect()
  }
  return effect
}

function createReactiveEffect(fn, options) {
  const effect = function reactiveEffect() {
     // 省略部分代码
    return fn()
  }
  effect.id = uid++
  effect.allowRecurse = !!options.allowRecurse
  effect._isEffect = true
  effect.active = true
  effect.raw = fn
  effect.deps = []
  effect.options = options
  return effect
}

// 3.track函数
function track(target, type, key) {
  if (!shouldTrack || activeEffect === undefined) {
    return
  }
  let depsMap = targetMap.get(target)
  if (!depsMap) {
    targetMap.set(target, (depsMap = new Map()))
  }
  let dep = depsMap.get(key)
  if (!dep) {
      
    depsMap.set(key, (dep = new Set()))
  }
  if (!dep.has(activeEffect)) {
      
    dep.add(activeEffect)

    activeEffect.deps.push(dep)
  }
}

// 4.trigger函数
function trigger(target , type , key , newValue , oldValue , oldTarget) {
  const depsMap = targetMap.get(target)
  if (!depsMap) {
    // never been tracked
    return
  }

  const effects = new Set()
  
  const add = (effectsToAdd) => {
    if (effectsToAdd) {
      effectsToAdd.forEach(effect => {
        if (effect !== activeEffect) {
          effects.add(effect)
        }
      })
    }
  }

  // schedule runs for SET | ADD | DELETE
  if (key !== void 0) {
      
     add(depsMap.get(key))
  }

  const run = (effect) => {
    if (effect.options.scheduler) {
      effect.options.scheduler(effect)
    } else {
      effect()
    }
  }
  effects.forEach(run)
}

// 5.进行代理转换 
function createReactiveObject(target, handlers, proxyMap) {
  if (!isObject(target)) {
    if (__DEV__) {
      console.warn(`value cannot be made reactive: ${String(target)}`)
    }
    return target
  }
 
  const existingProxy = proxyMap.get(target)
  if (existingProxy) {
    return existingProxy
  }
  const proxy = new Proxy(target,  handlers)
  
  proxyMap.set(target, proxy)
    
  return proxy
}
// 6. 配置handler
const handlers = { 
	get(target, key, receiver) {
		const res = Reflect.get(target, key, receiver)
		track(target, key);
		return res;
	},
    set(target, key, newValue, receiver) {
        const res = Reflect.set(target, key, newValue, receiver);
        trigger(target, key, newValue)
        return res
	}
}

let target = {
    name: "jiandarui"
}
const proxyMap = new Map()
let proxy = createReactiveObject(target, handlers, proxyMap);

// 伪代码
const effectFn = effect(() => {
    // 负责渲染组件
}，{lazy: false})
```

- 当初次渲染的时候，会进行读取操作，出发getter函数，这时就会通过track完成依赖的收集工作
- 当数据发生变化的时候，会触发setter函数，这时会通过trigger函数进行响应

### Object&Array的变化侦测

#### Object的深度代理

在vue2中，defineReactive函数会对data进行递归转换。那Vue3中是否存在这个问题呢？让我们先看一段代码：

```js
let obj = {
    name: "剑大瑞",
    hobby: {
       one: "篮球",
       two: "游泳"
    }
}
let handler = {
    get(target, key, receiver) {
        console.log(`get：${key}`)
        return Reflect.get(target, key, receiver)
    },
    set(target, key, value, receiver) {
        console.log(`set：${key}`)
        Reflect.set(target, key, value, receiver)
    }
}
let proxyObj = new Proxy(obj, handler)
proxyObj.name
// get: name
// 剑大瑞
proxyObj.name = "jiandarui"
// set: name
// jiandarui
proxyObj.hobby.one
// get: hobby
// 篮球
proxyObj.hobby.one = "basketball"
// get: hobby
// basketball
```

上面的代码中，我们明明通过 proxyObj.hobby.one = "basketball"，赋予新值，但handler只拦截到了hobby属性的getter操作。

如果obj中key对应的value为Object类型，则**Proxy只能进行单层的拦截**。这并不是我们期望的。

如果我们遇到如下场景：

```html
<div>{{proxyObj.hobby.one}}</div>
```

当 proxyObj.hobby.one 发生变化以后，我们期望DOM进行更新。由于proxyObj只进行了单层的代理，hobby并没有经过Proxy转为响应式。则会导致更新失败。

那Vue3是如何解决的呢？

答案是：**进行递归代理**，其思路与Vue2类似，通过判断value的类型，再进行响应转换。

这里就需要我们改写getter函数，

- 在get的时候去判断获取的value是否为Object
- 如果是Object，则再次进行一次Reactive代理

```js
let handler = {
    get(target, key， receiver) {
        // 省略部分代码.....
        
    	const res = Reflect.get(target, key, receiver)
    	if (isObject(res)) {
            // 如果为对象类型，则进行深层次转换
      		createReactiveObject(res)
    	}
    	return res
  	},
    set(target, key, value, receiver) {
        console.log(`set：${key}`)
        Reflect.set(target, key, value, receiver)
    }
}
```

#### 数组track&trigger的问题

Vue3中虽没有了数组拦截器，但是出现了另一个问题，让我们看一段代码：

```js
let arr = [1,2,3]
let handler = {
   get: function(target, key, receiver) {
       console.log(`get:${key}`)
       return Reflect.get(target, key, receiver)
   },
   set: function(target, key, value, receiver) {
       	console.log(`set:${key}`)
      	return Reflect.set(target, key, value, receiver)
   }
}
let proxyArr = new Proxy(arr, handler)
proxyArr.push(4) 
// get:push
// get:length
// set:3
// set:length
proxyArr.pop()
// get:pop
// get:length
// get:3
// set:length
proxyArr.shift()
// get:shift
// get:length
// get:0
// get:1
// set:0
// get:2
// set:1
// set:length
proxyArr.unshift(5)
// get:unshift
// get:length
// get:1
// set:2
// get:0
// set:1
// set:0
// set:length
proxyArr.splice(2,3,4)
// get:splice
// get:length
// get:constructor
// get:2
// set:2
// set:length
```

通过上面几个操作演示，我们可以发现一个简单的操作，可能会触发多次的Getter函数或者Setter函数，这种操作如果是在平常的业务开发过程中可能没有问题，但是在Vue3中可能会导致死递归的出现。

**push&pop&shift&unshift&splice** 这几个方法是可以对数组进行增加删除操作。需要注意的是：

- 这几个方法直接修改的是原数组
- 并会导致数组**length**属性的变化

 **includes&indexOf&lastIndexOf** 这三个方法都是数组用于判断是否存在要查找的值，需要注意的是：

- 这三个方法在数组方法实现中都会**对数组进行遍历操作**

> 感兴趣的同学可以看相关issue：[传送门1 (opens new window)](https://github.com/vuejs/vue-next/pull/2138)[传送门2(opens new window)](https://github.com/vuejs/vue-next/issues/2137)
>
> 大概意思是当通过watchEffect观察数组时，**发生了死递归**

通过上面打印的规律，可以发现：

- 每次调用方法时，都会先触发get，最后触发set

#### 创建数组Instrumentations

> 评论区，请大佬指教，vue3中的Instrumentations应如何翻译？(✿◡‿◡)

那我们能否做一个状态管理器，通过判断是否需要track，以避免到不必要的track和trigger：

- 通过hander中的get函数拦截array上的方法
- 对原型上的方法进行封装，在获取结果前后，分别去做track的暂停和重置，通过trackStack记录shouldTrack
- 获取到结果后，在进行track

让我们一起看下处理后的代码，注意**注释标示的顺序**：

```js
function createReactiveObject(target, handlers) {
  let proxy = new Proxy(target, handlers)
  return proxy
}
const targetMap = new WeakMap()

function track(target, key) {
  if (!shouldTrack) {
    return
  }
  console.log('-------track-------')
  // 省略部分代码
}

function trigger(target, key, newValue, oldValue) {
  console.log('trigger')
}

const handlers = {
  get(target, key, receiver) {
      
    // 1. 先获取结果
    // 注意：这里Reflect传递的是经过处理的 arrayInstrumentations
    const res = Reflect.get(arrayInstrumentations, key, receiver)
    
    // 5. 再track
    track(target, key)
    // 查看触发情况
    console.log(`get:${key}`)
    return res
  },
  set(target, key, newValue, receiver) {
    const res = Reflect.set(target, key, newValue, receiver)
    trigger(target, key, newValue)
    console.log(`set:${key}`)
    return res
  },
}

// 对数组原型上的方法进行拦截封装
const arrayInstrumentations = {}
;['push', 'pop', 'shift', 'unshift', 'splice'].forEach((key) => {
  const method = Array.prototype[key]
  arrayInstrumentations[key] = function (thisArgs = [], ...args) {
      
    // 2. 暂停track
    // 先将上一次的shouldTrack状态push至trackStack
   	// shouldTrack = false，不会触发track
    pauseTracking()
      
    // 3.获取结果
    const res = method.apply(thisArgs, args)
    
    // 4. 恢复track
    // shouldTrack取上一次的状态
    resetTracking()
    return res
  }
})

// 用于控制track函数
let shouldTrack = true
const trackStack = []
// 暂停开关
function pauseTracking() {
  trackStack.push(shouldTrack)
  shouldTrack = false
}
// 重置开关
function resetTracking() {
  const last = trackStack.pop()
  shouldTrack = last === undefined ? true : last
}

let arr = [1, 2, 3]
let proxyArr = createReactiveObject(arr, handlers)
proxyArr.push(4)
proxyArr.pop()
proxyArr.shift()
proxyArr.unshift(5)
proxyArr.splice(2,3,4)
//  -------track-------
//  get:push
//  -------track-------
//  get:pop
//  -------track-------
//  get:shift
//  -------track-------
//  get:unshift
//  -------track-------
//  get:splice
```

#### 浅层响应转换

前面提到，针对多层Object，需要通过递归进行深度代理。但是某些场景中我们希望响应式的对象只需要进行浅层代理。这就需要:

- 改写get函数：
  - 创建一个createGetter函数用来传递参数
  - 使用JS的闭包，缓存shallow，返回get函数
  - get函数内部通过shallow判断是否需要对res再次reactive
- 改写set函数：
  - targetObject为浅层响应，当targetObject内部属性发生变化时并不需要设置新值，

```js
const shallowReactiveHandlers = {
  get(target, key, receiver) {
    // reactiveMap、shallowReactiveMap是weakMap实例，用于映射target与代理实例
    if (receiver === shallowReactiveMap.get(target)) {
      return target
    }

    const res = Reflect.get(target, key, receiver)
	// 不在需要判断res的类型
    return res
  },
  set(target, key, value, receiver, shallow) {
    let oldValue = target[key]
    if (!shallow) {
      value = toRaw(value)
      oldValue = toRaw(oldValue) 
      oldValue.value = value
      return true
    } else {
      // shallow为true，不管targetObject是否是响应式，都不再更新设置oldValue的更新
    }

    const result = Reflect.set(target, key, value, receiver)
    
    if (target === toRaw(receiver)) { 
        trigger(target, TriggerOpTypes.SET, key, value, oldValue)
    }
    return result
  }
}
```

#### 只读响应转换

某些场景中我们希望响应式的对象可读不可更改，我们需要配置一个只进行只读响应转换的handler；

- 当发生修改时，可以在handler中拦截修改操作，如果触发则直接抛出异常。
- 因为targetObject是只读的，也没有必要再对其进行track。在get函数中判断是否需要track

```js
export const readonlyHandlers = {
  get: get(target, key, receiver) {
    // 对target和key做判断
    if (key === ReactiveFlags.IS_REACTIVE) {
      return !isReadonly
    } else if (key === ReactiveFlags.IS_READONLY) {
      return isReadonly
    } else if (
      key === ReactiveFlags.RAW &&
      receiver === readonlyMap.get(target)
    ) {
      return target
    }

    const res = Reflect.get(target, key, receiver)

	// isReadonly 为 true 不再 track
    // 注释掉 track操作：
    /* track(target, TrackOpTypes.GET, key) */ 

    if (isObject(res)) {
      return readonly(res)
    }
    return res
  },
  // 修改操作直接进行警告 或者忽略
  set(target, key) {
    if (__DEV__) {
      console.warn(
        `Set operation on key "${String(key)}" failed: target is readonly.`,
        target
      )
    }
    return true
  },
  deleteProperty(target, key) {
    if (__DEV__) {
      console.warn(
        `Delete operation on key "${String(key)}" failed: target is readonly.`,
        target
      )
    }
    return true
  }
}

```

#### 浅层只读响应转换

同理可知，浅层只读响应转换：

- 不在对targetObject进行深层次的转换
- 拦截修改操作，直接给出警告或者忽略

上代码：

```js
const shallowReadonlyHandlers = {
    get: (target, key, receiver) {
    if (key === ReactiveFlags.IS_REACTIVE) {
      return !isReadonly
    } else if (key === ReactiveFlags.IS_READONLY) {
      return isReadonly
    } else if (
      key === ReactiveFlags.RAW &&
      receiver === shallowReadonlyMap.get(target)
    ) {
      return target
    }

    const res = Reflect.get(target, key, receiver)

   	return res
  },
  set(target, key) {
    if (__DEV__) {
      console.warn(
        `Set operation on key "${String(key)}" failed: target is readonly.`,
        target
      )
    }
    return true
  },
  deleteProperty(target, key) {
    if (__DEV__) {
      console.warn(
        `Delete operation on key "${String(key)}" failed: target is readonly.`,
        target
      )
    }
    return true
  }
}
```

#### 整理重构

回看上面的代码，我们发现代码中存在大量的重复冗余的操作，非常有必要对其进行整理：

- 各个handler中，配置的函数相同，只不过可能以为涉及到需求的原因，方法内部做了逻辑修改
- 方法中代码存在重复：get函数、set函数中代码存在多处重复的代码
  - get函数的主要功能就是获取value，进行track
  - set函数的主要功能就是设置value，进行trigger
  - 没必要每个handler都把两个函数的核心作用进行重复

重构方法：

- 通过createGetter、createSetter函数创建get、set函数，利用闭包，通过传参获取不同属性的函数
- 利用创建出的不同方法组合handler

```js
// 用于处理target与proxy之间的映射
const reactiveMap = new WeakMap()
const shallowReactiveMap = new WeakMap()
const readonlyMap = new WeakMap()
const shallowReadonlyMap = new WeakMap()

const get = createGetter()
const shallowGet = createGetter(false, true)
const readonlyGet = createGetter(true)
const shallowReadonlyGet = createGetter(true, true)

function createGetter(isReadonly = false, shallow = false) {
    
  return function get(target, key , receiver) {
 
    if (key === ReactiveFlags.IS_REACTIVE) {
      return !isReadonly
    } else if (key === ReactiveFlags.IS_READONLY) {
      return isReadonly
    } else if (
      key === ReactiveFlags.RAW &&
      receiver ===
        (isReadonly
          ? shallow
            ? shallowReadonlyMap
            : readonlyMap
          : shallow
            ? shallowReactiveMap
            : reactiveMap
        ).get(target)
    ) {
      return target
    }

    const res = Reflect.get(target, key, receiver)

    if (!isReadonly) {
      track(target, TrackOpTypes.GET, key)
    }

    if (shallow) {
      return res
    }

    if (isObject(res)) {
      return isReadonly ? readonly(res) : reactive(res)
    }

    return res
  }
}

const set = createSetter()
const shallowSet = createSetter(true)

function createSetter(shallow = false) {
  return function set(target, key, value, receiver) {
    let oldValue = target[key]
    if (!shallow) {
      value = toRaw(value)
      oldValue = toRaw(oldValue)
      if (!isArray(target)) {
        oldValue.value = value
        return true
      }
    } else {
      // shallow为true，不管targetObject是否是响应式，都不再更新设置oldValue的更新
      
    }

    const result = Reflect.set(target, key, value, receiver)
   
   if (hasChanged(value, oldValue)) {
      // 判断value是否发生变化，再进行track
      trigger(target, TriggerOpTypes.SET, key, value, oldValue)
   }
      
    return result
  }
}

function deleteProperty(target, key) {
  const hadKey = hasOwn(target, key)
  const oldValue = target[key]
  const result = Reflect.deleteProperty(target, key)
  if (result && hadKey) {
    trigger(target, TriggerOpTypes.DELETE, key, undefined, oldValue)
  }
  return result
}

function has(target, key) {
  const result = Reflect.has(target, key)
  track(target, TrackOpTypes.HAS, key)

  return result
}

function ownKeys(target) {
  track(target, TrackOpTypes.ITERATE, isArray(target) ? 'length' : ITERATE_KEY)
  return Reflect.ownKeys(target)
}

// 组合目标 Handler
export const mutableHandlers = {
  get,
  set,
  deleteProperty,
  has,
  ownKeys
}

const readonlyHandlers = {
  get: readonlyGet,
  set(target, key) {
    if (__DEV__) {
      console.warn(
        `Set operation on key "${String(key)}" failed: target is readonly.`,
        target
      )
    }
    return true
  },
  deleteProperty(target, key) {
    if (__DEV__) {
      console.warn(
        `Delete operation on key "${String(key)}" failed: target is readonly.`,
        target
      )
    }
    return true
  }
}

const shallowReactiveHandlers= extend(
  {},
  mutableHandlers,
  {
    get: shallowGet,
    set: shallowSet
  }
)

const shallowReadonlyHandlers = extend(
  {},
  readonlyHandlers,
  {
    get: shallowReadonlyGet
  }
)
```

### Map&Set的变化侦测

前面我们学习了Object & Array的handler的配置及各个方法的实现。同样的逻辑，也适用于Map、Set类型的数据：

- 拆分处理各个method
- 根据需要配置handler

#### 经过代理的Map、Set实例

直接上代码，让我们看下map、set经过proxy代理后，在进行操作会发生什么事情？

**经过代理的map**

```js
let map = new Map([[1, 2], [3, 4], [5, 6]]);
let mapHandler = {
  get(target, key, receiver) {
     console.log(`key: ${key}`) // 进行 for of 遍历时需要注释掉
    if(key === "size") {
      return Reflect.get(target, "size", target)
    }
    var value = Reflect.get(target, key, receiver)
    // 查看 value 类型
    console.log(typeof value)
      
    // 注意：这里需要注意改变value的this指向
    return typeof value == 'function' ? value.bind(target) : value
  },
  set(target, key, value, receiver) {
    console.log(`set ${key} : ${value}`)
    return Reflect.set(target, key, value, receiver)
  }
}
let proxyMap = new Proxy(map, mapHandler);
// size 属性
console.log(proxyMap.size) 
// 输出:
// key: size  
// 3

// get 方法
console.log(proxyMap.get(1))
// 输出:
// key: get
// value: function
// 2

// set 方法
console.log(proxyMap.set('name', 'daRui')) 
// 输出:
// key: set  
// value: function  
// {1 => 2, 3 => 4, 5 => 6, "name" => "daRui"}

// has 方法
console.log(proxyMap.has('name'))
// 输出：
// key: has
// value: function
// true

// delete
console.log(proxyMap.delete(1))
// 输出:
// key: delete
// value: function
// true

// keys 方法
console.log(proxyMap.keys())
// 输出
// key: keys
// value: function
// MapIterator {3, 5, "name"}

// values 方法
console.log(proxyMap.values())
// 输出
// key: values
// value: function
// MapIterator {4, 6, "daRui"}

// entries 方法
console.log(proxyMap.entries())

// forEach
proxyMap.forEach(item => {
  console.log(item)
});
// 输出
// key: entries
// value: function
// MapIterator {3 => 4, 5 => 6, "name" => "daRui"}
// key: forEach
// value: function
// 4
// 6
// daRui

// 相当于entries()
// 需要注释 console, 否则抛出 Uncaught TypeError: Cannot convert a Symbol value to a string
for(let [key, value] of proxyMap) {
  console.log(key, value)
}
// 输出
// 3, 4
// 5, 6
// "name", "daRui"
```

**经过代理的set**

```js
let set = new Set([1, 2, 3, 4, 5])
let setHandler = {
  get(target, key, value, receiver) {
    if (key === 'size') {
      return Reflect.get(target, 'size', target)
    }
    console.log(`key: ${key}`)
    var value = Reflect.get(target, key, receiver)
    console.log(`value: ${typeof value}`)
    return typeof value == 'function' ? value.bind(target) : 
  },
  set(target, key, value, receiver) {
    console.log(`set ${key} : ${value}`)
    return Reflect.set(target, key, value, receiver)
  },
}
let proxySet = new Proxy(set, setHandler)

// add
console.log(proxySet.add('name', 'daRui'))
// 输出
// key: add
// value: function 
// true
// 6

// has
console.log(proxySet.has('name'))
// 输出
// key: has
// value: function
// true
      
// size
console.log(proxySet.size)
// 输出
// key: size
// 6

// delete
console.log(proxySet.delete(1))
// 输出
// key: delete
// value: function
// true

// keys
console.log(proxySet.keys())
// 输出
// key: keys
// value: function
// SetIterator {2, 3, 4, 5, "name"}

// values
console.log(proxySet.values())
// 输出
// key: values
// value: function
// SetIterator {2, 3, 4, 5, "name"}

// entries
console.log(proxySet.entries())
// 输出
// key: entries
// value: function
// SetIterator {2 => 2, 3 => 3, 4 => 4, 5 => 5, "name" => "name"}
      
// 相当于entries
proxySet.forEach((item) => {
  console.log(item)
})
// 输出
// key: forEach
// value: function
// 2
// 3
// 4
// 5
// name

for (let value of proxySet) {
  console.log(value)
}
// 输出
// value: function
// 2
// 3
// 4
// 5
// name

// clear
console.log(proxySet.clear())
// 输出
// key: clear
// value: function
```

- 出现上面输出结果是因为proxy代理的是Map、Set的实例
- 我们调用的是实例上的方法，就会触发访问方法的getter函数
- 故Map & Set类型的targetObject，不能使用与Object & Array相同的handler
- 需要为Map & Set创建方法，并配置handler

#### 增删改查

- map & set类型需配置的handler与Object & Array相同：响应式、浅层、只读、浅层只读
- 实例方法都需要独立处理
- 设计思路
  - 因为实例方法都是先触发方法访问的getter函数
  - 所以配置的handler对象只需有一个getter函数
  - 在get函数内部拦截方法
  - 在方法内部做track/trigger工作
  - 通过map/set的原始方法去获取value，并返回

前置知识补充：

- Vue3会为每个被转换的对象，设置一个`ReactiveFlags.RAW`属性
- 值是原始targetObject
- toRaw函数
  - 返回 [`reactive`](https://v3.cn.vuejs.org/api/basic-reactivity.html#reactive) 或 [`readonly`](https://v3.cn.vuejs.org/api/basic-reactivity.html#readonly) 代理的原始targetObject
  - 可用于临时读取数据而无需承担代理访问/跟踪的开销
  - 也可用于写入数据而避免触发更改
  - 原理：通过递归，脱proxy，找到原始值

```js 
function toRaw(observed) {
  return (
    (observed && toRaw((observed)[ReactiveFlags.RAW])) || observed
  )
}
```

- 配置不同的handler，就去要用相应的响应转换函数处理result
- 可以根据参数类型获去相应的转换函数

```js
const toReactive = (value ) => isObject(value) ? reactive(value) : value

const toReadonly = (value) => isObject(value) ? readonly(value) : value

const toShallow = (value) => value
// 获取原型
const getProto = (v) => Reflect.getPrototypeOf(v)
```

> 这里我们直接讲解Vue3 reactive中的源码部分，当然代码是经过省略的，但是会保留核心逻辑。
>
> 先理解主要思路，在关注细节。

- get函数
  - 用于Map实例根据key获取value
  - map类型的key可以是引用类型，也可能是代理实例
  - target & key都需要进行toRaw操作
  - 需要根须参数判断是否需要进行track，收集相关依赖
  - 需要调用原始target的 get方法获取value
  - 最后需要返回经过代理的value

```js
function get(target, key, isReadonly = false,isShallow = false) {
  // 获取原始对象，原始key
  target = target[ReactiveFlags.RAW]
  const rawTarget = toRaw(target)
  const rawKey = toRaw(key)
  
  /**
  * 我自己通过 looseEqual函数 对比了 target[ReactiveFlags.RAW] 与 rawTarget。
  * 返回true，两者没有区别。但是我并不明白尤大为什么这么设计，望大佬指教
  */
  
  // key 发生变化, track key
  if (key !== rawKey) {
    !isReadonly && track(rawTarget, TrackOpTypes.GET, key)
  }
    
  // track rawKey
  !isReadonly && track(rawTarget, TrackOpTypes.GET, rawKey)
  const { has } = getProto(rawTarget)
  
  // 根据参数获取对应的转换函数
  const wrap = isShallow ? toShallow : isReadonly ? toReadonly : toReactive
  
  // 返回经过代理的结果
  if (has.call(rawTarget, key)) {
    return wrap(target.get(key))
  } else if (has.call(rawTarget, rawKey)) {
    return wrap(target.get(rawKey))
  } else if (target !== rawTarget) {
    target.get(key)
  }
}

```

- set函数
  - 用于Map类型添加元素
  - map类型添加元素，有可能是新增key:value，有可能是修改
  - 需要对key是否存在进行判断
  - set函数会修改target，需要进行trigger，触发响应

```js
function set(this, key, value) {
  // 脱proxy，获取原始value & target
  value = toRaw(value)
  const target = toRaw(this)
  const { has, get } = getProto(target)
  
  // 判断 key是否存在于target
  let hadKey = has.call(target, key)
  if (!hadKey) {
    key = toRaw(key)
    hadKey = has.call(target, key)
  }
    
  // 获取旧值
  const oldValue = get.call(target, key)
  
  // 设置 key: vlaue
  target.set(key, value)
    
  // 调用trigger，触发响应
  if (!hadKey) {
      
    // 先前没有key，进行的是添加操作
    trigger(target, TriggerOpTypes.ADD, key, value)
  } else if (hasChanged(value, oldValue)) {
      
    // 先前存在key，进行的是设置操作
    trigger(target, TriggerOpTypes.SET, key, value, oldValue)
  }
  return this
}
```

- has函数
  - 可用于Set/Map实例判断某元素是否存在
  - has属性并不会更改targetObject，
  - 属于对target的访问操作
  - 需要对key进行track操作

```js

function has(this, key, isReadonly = false) {
  // 获取原始target key
  const target = (this)[ReactiveFlags.RAW]
  const rawTarget = toRaw(target)
  const rawKey = toRaw(key)
  
  // 根据判断进行track
  if (key !== rawKey) {
    !isReadonly && track(rawTarget, TrackOpTypes.HAS, key)
  }
  !isReadonly && track(rawTarget, TrackOpTypes.HAS, rawKey)
  
  // 调用原始target的has方法判断key是否存在
  return key === rawKey
    ? target.has(key)
    : target.has(key) || target.has(rawKey)
}
```

- add函数
  - 用于Set实例添加元素，添加的元素唯一
  - 如果添加的value先前不存在，则会使target发生更改，需要进行trigger操作，触发响应

```js
function add(this, value) {
  // 获取原始对象
  value = toRaw(value)
  const target = toRaw(this)
  
  // 获取原型，调用原型上的方法判断value是否存在
  // 因为set添加的value都是唯一的
  // 故只有 key 不存在的时候需要 trigger
  const proto = getProto(target)
  const hadKey = proto.has.call(target, value)
  if (!hadKey) {
    // 添加元素，调用trigger函数，触发响应
    target.add(value)
    trigger(target, TriggerOpTypes.ADD, value, value)
  }
  return this
}

```

- size属性
  - 用于返回Set/Map的成员总数
  - 不会触发target的变化
  - 但是需要进行track

```js
function size(target, isReadonly = false) {
  // 获取原始target
  target = target[ReactiveFlags.RAW]
  // 如果非只读 则进行track
  !isReadonly && track(toRaw(target), TrackOpTypes.ITERATE, ITERATE_KEY)
  // 返回结果
  return Reflect.get(target, 'size', target)
}
```

- clear函数
  - 用于清除Set/Map实例的所有成员
  - 会改变target，需要调用trigger函数

```js
function clear(this) {
  // 获取原始对象
  const target = toRaw(this)
  const hadItems = target.size !== 0
  const oldTarget = __DEV__
    ? isMap(target)
      ? new Map(target)
      : new Set(target)
    : undefined
  // 在触发响应之前调用clear
  const result = target.clear()
  if (hadItems) {
    // 如果原始对象不为空，则需要trigger
    trigger(target, TriggerOpTypes.CLEAR, undefined, undefined, oldTarget)
  }
  return result
}
```

- delete函数
  - 用于删除Set/Map实例的某个成员
  - 会更改原始target，需要trigger

```js
function deleteEntry(this, key) {
    
  // 获取原始target
  const target = toRaw(this)
  const { has, get } = getProto(target)
  
  // 判断key 或者 原始key是否存在
  let hadKey = has.call(target, key)
  if (!hadKey) {
    key = toRaw(key)
    hadKey = has.call(target, key)
  } 
    
  // 获取原始值
  const oldValue = get ? get.call(target, key) : undefined
  
  // 获取执行结果 
  const result = target.delete(key)
  if (hadKey) {
      
    // 如果成员先前存在，则trigger
    trigger(target, TriggerOpTypes.DELETE, key, undefined, oldValue)
  }
  return result
}
```



#### 遍历模式&迭代模式

- forEach函数
  - 属于设计模式中的遍历器模式
  - 用于遍历Set/Map实例，接受一个回调，会将key & value 传给callback
  - 针对不同的响应接口，我们根据判断创建forEach
  - 我们可以通过参数isReadonly, isShallow获取不同的forEach
  - forEach函数并不会更改原始对象，只需进行track工作

```js
function createForEach(isReadonly, isShallow) {
  return function forEach(this,callback,thisArg) {
    const observed = this
    // 获取原始target
    const target = observed[ReactiveFlags.RAW]
    const rawTarget = toRaw(target)
    
    // 根据参数获取响应转换函数
    const wrap = isShallow ? toShallow : isReadonly ? toReadonly : toReactive
    
    // 非只读情况下 进行track
    !isReadonly && track(rawTarget, TrackOpTypes.ITERATE, ITERATE_KEY)
    
    // 调用原始对象上的forEach 方法，将value & key传给回调
    return target.forEach((value, key) => {
        
      // 传递value & key时进行转换
      return callback.call(thisArg, wrap(value), wrap(key), observed)
    })
  }
}
```

- iterable迭代器模式
  - Map/Set的实例有三种方法：keys()、values()、entries()
  - 这三种方法都遵循可迭代协议 & 可迭代器协议
  - Vue3内部同样对这三个方法做了处理
  - 通过自行实现迭代器，模拟这三个方法
  - 在创建的迭代器内部，通过调用原始对象的方法获取result
  - 进行track，并对result进行响应处理
  - 最后在返回的可迭代对象中，返回经过响应转换的result
  - 下面代码的注释中已经标识出主要逻辑

```js
function createIterableMethod(method, isReadonly, isShallow) {
  return function(this, ...args) {
      
    // 获取原始对象
    const target = (this)[ReactiveFlags.RAW]
    const rawTarget = toRaw(target)
    
    // 判断原始对象是否是Map类型
    const targetIsMap = isMap(rawTarget)
    
    // entries() 返回的是一个可迭代的二维数组
    const isPair =
      method === 'entries' || (method === Symbol.iterator && targetIsMap)
    
    const isKeyOnly = method === 'keys' && targetIsMap
    
    // 获取原始对象方法返回的内部迭代器
    const innerIterator = target[method](...args)
    
    // 根据参数获取相应的转换函数
    const wrap = isShallow ? toShallow : isReadonly ? toReadonly : toReactive
    
    // 非只读情况下，进行track
    !isReadonly &&
      track(rawTarget, 
            TrackOpTypes.ITERATE, 
            isKeyOnly ? MAP_KEY_ITERATE_KEY : ITERATE_KEY 
           )
    
 	// 返回一个可迭代对象
    return {
      // 遵循可迭代器协议
      next() {
        // 调用内部可迭代器获取结果
        const { value, done } = innerIterator.next()
        return done
          ? { value, done }
          : {
              // 对value进行响应式转换
              value: isPair ? [wrap(value[0]), wrap(value[1])] : wrap(value),
              done
            }
      },
      // 遵循可迭代协议
      [Symbol.iterator]() {
        return this
      }
    }
  }
}

const iteratorMethods = ['keys', 'values', 'entries', Symbol.iterator]
// 遍历添加方法
iteratorMethods.forEach(method => {
  mutableInstrumentations[method] = createIterableMethod(
    method,
    false,
    false
  )
  readonlyInstrumentations[method] = createIterableMethod(
    method,
    true,
    false
  )
  shallowInstrumentations[method] = createIterableMethod(
    method,
    false,
    true
  )
  shallowReadonlyInstrumentations[method] = createIterableMethod(
    method,
    true,
    true
  )
})
```

> 对迭代器或者可迭代协议感兴趣的同学可以点击下面链接
>
> 迭代器协议：https://developer.mozilla.org/zh-CN/docs/Web/JavaScript/Reference/Iteration_protocols
>
> 迭代器：https://developer.mozilla.org/zh-CN/docs/Web/JavaScript/Guide/Iterators_and_Generators
>
> 迭代器：https://es6.ruanyifeng.com/#docs/iterator

#### 创建Handler

上面我们已经明白了各种方法的创建工作，接下来就是做类似Object & Array类型相同的工作——配置出不同的handler。

```js
// 对于只读情况下会触发更改的操作，我们统一使用createReadonlyMethod方法创建
function createReadonlyMethod(type) {
  return function(this, ...args) {
    if (__DEV__) {
      const key = args[0] ? `on key "${args[0]}" ` : ``
      console.warn(
        `${capitalize(type)} operation ${key}failed: target is readonly.`,
        toRaw(this)
      )
    }
    return type === TriggerOpTypes.DELETE ? false : this
  }
}

const mutableInstrumentations = {
  get(this, key) {
    return get(this, key)
  },
  get size() {
    return size(this)
  },
  has,
  add,
  set,
  delete: deleteEntry,
  clear,
  forEach: createForEach(false, false)
}

const shallowInstrumentations = {
  get(this, key) {
    return get(this, key, false, true)
  },
  get size() {
    return size(this)
  },
  has,
  add,
  set,
  delete: deleteEntry,
  clear,
  forEach: createForEach(false, true)
}

const readonlyInstrumentations = {
  get(this, key) {
    return get(this, key, true)
  },
  get size() {
    return size(this, true)
  },
  has(this, key) {
    return has.call(this, key, true)
  },
  add: createReadonlyMethod(TriggerOpTypes.ADD),
  set: createReadonlyMethod(TriggerOpTypes.SET),
  delete: createReadonlyMethod(TriggerOpTypes.DELETE),
  clear: createReadonlyMethod(TriggerOpTypes.CLEAR),
  forEach: createForEach(true, false)
}

const shallowReadonlyInstrumentations = {
  get(this, key) {
    return get(this, key, true, true)
  },
  get size() {
    return size((this, true)
  },
  has(this, key) {
    return has.call(this, key, true)
  },
  add: createReadonlyMethod(TriggerOpTypes.ADD),
  set: createReadonlyMethod(TriggerOpTypes.SET),
  delete: createReadonlyMethod(TriggerOpTypes.DELETE),
  clear: createReadonlyMethod(TriggerOpTypes.CLEAR),
  forEach: createForEach(true, true)
}

const iteratorMethods = ['keys', 'values', 'entries', Symbol.iterator]
iteratorMethods.forEach(method => {
  mutableInstrumentations[method] = createIterableMethod(
    method,
    false,
    false
  )
  readonlyInstrumentations[method] = createIterableMethod(
    method,
    true,
    false
  )
  shallowInstrumentations[method] = createIterableMethod(
    method,
    false,
    true
  )
  shallowReadonlyInstrumentations[method] = createIterableMethod(
    method,
    true,
    true
  )
})
// 创建getter函数
function createInstrumentationGetter(isReadonly, shallow) {
  const instrumentations = shallow
    ? isReadonly
      ? shallowReadonlyInstrumentations
      : shallowInstrumentations
    : isReadonly
      ? readonlyInstrumentations
      : mutableInstrumentations
  
  // get函数
  return (target, key, receiver) => {
    if (key === ReactiveFlags.IS_REACTIVE) {
      return !isReadonly
    } else if (key === ReactiveFlags.IS_READONLY) {
      return isReadonly
    } else if (key === ReactiveFlags.RAW) {
      return target
    }
    
    // 注意这里给Reflect.get传递的第一个参数
    // instrumentations 是我们创建的 【仪表盘】(一翻译出来就变味了~)
    // instrumentations方法中传递参数中的 this 就是调用get函数时的上下文
    return Reflect.get(
      hasOwn(instrumentations, key) && key in target
        ? instrumentations
        : target,
      key,
      receiver
    )
  }
}

// 配置Handler
const mutableCollectionHandlers = {
  get: createInstrumentationGetter(false, false)
}

const shallowCollectionHandlers = {
  get: createInstrumentationGetter(false, true)
}

const readonlyCollectionHandlers = {
  get: createInstrumentationGetter(true, false)
}

const shallowReadonlyCollectionHandlers = {
  get: createInstrumentationGetter(true, true)
}


```

最后再用两张图让我们总结下上面的过程吧！

**baseHandlers**：

![baseHandlers](D:\vue3深入浅出\docs\.vuepress\public\img\baseHandlers.png)

**collectionHandlers**：

![collectionHandlers](D:\vue3深入浅出\docs\.vuepress\public\img\collectionHandlers (1).png)

## API实现原理

### `reactive`

前面我们已经知道如何配置Handler接下来要创建不同的响应转换函数，创建函数其实就是给Proxy，配置不同的handler。让我们改写下在第一章节中代理模式中提到的createReactiveObject函数：

**第一章节写的响应函数**

```js
// 响应转换函数
function createReactiveObject(target, handlers, proxyMap) {
    
   // 1. 仅代理对象类型
  if (!isObject(target)) {
    if (__DEV__) {
      console.warn(`value cannot be made reactive: ${String(target)}`)
    }
    return target
  }
 
  // 2. 判断target是否已经经过代理
  const existingProxy = proxyMap.get(target)
  if (existingProxy) {
    return existingProxy
  }
  // 3. 进行代理转换
  const proxy = new Proxy(target,  handlers)
  
  // 4. 创建target与代理实例之间的映射，方便下次进行判断
  proxyMap.set(target, proxy)
    
  // 5.返回代理实例
  return proxy
}
```

**改写`createReactiveObject`**：

- 将handlers作为参数传递给函数
- 在内部通过判断target的类型，配置handlers

```js

function createReactiveObject(target, isReadonly, baseHandlers, collectionHandlers, proxyMap ) {
  if (!isObject(target)) {
    if (__DEV__) {
      console.warn(`value cannot be made reactive: ${String(target)}`)
    }
    return target
  }
    
  // 如果target已经经过代理直接返回
  // 经过readonly()转换的targetObject例外
  if (
    target[ReactiveFlags.RAW] &&
    !(isReadonly && target[ReactiveFlags.IS_REACTIVE])
  ) {
    return target
  }
    
  // 如果target已经有相应的代理 直接返回
  const existingProxy = proxyMap.get(target)
  if (existingProxy) {
    return existingProxy
  }
    
  // 只有在白名单内的 targetType 可以经过代理
  const targetType = getTargetType(target)
  if (targetType === TargetType.INVALID) {
    return target
  }
    
  // 根据targetType 给Proxy传不同的handler
  // Map & Set类型传collectionHandlers
  // Object & Array类型传 baseHandlers
  const proxy = new Proxy(
    target,
    targetType === TargetType.COLLECTION ? collectionHandlers : baseHandlers
  )
  
  // 保存target 与 proxy之间的关系，方便下次判断
  proxyMap.set(target, proxy)
  return proxy
}
```

#### `reactive`

- 返回对象的响应式副本
- 对target进行“深层”代理，影响所有嵌套 property

```js
function reactive(target) {
  // 如果target是只读的，直接返回target
  if (target && (target)[ReactiveFlags.IS_READONLY]) {
    return target
  }
  return createReactiveObject(
    target,
    false,
    mutableHandlers,
    mutableCollectionHandlers,
    reactiveMap
  )
}
```

#### `shallowReactive`

- 创建一个响应式代理，只跟踪其自身 property 的响应性
- 但不执行嵌套对象的深层响应式转换

```js
function shallowReactive(target) {
  return createReactiveObject(
    target,
    false,
    shallowReactiveHandlers,
    shallowCollectionHandlers,
    shallowReactiveMap
  )
}
```

#### `readonly`

- 接受一个对象 (响应式或纯对象) 或 [ref](https://v3.cn.vuejs.org/api/refs-api.html#ref) 并返回原始对象的只读代理。
- 只读代理是深层的：任何被访问的嵌套 property 也是只读的。

```js
function readonly(target) {
  return createReactiveObject(
    target,
    true,
    readonlyHandlers,
    readonlyCollectionHandlers,
    readonlyMap
  )
}
```



#### `shallowReadonly`

- 创建一个 proxy，使其自身的 property 为只读
- 但不执行嵌套对象的深度只读转换

```js
export function shallowReadonly(target) {
  return createReactiveObject(
    target,
    true,
    shallowReadonlyHandlers,
    shallowReadonlyCollectionHandlers,
    shallowReadonlyMap
  )
}
```

#### `isReactive`

- 检查对象是否是由 [`reactive`](https://v3.cn.vuejs.org/api/basic-reactivity.html#reactive) 创建的响应式代理
- 可以在observed阶段给target设置一个`[ReactiveFlags.RAW]/[ReactiveFlags.IS_REACTIVE]`属性

```js
function isReactive(value) {
  if (isReadonly(value)) {
    return isReactive((value)[ReactiveFlags.RAW])
  }
  return !!(value && (value)[ReactiveFlags.IS_REACTIVE])
}
```

#### `isReadonly`

- 检查对象是否是由 [`readonly`](https://v3.cn.vuejs.org/api/basic-reactivity.html#readonly) 创建的只读代理。
- 原理同上

```
function isReadonly(value) {
  return !!(value && (value)[ReactiveFlags.IS_READONLY])
}
```

#### `isProxy`

- 检查对象是否是由 [`reactive`](https://v3.cn.vuejs.org/api/basic-reactivity.html#reactive) 或 [`readonly`](https://v3.cn.vuejs.org/api/basic-reactivity.html#readonly) 创建的 proxy
- 内部其实是调用isReactive | isReadonly 方法进行的判断

```js
function isProxy(value: unknown): boolean {
  return isReactive(value) || isReadonly(value)
}
```

#### `toRaw`

- 前面已经说过，不再赘述

#### `markRaw`

- 标记一个对象，使其永远不会转换为 proxy。[返回对象本身](https://v3.cn.vuejs.org/api/basic-reactivity.html#markraw)。
- 原理：给value定义一个ReactiveFlags.SKIP属性并设置值为true
- 在reactive时对该属性进行判断

```js
function markRaw (value) {
  def(value, ReactiveFlags.SKIP, true)
  return value
}
```

### `ref`

学习Vue3时，有一个疑问：已经有一个reactive函数了，为什么还有搞一个ref呢？后来看了源码才明白部分原由。

在reactive中，我们并不能转换基础类型，只能对对象类型进行代理。而要如何实现对基础类型的代理呢？

创建一个Ref Class。通过类实例来实现get & set 的拦截操作。

> ref可以用于原始类型也能用于对象类型的转换，ref弥补reactive基础类型的转换应该是部分原因，尤大应该有其他跟高层次的考虑和设计。只是我暂时看不到呢~

Ref Class的实现原理并不复杂，我们可以直接看下其源码：

```js
// 通过判断value进行转换
const convert = (val) => isObject(val) ? reactive(val) : val

// Ref 类
class RefImpl {
  private _value:

  public readonly __v_isRef = true

  constructor(private _rawValue, public readonly _shallow) {
      
    // shallow为true，不对value进行转换
    this._value = _shallow ? _rawValue : convert(_rawValue)
  }

  // get的时候进行track
  get value() {
    track(toRaw(this), TrackOpTypes.GET, 'value')
    return this._value
  }

  // set的时候进行trigger
  set value(newVal) {
    if (hasChanged(toRaw(newVal), this._rawValue)) {
        
      // 新旧值不同时，进行trigger
      this._rawValue = newVal
      this._value = this._shallow ? newVal : convert(newVal)
        
      // 触发响应
      trigger(toRaw(this), TriggerOpTypes.SET, 'value', newVal)
    }
  }
}

// 工厂函数 用于创建ref实例
function createRef(rawValue, shallow = false) {
  if (isRef(rawValue)) {
    return rawValue
  }
  return new RefImpl(rawValue, shallow)
}
```

有了createRef函数，接下来就是创建API了

#### `ref`

- 接受一个value并返回一个响应式且可变的 ref 对象。
- ref 对象具有指向内部值的单个 property `.value`

```js
function ref(value) {
  return createRef(value)
}
```



#### `shallowRef`

- 创建一个跟踪自身 `.value` 变化的 ref，但不会使其值也变成响应式的。

```js
function shallowRef(value) {
  return createRef(value, true)
}
```

#### `isRef`

- 判断value是否为ref对象
- 注意上面我们在RefImpl Class中设置的一个只读属性 `__v_isRef`

```js
function isRef(r) {
  return Boolean(r && r.__v_isRef === true)
}
```

#### `toRef`

- 为源响应式对象上的某个 property 新创建一个 [`ref`](https://v3.cn.vuejs.org/api/refs-api.html#ref)
- 当需要将 prop 的 ref 传递给复合函数时，`toRef` 很有用

```js
class ObjectRefImpl {
  public readonly __v_isRef = true

  constructor(private readonly _object, private readonly _key) {}

  get value() {
    return this._object[this._key]
  }

  set value(newVal) {
    this._object[this._key] = newVal
  }
}

function toRef(object,key) {
  return isRef(object[key])
    ? object[key]
    : (new ObjectRefImpl(object, key))
}
```

#### `toRefs`

- 将响应式对象转换为普通对象，其中结果对象的每个 property 都是指向原始对象相应 property 的 [`ref`](https://v3.cn.vuejs.org/api/refs-api.html#ref)。
- 当从组合式函数返回响应式对象时，对响应式对象进行解构非常有用
- 原理：遍历响应式对象，调用toRef转换每一对key:value

```js
function toRefs {
  if (__DEV__ && !isProxy(object)) {
    console.warn(`toRefs() expects a reactive object but received a plain one.`)
  }
  const ret: any = isArray(object) ? new Array(object.length) : {}
  for (const key in object) {
    ret[key] = toRef(object, key)
  }
  return ret
}
```

#### `customRef`

- 创建一个自定义的 ref，并对其依赖项跟踪和更新触发进行显式控制。
- 需要一个工厂函数作为参数，该函数接收 `track` 和 `trigger` 函数作为参数
- 并且应该返回一个带有 `get` 和 `set` 的对象

```js
class CustomRefImpl {
  private readonly _get: ['get']
  private readonly _set: ['set']

  public readonly __v_isRef = true

  constructor(factory) {
    // 给工厂函数传 track函数 & trigger函数
    // 获取返回的 get set函数
    const { get, set } = factory(
      () => track(this, TrackOpTypes.GET, 'value'),
      () => trigger(this, TriggerOpTypes.SET, 'value')
    )
    this._get = get
    this._set = set
  }

  get value() {
    return this._get()
  }

  set value(newVal) {
    this._set(newVal)
  }
}
```

> 题外话：当我看了这段代码的设计，感觉真是太巧妙了

**API实现**：

```js
function customRef(factory){
  return new CustomRefImpl(factory)
}
```

#### `triggerRef`

- 手动执行与 [`shallowRef`](https://v3.cn.vuejs.org/api/refs-api.html#shallowref) 关联的任何作用 (effect)
- 内部其实就是进行手动trigger

```js
function triggerRef(ref) {
  trigger(toRaw(ref), TriggerOpTypes.SET, 'value', __DEV__ ? ref.value : void 0)
}
```

![Ref](D:\vue3深入浅出\docs\.vuepress\public\img\Ref.png)

### 再谈`effect`（重要！！！）

前面在讲变化侦测的时候，我们简单说了一下effect函数。但是并没有对effect在整个响应中的执行流程进行解析。这次一定要补上，因为如果不同effect的执行过程，就很难理解computed的原理。

在vue3中会有四种级别的effect：

- 负责渲染更新的`componentEffect`
- 负责处理watch的watchEffect
- 负责处理computed的`computedEffect`
- 用户自己使用effect API时创建的effct

这次我们主要说`setupRenderEffect`、`computedEffect`。

这里先展示一段代码：

```html
<div id="app">
  <input :value="input" @input="update" />
  <div>{{output}}</div>
</div>

<script>
const { ref, computed, effect } = Vue

Vue.createApp({
  setup() {
    const input = ref(0)
    const output = computed(function computedEffect() { return input.value + 5})
    
    // 会触发 computedEffect & 下面的effect重新执行
    const update = _.debounce(e => { input.value = e.target.value*1 }, 50)
    
	effect(function callback() {
        // 依赖收集
        console.log(input.value)
    })
    return {
      input,
      output,
      update
    }
  }
}).mount('#app')
</script>

```

在浏览器中，从上面的模板代码到渲染至可以进行响应交互的页面，Vue大概会做一下几件事：

- 执行setup函数，将state转为响应式，并将结果挂载至组件实例上
- 对模板进行compiler，并渲染至视图
- 在compile过程中，会**读取响应式数据**，读取的过程就会触发**getter**函数，就会进行**依赖收集**工作
- 当在表单中输入数据，就会触发update事件，更改input，更改的过程就会触发**setter**函数，就会进行**响应更新**

接着我们直接看下简版源码中是如何设计trigger函数的：

- trigger函数主要是获取与target关联的所有effect
- 将需要遍历的effect，添加到将要进行遍历的set集合（会去重）
- 遍历set，执行所有effect，触发响应。
- 结合示例代码：
  - 当用于在input框进行输入的时候，
  - 会执行update函数，对input进行更改
  - 触发trigger，收集所有与input相关的effects，遍历执行effects
  - 这个时候就会执行componentEffect、computedEffect、用户自定义的effect

```js	
function trigger (target, type, key, newValue, oldValue, oldTarget) {
    const depsMap = targetMap.get (target);
    
    // 没有相关依赖直接 返回
    if (!depsMap) { 
      return;
    }
    const effects = new Set ();
    
    // 添加需要遍历的 effect
    const add = effectsToAdd => { 
      if (effectsToAdd) {
        effectsToAdd.forEach (effect => {
          if (effect !== activeEffect || effect.allowRecurse) {
            effects.add(effect);
          }
        });
      }
    };
    
    if (key !== void 0) {
       add (depsMap.get (key));
    } 
    
    // 遍历的回调函数
    const run = effect => {
      if (effect.options.scheduler) {
        effect.options.scheduler (effect);
      } else {
          
        // 执行effect函数
        // 就会执行创建effect函数时传递的fn函数
        effect();
      }
    };
    
    effects.forEach (run);
  }

function track (target, type, key) {
    if (!shouldTrack || activeEffect === undefined) {
      return;
    }
    let depsMap = targetMap.get (target);
    if (!depsMap) {
      targetMap.set (target, (depsMap = new Map ()));
    }
    let dep = depsMap.get (key);
    if (!dep) {
      depsMap.set (key, (dep = new Set ()));
    }
    // 维护effect与dep的关系
    if (!dep.has (activeEffect)) {
      dep.add (activeEffect);
      activeEffect.deps.push (dep);
      if (activeEffect.options.onTrack) {
        activeEffect.options.onTrack ({
          effect: activeEffect,
          target,
          type,
          key,
        });
      }
    }
  }
```

那执行effect的过程，又会发生哪些事情呢？我们接着结合源码和示例代码进行解读下：

- effectStack栈主要是为了维护effect与dep之间的嵌套关系。
- 负责更新activeEffect。（可以看下track函数和我们前面说的effect与其所处dep之间的关系）
- enableTracking & resetTracking函数用于控制track的状态
- 因为effect执行的过程中也会进行track工作。这时就需要判断是否需要为当前的state与effects构建依赖关系
- 返回fn()的结果，执行finally内的代码，弹出当前的effect，更新下一个effect
- 结合实例代码我们分析下：
  1. 当在输入框输入数字5，input发生更改
  2. callback函数先入栈 ==》effectStack状态：[callback] ==》callback执行 ==》访问input.value ==》进行track，打印input.value: 5  ==》callback函数出栈
  3.  componentEffect 入栈 ==》 effectStack状态：[componentEffect ] ==》 更新input内的值  ==》进行track ==》更新div，需要调用computed的getter函数获取值
  4. computedEffect 入栈 ==》 effectStack状态：[componentEffect ，computedEffect ] ==》当前activeEffect是computedEffect  ==》进行track ==》获取getter的值==》computedEffect 出栈 ==》进行track
  5. componentEffect 出栈==》effectStack状态：当前activeEffect是componentEffect 
  6. 完成整个响应过程

```js
const effectStack = [];
let activeEffect;
let uid = 0;
function createReactiveEffect (fn, options) {
    const effect = function reactiveEffect () { 
      if (!effect.active) {
        return fn ();
      }
      if (!effectStack.includes (effect)) {
        // 首先需要将effect在其所处的deps中移除
        cleanup (effect);
        try {
          // 恢复track
          enableTracking ();
          // 入栈
          effectStack.push(effect);
          // 设置当前effect
          // fn执行的过程又会维护activeEffect与dep的关系
          activeEffect = effect;
            
          // 执行fn
          // 这里的fn可以是componentEffect函数、创建watch时传递的callback、computedEffect的getter函数
          // 也可以是用户使用effect API 传递的callback函数
          // 这些函数内部很可能对state进行访问，执行的过程就会触发getter，即进行track，进行依赖收集
          return fn ();
        } finally {
          // 出栈，弹出当前effect
          effectStack.pop();
          // 重置track
          resetTracking ();
          // 更新下一个effect
          activeEffect = effectStack[effectStack.length - 1];
        }
      }
    };
    effect.id = uid++;
    effect.allowRecurse = !!options.allowRecurse;
    effect._isEffect = true;
    effect.active = true;
    effect.raw = fn;
    effect.deps = [];
    effect.options = options;
    return effect;
  }

  function cleanup (effect) {
    const {deps} = effect;
    if (deps.length) {
      for (let i = 0; i < deps.length; i++) {
        deps[i].delete (effect);
      }
      deps.length = 0;
    }
  }

  function enableTracking() {
    trackStack.push(shouldTrack)
    shouldTrack = true
  }

  function resetTracking() {
    const last = trackStack.pop()
    shouldTrack = last === undefined ? true : last
  }

```

上面的过程可能比较绕，但是是有规律的，需要注意的是：effect执行的过程，会执行fn，fn很有可能触发track，进行依赖收集，而effecStack，主要是维护effect之间的更新顺序，总是先更新最后入栈的effect。

明白了上面effects的执行过程，就方便理解下面的computed了

### `computed`

说道computed，先让我们回想下怎么使用：

- 可以给computed传一个 getter 函数，
- 它会根据 getter 的返回值，返回一个不可变的响应式 [ref](https://v3.cn.vuejs.org/api/refs-api.html#ref) 对象。

```js
const count = ref(1)
const plusOne = computed(() => count.value + 1)

console.log(plusOne.value) // 2

plusOne.value++ // 错误
```

- 或者，接受一个具有 `get` 和 `set` 函数的对象，用来创建可写的 ref 对象。

```js
const count = ref(1)
const plusOne = computed({
  get: () => count.value + 1,
  set: val => {
    count.value = val - 1
  }
})

plusOne.value = 1
console.log(count.value) // 0
```

各位都知道computed强大的地方就是惰性更新，只有其依赖的值发生变化的时候才会，去更新。其实上面分析effect的过程已经，提现出来了。当其依赖的值发生变化的时候，负责渲染的compontentEffect函数会调用computedEffect获取新的值。

接下来让我们分析下简版源码的实现：

```js
// 创建computed API
function computed(getterOrOptions) {
  let getter
  let setter

  if (isFunction(getterOrOptions)) {
    getter = getterOrOptions
    setter = __DEV__
      ? () => {
          console.warn('Write operation failed: computed value is readonly')
        }
      : NOOP
  } else {
    getter = getterOrOptions.get
    setter = getterOrOptions.set
  }

  return new ComputedRefImpl(
    getter,
    setter,
    isFunction(getterOrOptions) || !getterOrOptions.set
  )
}


// computed Class
class ComputedRefImpl {
  private _value! 
  private _dirty = true

  public readonly effect
  
  // 声明为只读的响应式ref对象
  public readonly __v_isRef = true;
  public readonly [ReactiveFlags.IS_READONLY]

  constructor(
    getter,
    readonly _setter,
    isReadonly
  ) {
    // 
    this.effect = effect(getter, {
      // lazy为true，不会立即执行 getter函数
      lazy: true,
      
      // 在trigger函数中 最后对effects进行遍历
      // 执行run函数，如果effect.option.scheduler函数存在
      // 就会执行 scheduler 函数
      scheduler: () => {
        
        if (!this._dirty) {
          // 重置_dirty
          this._dirty = true
          
          // 响应派发
          trigger(toRaw(this), TriggerOpTypes.SET, 'value')
        }
      }
    })

    this[ReactiveFlags.IS_READONLY] = isReadonly
  }

  get value() {
    
    const self = toRaw(this)
    if (self._dirty) {
        
      // 执行effect即执行getter，获取新值
      self._value = this.effect()
      // _dirty 置为false
      self._dirty = false
    }
    // track 依赖收集
    track(self, TrackOpTypes.GET, 'value')
    return self._value
  }

  set value(newValue) {
    // 将新值传给用户配置的setter函数
    this._setter(newValue)
  }
}


```



## 总结