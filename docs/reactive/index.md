# `Vue3 reactivity `源码深入浅出

> 大家好，我是剑大瑞。前段时间公司用`Vue3`做了一个全新的项目，很荣幸，参与了大部分功能的开发工作，就把`Vue3`全家桶全部实践了一遍。趁热打铁，阅读了下`Vue3`源码中的`reactivity`包的源码。有不少收获，借此机会，将其分享出来。如有不足，还望各位批评指正。

![目录](D:\vue3深入浅出\docs\.vuepress\public\img\catalogue.png)

## 新旧对比

 这次分享的主要是`Vue3`的`reactivity`的源码部分，故只对比`Vue2`与`Vue3`的响应式源码部分。

### 新旧原理对比：`Object.defineProperty`与`Proxy`

**`Object.defineProperty`**：

有了解过`Vue2`源码的同学都知道。在`Vue2`中，其内部是通过`Object.defineProperty`来实现变化侦测的。该方法可以直接在一个对象上定义一个新属性或者修改一个现有属性。接受三个参数，分别是`targetObject`、`key`及一个针对key的`descriptorObject`，返回值是传递给函数的对象。

`descriptorObject`可以选择的键值：

- `configurable`：设置当前属性的可配置性，默认false。
- `enumerable`：设置当前属性的可枚举性，默认false。
- `value`：设置当前属性的值，默认undefined。
- `writable`：设置当前属性是否可更改，默认false。
- **get**：当前属性的getter函数，当访问该属性时，会触发该函数。
- **set**：当前属性的setter函数，当设置当前属性值时，会触发该函数。

这里附上`Vue2`中`defineReactive`函数的简略源码，**重点关注**： **get**函数和**set**函数。

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

针对这三个问题，``Vue2``中分别采取了不同的措施:

- 针对数组变化，创建数组拦截器。
- 针对新增和删除对象属性问题，创建`$set`、`$delete` `API`。
- 针对`value`为对象的情况，采用**递归**的方式，深度遍历，进行依赖收集。

**`Proxy`**：

随着浏览器对`ES6`支持度的提升，在`Vue3`中使用了`Proxy`。

**proxy 可以直接对整个`targetObject`进行拦截**，它接受两个参数，分别是`target`、`handler`，并返回一个代理对象。handler可配置的方法有***13***种，涉及属性查找、赋值、枚举、函数调用、原型、属性描述相关方法。

下面我们可以通过代码示例了解下`proxy`，及`Vue3`中`handler`使用到的几种方法：

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

> 这里说到`Proxy`，就不得不提一下它的好基友：`Reflect`。`Reflect`上的方法基本与`Object`相同，[但又存在细微的差别](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Reflect/Comparing_Reflect_and_Object_methods)。
>
> `Reflect`上的方法与Proxy方法命名相同。可以对`target`进行映射。
>
> 当需要调用Object上的方法时，我们可以直接调用Reflect。`Reflect`相当于直接对`Javascript`的操作做了一层拦截。

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
  - 接受四个参数`target`、`key`、`newValue`（新设置的值）、`receiver`
  - 返回true，严格模式返回`false`会报`TypeError`异常

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
  - 用于拦截对对象属性的`delete`操作（弥补了`Object.definedProperty`属性对`delete`操作无感的问题）。
  - 接受参数：`targe`t、`key`
  - 返回布尔值： `true`成功，`false`失败

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
  - 接受参数`target`、`key`
  - 返回布尔值，`true`存在，`false`不存在
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
  - 参数`target`
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

`Proxy`相较于`Object.defineProperty`更加强大。通过上面的示例，可以看出Proxy可以弥补`Object.defineProperty`在依赖收集，侦测变化方面的缺陷，比如：

- 对`Object`属性的新增删除操作
- 通过`Array`下标进行修改或新增元素操作

但是`Proxy`也有自己的缺陷，这里我们先留个空白，后面会补充。我们接着聊。

### 新旧模式对比：观察者模式与代理模式

#### 观察者模式

`Vue2`内部通过观察者模式处理数据与依赖的关系，观察者模式的特点：

- **一对多。**多个对象之间存在一对多的依赖关系，当一个对象的状态发生改变时，所有依赖于他的对象都得到通知并被自动更新
- 降低目标数据与依赖之间的耦合关系
- 属于行为型设计模式

**简单实现观察者模式**

