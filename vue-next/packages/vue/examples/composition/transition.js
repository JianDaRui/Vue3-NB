import {
  defineComponent,
  h,
  mounted,
  unmounted
} from '../../dist/vue.global.js

function whenTransitionEnds(el, type, resolve) {
  const endEvent = type + ‘end’
  const end = () => {
    // 每次监听时，先移除原有的监听事件
    el.removeEventListener(endEvent, onEnd);
    resolve();
  };
  const onEnd = (e) => {
    if (e.target === el) {
      end();
    }
  };
  el.addEventListener(endEvent, onEnd);
}

function nextFrame(cb) {
  requestAnimationFrame(() => {
    requestAnimationFrame(cb);
  });
}
const MyTransition = defineComponent({
  name: 'MyTransition',
  props: {
    name: {
      type: String,
      default: 'v'
    },
    type: String,
    css: {
      type: Boolean,
      default: true
    },
    duration: [String, Number, Object],
    enterFromClass: String,
    enterActiveClass: String,
    enterToClass: String,
    appearFromClass: String,
    appearActiveClass: String,
    appearToClass: String,
    leaveFromClass: String,
    leaveActiveClass: String,
    leaveToClass: String
  },
  setup(props, {
    slots
  }) {
    const children = slots.default()
    const newProps = {}
    const {
      name = 'v',
        type,
        duration,
        enterFromClass = `${name}-enter-from`,
        enterActiveClass = `${name}-enter-active`,
        enterToClass = `${name}-enter-to`,
        appearFromClass = enterFromClass,
        appearActiveClass = enterActiveClass,
        appearToClass = enterToClass,
        leaveFromClass = `${name}-leave-from`,
        leaveActiveClass = `${name}-leave-active`,
        leaveToClass = `${name}-leave-to`
    } = props
    const startBefore = (el, isAppear) => {
      addTransitionClass(el, isAppear ? appearFromClass : enterFromClass);
      addTransitionClass(el, isAppear ? appearActiveClass : enterActiveClass);
    };

    const finishEnter = (el, isAppear) => {
      removeTransitionClass(el, isAppear ? appearToClass : enterToClass);
      removeTransitionClass(el, isAppear ? appearActiveClass : enterActiveClass);
    };
    const finishLeave = (el) => {
      removeTransitionClass(el, leaveToClass);
      removeTransitionClass(el, leaveActiveClass);
    };
    const makeEnterHook = (isAppear) => {
      return (el) => {
        const hook = isAppear ? onAppear : onEnter;
        const resolve = () => finishEnter(el, isAppear, done);
        nextFrame(() => {
            removeTransitionClass(el, isAppear ? appearFromClass : enterFromClass; addTransitionClass(el, isAppear ? appearToClass : enterToClass);

              el.addEventListener(el, type, enterDuration, resolve);
            });
        }
      }
    }

    Object.assign(newProps, {
      onBeforeEnter(el) {
        startBefore(el, false)
      },
      onBeforeAppear(el) {
        startBefore(el, true)
      },
      onEnter: makeEnterHook(false),
      onAppear: makeEnterHook(true),
      onLeave(el) {
        const resolve = () => finishLeave(el);
        addTransitionClass(el, leaveFromClass);

        document.body.offsetHeight;

        addTransitionClass(el, leaveActiveClass);
        nextFrame(() => {
          removeTransitionClass(el, leaveFromClass);
          addTransitionClass(el, leaveToClass);

          el.addEventListener(el, type, enterDuration, resolve);
        });
      },
      onEnterCancelled(el) {
        finishEnter(el, false);
      },
      onAppearCancelled(el) {
        finishEnter(el, true);
      },
      onLeaveCancelled(el) {
        finishLeave(el);
      }
    })

    return h(children, newProps, null)
  }
})


function normalizeDuration(duration) {
  if (duration == null) {
    return null;
  } else if (isObject(duration)) {
    return [NumberOf(duration.enter), NumberOf(duration.leave)];
  } else {
    const n = NumberOf(duration);
    return [n, n];
  }
}


