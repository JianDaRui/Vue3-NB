# RunTime Core 源码分析

目录结构

```makefile
├── runtime-core
│   ├── __tests__                        ###  ###
│   ├── src                              ###  ###
│   │   ├── compat                       ###  ###
│   │   │   ├── Navbar                   ###  ###
│   │   │   └── Sidebar                  ###  ###
│   │   ├── components                   ###  ###
│   │   ├── helpers                      ###  ###
│   │   ├── apiAsyncComponent.ts         ###  ###
│   │   ├── apiComputed.ts               ###  ###
│   │   ├── apiCreateApp.ts              ###  ###
│   │   ├── apiWatch.ts          ###  ###
│   │   ├── component.ts         ###  ###
│   │   ├── apiAsyncComponent.ts         ###  ###
│   │   ├── apiAsyncComponent.ts         ###  ###
│   │   ├── apiAsyncComponent.ts         ###  ###
│   │   ├── apiAsyncComponent.ts         ###  ###
│   │   ├── apiAsyncComponent.ts         ###  ###
│   │   ├── apiAsyncComponent.ts         ###  ###
│   │   ├── apiAsyncComponent.ts         ###  ###
│   │   ├── apiAsyncComponent.ts         ###  ###
│   │   ├── apiAsyncComponent.ts         ###  ###
│   │   ├── apiAsyncComponent.ts         ###  ###
│   │   ├── apiAsyncComponent.ts         ###  ###
│   │   ├── apiAsyncComponent.ts         ###  ###
│   │   ├── apiAsyncComponent.ts         ###  ###
│   │   ├── apiAsyncComponent.ts         ###  ###
│   │   ├── apiAsyncComponent.ts         ###  ###
│   │   ├── apiAsyncComponent.ts         ###  ###
│   │   ├── apiAsyncComponent.ts         ###  ###
│   │   └── ...
│   ├── types                            ###  ###
│   ├── api-extractor.json               ###  ###
│   ├── index.js                         ###  ###
│   ├── LICENSE                          ###  ###
│   ├── package.json                     ###  ###
│   ├── README.md                        ###  ###


```



## apiComputed 文件

- 记录 组件创建阶段的 computed Effect 至 instance.effects，方便组件卸载的时候，移除当前实例的 computed effect

```typescript
import {
  computed as _computed,
  ComputedRef,
  WritableComputedOptions,
  WritableComputedRef,
  ComputedGetter
} from '@vue/reactivity'

// 来自component.ts文件
export function recordInstanceBoundEffect(
  effect: ReactiveEffect,
  instance = currentInstance
) {
  if (instance) {
    ;(instance.effects || (instance.effects = [])).push(effect)
  }
}

export function computed<T>(getter: ComputedGetter<T>): ComputedRef<T>
export function computed<T>(
  options: WritableComputedOptions<T>
): WritableComputedRef<T>
export function computed<T>(
  getterOrOptions: ComputedGetter<T> | WritableComputedOptions<T>
) {
   
  const c = _computed(getterOrOptions as any)
  // c.effect
  recordInstanceBoundEffect(c.effect)
  return c
}
```

## apiWatch 文件

apiWatch文件 导出两个API，watch & watchEffect

首先回顾下这两个API如何使用：

watch与watchEffect都属于Vue中的响应式API。

- watchEffect可以根据响应数据状态的变化，自动或者重新执行传入的副作用函数。

- 他接受一个回调函数，并在创建的时候立即执行，同时对齐进行响应式依赖追踪。
- 即建立当前传入的回调函数与所有相关effect的依赖关系。
- 并在依赖变化的时候重新运行该回调函数。
- 并会返回一个stop函数，用来停止侦听，即断开当前watchEffect与其所有依赖的effect之间的关系

```js
const count = ref(0)

const stop = watchEffect(() => console.log(count.value))
// -> logs 0

setTimeout(() => {
  count.value++
  // -> logs 1
}, 100)

// 停止侦听
stop()
```

当然watchEffect也可以接受异步回调函数作为参数。当回调函数为异步时：

- watchEffect可以给传入的函数传递一个异步的onInvalidate函数作为入参，用来注册清理watchEffect失效时的回调函数
- 何时watchEffect会失效：
  - 当手动调用stop函数的时候
  - 当组件卸载的时候

