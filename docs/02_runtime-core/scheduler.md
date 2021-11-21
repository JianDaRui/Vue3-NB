# 第三篇 RunTimeCore——scheduler源码分析 

## 任务调度器

schedler在Vue3中主要负责组件update前后的任务调度工作，

> 前置铺垫：schedler的源码虽然只有二百多行，并且与组件更新前后、更新中的所有执行的【任务】有关。【任务】在这里有比较抽象，理解起来比较困难。好在有一点就是我们在上一篇的文章中有理解到一个任务：watch Effect。我们就可以结合这个job，对scheduler进行分析。在后续的文章中，当我们讲解到update阶段的时候，会回来再看下scheduler。到时候就能明白不少啦。

调度器在执行任务的过程中，主要将任务分为三个阶段，每个阶段两种状态：

- 前置刷新阶段
- 刷新阶段
- 后置刷新阶段

每个阶段各有两种状态：

- 正在等待刷新
- 正在刷新

每次刷新的时候，通过Promise.resolve启动一个微任务，调用flushJob函数，先进行前置刷新工作，直至前置回调任务池为空，在刷新当前任务队列，当前任务队列刷新结束，最后刷新后置回调任务池，如此循环往复，直至三个任务池中的回调都刷新结束。



在讲解watch的时候，我们说过，watch effect会在组件update之前执行。这与用户定义的副作用函数 配置项fulsh有关。

- flush: pre，默认值。watch Effect的flush就是pre
  - 在创建watch的时候通过调用queuePreFlushCb(job)，将副作用函数push至pendingPreFlushCbs
  - 当组件需要进行update的时候，会先遍历执行pendingPreFlushCbs池中的回调
  - 从而做到在组件update前进行刷新。

- fulsh: post。可选 但不推荐
  - 当设置watch effect的flush为post的时候就会调用queuePostFlushCb函数，将副作用函数push至pendingPostFlushCbs
  - 当queue中的任务执行完之后，就会遍历执行pendingPostFlushCbs中的任务
  - 从而做到在组件update后进行刷新

下面我们一起看下这块相关的代码：

```js
// 前置更新相关
const pendingPreFlushCbs = []
let activePreFlushCbs = null
let preFlushIndex = 0

// 后置更新相关
const pendingPostFlushCbs  = []
let activePostFlushCbs = null
let postFlushIndex = 0
function queuePreFlushCb(cb) {
  queueCb(cb, activePreFlushCbs, pendingPreFlushCbs, preFlushIndex)
}

function queuePostFlushCb(cb) {
  queueCb(cb, activePostFlushCbs, pendingPostFlushCbs, postFlushIndex)
}

function queueCb(cb, activeQueue, pendingQueue, index) {
  if (!isArray(cb)) {
    // cb不是数组
    if (
      !activeQueue ||
      !activeQueue.includes(
        cb,
        (cb as SchedulerJob).allowRecurse ? index + 1 : index
      )
    ) {
      // activeQueue不存在 || 从index+1位置开始activeQueue不包含cb
      // watch job 会进来
      pendingQueue.push(cb)
    }
  } else {

    // 如果cb是一个数组，则它是一个组件生命周期挂钩，只能由一个作业触发，
    // 该作业已在主队列中消除重复，sowe可以在此处跳过重复检查以提高性能
    pendingQueue.push(...cb)
  }
  queueFlush()
}
```

从上面的代码中可以复制往各阶段任务池中，push任务的主要是queueCb函数，queueCb函数主要负责对任务进行判断，当任务是数组时，会直接解构至待执行队列中，当任务非数组的时候，需要对任务进行判断，push的任务不能在正在执行的任务队列中存在，或者当前没有正在执行的任务队列。最后会调用queueFlush函数。

queueFlush函数会根据当前的状态进行判断，只有非正在刷新且非正在等待刷新的状态下。才会通过Promise.resolve启动微任务，刷新队列。

看下queueFlush的代码：

```js
// 冲刷队列
function queueFlush() {
  // 如果没有正在刷新的 && 正在等待刷新的
  // 则执行 flushJobs
  if (!isFlushing && !isFlushPending) {
    // 正在等待刷新
    isFlushPending = true
    // 启动微任务，开始刷新任务队列。
    // flushJobs执行结束 将promise赋值给 currentFlushPromise
    currentFlushPromise = resolvedPromise.then(flushJobs)
  }
}
```

