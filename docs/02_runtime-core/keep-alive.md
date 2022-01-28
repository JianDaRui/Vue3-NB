# `KeepAlive` 使用及原理分析

`KeepAlive`组件是Vue中的内置组件，主要用于保留组件状态或者避免组件重新渲染。 

`KeepAlive`组件接受三个`Props`属性：

- `include` - `string | RegExp | Array`。只有名称匹配的组件会被缓存。
- `exclude` - `string | RegExp | Array`。任何名称匹配的组件都不会被缓存。
- `max` - `number | string`。最多可以缓存多少组件实例。

使用方法：

```html
<!-- 基本 -->
<keep-alive>
  <component :is="view"></component>
</keep-alive>

<!-- 多个条件判断的子组件 -->
<keep-alive>
  <comp-a v-if="a > 1"></comp-a>
  <comp-b v-else></comp-b>
</keep-alive>

<!-- 和 `<transition>` 一起使用 -->
<transition>
  <keep-alive>
    <component :is="view"></component>
  </keep-alive>
</transition>

<!-- 逗号分隔字符串 -->
<keep-alive include="a,b">
  <component :is="view"></component>
</keep-alive>

<!-- regex (使用 `v-bind`) -->
<keep-alive :include="/a|b/">
  <component :is="view"></component>
</keep-alive>

<!-- Array (使用 `v-bind`) -->
<keep-alive :include="['a', 'b']">
  <component :is="view"></component>
</keep-alive>

<!-- max属性设置缓存上限 -->
<keep-alive :max="10">
  <component :is="view"></component>
</keep-alive>

```

上面代码简单介绍了`KeepAlive`的使用方式，下面我们带着问题出发，从问题去分析`KeepAlive`组件的原理。

## `KeepAlive`返回的是什么？

看下简略版的代码：

```js
const KeepAliveImpl = {
  name: `KeepAlive`,

  // 私有属性 标记 该组件是一个KeepAlive组件
  __isKeepAlive: true,
  props: {
    // 用于匹配需要缓存的组件
    include: [String, RegExp, Array],
    // 用于匹配不需要缓存的组件
    exclude: [String, RegExp, Array],
    // 用于设置缓存上线
    max: [String, Number]
  },
  setup(props, { slots }) {
    // 省略部分代码...

    // 返回一个函数
    return () => {
      if (!slots.default) {
        return null
      }
      
      // 省略部分代码...
      
      // 获取子节点
      const children = slots.default()
      // 获取第一个子节点
      const rawVNode = children[0]
      // 返回原始Vnode
      return rawVNode
    }
  }
}
```

通过上面的代码可以知道，`KeepAlive`组件是一个**抽象组件**。

组件中并没有我们经常使用的模板`template`或者返回一个`render`函数。

在`setup`函数中，通过参数`slots.default()`获取到`KeepAlive`组件包裹的子组件列表。

最终返回的是**第一个子组件**的`rawVnode`。且仅支持缓存第一个子节点。

> 细心的同学，可能注意，我们平时使用`setup`函数时，最终返回的结果是一个对象。
>
> 而`KeepAlive`返回的是一个箭头函数。这里关于`setup`返回函数的分析，我们会在后续的文章中进行学习。

## `KeepAlive`是如何进行组件筛选的？

在使用`KeepAlive`时，我们可以通过配置`include` & `exclude`属性来实现对目标组件的缓存。`include` & `exclude` 属性可以配置`string`、`array`、`regExp`类型。下面一起看下`KeepAlive`是怎么利用这两个属性进行组件筛选的。

