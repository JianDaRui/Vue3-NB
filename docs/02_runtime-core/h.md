

# 第七篇`Vue3 RunTimeCore`——高阶 `API`



本片文章，会从`h`函数引入，逐步了解到`h`、`createVNode`、 `cloneVNode`、 `mergeProps`、`isVNode` 等高阶API的使用方式及原理。

## 渲染函数`h()`

在`Vue2`中，有个全局`API：render`函数。`Vue`内部回给这个函数传递一个`h`函数，用于创建`Vnode`的描述对象。

这次，在`Vue3`中。将`h`函数独立出来，作为一个单独的`API`，它的作用仍保持原样：用于创建一个描述所渲染节点的`Vnode`描述对象。

可以接受三个参数： `type`、`props`、`children`。

- `type`用于表示`Vnode`节点类型，可以是`HTML`标签名、组件、异步组件或函数式组件。使用返回`null`的函数将渲染一个注释，此参数必传。
- `props`是一个对象，与我们将在模板中使用的 `attribute`、`prop` 和事件相对应。可选。
- `children`是子节点 `VNode`，使用 `h()` 生成，或者使用字符串来获取“文本 `VNode`”，或带有插槽的对象。可选。

在刚开始学习`Vue`的时候，我一直搞不懂`render`函数中`h`的使用方式。如果你也是一直通过`HTML`模板语法来搭建页面结构，可能也会对`h`函数不特别熟悉，下面可以一起学习下。



当我们创建一个组件时，一般都是通过`HTML`模板来描述`UI`部分，比如：

- 使用`HTML`标签：

```html
<template>
    <div>
    	<input 
      		type="radio"
      		:id="branch"
      		:value="branch"
      		name="branch"
      		v-model="currentBranch" />
    	<label :for="branch">{{ branch }}</label>
    </div>
</template>
```

- 使用自定义组件标签：

```html
<template>
  	<tree-item class="item" :model="treeData" @chang="changeHandler"></tree-item>
</template>
```

其实这些都可以将通过`JS`抽象为三部分，并用对象描述：

- 用于表示模板标签类型的`type`
- 传给模板的`attribute`、`prop` 和事件
- 标签包裹的子节点`children`

且子节点同样可以抽象为同样的结构。

![官方图片](D:\vue3深入浅出\docs\.vuepress\public\img\runtime-core\dom-tree.png)

而`h`函数就是做了这么一件事。给他传入`type`、`props`、`children`。它返回对应的`Vnode`描述对象。



### **可不可以直接创建一个`Vnode`描述对象**

当然可以，只不过如果涉及`Vnode`的描述全部自己写的话，有点太累，而且容易出错。

我们先看下`Vue`内部定义的`Vnode`对象所包含的属性：

- `__v_isVNode: *true*`，内部属性，有该属性表示为`Vnode`
- `__v_skip: true`，内部属性，表示跳过响应式转换，`reactive`转换时会根据此属性进行判断
- `isCompatRoot?: *true*`，用于是否做了兼容处理的判断
- `type: VNodeTypes`，虚拟节点的类型
- `props: (VNodeProps & ExtraProps) | *null*`，虚拟节点的`props`
- `key: *string* | *number* | *null*`，虚拟阶段的`key`，可用于`diff`
- `ref: VNodeNormalizedRef | *null*`，虚拟阶段的引用
- `scopeId: *string* | *null*`，仅限于`SFC`(单文件组件)，在设置`currentRenderingInstance`当前渲染实例时，一期设置
- `slotScopeIds: *string*[] | *null*`，仅限于单文件组件，与单文件组件的插槽有关
- `children: VNodeNormalizedChildren`，子节点
- `component: ComponentInternalInstance | null`，组件实例
- `dirs: DirectiveBinding[] | null`，当前`Vnode`绑定的指令
- `transition: TransitionHooks<HostElement> | null`，`TransitionHooks`
- `DOM`相关属性
  - `el: HostNode | *null*`，宿主阶段
  - `anchor: HostNode | *null* // fragment anchor`
  - `target: HostElement | *null*` ，`teleport target` 传送的目标
  - `targetAnchor: HostNode | *null* // teleport target anchor`
  - `staticCount: *number* `，包含的静态节点的数量
- `suspense` 悬挂有关的属性
  - `suspense: SuspenseBoundary | *null*`

  - `ssContent: VNode | *null*`

  - `ssFallback: VNode | *null*`