当启动微任务刷新队列的时候，会将isFlushPending = true，表示开始等待刷新。当当前宏任务执行结束后，会执行相应的微任务队列，这是就会调用flushJobs函数。开始刷新队列。

> 当前宏任务有哪些，我们先不关注。首先要知道每个宏任务都会对应一个微任务队列，宏任务执行结束才会执行相应的微任务队列。
>
> 这也就是Vue说的【避免同一个“tick” 中多个状态改变导致的不必要的重复调用，并异步刷新用户副作用函数】

```js
function flushJobs(seen?: CountMap) {
  // 👉 等待刷新结束第三方，开始刷新
  isFlushPending = false
  isFlushing = true
  if (__DEV__) {
    seen = seen || new Map()
  }

  // 👉 前置刷新开始 jobs
  flushPreFlushCbs(seen)
  // 👉 前置刷新结束

  // Sort queue before flush.
  // This ensures that:
  // 1. Components are updated from parent to child. (because parent is always
  //    created before the child so its render effect will have smaller
  //    priority number)
  // 2. If a component is unmounted during a parent component's update,
  //    its update can be skipped.
  // 👉 在刷新前对队列排序
  // 1. 保证组件更新顺序是从父组件到子组件（因为父组件总是在子组件之前创建，所以其渲染副作用的优先级将更小）
  // 2.如果一个子组件在父组件更新期间卸载了，可以跳过该子组件的更新。
  queue.sort((a, b) => getId(a) - getId(b))

  try {
    for (flushIndex = 0; flushIndex < queue.length; flushIndex++) {
      const job = queue[flushIndex]
      if (job && job.active !== false) {
        if (__DEV__ && checkRecursiveUpdates(seen!, job)) {
          continue
        }
        // 执行 job 函数
        callWithErrorHandling(job, null, ErrorCodes.SCHEDULER)
      }
    }
  } finally {
    // 👉 重置正在刷新队列
    flushIndex = 0
    queue.length = 0

    // 👉 刷新后置刷新jobs
    flushPostFlushCbs(seen)
    // 👉 刷新结束
    isFlushing = false
      
    // 重置当前刷新的promise
    // 最后再nextTick中会用到
    currentFlushPromise = null
    // some postFlushCb queued jobs!
    // keep flushing until it drains.
    // 👉 如果还有当前任务或者，等待的预算新任务，或者等待的后刷新任务，则递归刷新
    if (
      queue.length ||
      pendingPreFlushCbs.length ||
      pendingPostFlushCbs.length
    ) {
      // 递归刷新
      flushJobs(seen)
    }
  }
}
```

flushJobs函数就是切入口，主要负责所有任务队列的刷新工作，前置任务的刷新主要是在该函数中调起flushPreFlushCbs(seen)函数，先去刷新前置任务池中的所有任务。

flushPreFlushCbs(seen) 函数代码：

```js
export function flushPreFlushCbs(seen ,parentJob) {
  if (pendingPreFlushCbs.length) {
    currentPreFlushParentJob = parentJob
    // 👉 去重
    activePreFlushCbs = [...new Set(pendingPreFlushCbs)]
    // 👉  置预刷jobs array 为空
    pendingPreFlushCbs.length = 0
    if (__DEV__) {
      seen = seen || new Map()
    }
    for (
      preFlushIndex = 0;
      preFlushIndex < activePreFlushCbs.length;
      preFlushIndex++
    ) {
      if (
        __DEV__ &&
        checkRecursiveUpdates(seen!, activePreFlushCbs[preFlushIndex])
      ) {
        // 递归刷新检查
        continue
      }
      // 👉 执行job eg: watch job
      // 👉 watch 会在这里执行
      activePreFlushCbs[preFlushIndex]()
    }
    // 👉 重置
    activePreFlushCbs = null
    preFlushIndex = 0
    currentPreFlushParentJob = null
    // recursively flush until it drains
    // 👉 递归刷新预刷新jobs
    flushPreFlushCbs(seen, parentJob)
  }
}
```

对与flushPreFlushCbs函数，我们把主要关注点先放在：