const TransitionHookValidator = [Function, Array];
const BaseTransitionImpl = {
  name: `BaseTransition`,
  props: {
    mode: String,
    appear: Boolean,
    // enter
    onBeforeEnter: TransitionHookValidator,
    onEnter: TransitionHookValidator,
    onAfterEnter: TransitionHookValidator,
    onEnterCancelled: TransitionHookValidator,
    // leave
    onBeforeLeave: TransitionHookValidator,
    onLeave: TransitionHookValidator,
    onAfterLeave: TransitionHookValidator,
    onLeaveCancelled: TransitionHookValidator,
    // appear
    onBeforeAppear: TransitionHookValidator,
    onAppear: TransitionHookValidator,
    onAfterAppear: TransitionHookValidator,
    onAppearCancelled: TransitionHookValidator
  },
  setup(props, {
    slots
  }) {
    return () => {
      const children = slots.default
      if (!children || !children.length) {
        return;
      }

      const child = children[0];


      return child;
    };
  }
};

function resolveTransitionProps(rawProps) {
  const newProps = {};
  for (const key in rawProps) {
    if (!(key in DOMTransitionPropsValidators)) {
      newProps[key] = rawProps[key];
    }
  }
  if (rawProps.css === false) {
    return newProps;
  }
  const {
    name = 'v', type, duration, enterFromClass = `${name}-enter-from`, enterActiveClass = `${name}-enter-active`, enterToClass = `${name}-enter-to`, appearFromClass = enterFromClass, appearActiveClass = enterActiveClass, appearToClass = enterToClass, leaveFromClass = `${name}-leave-from`, leaveActiveClass = `${name}-leave-active`, leaveToClass = `${name}-leave-to`
  } = rawProps;
  const durations = normalizeDuration(duration);
  const enterDuration = durations && durations[0];
  const leaveDuration = durations && durations[1];
  const {
    onBeforeEnter,
    onEnter,
    onEnterCancelled,
    onLeave,
    onLeaveCancelled,
    onBeforeAppear = onBeforeEnter,
    onAppear = onEnter,
    onAppearCancelled = onEnterCancelled
  } = newProps;
  const finishEnter = (el, isAppear, done) => {
    removeTransitionClass(el, isAppear ? appearToClass : enterToClass);
    removeTransitionClass(el, isAppear ? appearActiveClass : enterActiveClass);
    done && done();
  };
  const finishLeave = (el, done) => {
    removeTransitionClass(el, leaveToClass);
    removeTransitionClass(el, leaveActiveClass);
    done && done();
  };
  const makeEnterHook = (isAppear) => {
    return (el, done) => {
      const hook = isAppear ? onAppear : onEnter;
      const resolve = () => finishEnter(el, isAppear, done);
      callHook$1(hook, [el, resolve]);
      nextFrame(() => {
        removeTransitionClass(el, isAppear ? appearFromClass : enterFromClass);
        addTransitionClass(el, isAppear ? appearToClass : enterToClass);
        if (!hasExplicitCallback(hook)) {
          whenTransitionEnds(el, type, enterDuration, resolve);
        }
      });
    };
  };
  return extend(newProps, {
    onBeforeEnter(el) {
      callHook$1(onBeforeEnter, [el]);
      addTransitionClass(el, enterFromClass);
      addTransitionClass(el, enterActiveClass);
    },
    onBeforeAppear(el) {
      callHook$1(onBeforeAppear, [el]);
      addTransitionClass(el, appearFromClass);
      addTransitionClass(el, appearActiveClass);
    },
    onEnter: makeEnterHook(false),
    onAppear: makeEnterHook(true),
    onLeave(el, done) {
      const resolve = () => finishLeave(el, done);
      addTransitionClass(el, leaveFromClass);
      // force reflow so *-leave-from classes immediately take effect (#2593)
      forceReflow();
      addTransitionClass(el, leaveActiveClass);
      nextFrame(() => {
        removeTransitionClass(el, leaveFromClass);
        addTransitionClass(el, leaveToClass);
        if (!hasExplicitCallback(onLeave)) {
          whenTransitionEnds(el, type, leaveDuration, resolve);
        }
      });
      callHook$1(onLeave, [el, resolve]);
    },
    onEnterCancelled(el) {
      finishEnter(el, false);
      callHook$1(onEnterCancelled, [el]);
    },
    onAppearCancelled(el) {
      finishEnter(el, true);
      callHook$1(onAppearCancelled, [el]);
    },
    onLeaveCancelled(el) {
      finishLeave(el);
      callHook$1(onLeaveCancelled, [el]);
    }
  });
}



