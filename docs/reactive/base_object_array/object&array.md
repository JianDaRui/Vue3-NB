# 对象与数组类型的处理

上一节只是简单梳理了一个Vue3的响应原理，相较于源码还有许多需要完善的细节。而这一节我们就来一起看看源码中是怎么处理的，又有哪些值得学习的地方。

## 数组track&trigger的问题

Vue3中没有了数组拦截器，但是增加了一个Instrumentations，我们暂时将其翻译为仪表盘。这里相当于数组拦截器，通过拦截数组上的原型方法，在拦截的时候做了track操作。

### includes&indexOf&lastIndexOf方法

这三个方法都是数组用于判断是否存在要查找的值，

- includes判断数组是否存在目标值，返回一个布尔值，true存在，false不存在
- indexOf从前往后查找数组中是否存在目标值，存在返回，否则返回-1
- lastIndexOf从后往前查找数组中是否存在目标值，存在返回，否则返回-1
- 这三个方法在数组方法实现中都会对数组进行遍历操作

源码：

```typescript
// path: packages > reactivity > src > baseHandlers.ts

const arrayInstrumentations: Record<string, Function> = {}

// instrument identity-sensitive Array methods to account for possible reactive values

;(['includes', 'indexOf', 'lastIndexOf'] as const).forEach(key => {
  // 获取原型上的方法
  const method = Array.prototype[key] as any
  arrayInstrumentations[key] = function(this: unknown[], ...args: unknown[]) {
    // 获取原始数组
    const arr = toRaw(this)
    for (let i = 0, l = this.length; i < l; i++) {
      // 对数组的每一项进行tarck
      track(arr, TrackOpTypes.GET, i + '')
    }
    // we run the method using the original args first (which may be reactive)
    const res = method.apply(arr, args)
    if (res === -1 || res === false) {
      // 如果没有找到，使用原始值再次查找
      return method.apply(arr, args.map(toRaw))
    } else {
      return res
    }
  }
})

// toRaw函数用于递归获取原始值
export function toRaw<T>(observed: T): T {
  return (
    (observed && toRaw((observed as Target)[ReactiveFlags.RAW])) || observed
  )
}
```

## push&pop&shift&unshift&splice

上面这几个方法是可以对数组进行增加删除操作。注意的是：

- 这几个方法直接修改的是原数组
- 并会导致数组**length**属性的变化

### Proxy代理数组下的length属性

先看下面的代码，我们通过Proxy对一个数组进行代理，然后我们对代理实例进行一些数组方法的调用操作。并在handler中做一些拦截操作，主要是观察下在操作过程中，影响了哪些key。

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

