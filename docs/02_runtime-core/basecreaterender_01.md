# 渲染器分析

在上一篇中，我们知道`render`函数最终是通过`baseCreaterenderer`创建的。

当通过`createApp` API 创建的组件实例调用`mount`方法挂载组件的时候，其实`mount`方法也是通过调用`render`方法。

完成组件的渲染工作。



这篇文章主要分析是对`baseCreateRender`函数源码进行分析。

`baseCreateRenderer`函数的整体代码大概有一千多行。

包含的信息相当丰富。

纵向扩展，可以学习到`Vnode`的`patch`过程、虚拟`DOM`的`diff`方式、指令的调用方式。

深度扩展，可以学完`template`的解析、转换与生成，任务调度器的执行过程、甚至响应式系统。

还有就是写完，可以补上前面好多留的坑😂。

这次我们先纵向学习，了解该函数在`Vue`中主要做了什么。后面在逐步深入。

## 前文回顾

上篇文章中，我们知道app实例是通过`createApp` API创建的，`createApp`将*`createRenderer`*函数返回的对象中的`app`属性做了一些处理之后。再返回给用户。

而`createRenderer`其实调用的是`baseCreateRenderer`函数，并给`baseCreateRenderer`函数传递了一个用于配置渲染器的`options`对象。

这个`options`对象中包含了`DOM`的处理方法 & 属性的`patch`方法。

而`baseCreateRenderer`函数返回的对象中，包含`render`渲染函数、`hydrate`用于服务端渲染的注水函数、`createApp`函数。

`Vue3`顺带的将`render`方法设定为`API`，方便高阶玩家自由发挥。

当我们调用`app`实例上的`mount`方法时。

会根据挂载的组件创建对应的`Vnode`。

将`Vnode`、挂载元素`el`传给`render`函数。

最终通过`render`函数完成组件的渲染工作。

## 解构配置项

为了方便内部`patch`函数的使用，`baseCreateRenderer`函数首先对`options`进行了解构.

`options`主要包含的方法是对`DOM`的创建、插入、移动、设置、获取父节点、克隆节点、`patch`属性等方法。

这里我们需要先简单熟悉下：

```javascript
  insert: hostInsert,
  remove: hostRemove,
  patchProp: hostPatchProp,
  forcePatchProp: hostForcePatchProp,
  createElement: hostCreateElement,
  createText: hostCreateText,
  createComment: hostCreateComment,
  setText: hostSetText,
  setElementText: hostSetElementText,
  parentNode: hostParentNode,
  nextSibling: hostNextSibling,
  setScopeId: hostSetScopeId = NOOP,
  cloneNode: hostCloneNode,
  insertStaticContent: hostInsertStaticContent
```

## 渲染逻辑

![lifecycle](/Users/xuguorui/study/Vue3-NB/docs/02_runtime-core/lifecycle.svg)

在组件生命周期中，初次挂载会触发`mounted`钩子。

后续如果状态发生变换，会触发`beforeUpdate`、`updated`钩子。

这其实与渲染函数`render`有关。

`render`函数首先会判断`Vnode`是否存在。

如果不存在说明需要执行进行卸载，执行`unmount`操作。

如果存在需要进行`patch`操作。

`patch`的过程就包含了组件了创建到挂载，变化到更新。

![render](/Users/xuguorui/study/Vue3-NB/docs/02_runtime-core/render.png)

```javascript
 const render = (vnode, container, isSVG) => {
    if (vnode == null) {
      // 如果没有Vnode，则卸载原来的Vnode
      if (container._vnode) {
        unmount(container._vnode, null, null, true)
      }
    } else {
      // 存在则对新旧Vnode进行patch
      // patch是一个递归的过程
      patch(container._vnode || null, vnode, container, null, null, null, isSVG)
    }
    // patch结束后，开始冲刷任务调度器中的任务
    flushPostFlushCbs()
    // 更新vnode
    container._vnode = vnode
  }
```

从代码来看，`render`函数的逻辑并不复杂。

`render`函数的设计思想，基本就代表了`vue`处理各种类型节点的方式；

- 首先会判断`Vnode`是否存在，如果不存在，则调用`unmount`函数，进行组件的卸载
- 否则调用`patch`函数，对组件进行`patch`
- `patch` 结束后，会调用`flushPostFlushCbs`函数冲刷任务池
- 最后更新容器上的`Vnode`

## patch Vnode

`Vnode`有不同的类型，在这里我将其分为：

- 简单类型：文本、注释、`Static`。

- 复杂类型：组件、`Fragment`、`Component`、`Teleport`、`Suspense`。

`patch`思路，可以看作一个深度优先遍历。与深度克隆的逻辑非常相似。

简单类型就相当于JS中的原始数据类型：字符串、数字、布尔。

复杂类型就相当于JS中的引用类型：对象、数组、Map、Set。



不同的节点类型，需要采取不同的`patch`方式。

而`patch`函数的主要职责就是去判断`Vnode`的节点类型，然后调用对应类型的`Vnode`处理方式，进行更细致的`patch`。

