# 遍历模式&迭代模式

## 遍历模式

```js
function forEach(arr, callback, thisArg) {
    for(let i = 0; i < arr.length; i++) {
        callback.call(thisArg, arr[i], i, arr)
    }
}
```

Map或者Set调用遍历方法forEach，并根据需要进行相应转化

对forEach进行重新封装

- 通过传入参数isReadonly、isShallow 获取对应的reactive函数
- 再遍历的时候对value和key进行响应式转换

```js
function createForEach(isReadonly, isShallow) {
  return function forEach( this, callback, thisArg ) {
    const observed = this
    const target = observed[ReactiveFlags.RAW]
    const rawTarget = toRaw(target)
    
    // 获取转换函数
    const wrap = isShallow ? toShallow : isReadonly ? toReadonly : toReactive
    
    !isReadonly && track(rawTarget, TrackOpTypes.ITERATE, ITERATE_KEY)
    // 调用对象的原始forEac方法。
    return target.forEach((value: unknown, key: unknown) => {
      // important: make sure the callback is
      // 1. invoked with the reactive map as `this` and 3rd arg
      // 2. the value received should be a corresponding reactive/readonly.
      // 对值和value进行相应转化
      return callback.call(thisArg, wrap(value), wrap(key), observed)
    })
  }
}
```



## 迭代器模式

- 迭代器模式主要是提供一种方法顺序访问一个聚合对象中各个元素, 而又无须暴露该对象的内部表示。
- 当需要为一类聚合对象或者数据结构提供一个统一的、简便的访问接口
- 需要有序的访问聚合对象中的成员
- 需要反复多次执行一段逻辑程序时就可以使用迭代器模式
- 需要把元素之间游走的责任交给迭代器



ES6中新增的Iterator主要是为了解决JS中原有"集合"及新增集合Map、Set的遍历问题。ES6为Array、Map、Set、String、TypedArray、函数的 arguments 对象、NodeList 对象都部署了Symbol.iterator接口，凡是部署了`Symbol.iterator`属性的数据结构，就称为部署了遍历器接口。调用这个接口，就会返回一个遍历器对象。



实现一个自定义迭代器的要素：

- 需要实现一个iterator接口，
- 需要暴露一个属性作为"默认迭代器"，且这个属性必须要使用特殊的Symbol.iterator作为键
- 需要一个可选的return方法用于指定在迭代器提前关闭时执行的逻辑，该方法返回一个有效的可迭代对象

```js
class logArray {
    constructor(arr) {
        this.arr = arr
        this.length = arr.length
    }
    [Symbol.iterator]() {
        let i = 0;
        let length = this.length;
        let arr = this.arr;
        return {
            next() {
                if(i < length) {
                    return { done: false, value: arr[i++] * 2 }
                } else {
                    return { done: true }
                }
            },
            return() {
                // 提供提前终结能力
                return { done: true }
            }
    
        }
    }
}

let arr = new logArray([1,2,3,4,5]);
for(let i of arr) {
    console.log(i)
}
// 2
// 4
// 6
// 8
// 10
```

Vue3中为什么使用迭代器改写Map、Set的集合方法？

- 为了再进行遍历操作的时候进行track
- 为了可以根据参数进行响应式转换

Map、Set中的 keys、values、entries都内部都是通过迭代器实现的接口

需要再遍历获取值得时候进行track、再调用迭代器接口的时候对值进行转化

### Iterable

```js
function createIterableMethod( method, isReadonly, isShallow) {
  return function( this, ...args ){
    const target = this[ReactiveFlags.RAW]
    const rawTarget = toRaw(target)
    const targetIsMap = isMap(rawTarget)
    const isPair =
      method === 'entries' || (method === Symbol.iterator && targetIsMap)
    const isKeyOnly = method === 'keys' && targetIsMap
    const innerIterator = target[method](...args)
    
    // 根据参数获取对应的响应转换函数
    const wrap = isShallow ? toShallow : isReadonly ? toReadonly : toReactive
    
    // 依赖收集
    !isReadonly &&
      track(
        rawTarget,
        TrackOpTypes.ITERATE,
        isKeyOnly ? MAP_KEY_ITERATE_KEY : ITERATE_KEY
      )
    
    // return a wrapped iterator which returns observed versions of the
    // values emitted from the real iterator
    return {
      // iterator protocol
      next() {
        const { value, done } = innerIterator.next()
        return done
          ? { value, done }
          : {
              value: isPair ? [wrap(value[0]), wrap(value[1])] : wrap(value),
              done
            }
      },
      // iterable protocol
      [Symbol.iterator]() {
        return this
      }
    }
  }
}
```



## 创建各种类型的Instrumentation

- 正常情况

```typescript
const mutableInstrumentations: Record<string, Function> = {
  get(this: MapTypes, key: unknown) {
    return get(this, key)
  },
  get size() {
    return size((this as unknown) as IterableCollections)
  },
  has,
  add,
  set,
  delete: deleteEntry,
  clear,
  forEach: createForEach(false, false)
}
```
- 浅层转换

```js
const shallowInstrumentations: Record<string, Function> = {
  get(this: MapTypes, key: unknown) {
    return get(this, key, false, true)
  },
  get size() {
    return size((this as unknown) as IterableCollections)
  },
  has,
  add,
  set,
  delete: deleteEntry,
  clear,
  forEach: createForEach(false, true)
}


```

- 只读转换

```js
const readonlyInstrumentations: Record<string, Function> = {
  get(this: MapTypes, key: unknown) {
    return get(this, key, true)
  },
  get size() {
    return size((this as unknown) as IterableCollections, true)
  },
  has(this: MapTypes, key: unknown) {
    return has.call(this, key, true)
  },
  add: createReadonlyMethod(TriggerOpTypes.ADD),
  set: createReadonlyMethod(TriggerOpTypes.SET),
  delete: createReadonlyMethod(TriggerOpTypes.DELETE),
  clear: createReadonlyMethod(TriggerOpTypes.CLEAR),
  forEach: createForEach(true, false)
}
```

- 浅层只读转换

```js
const shallowReadonlyInstrumentations: Record<string, Function> = {
  get(this: MapTypes, key: unknown) {
    return get(this, key, true, true)
  },
  get size() {
    return size((this as unknown) as IterableCollections, true)
  },
  has(this: MapTypes, key: unknown) {
    return has.call(this, key, true)
  },
  add: createReadonlyMethod(TriggerOpTypes.ADD),
  set: createReadonlyMethod(TriggerOpTypes.SET),
  delete: createReadonlyMethod(TriggerOpTypes.DELETE),
  clear: createReadonlyMethod(TriggerOpTypes.CLEAR),
  forEach: createForEach(true, true)
}
```



改写迭代器方法：

```js
const iteratorMethods = ['keys', 'values', 'entries', Symbol.iterator]
iteratorMethods.forEach(method => {
  mutableInstrumentations[method as string] = createIterableMethod(
    method,
    false,
    false
  )
  readonlyInstrumentations[method as string] = createIterableMethod(
    method,
    true,
    false
  )
  shallowInstrumentations[method as string] = createIterableMethod(
    method,
    false,
    true
  )
  shallowReadonlyInstrumentations[method as string] = createIterableMethod(
    method,
    true,
    true
  )
})
```



参考：

- https://developer.mozilla.org/zh-CN/docs/Web/JavaScript/Guide/Iterators_and_Generators

- https://es6.ruanyifeng.com/#docs/iterator

- https://m.runoob.com/design-pattern/iterator-pattern.html

