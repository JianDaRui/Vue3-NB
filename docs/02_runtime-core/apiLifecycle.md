# 第四篇 `Vue3 RunTimeCore`——`apiLifecycle`源码分析

大家好，我是剑大瑞。

这是第四篇源码分析，这篇文章，我们主要对`Vue`的生命周期做了简单回顾，主要是对生命周期的源码进行分析。

## 简单回顾

`Vue3`与`Vue2`的生命周期函数在调用方式、父子组件间触发顺序等方面b并没有区别，这里我们只说一些关键的点：

- `Vue3`为生命周期提供了组合式`API`，可以让我们做到在setup函数中直接调用
- `Vue3`并没有提供`beforeCreate`、`created`生命周期的组合式函数，可以使用`setup`函数替代这两个组合式`API`
- `Vue3`也可以像`Vue2`一样通过组件配置项，配置生命周期函数

```js
import { onMounted, onUpdated, onUnmounted } from 'vue'

const MyComponent = {
  setup() {
    onMounted(() => {
      console.log('mounted!')
    })
    onUpdated(() => {
      console.log('updated!')
    })
    onUnmounted(() => {
      console.log('unmounted!')
    })
  }
}
```

> 因为 `setup` 是围绕 `beforeCreate` 和 `created` 生命周期钩子运行的，所以不需要显式地定义它们。换句话说，在这些钩子中编写的任何代码都应该直接在 `setup` 函数中编写。——引用自官方文档

- `Vue3`新增了`renderTracked/onRenderTracked`、`renderTriggered/onRenderTriggered`生命周期 `API`
  - `renderTracked`用于告诉你哪个操作跟踪了组件以及该操作的目标对象和键。
  - `onRenderTriggered`用于告诉你是什么操作触发了重新渲染，以及该操作的目标对象和键。

```html
<div id="app">
  <button v-on:click="addToCart">Add to cart</button>
  <p>Cart({{ cart }})</p>
</div>
<script>
const app = createApp({
  data() {
    return {
      cart: 0
    }
  },
  renderTracked({ key, target, type }) {
    console.log({ key, target, type })
    /* 👉当组件第一次渲染时，这将被记录下来:
    {
      key: "cart",
      target: {
        cart: 0
      },
      type: "get"
    }
    */
  },
  renderTriggered({ key, target, type }) {
    console.log({ key, target, type })
  },
  methods: {
    addToCart() {
      this.cart += 1
      /* 👉这将导致 renderTriggered 被调用
        {
          key: "cart",
          target: {
            cart: 1
          },
          type: "set"
        }
      */
    }
  }
})

app.mount('#app')
</script>
```

