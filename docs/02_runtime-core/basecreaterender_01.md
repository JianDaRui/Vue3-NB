# 渲染器分析

在上一篇中，我们知道render函数最终是通过baseCreaterenderer创建的。

当通过createApp API 创建的组件实例调用mount方法挂载组件的时候，其实mount方法也是通过调用render方法。

完成组件的渲染工作。



这篇文章主要分析是对baseCreateRender函数源码进行分析。

baseCreateRenderer函数的整体代码大概有一千多行。

包含的信息相当丰富。

纵向扩展，可以学习到Vnode的patch过程、虚拟DOM的diff方式、指令的调用方式。

深度扩展，可以学完template的解析、转换与生成，任务调度器的执行过程、甚至响应式系统。

还有就是写完，可以补上前面好多留的坑😂。

这次我们先纵向学习，了解该函数在Vue中主要做了什么。后面在逐步深入。

## 前文回顾

上篇文章中，我们知道app实例是通过createApp API创建的，createApp将*createRenderer*函数返回的对象中的app属性做了一些处理之后。再返回给用户。

而createRenderer其实调用的是baseCreateRenderer函数，并给baseCreateRenderer函数传递了一个用于配置渲染器的options对象。

这个options对象中包含了DOM的处理方法 & 属性的patch方法。

而baseCreateRenderer函数返回的对象中，包含render渲染函数、hydrate用于服务端渲染的注水函数、createApp函数。

Vue3顺带的将render方法设定为API，方便高阶玩家自由发挥。

当我们调用app实例上的mount方法时。

会根据挂载的组件创建对应的Vnode。

将Vnode、挂载元素el传给render函数。

最终通过render函数完成组件的渲染工作。

## 解构配置项

为了方便内部patch函数的使用，baseCreateRenderer函数首先对options进行了解构.

options主要包含的方法是对DOM的创建、插入、移动、设置、获取父节点、克隆节点、patch 属性等方法。

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

在组件生命周期中，初次挂载会触发mounted钩子。

后续如果状态发生变换，会触发beforeUpdate、updated钩子。

这其实与渲染函数render有关。

render函数首先会判断Vnode是否存在。

如果不存在说明需要执行进行卸载，执行unmount操作。

如果存在需要进行patch操作。

patch的过程就包含了组件了创建到挂载，变化到更新。

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

从代码来看，render函数的逻辑并不复杂。

render函数的设计思想，基本就代表了vue处理各种类型节点的方式；

- 首先会判断Vnode是否存在，如果不存在，则调用unmount函数，进行组件的卸载
- 否则调用patch函数，对组件进行patch
- patch 结束后，会调用flushPostFlushCbs函数冲刷任务池
- 最后更新容器上的Vnode

## patch Vnode

Vnode有不同的类型，在这里我将其分为：

- 简单类型：文本、注释、Static。

- 复杂类型：组件、Fragment、Component、Teleport、Suspense。

patch思路，可以看作一个深度优先遍历。与深度克隆的逻辑非常相似。

简单类型就相当于JS中的原始数据类型：字符串、数字、布尔。

复杂类型就相当于JS中的引用类型：对象、数组、Map、Set。



不同的节点类型，需要采取不同的patch方式。

而patch函数的主要职责就是去判断Vnode的节点类型，然后调用对应类型的Vnode处理方式，进行更细致的patch。

下面我们看下patch函数是如何处理的。

> 为了降低patch函数的理解难度，下面的流程图体现的是patch处理过程中的主要逻辑，并没有将所有细节记录在图中。

## Text类型

![处理文本类型](/Users/xuguorui/study/Vue3-NB/docs/02_runtime-core/Text.png)



- 匹配到Text类型Vnode。
- 会调用ProcessText函数对节点进行处理。
- ProcessText函数首先会判断n1是否存在。
- 不存在，说明是第一次执行，直接进行文本插入。
- 新旧，新旧文本不同，会设置新的Text。

## Comment类型

![注释类型节点](/Users/xuguorui/study/Vue3-NB/docs/02_runtime-core/Comment.png)

- 匹配到Comment类型Vnode
- 调用processCommentNode函数
- 如果n1不存在，则执行插入工作
- 否则直接新的覆盖旧的，因为注释节点并不需要在页面中进行展示，不必做多余的渲染工作

