# 第三篇 `RunTimeCore`——`scheduler`源码分析 

## `scheduler`任务调度器

> 前置铺垫：`schedler`的源码虽然只有二百多行，并且与组件更新前后、更新中的所有执行的【任务】有关。【任务】在这里有比较抽象，理解起来比较困难。好在有一点就是我们在上一篇的文章中有理解到一个任务：`watch Effect`。我们就可以结合这个`job`，对`scheduler`进行分析。在后续的文章中，当我们讲解到`update`阶段的时候，会回来再看下`scheduler`。到时候就能明白不少啦。

下面直接进入正题：

调度器在执行任务的过程中，主要将任务分为三个阶段，每个阶段两种状态：

- 前置刷新阶段
- 刷新阶段
- 后置刷新阶段

每个阶段各有两种状态：

- 正在等待刷新
- 正在刷新

每次刷新的时候，通过`Promise.resolve`启动一个微任务，调用`flushJo`b函数，先进行前置刷新工作，直至前置回调任务池为空，在刷新当前任务队列，当前任务队列刷新结束，最后刷新后置回调任务池，如此循环往复，直至三个任务池中的回调都刷新结束。



在讲解`watch`的时候，我们说过，`watch effect`会在组件`update`之前执行。这与用户定义的副作用函数 配置项`fulsh`有关。

- `flush: pre`，默认值。`watch Effect`的`flush`就是pre
  - 在创建`watch`的时候通过调用`queuePreFlushCb(job)`，将副作用函数`push`至`pendingPreFlushCbs`
  - 当组件需要进行`update`的时候，会先遍历执行`pendingPreFlushCbs`池中的回调
  - 从而做到在组件`update`前进行刷新。

- `fulsh: post`。可选 但不推荐
  - 当设置`watch effect`的`flush`为`post`的时候就会调用`queuePostFlushCb`函数，将副作用函数`push`至`pendingPostFlushCbs`
  - 当queue中的任务执行完之后，就会遍历执行`pendingPostFlushCbs`中的任务
  - 从而做到在组件`update`后进行刷新

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

从上面的代码中可以复制往各阶段任务池中，`push`任务的主要是`queueCb`函数，`queueCb`函数主要负责对任务进行判断，当任务是数组时，会直接解构至待执行队列中，当任务非数组的时候，需要对任务进行判断，push的任务不能在正在执行的任务队列中存在，或者当前没有正在执行的任务队列。最后会调用`queueFlush`函数。

`queueFlush`函数会根据当前的状态进行判断，只有非正在刷新且非正在等待刷新的状态下。才会通过`Promise.resolve`启动微任务，刷新队列。

看下`queueFlush`的代码：

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

当启动微任务刷新队列的时候，会将`isFlushPending = true`，表示开始等待刷新。当当前宏任务执行结束后，会执行相应的微任务队列，这时就会调用`flushJobs`函数。开始刷新队列。

> 当前宏任务有哪些，我们先不关注。首先要知道每个宏任务都会对应一个微任务队列，宏任务执行结束才会执行相应的微任务队列。
>
> 这也就是`Vue`所提到的【避免同一个“`tick`” 中多个状态改变导致的不必要的重复调用，并异步刷新用户副作用函数】

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

`flushJobs`函数就是切入口，主要负责所有任务队列的刷新工作，前置任务的刷新主要是在该函数中调起`flushPreFlushCbs(seen)`函数，先去刷新前置任务池中的所有任务。

`flushPreFlushCbs(seen) `函数代码：

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

对于`flushPreFlushCbs`函数，我们把主要关注点先放在：

- 前置更新状态的切换，由`pending` 到 `active`
- 遍历执行前置任务池中的每个任务
- 当遍历结束会重置当前状态及`index`
- 递归调用`flushPreFlushCbs`，直至`pendingPreFlushCbs`任务池为空。
- 主要是保证所有正在等待的队列会被执行到

> 有的同学可能会有疑问：既然已经 通过 `pendingPreFlushCbs.length = 0`，将待执行任务池清空了，为什么还需要递归继续。
>
> 这个其实与遍历执行的任务有关，有的任务中，还会继续创建待执行任务，这时就会将创建的待执行任务继续`push`至待执行任务池。故需要递归遍历执行

当`flushPreFlushCbs`函数执行结束后，就会进行当前遍历。即进入了`flushing`阶段，这时存在于`queue`的`update`函数就会执行，组件就会进行更新。但是在执行`queue`中的任务的时候，需要对任务去重 排序，这些工作完成之后，才会遍历执行`queue`中的任务。

当`queue`中的任务执行结束后，会通过 `flushIndex = 0`，`queue.length = 0`，对当前队列进行重置。

随后就会调用`flushPostFlushCbs`函数，该函数会刷新后置刷新队列，同样的主逻辑：改变后置刷新阶段状态，遍历执行后置刷新阶段任务池中的所有任务。

当`watch Effect `的`flush: post`的时候，这时就会遍历执行到`watch effect`。

`flushPostFlushCbs`与前面两个函数不一样的是：没有进行递归刷新。主要目的是为了保证各阶段中任务能按：**前置➡当前➡后置**阶段的顺序进行刷新！

`flushPostFlushCbs`函数的代码：

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

当`flushPostFlushCbs`函数执行结束的时候，就会回到`flushJobs`函数，通过` isFlushing = false`重置刷新状态。

最后通过各个阶段任务池中时候有任务，再继续递归调用`flushJobs`函数。

如此往复，直至所有阶段的任务执行结束。

## `nextTick`原理

我们知道`nextTick API` 会将回调延迟到下次 `DOM` 更新循环之后执行。并会返回一个`Promise`。

通过了解`flushJobs`函数，`flushJobs`函数主要就是通过`Promsie.resolve`执行的，当`flushJobs`函数执行结束，也就是`Promsie.resolve`更改状态的时候。

首先`flushJobs`函数会置空 `currentFlushPromise`。最后才会通过`Promsie.resolve`赋值给`currentFlushPromise`。

当调用`nextTick`的时候，返回的`promise`，其实就是`currentFlushPromise`。

> 可以再上去看下`flushJobs`函数中的代码。

`nextTick`代码：

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

其实明白了`scheduler`的调度过程，`nextTick`很好理解。

### 总结

通过分析我们知道在`Vue3`中`scheduler`任务调度器，在执行任务的过程中，主要分为三个阶段，**前置刷新阶段、后置刷新阶段、当前刷新阶段（update阶段）**，每个阶段都有两种状态：**等待刷新 & 正在刷新**，每个阶段发生变化后，状态都会进行重置。并且是按 **前置➡当前➡后置➡前置...**的过程进行的，如此往复，直到各阶段任务池中的所有任务结束。`nextTick`是等所有阶段的刷新任务结束后返回的一个`Promise.resolve`。

最后上一张图，总结下整个过程。

![一图胜千言](D:\vue3深入浅出\docs\.vuepress\public\img\runtime-core\scheduler6.png)

> 最后还是很(`bu`)真(`yao`)诚(`lian`)的推荐下我的公众号：coder狂想曲。您的关注就是对我创作的最大鼓励呐。