- 前置更新状态的切换，由pending 到 active
- 遍历执行前置任务池中的每个任务
- 当遍历结束会重置当前状态及index
- 递归调用flushPreFlushCbs，直至pendingPreFlushCbs任务池为空。
- 主要是保证所有正在等待的队列会被执行到

> 有的同学可能会有疑问：既然已经 通过 pendingPreFlushCbs.length = 0，将待执行任务池清空了，为什么还需要递归继续。
>
> 这个其实与遍历执行的任务有关，有的任务中，还会继续创建待执行任务，这是就会将创建的待执行任务继续push至待执行任务池。故需要递归遍历执行

当flushPreFlushCbs函数执行结束后，就会进行当前遍历。即进入了flushing阶段，这时纯在与queue的update函数就会执行，组件就会进行更新。但是在执行queue中的任务的时候，需要对任务去重 排序，这些工作完成之后，才会遍历执行queue中的任务。

当queue中的任务执行结束后，会通过 flushIndex = 0  ，queue.length = 0，对当前队列进行重置。

随后就会调用flushPostFlushCbs函数，该函数会刷新后置刷新队列，同样的主逻辑：改变后置刷新阶段状态，遍历执行后置刷新阶段任务池中的所有任务。

当watch Effect 的flush: post的时候，这是就会遍历执行到watch effect。

flushPostFlushCbs与前面两个函数不一样的是：没有进行递归刷新。主要目的是为了保证各阶段中任务能按：前置➡当前➡后置阶段的顺序进行刷新！

flushPostFlushCbs函数的代码：

```js
export function flushPostFlushCbs(seen?: CountMap) {
  // 👉 如果存在后置刷新任务
  if (pendingPostFlushCbs.length) {
    // 👉 去重job
    const deduped = [...new Set(pendingPostFlushCbs)]
    // 👉 正在等待的任务池 情况
    pendingPostFlushCbs.length = 0

    // 👉 #1947 already has active queue, nested flushPostFlushCbs call
    if (activePostFlushCbs) {
      // 👉 如果已经有活跃的队列，嵌套的flushPostFlushCbs调用
      activePostFlushCbs.push(...deduped)
      return
    }
    // 👉 将等待的作为当前的任务
    activePostFlushCbs = deduped
    if (__DEV__) {
      seen = seen || new Map()
    }
    // 👉 对后置任务进行排序
    activePostFlushCbs.sort((a, b) => getId(a) - getId(b))

    for (
      postFlushIndex = 0;
      postFlushIndex < activePostFlushCbs.length;
      postFlushIndex++
    ) {
      if (
        __DEV__ &&
        checkRecursiveUpdates(seen!, activePostFlushCbs[postFlushIndex])
      ) {
        continue
      }
      //👉  执行后置任务
      activePostFlushCbs[postFlushIndex]()
    }
    // 👉 重置正在执行的任务池
    activePostFlushCbs = null
    postFlushIndex = 0
  }
}
```

当flushPostFlushCbs函数执行结束的时候，就会回到flushJobs函数，通过 isFlushing = false 重置刷新状态。

最后通过各个阶段任务池中时候有任务，再继续递归调用flushJobs函数。

如此往复，直至所有阶段的任务执行结束。

## nextTick原理

我们知道nextTick API 会将回调延迟到下次 DOM 更新循环之后执行。并会返回一个Promise。

通过了解flushJob函数，flushJobs函数主要就是通过Promsie.resolve执行的，当flushJobs函数执行结束，也就是Promsie.resolve更改状态的时候。

首先flushJobs函数会置空 currentFlushPromise。最后才会通过Promsie.resolve赋值给currentFlushPromise。

当调用nextTick的时候，返回的promise，其实就是currentFlushPromise。

> 可以再上去看下flushJobs函数中的代码。

nextTick代码：

```js
const resolvedPromise: Promise<any> = Promise.resolve()
let currentFlushPromise: Promise<void> | null = null

function nextTick(
  this: ComponentPublicInstance | void,
  fn?: () => void
): Promise<void> {
  const p = currentFlushPromise || resolvedPromise
  return fn ? p.then(this ? fn.bind(this) : fn) : p
}
```

其实明白了scheduler的调度过程，nextTick很好理解。

最后上一张图，总结下整个过程。

![一图胜千言](D:\vue3深入浅出\docs\.vuepress\public\img\runtime-core\scheduler6.png)