## Static类型

![Static](/Users/xuguorui/study/Vue3-NB/docs/02_runtime-core/Static.png)

- 我们知道Vue3的性能提升，有部分原因就是得益于对静态节点的处理。
- patch过程中，匹配到Static类型节点。
- 如果n1不存在，会调用mountStaticNode，对静态节点进行挂载操作。
- 如果是dev环境，会调用patchStaticNode函数，patch节点。
- 为什么仅在dev环境中进行patch呢，因为dev环境下涉及到HMR。
- 另外静态节点不存在对state的依赖，不会触发track、trigger。且保持不变，在生产环境下，不必进行patch。以降低性能开销。

## Fragment类型

![Fragment](/Users/xuguorui/study/Vue3-NB/docs/02_runtime-core/fragment.png)

- 匹配到Fragment类型节点。
- 会调用processFragment函数，进行处理。
- Fragment节点，Fragment是Vue3中新增的Fragment组件，可以包裹多个子节点，但是并不会渲染Fragment节点。
- 所以在渲染过程中主要处理的事Fragmemt包裹的子节点。
- 如果n1不存在，会执行mountChildren，对子节点进行挂载。
  - mountChildren会对子节点进行遍历操作，递归调用patch函数。
- 如果n1存在，会对子节点再进行进一步的判断
  - 如果patchFlag存在 && 存在动态节点
  - 则会调用patchBlockChildren，对子节点进行patch，
  - patchBlockChildren会遍历子节点，递归调用patch函数
  - 否则会调用patchChildren函数，对子节点进行patch
  - patchChildren在执行的过程中涉及到了DOM的diff过程，这里暂时不展开分析，后面会出单独进行分析

## Element类型

![Element](/Users/xuguorui/study/Vue3-NB/docs/02_runtime-core/element.png)

- 匹配到Element类型
- 会调用processElement函数
- n1不存在，会执行mountElement函数，对Vnode进行挂载
  - mountElement在挂载Vnode过程中，会通过mountChildren，对子节点进行递归挂载处理。
  - 并会对Vnode的prop进行patch。
  - 并调用*queuePostRenderEffect*函数，向任务调度池中的后置执行阶段push生命周期钩子mounted。
- 否则会执行patchElement函数，对element进行patch，patchElement函数主要会执行以下任务：
  - 调用*hostPatchProp*对节点的class、style进行patch
  - 遍历props对节点的新旧props进行patch
    - 调用patchBlockChildren 或者patchChildren进行patch操作
    - 并调用*queuePostRenderEffect*函数，向任务调度池中的后置执行阶段push生命周期钩子updated。
    - 这里需要对子节点处理的原因是因为Element的子节点中，也可能还有组件或者其他类型的节点

## Component类型

![Component](/Users/xuguorui/study/Vue3-NB/docs/02_runtime-core/component.png)

- 通常情况下，我们都会给createApp传递一个组件
- 故当render函数执行patch时，首先会匹配到组件类型的节点
- 如果是组件类型，会调用processComponent函数进行处理
- 首先会判断n1是否存在
- 如果存在会进一步判断
  - 该组件是否是被Keep-Alive包裹的组件
  - 如果是，则会执行组件的activate钩子
  - 否则会调用mountComponent函数，对组件进行挂载
  - mountComponent函数涉及的层级较深，这里先不展开说
  - 但是要知道这个阶段会完成组件解析、编译与转换，病会创建一个渲染级别的effect
  - 用于负责组件的更新，这里我暂时将其称为updateEffect
- 否则会执行updateComponent函数，判断组件是否需要进行更细
  - 主要会对组件的新旧Props、子节点进行判断
  - 如果发生变化，会调用mountComponent阶段创建的updateEffect，出发响应式系统
  - 否则直接原有的直接进行覆盖

## Teleport类型 & Suspense类型

![Teleport](/Users/xuguorui/study/Vue3-NB/docs/02_runtime-core/teleport&suspense.png)

- Teleport 与 Suspense组件是Vue3内置的两个组件
- 如果匹配到以上两种，会调用组件实例上的process方法
- porcess方法的主要逻辑与前面的相同
- 首先会判断原有Vnode是否存在，不存在则mount，存在则patch
- 这两种类型的详细处理方式，我们会在分析这两个组件的源码的时候会进行分析
