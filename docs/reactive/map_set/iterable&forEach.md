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

Map、Set中的keys、values、entries都内部都是通过迭代器实现的接口

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



## 创建各种类型的拦截器

```js
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