- `optimization only` 用于优化的属性
  - `shapeFlag: *number*`
  - `patchFlag: *number*`
  - `dynamicProps: *string*[] | *null*`
  - `dynamicChildren: VNode[] | *null*`
- 根节点会有的属性
  - `appContext: AppContext | *null*`，实例上下文

可以看到在`Vue`内部，对于一个`Vnode`描述对象的属性大概有二十多个，有些属性还必须经过规范梳理。



`Vue`为了给用于减轻一定的负担，但又不至于太封闭，就创建了渲染`h`。可以在用户需要的时候，通过`h`函数创建对应的`Vnode`即可。

这样就给为一些高阶玩家保留了自由发挥的空间。

### **那为什么要使用`h`函数呢？**

其实官方文档已经给出了一个非常贴切又简单的实例，👉传送门：[渲染函数](https://v3.cn.vuejs.org/guide/render-function.html#dom-%E6%A0%91)

通过官方示例，可以知道。

`javascript`相较于模板语法，有更高的自由度。当使用模板太过臃肿的时候，比如多个if/else，就可以使用渲染函数`h`。



### 如何用

#### `v-if`

```html
<span v-if="user">
  	{{user.name}}
</span>
<p v-else>Plase login.</p>
```

使`h`函数表述如下:

```js
render() {
  return this.user ? h('span', null, user.name) : h('p', 'Plase login.')
}
```

从上面代码可以知道：

- 可以通过三元运算符代替`v-if/v-else`指令
- 或者通过`if/else`代替`v-if/v-else`指令

#### `v-show`

```html
<div v-show="isActive">Content</div>
```

使`h`函数表述如下:

```js
render() {
    return h("div", {
      "directives": [{
        name: "show",
        value: isActive
      }], 
    }, "Content");
}
```



#### `v-for`

```html
<ul>
  <li v-for="item in items">{{ item.name }}</li>
</ul>
```

使`h`函数表述如下:

```js
render() {
    return h('ul', this.items.map((item) => {
      return h('li', item.name)
    }))
}
```

- 可以通过map函数代替v-for指令
- 通过map返回的Vnode，每一个都是不同的对象

#### `v-on`

```html
<button @click="onClick">Button</button>
```

使`h`函数表述如下:

```js
render() {
    return h('button',  {
		onClick: onClick
	})
}
```

对于input标签可以通过

- `onBlur`监听失去焦点事件

- `onFocus`监听焦点事件

- `onInput`监听输入事件

- `onClick`监听点击事件

- `onKeypress`监听键盘事件

#### `v-model`

在`Vue`中，我们可以通过`v-bind`由上向下传值。

也可以通过`v-model`由上向下传值。

当使用`v-model`时，其本质时`v-bind`与`v-on`的语法糖；

在h函数中，如何表示`v-model`？我们看下代码：

```js
props: ['modelValue'],
emits: ['update:modelValue'],
render() {
  return h(Component, {
    modelValue: this.modelValue,
    'onUpdate:modelValue': value => this.$emit('update:modelValue', value)
  })
}
```

上面的代码是一个官方示例。这里表示的是：

- 但使用`v-model`绑定`value`时。必须给子组件`props`中绑定一个`value`，及一个监听更新的函数，来代替`v-bind`与`v-on`。

#### `attrs`

在英文中`props`与`attrs`都代表属性的含义，但在`Vue`中这两个属性含义却不相同：

- `props`表示元素对象的属性
- `attrs`表示元素标签的属性

比如当我们调用h函数创建`Vnode`时，传递的第二个参数，就是`Vnode`对象的属性。

而当我们需要给元素标签设置`attrs`时该如何做呢？

```js
<input type="button" disabled="true"/>
```

使`h`函数表述如下:

```js
render() {
    return h(input, {
    	"attrs": {
        	type: button,
        	disabled: true
    	}
	})
}
```

由此在`h`函数中可见`props`包含`attrs`。

#### `v-slot`

在`Vue`中`slot`为模板提供了内容分发能力。

在使用时，只需要使用`slot`标签进行占位就可以。

下面看下如何使用h函数创建插槽。

```html
<div><slot></slot></div>
```

使`h`函数表述如下:

**普通插槽**

可以通过 [`this.$slots`](https://v3.cn.vuejs.org/api/instance-properties.html#slots) 访问静态插槽的内容，每个插槽都是一个 VNode 数组：

```js
render() {
  return h('div', {}, this.$slots.default())
}
```

**作用域插槽：**

```html
<!--定义插槽组件child-->
<div><slot :text="message"></slot></div>
<!--使用组件child-->
<div><child v-slot:default="slotProps">{{ slotProps.text }}</child></div>
```

```js
render() {
  return h('div', {}, this.$slots.default({
    text: this.message
  }))
}
```

- 可以通过`this.$slot`访问静态插槽的内容
- 如果需要传递状态，可以给`this.$slots.default()`函数传递一个对象参数

#### **自定义组件**

```html
<div><child v-slot:default="slotProps"><span>{{ slotProps.text }}</span></child></div>
```

```js
const { h, resolveComponent } = Vue

render() {
  return h('div', [
    h(
      resolveComponent('child'),
      {},
      // 将 `slots` 以 { name: props => VNode | Array<VNode> } 的形式传递给子对象。
      {
        default: (props) => Vue.h('span', props.text)
      }
    )
  ])
}
```

`resolveComponent API`会返回`child`组件的`Vnode`。

#### 动态组件

```html
<component :is="name"></component>
```

使`h`函数表述如下:

```js
const { h, resolveDynamicComponent } = Vue
render() {
  const Component = resolveDynamicComponent(this.name)
  return h(Component)
}
```

使用动态组件时，可以使用`resolveDynamicComponent`代替`is` attribute，`resolveDynamicComponent`支持传递一个组件名称、一个 HTML 元素名称或一个组件选项对象。

能给is传什么就能给`resolveDynamicComponent`传什么。

#### 内置组件

在`Vue`中， `KeepAlive`, `Teleport`, `Transition`, `TransitionGroup`等通被称为`Vue`内置组件，内置组件与用户自定义组件不同的是，内置组件没有进行局部或者全局注册，所以无法通过`resolveComponent`去访问他们。在使用`h`函数时，需要自信导入：

```js
const { h, KeepAlive, Teleport, Transition, TransitionGroup } = Vue
// ...
render () {
  return h(Transition, { mode: 'out-in' }, /* ... */)
}
```
#### `ref`

```html
<someComponent ref="someComponent"></someComponent>
```

使`h`函数表述如下:

```js
render() {
  return h(someComponent, {"ref": "someComponent"}))
}
```

#### 自定义指令

可以使用 [`withDirectives`](https://v3.cn.vuejs.org/api/global-api.html#withdirectives) 将自定义指令应用于`VNode`：

```js
const { h, resolveDirective, withDirectives } = Vue

// <div v-pin:top.animate="200"></div>
render () {
  const pin = resolveDirective('pin')
  return withDirectives(h('div'), [
    [pin, 200, 'top', { animate: true }]
  ])
}
```

[`resolveDirective API`](https://v3.cn.vuejs.org/api/global-api.html#resolvedirective) 是模板内部用来解析指令名称的同一个函数。只有当你还没有直接访问指令的定义对象时，才需要这样做。

后面我们会对`withDirectives API`进行分析。







> `resolveComponent API` 及 `resolveDirective API`原理是一样的。当我们创建一个组件的时候，给这个组件配置`compontes`属性、`directives`属性。这些属性最终都会绑定在实例上，`resolve`组件/指令的过程，就是通过访问当前实例的`compontes/directives`属性的过程。

## 

## 渲染函数`h()`源码分析

> 这部分内容可能比较枯燥，主要就是分析`h`函数是如何创建`Vnode`，创建过程中会做哪些处理。

`Vnode`就是一个虚拟节点的普通`JS`对象，`Vue`会根据对象信息，渲染对应的节点。

### `Vnode`类型

可以给`h`函数传递的`Vnode`节点类型：

- `string`
- `VNode`
- `Component`
- `Text`
- `Static`
- `Comment`
- `Fragment`
- `TeleportImpl`
- `SuspenseImpl`

直接看下源码：

```js
function h(type, propsOrChildren, children) {
  // 根据参数长度判断是否有子节点
  const l = arguments.length
  
  if (l === 2) {
    // 👉传两个参数
    if (isObject(propsOrChildren) && !isArray(propsOrChildren)) {
      // 👉propsOrChildren 是对象且不是数组时
      if (isVNode(propsOrChildren)) {
        //👉props是Vnode类型，则propsOrChildren为子节点
        return createVNode(type, null, [propsOrChildren])
      }
      // 👉props不包含子节点
      return createVNode(type, propsOrChildren)
    } else {
      // 👉省略props
      return createVNode(type, null, propsOrChildren)
    }
  } else {
    // 👉当存在2个已上的参数时
    // 👉将子节点放入children数组中
    if (l > 3) {
      children = Array.prototype.slice.call(arguments, 2)
    } else if (l === 3 && isVNode(children)) {
      children = [children]
    }
    return createVNode(type, propsOrChildren, children)
  }
}

```

通过上面代码知道，渲染函数`h`只是`createVnode`函数的语法糖。

渲染`h()`函数的主要职责就是通过判断参数的长度和类型，去调用`createVnode`函数创建`Vnode`。

下面看下`createVnode`函数。

### `createVNode`

`createVnode`函数位于`Vue`源码的`runtime-core`中`vnode.ts`文件夹。

`createVNode` 其实还是调用的`_createVNode`。

> 这里暂时不用关注`vnodeArgsTransformer`。

```js
export const createVNode = (__DEV__ ? createVNodeWithArgsTransform : _createVNode)

const createVNodeWithArgsTransform = (...args) => {
  return _createVNode(
    ...(vnodeArgsTransformer
      ? vnodeArgsTransformer(args, currentRenderingInstance)
      : args)
  )
}


```

### `_createVNode`

- 首先进行类型校验，如果不符合预期，在`dev`环境会警告，`prod`环境会作为注释节点类型。
- 在判断是否已经是`Vnode`，是的话直接克隆节点，并对自己点进行规范梳理。
- 如果是类组件，会获取`__vccOpts`
- 做Vue2的异步或者函数组件的兼容
- 如果`props`存在，会对`props`进行判断，并规范我们传给节点的`class`、`style`，会将`class`处理为字符串，将`style`处理为对象
- 创建`Vnode`
- 规范梳理子节点
- 如果构建时需要做兼容处理，则做`Vue2`的兼容处理，最后返回虚拟节点

```js
function _createVNode(
  type,
  props,
  children,
  patchFlag,
  dynamicProps,
  isBlockNode = false
){
   
  if (!type || type === NULL_DYNAMIC_COMPONENT) {
    if (__DEV__ && !type) {
      warn(`Invalid vnode type when creating vnode: ${type}.`)
    }
    type = Comment
  }

  // 👉如果type是Vnode类型，则克隆这个类型的节点，规范梳理子节点，返回克隆的节点
  if (isVNode(type)) {
    const cloned = cloneVNode(type, props, true /* mergeRef: true */)
    if (children) {
      normalizeChildren(cloned, children)
    }
    return cloned
  }

  // 👉如果时类组件类型
  if (isClassComponent(type)) {
    type = type.__vccOpts
  }

  // 👉兼容Vue2的处理
  if (__COMPAT__) {
    type = convertLegacyComponent(type, currentRenderingInstance)
  }

  //👉 if块中主要处理 class & style 属性
  if (props) {
    // for reactive or proxy objects, we need to clone it to enable mutation.
    // 如果props是响应式对象，需要通过Object.assign进行拷贝
    if (isProxy(props) || InternalObjectKey in props) {
      props = extend({}, props)
    }
    let { class: klass, style } = props
    if (klass && !isString(klass)) {
      // class不是字符串，需要规范为字符串
      props.class = normalizeClass(klass)
    }
    if (isObject(style)) {
      // reactive state objects need to be cloned since they are likely to be
      // mutated
      if (isProxy(style) && !isArray(style)) {
        style = extend({}, style)
      }
      props.style = normalizeStyle(style)
    }
  }

  // 将vnode类型信息转为 bitmap
  const shapeFlag = isString(type)
    ? ShapeFlags.ELEMENT
    : __FEATURE_SUSPENSE__ && isSuspense(type)
      ? ShapeFlags.SUSPENSE
      : isTeleport(type)
        ? ShapeFlags.TELEPORT
        : isObject(type)
          ? ShapeFlags.STATEFUL_COMPONENT
          : isFunction(type)
            ? ShapeFlags.FUNCTIONAL_COMPONENT
            : 0

  if (__DEV__ && shapeFlag & ShapeFlags.STATEFUL_COMPONENT && isProxy(type)) {
    // 省略...
    )
  }

  //👉 创建VNode的描述对象
  const vnode: VNode = {
    __v_isVNode: true, // 👉标识 该对象为虚拟节点
    __v_skip: true, // 👉标识 该对象跳过proxy
    type, // 类型
    props,
    key: props && normalizeKey(props), // 👉梳理props
    ref: props && normalizeRef(props),// 👉梳理ref
    scopeId: currentScopeId,
    slotScopeIds: null,
    children: null,
    component: null,
    suspense: null,
    ssContent: null,
    ssFallback: null,
    dirs: null,
    transition: null,
    el: null,
    anchor: null,
    target: null,
    targetAnchor: null,
    staticCount: 0,
    shapeFlag,
    patchFlag,
    dynamicProps,
    dynamicChildren: null, // 动态子节点
    appContext: null // 实例上下文
  }

  // validate key
  if (__DEV__ && vnode.key !== vnode.key) {
    warn(`VNode created with invalid key (NaN). VNode type:`, vnode.type)
  }
      
  // 👉规范子节点
  normalizeChildren(vnode, children)

  // 👉如果时suspense类型虚拟DOM，规范 suspense 子节点
  if (__FEATURE_SUSPENSE__ && shapeFlag & ShapeFlags.SUSPENSE) {
    ;(type).normalize(vnode)
  }

  // 这里暂时不关注
  if (
    isBlockTreeEnabled > 0 &&
    !isBlockNode &&
    currentBlock &&
    (patchFlag > 0 || shapeFlag & ShapeFlags.COMPONENT) &&
    patchFlag !== PatchFlags.HYDRATE_EVENTS
  ) {
    currentBlock.push(vnode)
  }
  // 👉兼容处理
  if (__COMPAT__) {
    convertLegacyVModelProps(vnode)
    convertLegacyRefInFor(vnode)
    defineLegacyVNodeProperties(vnode)
  }
  // 👉返回虚拟节点
  return vnode
}

```

通过上面的代码可以看出，`_createVNode`函数的主要职责：

- 梳理规范`props`中的`class`、`style`、`child`
- 创建`Vnode`的描述对象，并返回
- 对`Vue2`做兼容处理

> `Object.assign`与`Proxy`：https://stackoverflow.com/questions/43185453/object-assign-and-proxies



上面代码中，如果`type`是`Vnode`类型，会调用`cloneVNode`创建克隆的节点，接下来我们看下`cloneVNode`函数。

### `cloneVNode`

其实我们可以先思考一下，克隆一个`Vnode`，其实可以简化为克隆一棵`tree`，是一个递归克隆的过程。

```js
export function cloneVNode(
  vnode,
  extraProps,
  mergeRef = false
){
  // This is intentionally NOT using spread or extend to avoid the runtime
  // key enumeration cost.
  const { props, ref, patchFlag, children } = vnode
  // 👉合并props
  const mergedProps = extraProps ? mergeProps(props || {}, extraProps) : props
  // 👉创建Vnode克隆对象
  const cloned = {
    __v_isVNode: true,
    __v_skip: true,
    type: vnode.type,
    props: mergedProps,
    key: mergedProps && normalizeKey(mergedProps),
    ref:
      extraProps && extraProps.ref
          mergeRef && ref
          ? isArray(ref)
            ? ref.concat(normalizeRef(extraProps)!)
            : [ref, normalizeRef(extraProps)!]
          : normalizeRef(extraProps)
        : ref,
    scopeId: vnode.scopeId,
    slotScopeIds: vnode.slotScopeIds,
    children:
      __DEV__ && patchFlag === PatchFlags.HOISTED && isArray(children)
        ? children.map(deepCloneVNode) // 对子节点进行深克隆
        : children,
    target: vnode.target,
    targetAnchor: vnode.targetAnchor,
    staticCount: vnode.staticCount,
    shapeFlag: vnode.shapeFlag,
    patchFlag:
      extraProps && vnode.type !== Fragment
        ? patchFlag === -1 // hoisted node
          ? PatchFlags.FULL_PROPS
          : patchFlag | PatchFlags.FULL_PROPS
        : patchFlag,
    dynamicProps: vnode.dynamicProps,
    dynamicChildren: vnode.dynamicChildren,
    appContext: vnode.appContext,
    dirs: vnode.dirs,
    transition: vnode.transition,

    component: vnode.component,
    suspense: vnode.suspense,
    ssContent: vnode.ssContent && cloneVNode(vnode.ssContent),
    ssFallback: vnode.ssFallback && cloneVNode(vnode.ssFallback),
    el: vnode.el,
    anchor: vnode.anchor
  }
  // 兼容处理
  if (__COMPAT__) {
    defineLegacyVNodeProperties(cloned)
  }
  return cloned
}

```

cloneVNode主要做了这么几件事：

- 合并props
- 创建克隆对象
- 对Vnode子节点进行深度克隆

### `deepClone`

深度克隆， 如果子节点是数组类型会进行递归克隆。

```ts
function deepCloneVNode(vnode) {
  const cloned = cloneVNode(vnode)
  if (isArray(vnode.children)) {
    cloned.children = vnode.children.map(deepCloneVNode)
  }
  return cloned
}

```

### `isVNode`

很简单，根据创建Vnode描述对象时的私有属性判断。

```js
export function isVNode(value) {
  return value ? value.__v_isVNode === true : false
}
```

### `normalizeChildren`

在`_createVNode`中，我们知道，如果`Vnode`纯在子节点的时候，会执行`normalizeChildren`规范梳理子节点。下面看下`normalizeChildren`是如何做的：

```js
export function normalizeChildren(vnode, children) {
  let type = 0
  const { shapeFlag } = vnode
  // 👉下面会对children类型做判断，不同类型，不同操作
  if (children == null) {
    // 👉children 是null
    children = null
  } else if (isArray(children)) {
    // 👉children 是数组，标记type为ARRAY_CHILDREN
    type = ShapeFlags.ARRAY_CHILDREN
  } else if (typeof children === 'object') {
     // 👉children 是对象
    if (shapeFlag & ShapeFlags.ELEMENT || shapeFlag & ShapeFlags.TELEPORT) {
      // Normalize slot to plain children for plain element and Teleport
      const slot = (children).default
      if (slot) {
        // _c marker is added by withCtx() indicating this is a compiled slot
        slot._c && (slot._d = false)
        normalizeChildren(vnode, slot())
        slot._c && (slot._d = true)
      }
      return
    } else {
      type = ShapeFlags.SLOTS_CHILDREN
      const slotFlag = (children)._
      if (!slotFlag && !(InternalObjectKey in children!)) {
         
        ;(children)._ctx = currentRenderingInstance
      } else if (slotFlag === SlotFlags.FORWARDED && currentRenderingInstance) {
        
        if (
          (currentRenderingInstance.slots)._ === SlotFlags.STABLE
        ) {
          ;(children)._ = SlotFlags.STABLE
        } else {
          ;(children)._ = SlotFlags.DYNAMIC
          vnode.patchFlag |= PatchFlags.DYNAMIC_SLOTS
        }
      }
    }
  } else if (isFunction(children)) {
    // 👉children是函数
    children = { default: children, _ctx: currentRenderingInstance }
    type = ShapeFlags.SLOTS_CHILDREN
  } else {
    children = String(children)
    // force teleport children to array so it can be moved around
    if (shapeFlag & ShapeFlags.TELEPORT) {
      type = ShapeFlags.ARRAY_CHILDREN
      children = [createTextVNode(children)]
    } else {
      type = ShapeFlags.TEXT_CHILDREN
    }
  }
  vnode.children = children
  vnode.shapeFlag |= type
}
```

从上面代码可以看出，`normalizeChildren`主要对`Vnode.children`与`type`做了规范梳理。

### `isClassComponent`

```js
export function isClassComponent(value) {
  return isFunction(value) && '__vccOpts' in value
}
```

### `normalizeStyle`

当我们给组件绑定`style`的时候，可能回这么写：

```html
<div :style="{ color: activeColor, fontSize: fontSize + 'px' }"></div>
```

```js
data() {
  return {
    activeColor: 'red',
    fontSize: 30
  }
}
```

通过对象语法动态绑定`style`。

也可能这么写：

```html
<div :style="[baseStyles, overridingStyles]"></div>
```

```js
data() {
  return {
      baseStyles: {
          activeColor: 'red',
    	  fontSize: 30
      },
      overridingStyles: {
    	  display: flex
      },
  }
}
```

通过数组给元素绑定多个`style`对象。

但是这两种写法。最终都会通过`normalizeStyle`函数进行规范梳理。

下面看下`normalizeStyle`函数：

```js
export function normalizeStyle(value) {
  if (isArray(value)) {
    const res = {}
    for (let i = 0; i < value.length; i++) {
      const item = value[i]
      const normalized = normalizeStyle(
        isString(item) ? parseStringStyle(item) : item
      )
      if (normalized) {
        for (const key in normalized) {
          res[key] = normalized[key]
        }
      }
    }
    return res
  } else if (isObject(value)) {
    return value
  }
}

```

`normalizeStyle`函数很简单，通过遍历递归将数组类型的`value`，规范为对象类型并返回。

### `normalizeClass`

在我们给节点绑定类的时候，基本有三种形式：

- 以字符串形式绑定
- 以对象形式绑定
- 以数组形式绑定

但最终绑定到节点上的`class`，都会以`string`处理，`normalizeClass`做的就是这件事。

将所有非`string`的形式链接为`string`。

```js
export function normalizeClass(value) {
  let res = ''
  if (isString(value)) {
    res = value
  } else if (isArray(value)) {
    // 👉遍历递归处理
    for (let i = 0; i < value.length; i++) {
      const normalized = normalizeClass(value[i])
      if (normalized) {
        res += normalized + ' '
      }
    }
  } else if (isObject(value)) {
    // 👉将对象转化为string
    for (const name in value) {
      if (value[name]) {
        res += name + ' '
      }
    }
  }
  return res.trim()
}
```

`normalizeClass`函数思路其实与`normalizeStyle`相同。

> Tip：这种遍历递归经常会在面试题中出现。

### `mergeProps`

在前面的分析中，我们知道，克隆`Vnode`的过程中，回调用`mergeProps`对`vnode.props`进行合并。并将合并后的`mergedProps`传给`cloned Vnode`。

下面看下`mergedProps`是如何进行合并的？

```js
export function mergeProps(...args) {
  const ret = extend({}, args[0])
  for (let i = 1; i < args.length; i++) {
    const toMerge = args[i]
    for (const key in toMerge) {
      if (key === 'class') {
        // 👉merge Class
        if (ret.class !== toMerge.class) {
          ret.class = normalizeClass([ret.class, toMerge.class])
        }
      } else if (key === 'style') {
        // 👉merge Style
        ret.style = normalizeStyle([ret.style, toMerge.style])
      } else if (isOn(key)) {
        // 👉merge 监听的事件
        const existing = ret[key]
        const incoming = toMerge[key]
        if (existing !== incoming) {
          ret[key] = existing
            ? [].concat(existing, incoming)
            : incoming
        }
      } else if (key !== '') {
        ret[key] = toMerge[key]
      }
    }
  }
  return ret
}

```

- 会对节点的`class`、`style`、绑定的事件及非空属性进行合并
- 合并的过程会对`class`、`style`做`normalize`处理
- 如果绑定多个事件，会将所有事件存储在数组中

### `withDirectives`

```js
function withDirectives(vnode, directives) {
  const internalInstance = currentRenderingInstance
  if (internalInstance === null) {
    __DEV__ && warn(`withDirectives can only be used inside render functions.`)
    return vnode
  }
  const instance = internalInstance.proxy
  const bindings = vnode.dirs || (vnode.dirs = [])
  for (let i = 0; i < directives.length; i++) {
    let [dir, value, arg, modifiers] = directives[i]
    if (isFunction(dir)) {
      dir = {
        mounted: dir,
        updated: dir
      }
    }
    bindings.push({
      dir,
      instance,
      value,
      oldValue,
      arg,
      modifiers
    })
  }
  return vnode
}
```

通过上面代码可知，`withDirectives API`的思路其实很简单，就是通过遍历指令配置对象，将配置的指令`push`至`binding`集合中。

## 总结

`h`函数其实是`createVNode`的语法糖，返回的就是一个`Js`普通对象。在`createVNode` API 在创建`Vnode`的时候，会对`Vnode`的props、`children`、`ref`、`class`、`style`等属性进行规范梳理或者合并。如果`Type`直接就是`Vnode`类型，则会返回深度克隆的`Vnode`对象。相较于`HTML`模板语法，使用`h`函数创建组件`Vnode`，更加灵活，也更抽象。



参考:

[官方文档](https://v3.cn.vuejs.org/guide/render-function.html#%E6%8F%92%E6%A7%BD)