> 感兴趣的同学可以看这里：[传送门1](https://github.com/vuejs/vue-next/pull/2138) [传送门2](https://github.com/vuejs/vue-next/issues/2137)
>
> 大概意思是当通过watchEffect观察数组时，发生了死递归

那Vue3是如何解决这个问题的呢？源码：

```typescript
// path: packages > reactivity > src > baseHandlers
;(['push', 'pop', 'shift', 'unshift', 'splice'] as const).forEach(key => {
  const method = Array.prototype[key] as any
  arrayInstrumentations[key] = function(this: unknown[], ...args: unknown[]) {
    // 暂停track
    pauseTracking()
    const res = method.apply(this, args)
    // 恢复track
    resetTracking()
    return res
  }
})

// path: packages > reactivity > src > effect
// 用于控制track函数
let shouldTrack = true
const trackStack: boolean[] = []
export function pauseTracking() {
  trackStack.push(shouldTrack)
  shouldTrack = false
}

export function enableTracking() {
  trackStack.push(shouldTrack)
  shouldTrack = true
}

export function resetTracking() {
  const last = trackStack.pop()
  shouldTrack = last === undefined ? true : last
}

// 完整的track函数
export function track(target: object, type: TrackOpTypes, key: unknown) {
  // 如果是数组方法：push、pop、shift、unshift、splice。shouldTrack为false, 直接返回
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
    if (__DEV__ && activeEffect.options.onTrack) {
      activeEffect.options.onTrack({
        effect: activeEffect,
        target,
        type,
        key
      })
    }
  }
}


function createGetter(isReadonly = false, shallow = false) {
  return function get(target: Target, key: string | symbol, receiver: object) {
   	// 省略了无关代码...
    const targetIsArray = isArray(target)
    if (!isReadonly && targetIsArray && hasOwn(arrayInstrumentations, key)) {
      // 使用改写后的数组方法
      return Reflect.get(arrayInstrumentations, key, receiver)
    }   
}
```

从源码可以看出：

- 设置一个track栈来记录能否track，通过pauseTracking、enableTracking、resetTracking进行track状态的管理。
- 针对push、pop、shift、unshift、splice操作数组时，先调用pauseTracking，暂停track
- 调用数组原型方法获取结果，调用resetTracking恢复shouldTrack。
- 只进行最后一次track，并返回结果

可以看下管理状态之后的代码

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
    const res = Reflect.get(arrayInstrumentations, key, receiver)
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

const arrayInstrumentations = {}
;['push', 'pop', 'shift', 'unshift', 'splice']forEach((key) => {
  const method = Array.prototype[key]
  arrayInstrumentations[key] = function (thisArgs = [], ...args) {
    // 暂停track
    pauseTracking()
    const res = method.apply(thisArgs, args)
    // 恢复track
    resetTracking()
    return res
  }
})

// 用于控制track函数
let shouldTrack = true
const trackStack = []
function pauseTracking() {
  trackStack.push(shouldTrack)
  shouldTrack = false
}
function resetTracking() {
  const last = trackStack.pop()
  shouldTrack = last === undefined ? true : last
}

function activeEffect() {
  console.log('DOM更新')
}
activeEffect.deps = []
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

经过shouldTrack判断之后，可以避免掉许多无用或重复的 track。

## 对象的深浅代理

### Proxy代理下的对象

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

如果obj中key对应的value为Object类型，则Proxy只能进行单层的拦截。这并不是我们期望的。

如果我们遇到如下场景：

```html
<div>{{proxyObj.hobby.one}}</div>
```

当 proxyObj.hobby.one 发生变化以后，我们期望DOM进行更新。由于proxyObj只进行了单层的代理，hobby并没有经过Proxy转为响应式。则会导致更新失败。

### 递归转换为响应式

这里就需要我们改写getter函数

- 在get的时候去判断获取的value是否为Object
- 如果是Object，则再次进行一次Reactive

```js
function createGetter() {
  return function get(target, key， receiver) {
    const targetIsArray = isArray(target)
    if (targetIsArray && hasOwn(arrayInstrumentations, key)) {
      return Reflect.get(arrayInstrumentations, key, receiver)
    }
    const res = Reflect.get(target, key, receiver)

    if (isObject(res)) {
      // 如果为对象类型，则进行深层次转换
      reactive(res)
    }
    return res
  }
}
```

- 既然有需要进行深度转换的target。那就只需要进行浅层转换的target。

- 我们可以通过传参来判断是否需要进行深度转换。

```js
function createGetter(shallow = false) {
  return function get(target, key， receiver) {
    const targetIsArray = isArray(target)
    if (targetIsArray && hasOwn(arrayInstrumentations, key)) {
      return Reflect.get(arrayInstrumentations, key, receiver)
    }
    const res = Reflect.get(target, key, receiver)
	if(shallow) {
       // 浅响应式
       return res
    }
    if (isObject(res)) {
      // 如果为对象类型，则进行深层次转换
      reactive(res)
    }
    return res
  }
}
```

如果是浅响应式，则Setter函数也许改写：

```js
function createSetter(shallow = false) {
  return function set(target, key, value, receiver) {
    let oldValue = target
    if (!shallow) {
      // 如果为深度相应模式，这需要找到value与oldValue的原始值，进行修改
      value = toRaw(value)
      oldValue = toRaw(oldValue)
      if (!isArray(target)) {
        oldValue.value = value
        return true
      }
    } else {
      // in shallow mode, objects are set as-is regardless of reactive or not	// 在浅层响应模式中，不管是否是响应式，对象都被设置为原始值，故不许操作，else内没有代码
    }	
    // 省略的代码...
  }
}
```

- 创建一个shallowReactiveMap用于保存浅层相应的对象
- 创建一个shallowReactiveHandlers用于做浅层拦截操作
- 创建一个shallowReactive用户做浅层响应式的转换

```js
// utils
const extend = Object.assign
// 创建shallowHandlers
const shallowGet = createGetter(true)
const shallowSet = createSetter(true)
export const shallowReactiveHandlers= extend(
  {},
  mutableHandlers,
  {
    get: shallowGet,
    set: shallowSet
  }
)
// 浅响应式创建函数：返回原始对象的浅响应副本，只有root层是相应的，即使在root级别，它也能展开引用,。
export function shallowReactive<T extends object>(target: T): T {
  return createReactiveObject(
    target,
    false,
    shallowReactiveHandlers,
    shallowReactiveMap
  )
}
```



## 只读响应式

某些场景中我们希望响应式的对象可读不可改，则意味着我们可以在handler的修改操作：set函数、delete函数中抛出异常，拦截修改操作。

- 给get函数传递一个参数： *isReadonly*，用于判断是否只读
- 如果*isReadonly*为true，则target为**非响应式**，不需要进行track
- 对于数组类型，不需要使用改写后的方法
- 在set函数、delete函数中需要抛出异常

为完成这些需求，需要：

- 设置一个readonlyMap来记录只读响应对象
- 设置一个readonly函数用于创建只读的响应式代理
- 设置一个readonlyHandlers来进行只读操作的拦截

代码:

```js
// createGetter函数增加参数
function createSetter(isReadonly = false, shallow = false) {
  // 省略的代码...
}
// 创建 readonlyHandlers
const readonlyGet = createGetter(true)
export const readonlyHandlers = {
  get: readonlyGet,
  set(target, key) {
    if (__DEV__) {
      // 开发环境抛出异常
      console.warn(
        `Set operation on key "${String(key)}" failed: target is readonly.`,
        target
      )
    }
    // 正式环境，并不会去进行set操作，tigger操作
    return true
  },
  deleteProperty(target, key) {
    if (__DEV__) {
      // 开发环境抛出异常
      console.warn(
        `Delete operation on key "${String(key)}" failed: target is readonly.`,
        target
      )
    }
    // 正式环境，并不会去进行set操作，tigger操作
    return true
  }
}
// 新增
export const readonlyMap = new WeakMap()
export function readonly (target) {
  return createReactiveObject(target, true, readonlyHandlers, readonlyMap)
}

// 改写 createReactiveObject 函数
function createReactiveObject(target, isReadonly, baseHandlers, proxyMap) {
  if (!isObject(target)) {
    if (__DEV__) {
      console.warn(`value cannot be made reactive: ${String(target)}`)
    }
    return target
  }
  // target已经是代理了，则直接返回
  // 在一个reactive对象上调用readonly()的情况除外
  if (
    target[ReactiveFlags.RAW] &&
    !(isReadonly && target[ReactiveFlags.IS_REACTIVE])
  ) {
    return target
  }
  // target已经经过Proxy，直接返回
  const existingProxy = proxyMap.get(target)
  if (existingProxy) {
    return existingProxy
  }
  const proxy = new Proxy(target, baseHandlers)
  proxyMap.set(target, proxy)
  return proxy
}

```

## 浅层只读响应式



```js
// 创建 shallowReadonlyHandlers
const shallowReadonlyGet = createGetter(true, true)
export const shallowReadonlyHandlers = extend(
  {},
  // 复用readonlyHandlers
  readonlyHandlers,
  {
    get: shallowReadonlyGet
  }
)

// 创建浅层只读函数
export const shallowReadonlyMap = new WeakMap()
// 返回原始对象的响应式副copy，其中只有root级别属性为只读属性，并且不展开引用，也不递归地转换返回的属性。可用于创建有状态组件的属性代理对象。
export function shallowReadonly(target){
  return createReactiveObject(
    target,
    true,
    shallowReadonlyHandlers,
    shallowReadonlyMap
  )
}
```