```javascript
const KeepAliveImpl = {
  setup(props, { slots }) {
    // 1️⃣ 缓存Vnode
    const cache: Cache = new Map()
    // 记录被缓存Vnode的key
    const keys: Keys = new Set()

    // 2️⃣ 修剪缓存
    function pruneCache(filter) {
      cache.forEach((vnode, key) => {
        // 获取组件名称
        const name = getComponentName(vnode.type) 
        if (name && (!filter || !filter(name))) {
          pruneCacheEntry(key)
        }
      })
    }
    function pruneCacheEntry(key) {
      // 省略部分代码...
      cache.delete(key)
      keys.delete(key)
    }

    // prune cache on include/exclude prop change
    // 3️⃣ 侦测筛选条件，当include/exclude发生变化的时候，更新缓存
    watch(
      () => [props.include, props.exclude],
      ([include, exclude]) => {
        include && pruneCache(name => matches(include, name))
        exclude && pruneCache(name => !matches(exclude, name))
      },
      // prune post-render after `current` has been updated
      { flush: 'post', deep: true }
    )

    return () => {
  
      // 省略部分代码...
      
      const children = slots.default()
      const rawVNode = children[0] 
      let vnode = getInnerChild(rawVNode)
      const comp = vnode.type

      // for async components, name check should be based in its loaded
      // inner component if available
      // 对于异步组件 名称校验应该基于被加载的组件
      const name = getComponentName(
        isAsyncWrapper(vnode)
          ? (vnode.type).__asyncResolved || {}
          : comp
      )
      const { include, exclude, max } = props
      
      // 4️⃣ 筛选Vnode
      if (
        (include && (!name || !matches(include, name))) ||
        (exclude && name && matches(exclude, name))
      ) {
        current = vnode
        return rawVNode
      }

      const key = vnode.key == null ? comp : vnode.key
      // 从缓存中获取Vnode
      const cachedVNode = cache.get(key)

 
      if (cachedVNode) {
         // 省略部分代码...
      } else {
        // 如果先前没有缓存Vnode
        // 则直接添加
        keys.add(key)
        // prune oldest entry
        // 5️⃣ 删除最旧的
        if (max && keys.size > parseInt(max, 10)) {
          pruneCacheEntry(keys.values().next().value)
        }
      }

    }
  }
}
```

上面的代码我们可以分成五部分进行分析：

1. 常量`cache`用于映射缓存组件的`key : Vnode`，常量`keys`用于记录已经被缓存的`Vnode`的`key`
2. 负责修剪`cache`、`keys`的`pruneCache`、`pruneCacheEntry`方法。主要职责是通过遍历`cache`，执行`filter`函数，修剪`cache`、`keys`。
3. 负责侦测筛选条件的`watch`，当筛选条件发生变化的时候，会执行`pruneCache`，更新`cache`、`keys`。筛选条件就是我们传入的props中的`include`、`exclude`。
4. 用于筛选符合筛选条件的`Vnode`，不符合缓存条件的，会直接返回`rawVnode`，不会被`cache`、`keys`缓存。
5. 用于判断是否已经超过缓存上限，如果超过，会删除最开始被缓存的`Vnode`。

对于代码中的`matches`函数，是一个用于匹配的工具函数。

```js
function matches(pattern, name) {
  if (isArray(pattern)) {
    // 数组类型，递归matches
    return pattern.some((p) => matches(p, name))
  } else if (isString(pattern)) {
    return pattern.split(',').indexOf(name) > -1
  } else if (pattern.test) {
    return pattern.test(name)
  }
  /* istanbul ignore next */
  return false
}
```

## 在哪个阶段构建的缓存？

下面我们一起看下`KeepAlive`组件是本组件的哪个生命周期中进行的缓存构建：