- 父组件完成`mounted`阶段，并**不会**保证所有的子组件被挂载完成，如果你希望等待整个视图都渲染完毕，可以在 `mounted` 内部使用 [`vm.$nextTick`](https://v3.cn.vuejs.org/api/instance-methods.html#nexttick)
- 同样的，父组件完成`updated`阶段，也**不会**保证所有的子组件也都被重新渲染完毕。如果你希望等待整个视图都渲染完毕，可以在 `updated` 内部使用 [`vm.$nextTick`](https://v3.cn.vuejs.org/api/instance-methods.html#nexttick)。
- 这与我们[**上一篇**](https://mp.weixin.qq.com/s/SmAF9qvtAiyGRxEv5A-0CA)讲的`nextTick`原理有关，看过的小伙伴可以思考下，再看看源码，我相信你一定有收获。
- 这与组件的更新原理有关，组件的`update`函数，也是一个`effect`。这是一个`component Effect`，这将使我们接触的第三个级别的`Effect`函数，后面我们分析渲染器的时候，会进行讲解。这里先挖个坑。

![官方图片镇楼](D:\vue3深入浅出\docs\.vuepress\public\img\runtime-core\lifecycle.jpg)

## 分析

组件的生命周期钩子其实就是在组件从创建、初始化、数据响应、模板编译、模板挂载、数据更新、组件卸载前后等一系列过程中，在各阶段暴露给用户做某些操作的机会/时机。

而各关键阶段开始/结束其实就是一个负责该阶段函数执行开始/结束的过程。在`Vue`中，主要是将生命周期函数挂载在组件实例上，当需要执行当前阶段对应的生命周期时，直接从实例上获取到所有的生命周期钩子，再遍历执行。

这里我们先只分析`Vue`生命周期相关的源码，关于各个生命周期在具体的执行过程和调用过程，会在我们后续深入的过程中就会讲解到的。

下面直接看源码。

`Vue3`中各生命周期函数主要通过`createHook`函数创建。`createHook`函数是一个高阶函数。

```js
// 👉 keep-alive组件的生命周期
export { onActivated, onDeactivated } from './components/KeepAlive'

export const onBeforeMount = createHook(LifecycleHooks.BEFORE_MOUNT)
export const onMounted = createHook(LifecycleHooks.MOUNTED)
export const onBeforeUpdate = createHook(LifecycleHooks.BEFORE_UPDATE)
export const onUpdated = createHook(LifecycleHooks.UPDATED)
export const onBeforeUnmount = createHook(LifecycleHooks.BEFORE_UNMOUNT)
export const onUnmounted = createHook(LifecycleHooks.UNMOUNTED)
export const onServerPrefetch = createHook(LifecycleHooks.SERVER_PREFETCH)

export const onRenderTriggered = createHook(
  LifecycleHooks.RENDER_TRIGGERED
)
export const onRenderTracked = createHook(
  LifecycleHooks.RENDER_TRACKED
)
```

`createHook`函数代码：

```js
export const createHook = (
  lifecycle
) => (hook, target) => (!isInSSRComponentSetup || lifecycle === LifecycleHooks.SERVER_PREFETCH) && 
      injectHook(lifecycle, hook, target)
```

`createHook`函数就是一个高阶函数，用过参数type，创建不同的生命周期钩子，主要是通过返回的`injectHook`函数去接受用户创建`hook`，第二个参数`target`默认是当前组件。

`injectHook`代码：

```js
function injectHook(type, hook, target = currentInstance, prepend = false) {
      if (target) {
          // 👉获取target(实例)上的type类型的钩子函数
          // 👉可以是多个，如果是多个，则是数组类型
          const hooks = target[type] || (target[type] = []);
          // cache the error handling wrapper for injected hooks so the same hook
          // can be properly deduped by the scheduler. "__weh" stands for "with error
          // handling".
          // 👉对注册的钩子函数进行一层负责错误处理的包裹
          const wrappedHook = hook.__weh ||
              (hook.__weh = (...args) => {
                  if (target.isUnmounted) {
                      return;
                  }
                  
                  // 👉禁用所有生命周期挂钩内部的跟踪，因为它们可能被内部副作用调用。
                  // 👉比如在生命周期中进行状态的访问和修改。
                  pauseTracking();
                  // 👉在钩子调用期间设置currentInstance。
               
                  // 👉设置当前渲染实例
                  setCurrentInstance(target);
                  // callWithAsyncErrorHandling函数负责调用hook，如果执行过程出错会进行警告
                  const res = callWithAsyncErrorHandling(hook, target, type, args);
                  // 👉钩子执行结束，重置当前实例
                  setCurrentInstance(null);
                  // 👉重置Track
                  resetTracking();
                  // 👉返回结果
                  return res;
              });
          // 👉往hooks中添加包裹后的钩子函数
          // 👉注意：此次更改hooks，对应的target[type]也会发生更改。
          if (prepend) {
              hooks.unshift(wrappedHook);
          } else {
              hooks.push(wrappedHook);
          }
          // 👉返回经过包裹的钩子函数
          return wrappedHook;
      } else {
          // 👉错误处理
          const apiName = toHandlerKey(ErrorTypeStrings[type].replace(/ hook$/, ''));
          warn('省略...');
      }
  }
```

从上面代码可以知道，`injectHook`函数主要负责：

- 将用户的钩子函数进行一层包裹处理，是为了能在钩子函数执行出错的过程中进行提示
- 将包裹后的钩子函数添加到当前实例的同类型的生命周期钩子函数数组中
- 当需要执行钩子函数的时候，会从组件实例上获取对应阶段的所有钩子函数，遍历执行

## 总结

至此我们知道了生命周期钩子函数 & 生命周期组合式`API`，就是一个高阶函数返回的函数，主要是通过`createHook`先创建不同类型的`HOOK`，在调用的时候会会传入当前实例`target`，当前实例默认为当前渲染的组件。在用户调用的时候，会将用户传入的函数做一层错误包裹，主要是为了做一个异常报告处理，然后会将包裹后的`wrappedHook` 放入`hooks`数组中。当到了适当阶段，就会从实例上获取对应的生命周期钩子，然后遍历执行。

如果组件中存在子组件或者是多层组件，在父组件`mounted || updated` 结束后，并不代表子组件能`mounted || updated`结束，是因为需要等调度器中的任务执行结束之后，才能获取到最新的`DOM`。调度器执行结束返回的`Promise.resolve`也就是`nextTick`的`Promise.resolve`