const MyTransitionBase = defineComponent({
  // 省略部分代码...
  setup(props, {
    slots
  }) {
    const state = {
      isMounted: false,
      isUnmounting: false,
    }
    onMounted(() => {
      state.isMounted = true
    })
    onBeforeUnmount(() => {
      state.isUnmounting = true
    })

    // 返回一个渲染函数
    return () => {
      // 获取子节点
      const children = slots.default
      if (!children || !children.length) {
        return;
      }
      // 只为单个元素/组件绑定过渡效果
      const child = children[0];

      // 获取Enter阶段钩子
      const hooks = resolveTransitionHooks(
        child,
        props,
        state
      )
      // 设置过渡钩子
      setTransitionHooks(child, hooks)

      return child;
    };
  }
})


function resolveTransitionHooks(vnode, props, state) {
  const {
    appear,
    mode,
    persisted = false,
    onBeforeEnter,
    onEnter,
    onAfterEnter,
    onEnterCancelled,
    onBeforeLeave,
    onLeave,
    onAfterLeave,
    onLeaveCancelled,
    onBeforeAppear,
    onAppear,
    onAfterAppear,
    onAppearCancelled
  } = props;
  const key = String(vnode.key);

  const hooks = {
    mode,
    persisted,
    beforeEnter(el) {
      let hook = onBeforeEnter;
      if (!state.isMounted) {
        if (appear) {
          hook = onBeforeAppear || onBeforeEnter;
        } else {
          return;
        }
      }
      callHook(hook, [el]);
    },
    enter(el) {
      let hook = onEnter;
      if (!state.isMounted) {
        if (appear) {
          hook = onAppear || onEnter;
        } else {
          return;
        }
      }
      if (hook) {
        hook(el);
      }
    },
    leave(el) {
      callHook(onBeforeLeave, [el]);
      if (onLeave) {
        onLeave(el);
      }
    }
  };
  return hooks;
}

function setTransitionHooks(vnode, hooks) {
  if (vnode.component) {
    setTransitionHooks(vnode.component.subTree, hooks);
  } else {
    vnode.transition = hooks;
  }
}




// 移动节点
const move = (vnode, container, anchor, moveType, parentSuspense = null) => {
  const {
    el,
    type,
    transition,
    children,
    shapeFlag
  } = vnode;

  // 省略部分代码...
  // single nodes
  const needTransition = moveType !== 2 /* REORDER */ &&
    shapeFlag & 1 /* ELEMENT */ &&
    transition;
  if (needTransition) {
    if (moveType === 0 /* ENTER */ ) {
      transition.beforeEnter(el);
      hostInsert(el, container, anchor);
      queuePostRenderEffect(() => transition.enter(el), parentSuspense);
    } else {
      const {
        leave,
        delayLeave,
        afterLeave
      } = transition;
      const remove = () => hostInsert(el, container, anchor);
      const performLeave = () => {
        leave(el, () => {
          remove();
          afterLeave && afterLeave();
        });
      };
      if (delayLeave) {
        delayLeave(el, remove, performLeave);
      } else {
        performLeave();
      }
    }
  }
};