```js
const KeepAliveImpl = {
  setup(props, { slots }) {
    // 获取当前渲染实例
    const instance = getCurrentInstance()!
    const sharedContext = instance.ctx

    // if the internal renderer is not registered, it indicates that this is server-side rendering,
    // for KeepAlive, we just need to render its children
    // 服务端渲染的处理方式
    if (!sharedContext.renderer) {
      return slots.default
    }
    // 缓存
    const cache = new Map()
    const keys = new Set()
    let current = null

    // cache sub tree after render
    // 渲染之后缓存子节点
    let pendingCacheKey = null
    const cacheSubtree = () => {
      // fix #1621, the pendingCacheKey could be 0
      if (pendingCacheKey != null) {
        cache.set(pendingCacheKey, getInnerChild(instance.subTree))
      }
    }
    // 🟢 缓存组件
    onMounted(cacheSubtree)
    onUpdated(cacheSubtree)

    // 返回一个渲染函数
    return () => {
      // 省略部分代码
      pendingCacheKey = null

      // 获取内部子节点
      // keepAlive一般用户缓存路由组件包含的组件
      // 或者component包含的组件，这步操作就相当于获取路由组件或者动态组件包裹的子节点
      let vnode = getInnerChild(rawVNode)
      // 获取节点类型
      const comp = vnode.type
      
      const key = vnode.key == null ? comp : vnode.key
      // 从缓存中获取Vnode
      const cachedVNode = cache.get(key)

      // #1513 it's possible for the returned vnode to be cloned due to attr
      // fallthrough or scopeId, so the vnode here may not be the final vnode
      // that is mounted. Instead of caching it directly, we store the pending
      // key and cache `instance.subTree` (the normalized vnode) in
      // beforeMount/beforeUpdate hooks.
      
      // 这里更新pendingCacheKey是因为attr fallthrough 或者 scopeId变化需要返回一个经过克隆的Vnode,
      // 因此这里的Vnode并不能作为最终渲染所使用的的Vnode。
      // 不是直接缓存，而是在 beforeMount/beforeUpdate阶段
      // 存储pending状态的key和要缓存的Vnode。（翻译的不好，望指教~~~）
      pendingCacheKey = key
      
      if (cachedVNode) {
        // 省略部分代码...
        
        // make this key the freshest
        // 更新key
        keys.delete(key)
        keys.add(key)
      } else {
        // 如果先前没有缓存Vnode
        // 则直接添加
        keys.add(key)
        // prune oldest entry
        // 删除最旧的
        if (max && keys.size > parseInt(max as string, 10)) {
          pruneCacheEntry(keys.values().next().value)
        }
      }
      return rawVNode
    }
  }
}
```

通过上面的代码可以知道：

- `Vnode`的`cache`构建，是在`KeepAlive`组件的`onMounted` && `onUpdated`两个生命周期通过`cacheSubtree`方法构建的。
- 变量`pendingCacheKey`主要用于记录处理`pending`状态的`key`
- 如果组件的`Vnode`先前被`Vnode`被缓存过，在获取到`cachedVNode`之后，会更新`keys`中对应的`key`。

## `activated` & `deactivate`钩子函数实现

经过`KeepAlive`包裹组件，在切换时，它的生命周期钩子`mounted`和`unmouned`生命周期钩子不会被调用，而是被缓存组件独有的两个生命周期钩子所代替：`activated`和`deactivated`。这两个钩子会被用于`KeepAlive`的直接子节点和所有子孙节点。

```js
const KeepAliveImpl = {
  setup(props, { slots }) {
    // 获取当前渲染实例
    const instance = getCurrentInstance()!
    // KeepAlive communicates with the instantiated renderer via the
    // ctx where the renderer passes in its internals,
    // and the KeepAlive instance exposes activate/deactivate implementations.
    // The whole point of this is to avoid importing KeepAlive directly in the
    // renderer to facilitate tree-shaking.
    const sharedContext = instance.ctx


    let current: VNode | null = null

    if (__DEV__ || __FEATURE_PROD_DEVTOOLS__) {
      ;(instance as any).__v_cache = cache
    }
    // 悬挂
    const parentSuspense = instance.suspense
    // 解构获取内部渲染器
    // 其实就是basecreaterender函数中的方法
    const {
      renderer: {
        p: patch,
        m: move,
        um: _unmount,
        o: { createElement }
      }
    } = sharedContext
    // 创建存储容器
    const storageContainer = createElement('div')
    
    // 🟢 存活时
    sharedContext.activate = (vnode, container, anchor, isSVG, optimized) => {
      const instance = vnode.component!
      // 移动节点
      move(vnode, container, anchor, MoveType.ENTER, parentSuspense)
      // in case props have changed
      // 某些情况下属性可能发生改变
      patch(
        instance.vnode,
        vnode,
        container,
        anchor,
        instance,
        parentSuspense,
        isSVG,
        vnode.slotScopeIds,
        optimized
      )
      // 后置任务池中 push 任务
      queuePostRenderEffect(() => {
        instance.isDeactivated = false
        if (instance.a) {
          invokeArrayFns(instance.a)
        }
        const vnodeHook = vnode.props && vnode.props.onVnodeMounted
        if (vnodeHook) {
          invokeVNodeHook(vnodeHook, instance.parent, vnode)
        }
      }, parentSuspense)
    }
    // 🟡 失活时
    sharedContext.deactivate = (vnode) => {
      const instance = vnode.component!
      move(vnode, storageContainer, null, MoveType.LEAVE, parentSuspense)
      
      queuePostRenderEffect(() => {
        if (instance.da) {
          invokeArrayFns(instance.da)
        }
        const vnodeHook = vnode.props && vnode.props.onVnodeUnmounted
        if (vnodeHook) {
          invokeVNodeHook(vnodeHook, instance.parent, vnode)
        }
        instance.isDeactivated = true
      }, parentSuspense)

    }
  }
}
```