```js

const stop = watchEffect(onInvalidate => {
  const token = performAsyncOperation(id.value)
  onInvalidate(() => {
    // 当调用stop函数时，会执行给onInvalidate传入的回调函数
    token.cancel()
  })
})
onUnmounted(() => {
    console.log('组件卸载')
})
```

为了提高刷新效率，Vue的响应式系统会缓存并异步处理所有watchEffect副作用函数，以避免同一个“tick” 中多个状态改变导致的不必要的重复调用。

> 关于如何缓存并异步处理，稍后源码中进行解析

配置watchEffect，watchEffect可以接受两个参数，第二个参数对watchEffect进行配置：

- 默认情况下（flush: 'pre'），watchEffect副作用会在所有的组件 `update` **前**执行
- 当设置flush: 'post'时，组件更新后会重新运行watchEffect副作用
- 当设置flush: 'sync'时，这将强制效果始终同步触发watchEffect副作用

```vue
<template>
  <div>{{ count }}</div>
</template>

<script>
export default {
  setup() {
    const count = ref(0)
    // 更新前触发
    watchEffect(() => {
      console.log(count.value)
    }, {
    	flush: 'pre'
  	})
	// 更新后触发
    watchEffect(() => {
      console.log(count.value)
    }, {
    	flush: 'post'
  	})
    // 同步触发
	watchEffect(() => {
      console.log(count.value)
    }, {
    	flush: 'sync'
  	})
    return {
      count
    }
  }
}
</script>
```

- watch等同于组件侦听器property
- 需要侦听特定的响应式数据源
- 并在回调喊胡世宗执行副作用
- 默认情况下是惰性的，只有当侦听的数据源发生变化的时候才会执行回调

侦听单个数据源：

```js
// 侦听一个 getter
const state = reactive({ count: 0 })
watch(
  () => state.count,
  (count, prevCount) => {
    /* ... */
  }
)

// 直接侦听ref
const count = ref(0)
watch(count, (count, prevCount) => {
  /* ... */
})
```

侦听多个数据源（直接侦听ref）：

> 注意虽然侦听的是多个数据源，但是当多个数据源发生改变的时候，侦听器仍只会执行一次

```js
setup() {
  const firstName = ref('')
  const lastName = ref('')

  watch([firstName, lastName], (newValues, prevValues) => {
    console.log(newValues, prevValues)
  })

  const changeValues = () => {
    firstName.value = 'John'
    lastName.value = 'Smith'
    // 打印 ["John", "Smith"] ["", ""]
  }

  return { changeValues }
}
```

侦听响应式对象

- deep可进行深度侦听
- immediate可进行立即侦听

```js
const state = reactive({ 
  id: 1,
  attributes: { 
    name: '',
  }
})

watch(
  () => state,
  (state, prevState) => {
    console.log('not deep', state.attributes.name, prevState.attributes.name)
  }
)
// 深度并立即响应侦听
watch(
  () => state,
  (state, prevState) => {
    console.log('deep', state.attributes.name, prevState.attributes.name)
  },
  { deep: true, immediate: true }
)

state.attributes.name = 'Alex' // 日志: "deep" "Alex" "Alex"
```

> 这里需要说下 【副作用】【依赖】都是我们上一篇文章中提到的effet。
>
> 比较关键的是，我们这里接触的是Vue源码中的第二个级别的effect，第一个是compute Effect。这次要说的是watch Effect。

Ok，到这里我们基本已经回顾完这两个响应式API如何使用了，下面我们结合源码，进行分析:

1. watchEffect是如何停止侦听的？
2. watchEffect是如何进行函数缓存的?
3. watchEffect是如何异步进行刷新的？
4. watch是如何侦听单个或者多个数据源的？
5. watch是如何进行深度或者立即侦听响应的？

Vue3中的watch代码中设计的功能比较多，为了方便理解，我们拆开来一点一点进行解析

- watchEffect是如何停止侦听的？

前面提到wach其实也是一个effect，所谓的侦听就是watch与其他effect之间建立一个依赖关系，当数据发生变化的时候，去遍历执行所有的effect，就会执行watch。

在上一篇文章中我们提到，effect中有个stop函数，用于断开传入effect与之相关的依赖之间的关系。

所谓的停止侦听就是断开watch与所有相关effect的依赖关系。当创建watch Effect时，会为其维护一个deps属性，用于存储所有的dep。故当我们创建watch的时候，将当前runner传给stop函数，并返回一个函数，用户调用的时候，就会停止侦听。

