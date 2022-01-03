# baseCreateRender 分析

在上一篇中，我们知道render函数主要是通过baseCreaterenderer创建的。当通过createApp API 创建的组件实例调用mount方法挂载组件的时候，其实mount方法也会去调用render方法。

通过render方法完成组件的渲染工作。



这篇文章主要分析下baseCreateRender函数的实现原理。

介于baseCreateRender函数的整体代码的体量比较大，我这里会分开来讲。

这一篇主要是想知道它做了什么？



当初次执行mount函数的时候，会根据我们传入的跟组件创建对应的Vnode。

然后将Vnode、el传入render函数，进行渲染。



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
    // patch结束后，会开始冲刷任务调度器
    flushPostFlushCbs()
    // 更新vnode
    container._vnode = vnode
  }
```

render函数的设计思想，基本就代表了vue处理各种类型节点的方式；



- 首先会判断Vnode是否存在，如果不存在，则调用unmount函数，进行组件的卸载
- 如果存在，这会调用patch函数，对组件进行patch
- patch 结束后，会调用flushPostFlushCbs函数冲刷任务池
- 最后更新容器上的Vnode



首先我们知道Vnode有不同的类型，在Vue中，共定义了：

简单类型：文本、注释、Static

复杂类型：组件、Fragment、Component、Teleport、Suspense这几种类型的节点。

不同的节点类型，需要采取不同的patch方式。

而patch函数的主要职责就是去判断Vnode的节点类型，然后调用对应的处理方式，进行patch。



baseCreateRender包含了：

- 各种Vnode节点类型的处理方式
- Vnode的diff方法
- 如果深入的话，甚至包含了响应式系统的触发 & 模版的解析、转换、生成

所以这里要分开讲



## 文本类型

![处理文本类型](/Users/xuguorui/study/Vue3-NB/docs/02_runtime-core/processText.png)