- Subject`类：
  - observers`属性用于维护所有的观察者
  - `add`方法用于添加观察者
  - `notify`方法用于通知所有的观察者
  - `remove`方法用于移除观察者
- `Observer`类：
  - `update`方法用于接受状态的变化

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

**`Vue2`中的观察者模式**

![借用大佬的图，侵删](D:\vue3深入浅出\docs\.vuepress\public\img\define_reactive.png)



- `Vue2`中 数据就是我们要观察的对象，Watcher就是所谓的依赖，而`Dep`只是负责对`Watcher`的收集和派发。

- 另`Vue2`中watcher也可以是目标数据。它与`Dep`是一种多对多的关系，而不是一对多。

下面我们再次回顾下`Vue2`中是如何设计这几个类的：

- **Observer类**：
  - 用于创建`Observer`实例
  - `walk`方法遍历被观察的对象，将`value`中的每一项转为响应式
  - `observeArray`方法用于遍历被观察的数组，将数组中的每一项转为响应式

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
  - `observe`方法是用于创建`Observer`实例的工场方法

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
  - 对`val`进行递归观察
  - 通过`Object.defineProperty`，对`obj[key]`进行`Getter`、`Setter`拦截
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

- **`Dep`类**
  - 相当于`Observer`与`Watcher`之间的中介
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

- **`Watcher`类**
  - 真正的依赖，执行`callback`函数，进行响应
  - 维护`dep`与`watcher`多对多的关系
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

上面几个类代码中，省略了一些不必要的代码，以便减轻阅读负担。但已经能够展示出`Vue2`的观察者模式中几个类的基本结构 & 关系。



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

`Vue3`响应式是基于`Proxy`的代理模式。通过**配置`handler`**我们就可以对原始对象的访问**进行控制 & 增强**。

![Vue3代理模式](D:\vue3深入浅出\docs\.vuepress\public\img\proxy_module.png)

**增强的`hanlder`**

- `getter`时进行`Track`
  - 确定`target`与`effect`的关系
  - 确定`activeEffect`与`Dep`的关系
  - 返回`value`
- `setter`时进行`Trigger`
  - 获取对应的`effects`，遍历执行`effect`
  - 更新`activeEffect`
  - 更新`value`

通过分析，我们不难写出有以下逻辑的代码：

- 通过对`target`进行判断，是否需要进行代理转换
- 通过`new Proxy`对`target`进行代理
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

通过上面的图，我们可以看出，`Vue3`中的依赖收集 & 响应派发都是在`handler`中做的，但是有几个问题需要我们确定下：

- `handler`针对其他操作类型是如何配置的？比如`delete、forEach`。
- 针对不同的数据类型，`handler`的配置方式一样吗？有什么需要注意的？

针对上面的两个问题，我们先留着。下面的内容我们就会说到，咱们接着聊。

## 变化侦测

### Track：依赖收集 

#### 新的依赖

在`Vue2`中，依赖就是watcher，在`Vue3`的源码中，我并没有发现Watcher类，而是出现一个新的函数effect，可以称为副作用函数。通过对比`watcher`与`effect`及`effect`与数据的关系。可以确定的称`effect`相当于`Vue2`中的`watcher`，但比`Watcher`类更简洁。

这里贴上effect代码的简略实现，并分析下它的思路：

- `effect`接受一个`fn`作为回调函数通过`createReactiveEffect`函数进行缓存
- 通过`options`对`effect`进行配置
- 执行`effect`其实就是创建一个缓存了`fn`的`effect`函数

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

在`Vue2`中，为了维护数据与watcher的关系，专门创建了`Dep`类。而在`Vue3`中`Dep`变为了一个简单的Set实例。在`Track`的时候，当前的`activeEffect`就存储在`dep`中。在`Trigger`的时候，通过key获取对应的`dep`集合，再去遍历执行即可。

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

在`Vue2`中，是通过`Observe、Dep、Watcher`来维持`value`与`watcher`之间的关系。

但是`Vue3`中没有了上面的几个类。那它是如何维持`value与effect`之间的关系的呢？

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

当obj的属性发生变化的时候，我们需要去执行所有与之相关的effect，触发响应。`Vue`中，`state`与依赖的关系，可以具体到最基本的` key:value`，其结构与`Vue2`中`state`与`watcher`的结构相似，只不过在存储state与依赖的方式有所变化：