```js
// reactive effect.ts 文件
export function stop(effect) {
  if (effect.active) {
    cleanup(effect)
    if (effect.options.onStop) {
      effect.options.onStop()
    }
    effect.active = false
  }
}
function cleanup(effect) {
  const { deps } = effect
  if (deps.length) {
    for (let i = 0; i < deps.length; i++) {
      deps[i].delete(effect)
    }
    deps.length = 0
  }
}

// 真正的watch函数
function doWatch(
  source,
  cb,
  { immediate, deep, flush, onTrack, onTrigger } = EMPTY_OBJ,
  instance 
) {
  let getter: () => any
  // 定义runner
  // watch 级别的effect
  // runner执行，即执行getter函数
  const runner = effect(getter, {
    lazy: true,
    onTrack,
    onTrigger,
    scheduler
  })

  
  // 返回一个stop函数
  // 用于断开runner与其他依赖之间的关系
  // 并将其将从instance.effects中移除
  return () => {
    stop(runner)
    // 
    if (instance) {
      remove(instance.effects!, runner)
    }
  }
}
```

- watchEffect是如何进行函数缓存的?



- watchEffect是如何异步进行刷新的？

```js
// 真正的watch函数
function doWatch(
  source,
  cb,
  { immediate, deep, flush, onTrack, onTrigger } = EMPTY_OBJ,
  instance = currentInstance
) {
  
  let getter: () => any
  let forceTrigger = false
  let isMultiSource = false
  
  /* Start: 开始定义getter函数 */
  if (isRef(source)) {
    // 源是ref类型
    getter = () => source.value
    forceTrigger = !!source._shallow
  } else if (isReactive(source)) {
    // 源是响应式对象
    // 自动进行深度侦听
    getter = () => source
    deep = true
  } else if (isArray(source)) {
    // 侦听多个源
    isMultiSource = true
    forceTrigger = source.some(isReactive)
    getter = () =>
      // 遍历判断源
      source.map(s => {
        if (isRef(s)) {
          return s.value
        } else if (isReactive(s)) {
          // 递归返回值
          return traverse(s)
        } else if (isFunction(s)) {
          // 执行函数
          return callWithErrorHandling(s, instance, ErrorCodes.WATCH_GETTER)
        } else {
          // 已上都不是 则进行警示
          __DEV__ && warnInvalidSource(s)
        }
      })
  } else if (isFunction(source)) {
    // 数据源是函数
    if (cb) {
      // getter with cb
      getter = () =>
        callWithErrorHandling(source, instance, ErrorCodes.WATCH_GETTER)
    } else {
      // no cb -> simple effect
      // 没有传回调函数的情况
      getter = () => {
        if (instance && instance.isUnmounted) {
          return
        }
        if (cleanup) {
          cleanup()
        }
        return callWithAsyncErrorHandling(
          source,
          instance,
          ErrorCodes.WATCH_CALLBACK,
          [onInvalidate]
        )
      }
    }
  } else {
    getter = NOOP
    __DEV__ && warnInvalidSource(source)
  }
  /* End: 定义getter函数结束 */

  // 2.x array mutation watch compat
  // Vue2做兼容处理
  if (__COMPAT__ && cb && !deep) {
    const baseGetter = getter
    getter = () => {
      const val = baseGetter()
      if (
        isArray(val) &&
        checkCompatEnabled(DeprecationTypes.WATCH_ARRAY, instance)
      ) {
        traverse(val)
      }
      return val
    }
  }

  if (cb && deep) {
    // 深度侦听，则递归遍历getter函数返回的值
    const baseGetter = getter
    getter = () => traverse(baseGetter())
  }

  let cleanup: () => void

  // 定义失效时需要传参的函数
  let onInvalidate: InvalidateCbRegistrator = (fn: () => void) => {
    cleanup = runner.options.onStop = () => {
      callWithErrorHandling(fn, instance, ErrorCodes.WATCH_CLEANUP)
    }
  }

  // 服务端渲染的情况下，不必创建一个真正的effect， onInvalidate 应该为一个空对象，
  // 触发 immediate 为true
  if (__NODE_JS__ && isInSSRComponentSetup) {
    // we will also not call the invalidate callback (+ runner is not set up)
    onInvalidate = NOOP
    if (!cb) {
      getter()
    } else if (immediate) {
      callWithAsyncErrorHandling(cb, instance, ErrorCodes.WATCH_CALLBACK, [
        getter(),
        undefined,
        onInvalidate
      ])
    }
    return NOOP
  }

  let oldValue = isMultiSource ? [] : INITIAL_WATCHER_VALUE

  // 定义任务队列中的任务
  // 用于执行runner函数
  // 执行的过程会进行track & trigger
  const job: SchedulerJob = () => {
    if (!runner.active) {
      return
    }
    if (cb) {
      // watch(source, cb)
      // runner执行就是在执行getter函数，获取newValue
      const newValue = runner()
      if (
        deep ||
        forceTrigger ||
        (isMultiSource
          ? (newValue as any[]).some((v, i) =>
              hasChanged(v, (oldValue as any[])[i])
            )
          : hasChanged(newValue, oldValue)) ||
        (__COMPAT__ &&
          isArray(newValue) &&
          isCompatEnabled(DeprecationTypes.WATCH_ARRAY, instance))
      ) {
        // watch API的处理方式
        // cleanup before running cb again
        if (cleanup) {
          cleanup()
        }
        // 执行回调函数
        // 因为我们在传入的cb中很有可能读取或者更改响应式数据
        // 因此可能会进行 track || trigger
        // 将newValue & oldValue传给cb
        callWithAsyncErrorHandling(cb, instance, ErrorCodes.WATCH_CALLBACK, [
          newValue, 
          oldValue === INITIAL_WATCHER_VALUE ? undefined : oldValue,
          onInvalidate
        ])
        // 将新值赋值给旧值
        oldValue = newValue
      }
    } else {
      // watchEffect
      // watchEffect API的处理方式，直接执行runner
      runner()
    }
  }

  // 将job标记为一个可以侦测的回调函数，以便调度器知道他可以自动进行响应触发（trigger）
  job.allowRecurse = !!cb

  // 调度器，有没有想到computed API 创建的时候，在配置项中设置的 scheduler
  // 在computed中scheduler主要负责重置 dirty
  // 当 watche Effect 侦测的数据源发生变化的时候
  // 会进行trigger，遍历执行所有与数据源相关的 effect
  // 在遍历的过程中会判断effect.scheduler 是否存在
  // 如果存在 则会执行scheduler（任务调度器），这一点与我们第一篇提到的computed的原理一样
  // scheduler执行 其实就是在执行job，job执行就是在执行 runner Effect
  // 即watch Effect
  let scheduler: ReactiveEffectOptions['scheduler']
  if (flush === 'sync') {
    // 同步更新
    scheduler = job as any // 任务调度函数被直接调用
  } else if (flush === 'post') {
    // 组件更新后
    scheduler = () => queuePostRenderEffect(job, instance && instance.suspense)
  } else {
    // default: 'pre'
    // 默认情况下
    scheduler = () => {
      if (!instance || instance.isMounted) {
        // 进行异步更新
        queuePreFlushCb(job)
      } else {
        // 使用 'pre' 选项，第一次调用必须在组件安装之前发生，以便同步调用。
        job()
      }
    }
  }

  // 定义runner
  // watch 级别的effect
  // runner执行，即执行getter函数
  const runner = effect(getter, {
    lazy: true,
    onTrack,
    onTrigger,
    scheduler
  })
  
  // 将watch effect 存至instance.effects
  // 当组件卸载的时候会清空当前runner与依赖之间的关系
  recordInstanceBoundEffect(runner, instance)

  // initial run
  if (cb) {
    if (immediate) {
      // 立即执行
      // 即进行track & trigger
      job()
    } else {
      oldValue = runner()
    }
  } else if (flush === 'post') {
    queuePostRenderEffect(runner, instance && instance.suspense)
  } else {
    runner()
  }

  // 返回一个stop函数
  // 用于断开runner与其他依赖之间的关系
  // 并将其将从instance.effects中移除
  return () => {
    stop(runner)
    // 
    if (instance) {
      remove(instance.effects!, runner)
    }
  }
}
```

