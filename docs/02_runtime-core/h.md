# 第六篇 `Vue3 RunTimeCore`——高阶 API 源码分析

## h()

用于创建Vnode，是createVnode的语法糖

Vnode就是一个虚拟节点的普通JS对象，Vue会根据对象信息，渲染对应的节点。

先看下Vnode有哪些信息：

- __v_isVNode: *true*，内部属性，有该属性表示为Vnode

- __v_skip: true，内部属性，表示跳过响应式转换，reactive转换时会根据此属性进行判断

- isCompatRoot?: *true*，用于是否做了兼容处理的判断

- type: VNodeTypes，虚拟节点的类型

- props: (VNodeProps & ExtraProps) | *null*，虚拟节点的props

- key: *string* | *number* | *null*，虚拟阶段的key，可用于diff

- ref: VNodeNormalizedRef | *null*，虚拟阶段的引用

- scopeId: *string* | *null*，仅限于SFC(单文件组件)，在设置currentRenderingInstance当前渲染实例时，一期设置

- slotScopeIds: *string*[] | *null*，仅限于单文件组件，与单文件组件的插槽有关

- children: VNodeNormalizedChildren，子节点

- component: ComponentInternalInstance | *null*，组件实例

- dirs: DirectiveBinding[] | *null*，当前Vnode绑定的指令

- transition: TransitionHooks<HostElement> | *null*，TransitionHooks

- DOM相关属性
  - el: HostNode | *null*，宿主阶段
  - anchor: HostNode | *null* // fragment anchor
  - target: HostElement | *null* ，teleport target 传送的目标
  - targetAnchor: HostNode | *null* // teleport target anchor
  - staticCount: *number* ，包含的静态节点的数量

- suspense 悬挂有关的属性

  - suspense: SuspenseBoundary | *null*

  - ssContent: VNode | *null*

  - ssFallback: VNode | *null*

- optimization only 用于优化的属性
  - shapeFlag: *number*
  - patchFlag: *number*
  - dynamicProps: *string*[] | *null*
  - dynamicChildren: VNode[] | *null*

- 根节点会有的属性
  - appContext: AppContext | *null*，实例上下文



在Vue中有哪些类型的虚拟阶段：

```js
export type VNodeTypes =
  | string
  | VNode
  | Component
  | typeof Text
  | typeof Static
  | typeof Comment
  | typeof Fragment
  | typeof TeleportImpl
  | typeof SuspenseImpl
```

一段html标签包含的信息：

```html
<button onclick="handClick">BUTTON</button>
```

标签、属性、子节点。

```js
export function h(type, propsOrChildren, children) {
  // 根据参数长度判断是否有子节点
  const l = arguments.length
  
  if (l === 2) {
    if (isObject(propsOrChildren) && !isArray(propsOrChildren)) {
      // single vnode without props
      if (isVNode(propsOrChildren)) {
        return createVNode(type, null, [propsOrChildren])
      }
      // props without children
      return createVNode(type, propsOrChildren)
    } else {
      // omit props 省略props
      return createVNode(type, null, propsOrChildren)
    }
  } else {
    if (l > 3) {
      children = Array.prototype.slice.call(arguments, 2)
    } else if (l === 3 && isVNode(children)) {
      children = [children]
    }
    return createVNode(type, propsOrChildren, children)
  }
}

```



## createVNode

createVNode 其实还是调用的_createVNode，这里暂时不用关注vnodeArgsTransformer

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



## _createVNode