下面我们看下`patch`函数是如何处理的。

> 为了降低patch函数的理解难度，下面的流程图体现的是patch处理过程中的主要逻辑，并没有将所有细节记录在图中。

## Text类型

![处理文本类型](/Users/xuguorui/study/Vue3-NB/docs/02_runtime-core/Text.png)



- 匹配到`Text`类型`Vnode`。
- 会调用`ProcessText`函数对节点进行处理。
- `ProcessText`函数首先会判断`n1`是否存在。
- 不存在，说明是第一次执行，直接进行文本插入。
- 新旧，新旧文本不同，会设置新的`Text`。

## Comment类型

![注释类型节点](/Users/xuguorui/study/Vue3-NB/docs/02_runtime-core/Comment.png)

- 匹配到`Comment`类型`Vnode`
- 调用`processCommentNode`函数
- 如果`n1`不存在，则执行插入工作
- 否则直接新的覆盖旧的，因为注释节点并不需要在页面中进行展示，不必做多余的渲染工作

## Static类型

![Static](/Users/xuguorui/study/Vue3-NB/docs/02_runtime-core/Static.png)

- 我们知道`Vue3`的性能提升，有部分原因就是得益于对静态节点的处理。
- `patch`过程中，匹配到`Static`类型节点。
- 如果`n1`不存在，会调用`mountStaticNode`，对静态节点进行挂载操作。
- 如果是`dev`环境，会调用`patchStaticNode`函数，`patch`节点。
- 为什么仅在`dev`环境中进行`patch`呢，因为`dev`环境下涉及到`HMR`。
- 另外静态节点不存在对`state`的依赖，不会触发`track`、`trigger`。且保持不变，在生产环境下，不必进行`patch`。以降低性能开销。

## Fragment类型

![Fragment](/Users/xuguorui/study/Vue3-NB/docs/02_runtime-core/fragment.png)

- 匹配到`Fragment`类型节点。
- 会调用`processFragment`函数，进行处理。
- `Fragment`节点，`Fragment`是`Vue3`中新增的`Fragment`组件，可以包裹多个子节点，但是并不会渲染`Fragment`节点。
- 所以在渲染过程中主要处理的是`Fragmemt`包裹的子节点。
- 如果`n1`不存在，会执行`mountChildren`，对子节点进行挂载。
  - `mountChildren`会对子节点进行遍历操作，递归调用`patch`函数。
- 如果n1存在，会对子节点再进行进一步的判断
  - 如果`patchFlag`存在 && 存在动态节点
  - 则会调用`patchBlockChildren`，对子节点进行`patch`，
  - `patchBlockChildren`会遍历子节点，递归调用`patch`函数
  - 否则会调用`patchChildren`函数，对子节点进行`patch`
  - `patchChildren`在执行的过程中涉及到了`DOM`的`diff`过程，这里暂时不展开分析，后面会出单独进行分析

## Element类型

![Element](/Users/xuguorui/study/Vue3-NB/docs/02_runtime-core/element.png)

- 匹配到`Element`类型
- 会调用`processElement`函数
- `n1`不存在，会执行`mountElement`函数，对`Vnode`进行挂载
  - `mountElement`在挂载`Vnode`过程中，会通过`mountChildren`，对子节点进行递归挂载处理。
  - 并会对`Vnode`的`prop`进行`patch`。
  - 并调用`queuePostRenderEffect`函数，向任务调度池中的后置执行阶段`push`生命周期钩子`mounted`。
- 否则会执行`patchElement`函数，对`element`进行`patch`，`patchElement`函数主要会执行以下任务：
  - 调用`hostPatchProp`对节点的`class`、`style`进行`patch`
  - 遍历`props`对节点的新旧`props`进行`patch`
    - 调用`patchBlockChildren`或者`patchChildren`进行`patch`操作
    - 并调用`queuePostRenderEffect`函数，向任务调度池中的后置执行阶段`push`生命周期钩子`updated`。
    - 这里需要对子节点处理的原因是因为`Element`的子节点中，也可能还有组件或者其他类型的节点

## Component类型

![Component](/Users/xuguorui/study/Vue3-NB/docs/02_runtime-core/component.png)

- 通常情况下，我们都会给`createApp`传递一个组件
- 故当`render`函数执行`patch`时，首先会匹配到组件类型的节点
- 如果是组件类型，会调用`processComponent`函数进行处理
- 首先会判断`n1`是否存在
- 如果存在会进一步判断
  - 该组件是否是被`Keep-Alive`包裹的组件
  - 如果是，则会执行组件的`activate`钩子
  - 否则会调用`mountComponent`函数，对组件进行挂载
  - `mountComponent`函数涉及的层级较深，这里先不展开说，但是要知道以下几点：
    - 会完成组件实例的创建
    - 完成`Props`、`Slots`的初始化
    - 执行`setup`函数，获取响应式状态
    - 完成组件模板的解析、编译与转换
    - 调用`setupRenderEffect`创建一个**渲染级别的`effect`**
    - 用于负责组件的更新，这里我暂时将其称为`updateEffect`。