- watch是如何侦听单个或者多个数据源的？

```js
function doWatch(
  source,
  cb,
  { immediate, deep, flush, onTrack, onTrigger } = EMPTY_OBJ,
  instance = currentInstance
) {
  // 省略部分代码...
  
  let getter: () => any
  let forceTrigger = false
  let isMultiSource = false
  
  /* Start: 开始定义getter函数 */
  if (isRef(source)) {
    // 源是ref类型
    getter = () => source.value
    forceTrigger = !!source._shallow
  } else if (isReactive(source)) {
    // 源是响应式对象
    // 自动进行深度侦听
    getter = () => source
    deep = true
  } else if (isArray(source)) {
    // 侦听多个源
    isMultiSource = true
    forceTrigger = source.some(isReactive)
    getter = () =>
      // 遍历判断源
      source.map(s => {
        if (isRef(s)) {
          return s.value
        } else if (isReactive(s)) {
          // 递归返回值
          return traverse(s)
        } else if (isFunction(s)) {
          // 执行函数
          return callWithErrorHandling(s, instance, ErrorCodes.WATCH_GETTER)
        } else {
          // 已上都不是 则进行警示
          __DEV__ && warnInvalidSource(s)
        }
      })
  } else if (isFunction(source)) {
    // 数据源是函数
    if (cb) {
      // getter with cb
      getter = () =>
        callWithErrorHandling(source, instance, ErrorCodes.WATCH_GETTER)
    } else {
      // no cb -> simple effect
      // 没有传回调函数的情况
      getter = () => {
        if (instance && instance.isUnmounted) {
          return
        }
        if (cleanup) {
          cleanup()
        }
        return callWithAsyncErrorHandling(
          source,
          instance,
          ErrorCodes.WATCH_CALLBACK,
          [onInvalidate]
        )
      }
    }
  } else {
    getter = NOOP
    __DEV__ && warnInvalidSource(source)
  }
  /* End: 定义getter函数结束 */
  
  // 省略部分代码...
}
```



