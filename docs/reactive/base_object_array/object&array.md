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



这几个方法，在调用的时候都会触发length属性，

```typescript
;(['push', 'pop', 'shift', 'unshift', 'splice'] as const).forEach(key => {
  const method = Array.prototype[key] as any
  arrayInstrumentations[key] = function(this: unknown[], ...args: unknown[]) {
    pauseTracking()
    const res = method.apply(this, args)
    resetTracking()
    return res
  }
})
```





## 浅层

## 只读

## 