- 否则会执行`updateComponent`函数，判断组件是否需要进行更细
  - 主要会对组件的新旧`Props`、子节点进行判断
  - 如果发生变化，会调用`mountComponent`阶段创建的`updateEffect`，触发响应式系统
  - 否则直接原有的直接进行覆盖

## Teleport类型 & Suspense类型

![Teleport](/Users/xuguorui/study/Vue3-NB/docs/02_runtime-core/teleport&suspense.png)

- `Teleport` 与 `Suspense`是`Vue3`新增的两个内置组件
- 如果匹配到以上两种，会调用组件实例上的`process`方法
- `porcess`方法的主要逻辑与前面的相同
- 首先会判断原有`Vnode`是否存在，不存在则`mount`，存在则`patch`
- 这两种类型的详细处理方式，我们会在分析这两个组件的源码的时候会进行分析

## 卸载组件

![unmount](/Users/xuguorui/study/Vue3-NB/docs/02_runtime-core/unmount.png)

- 如果调用`render`函数时没有传`Vnode`，则会调用`unmount`函数对组件进行卸载
- 卸载过程中，如果存在`ref`，会首先重置`ref`
- 如果组件是经过`Keep-Alive`缓存的组件，会通过`deactivate`对组件进行卸载
- 如果是组件类型`Vnode`，会通过`unmountComponent`函数对组件进行卸载
  - 在卸载组件过程中会执行`beforeMount`生命周期钩子
  - 通过`stop` API来卸载组件的所有相关`effect`
  - 如果存在`updateEffect`，会卸载`updateEffect`，并递归调用`unmount`函数，对组件进行卸载
  - 最后会执行`unmount`生命周期钩子
  - 并通过*`queuePostRenderEffect`*向任务调度器中的后置任务池中，`push`一个用于标记组件已完成卸载的函数
  - 至此，就完成了组件的卸载工作
- 如果不是组件类型的`Vnode`，会有以下几种情况：
  - 如果是`Suspense`类型，会通过`Suspense`实例上的`unmount`方法完成`Vnode`的卸载工作
  - 如果是`Teleport`类型，会通过`Teleport`实例上的`remove`方法完成`Vnode`的卸载工作
  - 如果存在子组件，会通过*`unmountChildren`*完成子组件的卸载工作
  - 最后会调用`remove`函数完成`Fragment`、`Static`、`Element`类型的卸载工作

从上面整个过程可以看出，卸载组件过程基本与`patch`形似，也是对各种类型的`Vnode`有不同的处理方法，并会通过**递归**调用`unmount`完成组件的卸载工作，卸载过程中，会卸载组件相关的`effect`、`updateEffect`，触发卸载相关的生命周期钩子 & 指令相关的钩子。

## 总结

通过上面的梳理分析，可以知道，对于所有类型的组件，`patch`过程非常相似。

首先会判断原有的`vnode`是否存在。

如果不存在，则会进行`mount`操作。

如果存在则会对新旧`Vnode`进行patch操作。

不同的是对于复杂类型的`Vnode`，由于其内部可能包含有其他类型的`Vnode`，比如`Component`类型。其中会涉及到：

- 组件实例的创建
- 模板的编译工作
- 子组件的递归`patch`工作等等

在`unmount`过程中，同样的会对不同的组件类型进行处理，并卸载组件的所有相关`effect`，递归卸载子组件。

不过没有提及的是上面的两个过程中，都会向任务调度器中`push`任务。

在render函数执行的最后阶段，会通过*`flushPostFlushCbs`*冲刷任务调度器，关于任务调度器是如何运作的，可以移步这里👉[任务调度器源码分析](https://mp.weixin.qq.com/s/SmAF9qvtAiyGRxEv5A-0CA)

其实写到这里还有两个问题没有说：

**第一个问题：还有哪些没有说？**

baseCreateRenderer包含的内容实在是太多了，要想一篇就分析完并输出，对于读者和我都是一种考验。所以本文只是纵向的对baseCreateRenderer进行了分析，并没有深究细节。

比较重要的有几点：

- 子节点的diff过程
- 组件类型编译过程、响应式转换过程
- updateEffect做了什么
- 如何进行指令的生命周期钩子调用
- 生命周期的执行过程
- 往任务调度器中都push了哪些任务
- 如何设计的性能监控系统

等等细节之处都是我们还没有说的。不过后面我们会继续。

**第二个问题：baseCreateRenderer这么复杂，我或者你费了这么大劲读了有什么用？**

下面我说说我的感受：

1. 在工作中，很大概率下没啥用。因为Vue通过createRenderer已经做了很全面的配置，创建的render函数，已经能满足工作需求。
2. 如果是高阶玩家，比如说我想用createRenderer做个Vnode渲染引擎，可能有帮助。只需要通过配置Options。就可以创建一个定制化的渲染器。并且这个渲染器已经包含了Vnode的diff系统、编译系统。

> 最后非常感谢各位的阅读，如果文章有疏漏之处，还望批评指正。
>
> 如果有所收获，可以帮我点个关注，我会持续更新Vue的相关学习分享😁！