```typescript
// 简单的 watch effect.
export function watchEffect(
  effect: WatchEffect,
  options?: WatchOptionsBase
): WatchStopHandle {
  return doWatch(effect, null, options)
}
// 进行重载，侦听多个数据源 & cb
export function watch<
  T extends MultiWatchSources,
  Immediate extends Readonly<boolean> = false
>(
  sources: [...T],
  cb: WatchCallback<MapSources<T, false>, MapSources<T, Immediate>>,
  options?: WatchOptions<Immediate>
): WatchStopHandle

// 重载：侦听多个数据源，并且数据源是只读的
export function watch<
  T extends Readonly<MultiWatchSources>,
  Immediate extends Readonly<boolean> = false
>(
  source: T,
  cb: WatchCallback<MapSources<T, false>, MapSources<T, Immediate>>,
  options?: WatchOptions<Immediate>
): WatchStopHandle

// 重载：简单watch Effect & cb
export function watch<T, Immediate extends Readonly<boolean> = false>(
  source: WatchSource<T>,
  cb: WatchCallback<T, Immediate extends true ? (T | undefined) : T>,
  options?: WatchOptions<Immediate>
): WatchStopHandle

// 重载：侦听响应式对象 & cb
export function watch<
  T extends object,
  Immediate extends Readonly<boolean> = false
>(
  source: T,
  cb: WatchCallback<T, Immediate extends true ? (T | undefined) : T>,
  options?: WatchOptions<Immediate>
): WatchStopHandle

// 执行创建 watch
export function watch<T = any, Immediate extends Readonly<boolean> = false>(
  source: T | WatchSource<T>,
  cb: any,
  options?: WatchOptions<Immediate>
): WatchStopHandle {
  if (__DEV__ && !isFunction(cb)) {
     // 省略...
  }
  // 返回的是一个stop函数
  return doWatch(source as any, cb, options)
}
// 真正的watch函数
function doWatch(
  source: WatchSource | WatchSource[] | WatchEffect | object,
  cb: WatchCallback | null,
  { immediate, deep, flush, onTrack, onTrigger }: WatchOptions = EMPTY_OBJ,
  instance = currentInstance
): WatchStopHandle {
  // dev环境下判断 immediate, deep
  if (__DEV__ && !cb) {
    if (immediate !== undefined) {
      warn(
        `watch() "immediate" option is only respected when using the ` +
          `watch(source, callback, options?) signature.`
      )
    }
    if (deep !== undefined) {
      warn(
        `watch() "deep" option is only respected when using the ` +
          `watch(source, callback, options?) signature.`
      )
    }
  }
  // 校验数据源
  const warnInvalidSource = (s: unknown) => {
    warn(
      `Invalid watch source: `,
      s,
      `A watch source can only be a getter/effect function, a ref, ` +
        `a reactive object, or an array of these types.`
    )
  }

  let getter: () => any
  let forceTrigger = false
  let isMultiSource = false
  
  /* Start: 开始定义getter函数 */
  if (isRef(source)) {
    // 源是ref类型
    getter = () => source.value
    forceTrigger = !!source._shallow
  } else if (isReactive(source)) {
    // 源是响应式对象
    // 自动进行深度侦听
    getter = () => source
    deep = true
  } else if (isArray(source)) {
    // 侦听多个源
    isMultiSource = true
    forceTrigger = source.some(isReactive)
    getter = () =>
      // 遍历判断源
      source.map(s => {
        if (isRef(s)) {
          return s.value
        } else if (isReactive(s)) {
          // 递归返回值
          return traverse(s)
        } else if (isFunction(s)) {
          // 执行函数
          return callWithErrorHandling(s, instance, ErrorCodes.WATCH_GETTER)
        } else {
          // 已上都不是 则进行警示
          __DEV__ && warnInvalidSource(s)
        }
      })
  } else if (isFunction(source)) {
    // 数据源是函数
    if (cb) {
      // getter with cb
      getter = () =>
        callWithErrorHandling(source, instance, ErrorCodes.WATCH_GETTER)
    } else {
      // no cb -> simple effect
      // 没有传回调函数的情况
      getter = () => {
        if (instance && instance.isUnmounted) {
          return
        }
        if (cleanup) {
          cleanup()
        }
        return callWithAsyncErrorHandling(
          source,
          instance,
          ErrorCodes.WATCH_CALLBACK,
          [onInvalidate]
        )
      }
    }
  } else {
    getter = NOOP
    __DEV__ && warnInvalidSource(source)
  }
  /* End: 定义getter函数结束 */

  // 2.x array mutation watch compat
  // Vue2做兼容处理
  if (__COMPAT__ && cb && !deep) {
    const baseGetter = getter
    getter = () => {
      const val = baseGetter()
      if (
        isArray(val) &&
        checkCompatEnabled(DeprecationTypes.WATCH_ARRAY, instance)
      ) {
        traverse(val)
      }
      return val
    }
  }

  if (cb && deep) {
    // 深度侦听，则递归遍历getter函数返回的值
    const baseGetter = getter
    getter = () => traverse(baseGetter())
  }

  let cleanup: () => void

  // 定义失效时需要传参的函数
  let onInvalidate: InvalidateCbRegistrator = (fn: () => void) => {
    cleanup = runner.options.onStop = () => {
      callWithErrorHandling(fn, instance, ErrorCodes.WATCH_CLEANUP)
    }
  }

  // 服务端渲染的情况下，不必创建一个真正的effect， onInvalidate 应该为一个空对象，
  // 触发 immediate 为true
  if (__NODE_JS__ && isInSSRComponentSetup) {
    // we will also not call the invalidate callback (+ runner is not set up)
    onInvalidate = NOOP
    if (!cb) {
      getter()
    } else if (immediate) {
      callWithAsyncErrorHandling(cb, instance, ErrorCodes.WATCH_CALLBACK, [
        getter(),
        undefined,
        onInvalidate
      ])
    }
    return NOOP
  }

  let oldValue = isMultiSource ? [] : INITIAL_WATCHER_VALUE

  // 定义任务队列中的任务
  // 用于执行runner函数
  // 执行的过程会进行track & trigger
  const job: SchedulerJob = () => {
    if (!runner.active) {
      return
    }
    if (cb) {
      // watch(source, cb)
      // runner执行就是在执行getter函数，获取newValue
      const newValue = runner()
      if (
        deep ||
        forceTrigger ||
        (isMultiSource
          ? (newValue as any[]).some((v, i) =>
              hasChanged(v, (oldValue as any[])[i])
            )
          : hasChanged(newValue, oldValue)) ||
        (__COMPAT__ &&
          isArray(newValue) &&
          isCompatEnabled(DeprecationTypes.WATCH_ARRAY, instance))
      ) {
        // watch API的处理方式
        // cleanup before running cb again
        if (cleanup) {
          cleanup()
        }
        // 执行回调函数
        // 因为我们在传入的cb中很有可能读取或者更改响应式数据
        // 因此可能会进行 track || trigger
        // 将newValue & oldValue传给cb
        callWithAsyncErrorHandling(cb, instance, ErrorCodes.WATCH_CALLBACK, [
          newValue, 
          oldValue === INITIAL_WATCHER_VALUE ? undefined : oldValue,
          onInvalidate
        ])
        // 将新值赋值给旧值
        oldValue = newValue
      }
    } else {
      // watchEffect
      // watchEffect API的处理方式，直接执行runner
      runner()
    }
  }

  // 将job标记为一个可以侦测的回调函数，以便调度器知道他可以自动进行响应触发（trigger）
  job.allowRecurse = !!cb

  // 调度器，有没有想到computed API 创建的时候，在配置项中设置的 scheduler
  // 在computed中scheduler主要负责重置 dirty
  // 当 watche Effect 侦测的数据源发生变化的时候
  // 会进行trigger，遍历执行所有与数据源相关的 effect
  // 在遍历的过程中会判断effect.scheduler 是否存在
  // 如果存在 则会执行scheduler（任务调度器），这一点与我们第一篇提到的computed的原理一样
  // scheduler执行 其实就是在执行job，job执行就是在执行 runner Effect
  // 即watch Effect
  let scheduler: ReactiveEffectOptions['scheduler']
  if (flush === 'sync') {
    // 同步更新
    scheduler = job as any // 任务调度函数被直接调用
  } else if (flush === 'post') {
    // 组件更新后
    scheduler = () => queuePostRenderEffect(job, instance && instance.suspense)
  } else {
    // default: 'pre'
    // 默认情况下
    scheduler = () => {
      if (!instance || instance.isMounted) {
        queuePreFlushCb(job)
      } else {
        // 使用 'pre' 选项，第一次调用必须在组件安装之前发生，以便同步调用。
        job()
      }
    }
  }

  // 定义runner
  // watch 级别的effect
  // runner执行，即执行getter函数
  const runner = effect(getter, {
    lazy: true,
    onTrack,
    onTrigger,
    scheduler
  })
  
  // 将watch effect 存至instance.effects
  // 当组件卸载的时候会清空当前runner与依赖之间的关系
  recordInstanceBoundEffect(runner, instance)

  // initial run
  if (cb) {
    if (immediate) {
      // 立即执行
      // 即进行track & trigger
      job()
    } else {
      oldValue = runner()
    }
  } else if (flush === 'post') {
    queuePostRenderEffect(runner, instance && instance.suspense)
  } else {
    runner()
  }

  // 返回一个stop函数
  // 用于断开runner与其他依赖之间的关系
  // 并将其将从instance.effects中移除
  return () => {
    stop(runner)
    // 
    if (instance) {
      remove(instance.effects!, runner)
    }
  }
}

// this.$watch
// 组件实例上的watch API
export function instanceWatch(
  this: ComponentInternalInstance,
  source: string | Function,
  value: WatchCallback | ObjectWatchOptionItem,
  options?: WatchOptions
): WatchStopHandle {
  const publicThis = this.proxy as any
  // 定义getter函数
  const getter = isString(source)
    ? source.includes('.')
      ? createPathGetter(publicThis, source)
      : () => publicThis[source]
    : source.bind(publicThis, publicThis)
  let cb
  if (isFunction(value)) {
    cb = value
  } else {
    cb = value.handler as Function
    options = value
  }
  return doWatch(getter, cb.bind(publicThis), options, this)
}

// 获取侦测路径
export function createPathGetter(ctx: any, path: string) {
  const segments = path.split('.')
  return () => {
    let cur = ctx
    for (let i = 0; i < segments.length && cur; i++) {
      cur = cur[segments[i]]
    }
    return cur
  }
}

// 递归遍历获取值
// seen用于防止陷入死循环
function traverse(value: unknown, seen: Set<unknown> = new Set()) {
  if (
    !isObject(value) ||
    seen.has(value) ||
    (value as any)[ReactiveFlags.SKIP]
  ) {
    return value
  }
  seen.add(value)
  if (isRef(value)) {
    traverse(value.value, seen)
  } else if (isArray(value)) {
    for (let i = 0; i < value.length; i++) {
      traverse(value[i], seen)
    }
  } else if (isSet(value) || isMap(value)) {
    value.forEach((v: any) => {
      traverse(v, seen)
    })
  } else if (isPlainObject(value)) {
    for (const key in value) {
      traverse((value as any)[key], seen)
    }
  }
  return value
}


```