![数据与依赖之间的关系](D:\vue3深入浅出\docs\.vuepress\public\img\effect_dep.png)

- `targetMap`：使用`WeakMap`实例，用于维护`targetObject与KeyToDepMap`的关系
- `KeyToDepMap`：使用`Map`实例，用于维护key与`Dep`的关系
- `Dep`：使用`Set`实例，用于存储所有与`key`相关的`effect`
- `effect.deps`：使用`Array`实例，用于存储所有与当前`effect`的`dep`实例



### Trigger：响应派发

当我们对经过响应转换的数据进行修改时，会触发`Setter`函数，这时需要做依赖的派发工作，比如`DOM`更新、`watch/computed`的执行。

#### 触发依赖

```html	
<template>
	<div>
    	{{proxy.name}}
	</div>
</template>
```

模板中`name`是通过`Proxy`代理产生的，当`proxy.name`赋新值时，会触发`Setter`，这时需要动态的去更新`DOM`，故在`Setter`中可以做一些依赖的触发操作。我们可以通过创建一个`trigger`函数，在`setter`函数中调用。

通过分析，**tigger函数的主要作用**：

- 根据`target、key`获取要执行的所有`effect`
- 根据`type`操作，进行一些情况判断，添加需要遍历执行的`effect`
- 遍历执行`effets`，触发响应

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

通过上面的代码示例，我们可以知道，`Vue3`内部，会在`Getter`函数中进行`track`，在`Setter`函数中进行`trigger`。上面我们并没有研究这两个关键函数的内部实现，下一小节我们一起研究下现在的响应式是如何处理数据与依赖的？`track与trigger`的内部实现的细节有哪些？

#### 完善handler & track & trigger

通过对`Proxy，handler、track、trigger、effect、依赖与数据的关系`这几项分析。接下来我们就可以进行一个简单的组合，写出一个简版的响应式代码

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

- 当初次渲染的时候，会进行读取操作，出发`getter`函数，这时就会通过`track`完成依赖的收集工作
- 当数据发生变化的时候，会触发`setter`函数，这时会通过`trigger`函数进行响应

### `Object&Array`的变化侦测

#### `Object`的深度代理

在`Vue2`中，`defineReactive`函数会对`data`进行递归转换。那`Vue3`中是否存在这个问题呢？让我们先看一段代码：

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

上面的代码中，我们明明通过 `proxyObj.hobby.one = "basketball"`，赋予新值，但`handler`只拦截到了hobby属性的`getter`操作。

如果`obj`中`key`对应的`value`为`Object`类型，则**Proxy只能进行单层的拦截**。这并不是我们期望的。

如果我们遇到如下场景：

```html
<div>{{proxyObj.hobby.one}}</div>
```

当 `proxyObj.hobby.one` 发生变化以后，我们期望DOM进行更新。由于`proxyObj`只进行了单层的代理，`hobby`并没有经过`Proxy`转为响应式。则会导致更新失败。

那`Vue3`是如何解决的呢？

答案是：**进行递归代理**，其思路与`Vue2`类似，通过判断`value`的类型，再进行响应转换。

这里就需要我们改写`getter`函数，

- 在get的时候去判断获取的`value`是否为`Object`
- 如果是`Object`，则再次进行一次`Reactive`代理

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

#### 数组`track&trigger`的问题

`Vue3`中虽没有了数组拦截器，但是出现了另一个问题，让我们看一段代码：

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

通过上面几个操作演示，我们可以发现一个简单的操作，可能会触发多次的`Getter`函数或者`Setter`函数，这种操作如果是在平常的业务开发过程中可能没有问题，但是在`Vue3`中可能会导致死递归的出现。

**`push&pop&shift&unshift&splice`** 这几个方法是可以对数组进行增加删除操作。需要注意的是：

- 这几个方法直接修改的是原数组
- 并会导致数组**length**属性的变化

 **`includes&indexOf&lastIndexOf`** 这三个方法都是数组用于判断是否存在要查找的值，需要注意的是：

- 这三个方法在数组方法实现中都会**对数组进行遍历操作**