从上面的代码可以知道：

- 代码首先会从当前实例的上下文中获取渲染相关的方法，这些方法其实是在`renderer`中创建并配置好的，当`patch`组件时，会首先执行`mountComponent`方法，当组件是`KeepAlive`组件时，会绑定渲染相关的属性，因此在这里解构可以获取到`mount`、`patch`、`move`等方法。
- `activated`方法主要负责移动节点、调用`patch`方法，向任务调度器中的后置任务池中push `Vnode`相关的钩子。
- `deactivated`方法会通过`move`方法移除`Vnode`，向任务调度器中的后置任务池中`push` 卸载相关的`Vnode`钩子。

```js
// packages/runtime-core/renderer.ts中的代码
function baseCreateRenderer() {
  // 省略其他代码...
  
  // 挂载组件
  const mountComponent = (
    initialVNode,
    container,
    anchor,
    parentComponent,
    parentSuspense,
    isSVG,
    optimized
  ) => {
    
    // 获取当前渲染实例
    const instance =
      compatMountInstance ||
      (initialVNode.component = createComponentInstance(
        initialVNode,
        parentComponent,
        parentSuspense
      ))

    // inject renderer internals for keepAlive
    // 为KeepAlive注入私有渲染器
    if (isKeepAlive(initialVNode)) {
      instance.ctx.renderer = internals
    }
     
  }

  // 定义内部渲染器
  const internals = {
    p: patch,
    um: unmount,
    m: move,
    r: remove,
    mt: mountComponent,
    mc: mountChildren,
    pc: patchChildren,
    pbc: patchBlockChildren,
    n: getNextHostNode,
    o: options
  }
}

```

## 清空缓存

```js
const KeepAliveImpl = {
  setup(props, { slots }) { 
  	 // 卸载
    function unmount(vnode) {
      // reset the shapeFlag so it can be properly unmounted
      resetShapeFlag(vnode)
      _unmount(vnode, instance, parentSuspense)
    }


    onBeforeUnmount(() => {
      cache.forEach(cached => {
        const { subTree, suspense } = instance
        const vnode = getInnerChild(subTree)
        if (cached.type === vnode.type) {
          // current instance will be unmounted as part of keep-alive's unmount
          resetShapeFlag(vnode)
          // but invoke its deactivated hook here
          const da = vnode.component!.da
          da && queuePostRenderEffect(da, suspense)
          return
        }
        // 清理缓存
        unmount(cached)
      })
    })
  }
}

```

当`KeepAlive`卸载的时候，会调用`onBeforeUnmount`生命周期钩子，在此钩子中会遍历`cache`，执行卸载相关的逻辑。

## 总结

通过学习分析可以知道，`KeepAlive`组件是一个抽象组件，抽象组件也是有生命周期的。在`KeepAlive`组件内部通过`onMounted` && `onUpdated`两个生命周期对`KeepAlive`组件的第一个子节点的`Vnode`进行缓存，通过`watch`侦测筛选条件的变化，实现响应式的从`cache`中增删`Vnode`。在组件的`onBeforeUnmounted`阶段，实现缓存的清空。