// 移除Vnode
const remove = vnode => {
  const {
    type,
    el,
    anchor,
    transition
  } = vnode;
  // 省略部分代码...

  const performRemove = () => {
    hostRemove(el);
    if (transition && !transition.persisted && transition.afterLeave) {
      transition.afterLeave();
    }
  };
  if (vnode.shapeFlag & 1 /* ELEMENT */ &&
    transition &&
    !transition.persisted) {
    const {
      leave,
      delayLeave
    } = transition;
    const performLeave = () => leave(el, performRemove);
    if (delayLeave) {
      delayLeave(vnode.el, performRemove, performLeave);
    } else {
      performLeave();
    }
  } else {
    performRemove();
  }
};


const MyTransitionBase = {
  setup(props, { slots }) {
      const instance = getCurrentInstance();
      const state = useTransitionState();

      return () => {
          const children = slots.default()
          
          const { mode } = props;
          // at this point children has a guaranteed length of 1.
          const child = children[0];

          const enterHooks = resolveTransitionHooks(child, rawProps, state, instance);

          setTransitionHooks(child, enterHooks);

          const oldChild = instance.subTree;

          // handle mode
          if (oldChild && (!isSameVNodeType(child, oldChild))) {
              const leavingHooks = resolveTransitionHooks(oldChild, rawProps, state, instance);
              // update old tree's hooks in case of dynamic transition
              setTransitionHooks(oldChild, leavingHooks);
              // switching between different views
              if (mode === 'out-in') {
                  // return placeholder node and queue update when leave finishes
                  leavingHooks.afterLeave = () => {
                      instance.update();
                  };
              } else if (mode === 'in-out') {
                  leavingHooks.delayLeave = (el, earlyRemove, delayedLeave) => {
                      const leavingVNodesCache = getLeavingNodesForType(state, oldChild);
                      leavingVNodesCache[String(oldChild.key)] = oldChild;
                      // early removal callback
                      el._leaveCb = () => {
                          earlyRemove();
                          el._leaveCb = undefined;
                          delete enterHooks.delayedLeave;
                      };
                      enterHooks.delayedLeave = delayedLeave;
                  };
              }
          }

          return child;
      };
  }
}

function getLeavingNodesForType(state, vnode) {
  const { leavingVNodes } = state;
  let leavingVNodesCache = leavingVNodes.get(vnode.type);
  if (!leavingVNodesCache) {
      leavingVNodesCache = Object.create(null);
      leavingVNodes.set(vnode.type, leavingVNodesCache);
  }
  return leavingVNodesCache;
}

function useTransitionState {
  const state: TransitionState = {
    isMounted: false,
    isUnmounting: false,
    leavingVNodes: new Map()
  }
  onMounted(() => {
    state.isMounted = true
  })
  onBeforeUnmount(() => {
    state.isUnmounting = true
  })
  return state
}


function resolveTransitionHooks(vnode, props, state, instance) {
  // 省略部分代码...
  const key = String(vnode.key);
  const leavingVNodesCache = getLeavingNodesForType(state, vnode);
  const callHook = (hook, args) => {
    hook && callWithAsyncErrorHandling(
      hook,
      instance,
      args
    )
};
  const hooks = {
      mode,
      persisted,
      beforeEnter(el) {
          let hook = onBeforeEnter;
          // 省略部分代码...
          // for toggled element with same key (v-if)
          const leavingVNode = leavingVNodesCache[key];
          if (leavingVNode &&
              isSameVNodeType(vnode, leavingVNode) &&
              leavingVNode.el._leaveCb) {
              // force early removal (not cancelled)
              leavingVNode.el._leaveCb();
          }
          callHook(hook, [el]);
      },
      leave(el, remove) {
          // 省略部分代码
          const key = String(vnode.key);
          
          if (state.isUnmounting) {
            return remove();
          }
          callHook(onBeforeLeave, [el]);

          leavingVNodesCache[key] = vnode;
          
      }
  };
  return hooks;
}