> 感兴趣的同学可以看相关issue：[传送门1 (opens new window)](https://github.com/vuejs/vue-next/pull/2138)[传送门2(opens new window)](https://github.com/vuejs/vue-next/issues/2137)
>
> 大概意思是当通过`watchEffect`观察数组时，**发生了死递归**

通过上面打印的规律，可以发现：

- 每次调用方法时，都会先触发`get`，最后触发`set`

#### 创建数组`Instrumentations`

> 评论区，请大佬指教，`vue3`中的`Instrumentations`应如何翻译？(✿◡‿◡)

那我们能否做一个状态管理器，通过判断是否需要track，以避免到不必要的`track`和`trigger`：

- 通过`hander`中的`get`函数拦截`array`上的方法
- 对原型上的方法进行封装，在获取结果前后，分别去做`track`的暂停和重置，通过`trackStack`记录`shouldTrack`
- 获取到结果后，在进行`track`

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

前面提到，针对多层`Object`，需要通过递归进行深度代理。但是某些场景中我们希望响应式的对象只需要进行浅层代理。这就需要:

- 改写`get`函数：
  - 创建一个`createGetter`函数用来传递参数
  - 使用`JS`的闭包，缓存`shallow`，返回get函数
  - `get`函数内部通过`shallow`判断是否需要对`res`再次`reactive`
- 改写`set`函数：
  - `targetObject`为浅层响应，当`targetObject`内部属性发生变化时并不需要设置新值，

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

某些场景中我们希望响应式的对象可读不可更改，我们需要配置一个只进行只读响应转换的`handler`；

- 当发生修改时，可以在`handler`中拦截修改操作，如果触发则直接抛出异常。
- 因为`targetObject`是只读的，也没有必要再对其进行`track`。在`get`函数中判断是否需要`track`

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

- 不在对`targetObject`进行深层次的转换
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

- 各个`handler`中，配置的函数相同，只不过可能以为涉及到需求的原因，方法内部做了逻辑修改
- 方法中代码存在重复：`get`函数、`set`函数中代码存在多处重复的代码
  - get函数的主要功能就是获取`value`，进行`track`
  - set函数的主要功能就是设置`value`，进行`trigger`
  - 没必要每个`handler`都把两个函数的核心作用进行重复

重构方法：

- 通过`createGetter`、`createSetter`函数创建`get`、`set`函数，利用闭包，通过传参获取不同属性的函数
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

前面我们学习了`Object & Array`的`handler`的配置及各个方法的实现。同样的逻辑，也适用于`Map、Set`类型的数据：

- 拆分处理各个`method`
- 根据需要配置`handler`

#### 经过代理的`Map、Set`实例

直接上代码，让我们看下`map、set`经过`proxy`代理后，在进行操作会发生什么事情？

**经过代理的`map`**

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

**经过代理的`set`**

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

- 出现上面输出结果是因为`proxy`代理的是`Map、Set`的实例
- 我们调用的是实例上的方法，就会触发访问方法的`getter`函数
- 故`Map & Set`类型的`targetObject`，不能使用与`Object & Array`相同的`handler`
- 需要为`Map & Set`创建方法，并配置`handler`

#### 增删改查

- `map & set`类型需配置的`handler`与`Object & Array`相同：响应式、浅层、只读、浅层只读
- 实例方法都需要独立处理
- 设计思路
  - 因为实例方法都是先触发方法访问的`getter`函数
  - 所以配置的`handler`对象只需有一个`getter`函数
  - 在get函数内部拦截方法
  - 在方法内部做`track/trigger`工作
  - 通过`map/set`的原始方法去获取value，并返回

前置知识补充：

- `Vue3`会为每个被转换的对象，设置一个`ReactiveFlags.RAW`属性
- 值是原始`targetObject`
- `toRaw`函数
  - 返回 [`reactive`](https://v3.cn.vuejs.org/api/basic-reactivity.html#reactive) 或 [`readonly`](https://v3.cn.vuejs.org/api/basic-reactivity.html#readonly) 代理的原始`targetObject`
  - 可用于临时读取数据而无需承担代理访问/跟踪的开销
  - 也可用于写入数据而避免触发更改
  - 原理：通过递归，脱`proxy`，找到原始值

```js 
function toRaw(observed) {
  return (
    (observed && toRaw((observed)[ReactiveFlags.RAW])) || observed
  )
}
```

- 配置不同的`handler`，就去要用相应的响应转换函数处理result
- 可以根据参数类型获去相应的转换函数

```js
const toReactive = (value ) => isObject(value) ? reactive(value) : value

const toReadonly = (value) => isObject(value) ? readonly(value) : value

const toShallow = (value) => value
// 获取原型
const getProto = (v) => Reflect.getPrototypeOf(v)
```

> 这里我们直接讲解`Vue3 reactive`中的源码部分，当然代码是经过省略的，但是会保留核心逻辑。
>
> 先理解主要思路，在关注细节。

- `get`函数
  - 用于`Map实例根据key获取`value`
  - `map类型的key可以是引用类型，也可能是代理实例
  - `target & key`都需要进行`toRaw`操作
  - 需要根须参数判断是否需要进行`track`，收集相关依赖
  - 需要调用原始`target`的 `get`方法获取`value`
  - 最后需要返回经过代理的`value`

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

- `set`函数
  - 用于`Map`类型添加元素
  - `map`类型添加元素，有可能是新增`key:value`，有可能是修改
  - 需要对key是否存在进行判断
  - set函数会修改`target`，需要进行`trigger`，触发响应

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

- `has`函数
  - 可用于`Set/Map`实例判断某元素是否存在
  - `has`属性并不会更改`targetObject`，
  - 属于对`target`的访问操作
  - 需要对`key`进行`track`操作

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

- `add`函数
  - 用于`Set`实例添加元素，添加的元素唯一
  - 如果添加的`value`先前不存在，则会使`target`发生更改，需要进行`trigger`操作，触发响应

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

- `size`属性
  - 用于返回`Set/Map`的成员总数
  - 不会触发`target`的变化
  - 但是需要进行`track`

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

- `clear`函数
  - 用于清除`Set/Map`实例的所有成员
  - 会改变`target`，需要调用`trigger`函数

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

- `delete`函数
  - 用于删除`Set/Map`实例的某个成员
  - 会更改原始`target`，需要`trigger`

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

- `forEach`函数
  - 属于设计模式中的遍历器模式
  - 用于遍历`Set/Map`实例，接受一个回调，会将`key & value` 传给`callback`
  - 针对不同的响应接口，我们根据判断创建`forEach`
  - 我们可以通过参数`isReadonly`, `isShallow`获取不同的`forEach`
  - `forEach`函数并不会更改原始对象，只需进行`track`工作

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

- `iterable`迭代器模式
  - `Map/Set`的实例有三种方法：`keys()、values()、entries()`
  - 这三种方法都遵循可迭代协议 & 可迭代器协议
  - `Vue3`内部同样对这三个方法做了处理
  - 通过自行实现迭代器，模拟这三个方法
  - 在创建的迭代器内部，通过调用原始对象的方法获取`result`
  - 进行`track`，并对`result`进行响应处理
  - 最后在返回的可迭代对象中，返回经过响应转换的`result`
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

#### 创建`Handler`

上面我们已经明白了各种方法的创建工作，接下来就是做类似`Object & Array`类型相同的工作——配置出不同的`handler`。

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

**`baseHandlers`**：

![baseHandlers](D:\vue3深入浅出\docs\.vuepress\public\img\baseHandlers.png)

**collectionHandlers**：

![collectionHandlers](D:\vue3深入浅出\docs\.vuepress\public\img\collectionHandlers (1).png)

## API实现原理

### `reactive`

前面我们已经知道如何配置Handler接下来要创建不同的响应转换函数，创建函数其实就是给`Proxy`，配置不同的`handler`。让我们改写下在第一章节中代理模式中提到的`createReactiveObject`函数：

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

- 将`handlers`作为参数传递给函数
- 在内部通过判断`target`的类型，配置`handlers`

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
- 对`target`进行“深层”代理，影响所有嵌套 `property`

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

- 创建一个响应式代理，只跟踪其自身` property` 的响应性
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
- 只读代理是深层的：任何被访问的嵌套` property `也是只读的。

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

- 创建一个 `proxy`，使其自身的 `property` 为只读
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

- 标记一个对象，使其永远不会转换为 `proxy`。[返回对象本身](https://v3.cn.vuejs.org/api/basic-reactivity.html#markraw)。
- 原理：给v`alue`定义一个`ReactiveFlags.SKIP`属性并设置值为`true`
- 在`reactive`时对该属性进行判断

```js
function markRaw (value) {
  def(value, ReactiveFlags.SKIP, true)
  return value
}
```

### `ref`

学习`Vue3`时，有一个疑问：已经有一个`reactive`函数了，为什么还有搞一个ref呢？后来看了源码才明白部分原由。

在`reactive`中，我们并不能转换基础类型，只能对对象类型进行代理。而要如何实现对基础类型的代理呢？

创建一个`Ref Class`。通过类实例来实现`get & set `的拦截操作。

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

有了`createRef`函数，接下来就是创建`API`了

#### `ref`

- 接受一个`value`并返回一个响应式且可变的 `ref `对象。
- `ref `对象具有指向内部值的单个 property `.value`

```js
function ref(value) {
  return createRef(value)
}
```



#### `shallowRef`

- 创建一个跟踪自身 `.value` 变化的` ref`，但不会使其值也变成响应式的。

```js
function shallowRef(value) {
  return createRef(value, true)
}
```

#### `isRef`

- 判断`value`是否为`ref`对象
- 注意上面我们在`RefImpl Class`中设置的一个只读属性 `__v_isRef`

```js
function isRef(r) {
  return Boolean(r && r.__v_isRef === true)
}
```

#### `toRef`

- 为源响应式对象上的某个 property 新创建一个 [`ref`](https://v3.cn.vuejs.org/api/refs-api.html#ref)
- 当需要将` prop` 的` ref `传递给复合函数时，`toRef` 很有用

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

- 将响应式对象转换为普通对象，其中结果对象的每个 property 都是指向原始对象相应 `property `的 [`ref`](https://v3.cn.vuejs.org/api/refs-api.html#ref)。
- 当从组合式函数返回响应式对象时，对响应式对象进行解构非常有用
- 原理：遍历响应式对象，调用`toRef`转换每一对`key:value`

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

- 创建一个自定义的 `ref`，并对其依赖项跟踪和更新触发进行显式控制。
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

**`API`实现**：

```js
function customRef(factory){
  return new CustomRefImpl(factory)
}
```

#### `triggerRef`

- 手动执行与 [`shallowRef`](https://v3.cn.vuejs.org/api/refs-api.html#shallowref) 关联的任何作用 (effect)
- 内部其实就是进行手动`trigger`

```js
function triggerRef(ref) {
  trigger(toRaw(ref), TriggerOpTypes.SET, 'value', __DEV__ ? ref.value : void 0)
}
```

![Ref](D:\vue3深入浅出\docs\.vuepress\public\img\Ref.png)

### 再谈`effect`（重要！！！）

前面在讲变化侦测的时候，我们简单说了一下effect函数。但是并没有对`effect`在整个响应中的执行流程进行解析。这次一定要补上，因为如果不同`effect`的执行过程，就很难理解`computed`的原理。

在`vue3`中会有四种级别的`effect`：

- 负责渲染更新的`componentEffect`
- 负责处理`watch`的`watchEffect`
- 负责处理`compute`d的`computedEffect`
- 用户自己使用`effect API`时创建的`effct`

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

在浏览器中，从上面的模板代码到渲染至可以进行响应交互的页面，`Vue`大概会做一下几件事：

- 执行`setup`函数，将`state`转为响应式，并将结果挂载至组件实例上
- 对模板进行`compiler`，并渲染至视图
- 在`compiler`过程中，会**读取响应式数据**，读取的过程就会触发**`getter`**函数，就会进行**依赖收集**工作
- 当在表单中输入数据，就会触发`update`事件，更改`input`，更改的过程就会触发**`setter`**函数，就会进行**响应更新**

接着我们直接看下简版源码中是如何设计`trigger`函数的：

- trigger函数主要是获取与target关联的所有`effect`
- 将需要遍历的`effect`，添加到将要进行遍历的set集合（会去重）
- 遍历set，执行所有`effect`，触发响应。
- 结合示例代码：
  - 当用于在`input`框进行输入的时候，
  - 会执行`update`函数，对`input`进行更改
  - 触发`trigger`，收集所有与`input`相关的effects，遍历执行`effects`
  - 这个时候就会执行`componentEffect`、`computedEffect`、用户自定义的`effect`

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

那执行`effect`的过程，又会发生哪些事情呢？我们接着结合源码和示例代码进行解读下：

- `effectStack`栈主要是为了维护`effect`与`dep`之间的嵌套关系。
- 负责更新`activeEffect`。（可以看下`track`函数和我们前面说的`effect`与其所处`dep`之间的关系）
- `enableTracking & resetTracking`函数用于控制`track`的状态
- 因为`effect`执行的过程中也会进行`track`工作。这时就需要判断是否需要为当前的`state`与`effects`构建依赖关系
- 返回`fn()`的结果，执行`finally`内的代码，弹出当前的`effect`，更新下一个`effect`
- 结合实例代码我们分析下：
  1. 当在输入框输入数字5，`input`发生更改
  2. `callback`函数先入栈 ==》`effectStack`状态：`[callback] `==》`callback`执行 ==》访问`input.value` ==》进行`track`，打印`input.value: 5 `==》callback`函数出栈
  3. ` componentEffect `入栈 ==》 `effectStack`状态：`[componentEffect ] `==》 更新`input`内的值  ==》进行`track `==》更新`div`，需要调用`computed`的`getter`函数获取值
  4. `computedEffect` 入栈 ==》` effectStack`状态：`[componentEffect ，computedEffect ] `==》当前`activeEffect`是`computedEffect`  ==》进行`track `==》获取``getter`的值==》`computedEffect`出栈 ==》进行`track`
  5. `componentEffect` 出栈==》`effectStack`状态：当前`activeEffect`是`componentEffect `
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

上面的过程可能比较绕，但是是有规律的，需要注意的是：`effect`执行的过程，会执行`fn`，`fn`很有可能触发`track`，进行依赖收集，而`effecStack`，主要是维护`effect`之间的更新顺序，总是先更新最后入栈的`effect`。

明白了上面`effects`的执行过程，就方便理解下面的`computed`了.

### `computed`

说道`computed`，先让我们回想下怎么使用：

- 可以给`compute`d传一个 `getter `函数，
- 它会根据` getter `的返回值，返回一个不可变的响应式 [ref](https://v3.cn.vuejs.org/api/refs-api.html#ref) 对象。

```js
const count = ref(1)
const plusOne = computed(() => count.value + 1)

console.log(plusOne.value) // 2

plusOne.value++ // 错误
```

- 或者，接受一个具有 `get` 和 `set` 函数的对象，用来创建可写的 `ref `对象。

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

各位都知道`computed`强大的地方就是惰性更新，只有其依赖的值发生变化的时候才会，去更新。其实上面分析`effect`的过程已经，提现出来了。当其依赖的值发生变化的时候，负责渲染的`compontentEffect`函数会调用`computedEffect`获取新的值。

`computed`主要是根据`dirty`去更新值。当`dirty`为`true`时，说明需要重新计算返回值，当`dirty`为`false`时，说明不需要重新计算返回值。

当在模板中使用了一个数据渲染视图的时，如果这个数据是`computed`产生的，那么读取数据这个操作其实就是触发计算属性`getter`方法获取`value`，获取之后将计算属性的`_dirty`属性置为`false`，直到下次计算属性依赖的数据发生变化的之后，才会更改。

当我们创建一个`computed`属性时，其实是配置了一个`lazy`为`true`，并有`scheduler`属性的`effect`。`computedEffect`的`scheduler`主要负责重置`_dirty`属性。并触发`trigger`。

当模板中的数据发生变化的时候，会触发`trigger`，进行响应，执行所有的`effects`，如果`effect.scheduler`存在，则执行`effect.scheduler`函数，重置`_dirty`。负责渲染的`componentEffect`再重新读取计算属性的值时，会调用`computed`的`getter`方法。这时`dirty`为`true`，返回新的`value`后，`dirty`置为`false`。

接下来让我们看下简版源码的实现：

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
      self._dirty = fa
        lse
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

上述代码已经用注释标明了代码的主要逻辑，结合`effect`的执行逻辑，在进行分析就不难理解`computed`了。

## 总结

至此我们已经分析完了`Vue3 reactive`源码分析，在新的响应式结构中，`Vue`通过`Proxy`来拦截`state`的`getter`或者`setter`操作。通过`effect`完成依赖的的收集工作。通过配置不同的`handler`对象，创建对不同数据类型和不同响应层次的响应式`API`。

>- 文章中如果有错误，还望大家批评指正。大瑞不胜感激。
>
>- 如果在阅读过程中有所疑问，可以在评论区或者我的公众号留言，我定会耐心解答
>- 如果阅读完感觉不错，确实有帮助到你，点个赞是对我最大的鼓励

参考：

- https://github.com/vuejs/vue-next
- https://v3.vuejs.org/
- 《深入浅出Vue.js》