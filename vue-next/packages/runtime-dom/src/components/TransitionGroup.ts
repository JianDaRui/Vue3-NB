import {
  TransitionProps,
  addTransitionClass,
  removeTransitionClass,
  ElementWithTransition,
  getTransitionInfo,
  resolveTransitionProps,
  TransitionPropsValidators,
  forceReflow
} from './Transition'
import {
  Fragment,
  VNode,
  warn,
  resolveTransitionHooks,
  useTransitionState,
  getTransitionRawChildren,
  getCurrentInstance,
  setTransitionHooks,
  createVNode,
  onUpdated,
  SetupContext,
  toRaw,
  compatUtils,
  DeprecationTypes,
  ComponentOptions
} from '@vue/runtime-core'
import { extend } from '@vue/shared'

interface Position {
  top: number
  left: number
}

const positionMap = new WeakMap<VNode, Position>()
const newPositionMap = new WeakMap<VNode, Position>()

export type TransitionGroupProps = Omit<TransitionProps, 'mode'> & {
  tag?: string
  moveClass?: string
}

const TransitionGroupImpl: ComponentOptions = {
  name: 'TransitionGroup',

  props: /*#__PURE__*/ extend({}, TransitionPropsValidators, {
    tag: String,
    moveClass: String
  }),

  setup(props: TransitionGroupProps, { slots }: SetupContext) {
    const instance = getCurrentInstance()!
    const state = useTransitionState()
    let prevChildren: VNode[]
    let children: VNode[]
    // 更新阶段生命周期
    onUpdated(() => {
      // children is guaranteed to exist after initial render
      // 初始化渲染之后确保子节点存在
      if (!prevChildren.length) {
        return
      }
      const moveClass = props.moveClass || `${props.name || 'v'}-move`

      if (
        !hasCSSTransform(
          prevChildren[0].el as ElementWithTransition,
          instance.vnode.el as Node,
          moveClass
        )
      ) {
        return
      }

      // we divide the work into three loops to avoid mixing DOM reads and writes
      // in each iteration - which helps prevent layout thrashing.
      // 执行pending状态回调
      prevChildren.forEach(callPendingCbs)
      // 记录子节点位置
      prevChildren.forEach(recordPosition)
      // 计算子节点过渡前后信息 并应用过渡
      const movedChildren = prevChildren.filter(applyTranslation)

      // force reflow to put everything in position
      // 强制出发重排 确保所有DOM都在正确的位置
      forceReflow()

      movedChildren.forEach(c => {
        const el = c.el as ElementWithTransition
        const style = el.style
        addTransitionClass(el, moveClass)
        style.transform = style.webkitTransform = style.transitionDuration = ''
        const cb = ((el as any)._moveCb = (e: TransitionEvent) => {
          if (e && e.target !== el) {
            return
          }
          if (!e || /transform$/.test(e.propertyName)) {
            el.removeEventListener('transitionend', cb)
            ;(el as any)._moveCb = null
            removeTransitionClass(el, moveClass)
          }
        })
        // 监听transitionend事件，过渡结束 移除监听事件
        el.addEventListener('transitionend', cb)
      })
    })

    return () => {
      const rawProps = toRaw(props)
      const cssTransitionProps = resolveTransitionProps(rawProps)
      let tag = rawProps.tag || Fragment

      if (
        __COMPAT__ &&
        !rawProps.tag &&
        compatUtils.checkCompatEnabled(
          DeprecationTypes.TRANSITION_GROUP_ROOT,
          instance.parent
        )
      ) {
        tag = 'span'
      }

      prevChildren = children
      children = slots.default ? getTransitionRawChildren(slots.default()) : []

      for (let i = 0; i < children.length; i++) {
        const child = children[i]
        if (child.key != null) {
          setTransitionHooks(
            child,
            resolveTransitionHooks(child, cssTransitionProps, state, instance)
          )
        } else if (__DEV__) {
          warn(`<TransitionGroup> children must be keyed.`)
        }
      }

      if (prevChildren) {
        for (let i = 0; i < prevChildren.length; i++) {
          const child = prevChildren[i]
          setTransitionHooks(
            child,
            resolveTransitionHooks(child, cssTransitionProps, state, instance)
          )
          // 记录原始位置
          positionMap.set(child, (child.el as Element).getBoundingClientRect())
        }
      }
      // 返回Vnode
      return createVNode(tag, null, children)
    }
  }
}

if (__COMPAT__) {
  TransitionGroupImpl.__isBuiltIn = true
}

/**
 * TransitionGroup does not support "mode" so we need to remove it from the
 * props declarations, but direct delete operation is considered a side effect
 * and will make the entire transition feature non-tree-shakeable, so we do it
 * in a function and mark the function's invocation as pure.
 */
const removeMode = (props: any) => delete props.mode
/*#__PURE__*/ removeMode(TransitionGroupImpl.props)

export const TransitionGroup = (TransitionGroupImpl as unknown) as {
  new (): {
    $props: TransitionGroupProps
  }
}

function callPendingCbs(c: VNode) {
  const el = c.el as any
  if (el._moveCb) {
    el._moveCb()
  }
  if (el._enterCb) {
    el._enterCb()
  }
}

function recordPosition(c: VNode) {
  newPositionMap.set(c, (c.el as Element).getBoundingClientRect())
}

function applyTranslation(c: VNode): VNode | undefined {
  const oldPos = positionMap.get(c)!
  const newPos = newPositionMap.get(c)!
  const dx = oldPos.left - newPos.left
  const dy = oldPos.top - newPos.top
  if (dx || dy) {
    const s = (c.el as HTMLElement).style
    s.transform = s.webkitTransform = `translate(${dx}px,${dy}px)`
    s.transitionDuration = '0s'
    return c
  }
}

function hasCSSTransform(
  el: ElementWithTransition,
  root: Node,
  moveClass: string
): boolean {
  // Detect whether an element with the move class applied has
  // CSS transitions. Since the element may be inside an entering
  // transition at this very moment, we make a clone of it and remove
  // all other transition classes applied to ensure only the move class
  // is applied.
  const clone = el.cloneNode() as HTMLElement
  if (el._vtc) {
    el._vtc.forEach(cls => {
      cls.split(/\s+/).forEach(c => c && clone.classList.remove(c))
    })
  }
  moveClass.split(/\s+/).forEach(c => c && clone.classList.add(c))
  clone.style.display = 'none'
  const container = (root.nodeType === 1
    ? root
    : root.parentNode) as HTMLElement
  container.appendChild(clone)
  // 获取过渡信息
  const { hasTransform } = getTransitionInfo(clone)
  container.removeChild(clone)
  return hasTransform
}