- 首先进行类型校验，如果不符合预期，在dev环境会警告，prod环境会作为注释节点类型。
- 在判断是否已经是Vnode，是的话直接克隆节点，并对自己点进行规范梳理。
- 如果是类组件，会获取__vccOpts
- 做Vue2的异步或者函数组件的兼容
- 如果props存在，会对props进行判断，并规范我们传给节点的class、style，会将class 处理为字符串，将style处理为对象
- 创建Vnode
- 规范梳理子节点
- 如果构建时需要做兼容处理，则做Vue2的兼容处理，最后返回虚拟节点

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

  if (isVNode(type)) {
    const cloned = cloneVNode(type, props, true /* mergeRef: true */)
    if (children) {
      normalizeChildren(cloned, children)
    }
    return cloned
  }

  // 类组件
  if (isClassComponent(type)) {
    type = type.__vccOpts
  }

  // 兼容Vue2
  if (__COMPAT__) {
    type = convertLegacyComponent(type, currentRenderingInstance)
  }

  // class & style 规范
  if (props) {
    // for reactive or proxy objects, we need to clone it to enable mutation.
    if (isProxy(props) || InternalObjectKey in props) {
      props = extend({}, props)
    }
    let { class: klass, style } = props
    if (klass && !isString(klass)) {
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
    type = toRaw(type)
    warn(
      `Vue received a Component which was made a reactive object. This can ` +
        `lead to unnecessary performance overhead, and should be avoided by ` +
        `marking the component with \`markRaw\` or using \`shallowRef\` ` +
        `instead of \`ref\`.`,
      `\nComponent that was made reactive: `,
      type
    )
  }
  // 创建VNode的描述对象
  const vnode: VNode = {
    __v_isVNode: true, // 标识 该对象为虚拟节点
    __v_skip: true, // 标识 该对象跳过proxy
    type, // 类型
    props,
    key: props && normalizeKey(props),
    ref: props && normalizeRef(props),
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
  // 规范子节点
  normalizeChildren(vnode, children)

  // 规范 suspense 子节点
  if (__FEATURE_SUSPENSE__ && shapeFlag & ShapeFlags.SUSPENSE) {
    ;(type as typeof SuspenseImpl).normalize(vnode)
  }

  if (
    isBlockTreeEnabled > 0 &&
    !isBlockNode &&
    currentBlock &&
    (patchFlag > 0 || shapeFlag & ShapeFlags.COMPONENT) &&
    patchFlag !== PatchFlags.HYDRATE_EVENTS
  ) {
    currentBlock.push(vnode)
  }
  // 兼容处理
  if (__COMPAT__) {
    convertLegacyVModelProps(vnode)
    convertLegacyRefInFor(vnode)
    defineLegacyVNodeProperties(vnode)
  }
  // 返回虚拟节点
  return vnode
}

```





```js
export function cloneVNode(
  vnode,
  extraProps,
  mergeRef = false
){
  // This is intentionally NOT using spread or extend to avoid the runtime
  // key enumeration cost.
  const { props, ref, patchFlag, children } = vnode
  const mergedProps = extraProps ? mergeProps(props || {}, extraProps) : props
  const cloned: VNode = {
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
        ? (children as VNode[]).map(deepCloneVNode)
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
  if (__COMPAT__) {
    defineLegacyVNodeProperties(cloned)
  }
  return cloned as any
}

```

## deepClone

深度克隆， 如果子节点是数组类型会进行递归克隆

```ts
function deepCloneVNode(vnode) {
  const cloned = cloneVNode(vnode)
  if (isArray(vnode.children)) {
    cloned.children = vnode.children.map(deepCloneVNode)
  }
  return cloned
}

```

## isVNode

很简单，根据创建Vnode描述对象时的私有属性判断

```js
export function isVNode(value) {
  return value ? value.__v_isVNode === true : false
}
```

## normalizeChildren

```js
export function normalizeChildren(vnode, children) {
  let type = 0
  const { shapeFlag } = vnode
  if (children == null) {
    children = null
  } else if (isArray(children)) {
    type = ShapeFlags.ARRAY_CHILDREN
  } else if (typeof children === 'object') {
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
      const slotFlag = (children as RawSlots)._
      if (!slotFlag && !(InternalObjectKey in children!)) {
        // if slots are not normalized, attach context instance
        // (compiled / normalized slots already have context)
        ;(children as RawSlots)._ctx = currentRenderingInstance
      } else if (slotFlag === SlotFlags.FORWARDED && currentRenderingInstance) {
        // a child component receives forwarded slots from the parent.
        // its slot type is determined by its parent's slot type.
        if (
          (currentRenderingInstance.slots as RawSlots)._ === SlotFlags.STABLE
        ) {
          ;(children as RawSlots)._ = SlotFlags.STABLE
        } else {
          ;(children as RawSlots)._ = SlotFlags.DYNAMIC
          vnode.patchFlag |= PatchFlags.DYNAMIC_SLOTS
        }
      }
    }
  } else if (isFunction(children)) {
    children = { default: children, _ctx: currentRenderingInstance }
    type = ShapeFlags.SLOTS_CHILDREN
  } else {
    children = String(children)
    // force teleport children to array so it can be moved around
    if (shapeFlag & ShapeFlags.TELEPORT) {
      type = ShapeFlags.ARRAY_CHILDREN
      children = [createTextVNode(children as string)]
    } else {
      type = ShapeFlags.TEXT_CHILDREN
    }
  }
  vnode.children = children as VNodeNormalizedChildren
  vnode.shapeFlag |= type
}
```



```js
export function isClassComponent(value) {
  return isFunction(value) && '__vccOpts' in value
}

```

```ts
// 兼容处理
export function convertLegacyComponent(
  comp: any,
  instance: ComponentInternalInstance | null
): Component {
  if (comp.__isBuiltIn) {
    return comp
  }

  // 2.x constructor
  if (isFunction(comp) && comp.cid) {
    comp = comp.options
  }

  // 2.x async component
  if (
    isFunction(comp) &&
    checkCompatEnabled(DeprecationTypes.COMPONENT_ASYNC, instance, comp)
  ) {
    // since after disabling this, plain functions are still valid usage, do not
    // use softAssert here.
    return convertLegacyAsyncComponent(comp)
  }

  // 2.x functional component
  if (
    isObject(comp) &&
    comp.functional &&
    softAssertCompatEnabled(
      DeprecationTypes.COMPONENT_FUNCTIONAL,
      instance,
      comp
    )
  ) {
    return convertLegacyFunctionalComponent(comp)
  }

  return comp
}

```

## normalizeStyle



```js
export function normalizeStyle(value) {
  if (isArray(value)) {
    const res: NormalizedStyle = {}
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

## normalizeClass

在我们给节点绑定类的时候，基本有三种形式：

- 以字符串形式绑定
- 以对象形式绑定
- 以数组形式绑定

但最终绑定到节点上的class，都会以string处理，normalizeClass做的就是这件事。

将所有非string的形式链接为string。

```js
export function normalizeClass(value) {
  let res = ''
  if (isString(value)) {
    res = value
  } else if (isArray(value)) {
    // 递归处理
    for (let i = 0; i < value.length; i++) {
      const normalized = normalizeClass(value[i])
      if (normalized) {
        res += normalized + ' '
      }
    }
  } else if (isObject(value)) {
    for (const name in value) {
      if (value[name]) {
        res += name + ' '
      }
    }
  }
  return res.trim()
}

```



## mergeProps

- 会对节点的class、style、绑定的事件及非空属性进行合并
- 合并的过程会对class、style做normalize处理
- 如果绑定多个事件，会将所有事件存储在数组中

```js
export function mergeProps(...args: (Data & VNodeProps)[]) {
  const ret = extend({}, args[0])
  for (let i = 1; i < args.length; i++) {
    const toMerge = args[i]
    for (const key in toMerge) {
      if (key === 'class') {
        if (ret.class !== toMerge.class) {
          ret.class = normalizeClass([ret.class, toMerge.class])
        }
      } else if (key === 'style') {
        ret.style = normalizeStyle([ret.style, toMerge.style])
      } else if (isOn(key)) {
        const existing = ret[key]
        const incoming = toMerge[key]
        if (existing !== incoming) {
          ret[key] = existing
            ? [].concat(existing as any, incoming as any)
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



## normalizeVNode



```js
export function normalizeVNode(child) {
  if (child == null || typeof child === 'boolean') {
    // empty placeholder
    return createVNode(Comment)
  } else if (isArray(child)) {
    // fragment
    return createVNode(
      Fragment,
      null,
      // #3666, avoid reference pollution when reusing vnode
      child.slice()
    )
  } else if (typeof child === 'object') {
    // already vnode, this should be the most common since compiled templates
    // always produce all-vnode children arrays
    return cloneIfMounted(child)
  } else {
    // strings and numbers
    return createVNode(Text, null, String(child))
  }
}
```

## cloneIfMounted

```js
export function cloneIfMounted(child: VNode): VNode {
  return child.el === null ? child : cloneVNode(child)
}
```

## createStaticVNode

```js
/**
 * @private
 */
export function createStaticVNode(
  content: string,
  numberOfNodes: number
): VNode {
  // A static vnode can contain multiple stringified elements, and the number
  // of elements is necessary for hydration.
  const vnode = createVNode(Static, null, content)
  vnode.staticCount = numberOfNodes
  return vnode
}
```

## createTextVNode

```js
/**
 * @private
 */
export function createTextVNode(text: string = ' ', flag: number = 0): VNode {
  return createVNode(Text, null, text, flag)
}
```



## createCommentVNode

```js
/**
 * @private
 */
export function createCommentVNode(
  text: string = '',
  // when used as the v-else branch, the comment node must be created as a
  // block to ensure correct updates.
  asBlock: boolean = false
): VNode {
  return asBlock
    ? (openBlock(), createBlock(Comment, null, text))
    : createVNode(Comment, null, text)
}
```



```js
export function createBlock(
  type: VNodeTypes | ClassComponent,
  props?: Record<string, any> | null,
  children?: any,
  patchFlag?: number,
  dynamicProps?: string[]
): VNode {
  const vnode = createVNode(
    type,
    props,
    children,
    patchFlag,
    dynamicProps,
    true /* isBlock: prevent a block from tracking itself */
  )
  // save current block children on the block vnode
  vnode.dynamicChildren =
    isBlockTreeEnabled > 0 ? currentBlock || (EMPTY_ARR as any) : null
  // close block
  closeBlock()
  // a block is always going to be patched, so track it as a child of its
  // parent block
  if (isBlockTreeEnabled > 0 && currentBlock) {
    currentBlock.push(vnode)
  }
  return vnode
}
```

