# 第六篇 `Vue3 RunTimeCore`——`defineComponent` &`defineAsyncComponent`源码分析

`XDM`好，我是剑大瑞。今天这篇文章的主要内容如题所示。

在分析源码之前，我们先回顾一下这两个`API`的使用方法。

## 回顾

### `defineComponent API`

在`Vue2`中，我们写的每一个单文件组件都是通过 `export default` 导出一个默认的配置对象：

```js
export default {
    name: "HelloWorld",
    data: () => {},
    methods: {},
    // 省略...
}
```

在`Vue3`中，提供了一个`defineComponent` 函数用于定义并导出单文件组件，使用时可以传入一个与`Vue2`定义组件相同的配置对象，或者传入一个函数：

```js
import { defineComponent } from 'vue'
// 👉传入配置对象作为参数
const MyComponent = defineComponent({
  data() {
    return { count: 1 }
  },
  methods: {
    increment() {
      this.count++
    }
  }
})
console.log(MyComponent)
// {
//    "name": "MyComponent",
//    "methods": {}
// }


// 👉一个 setup 函数，函数名称将作为组件名称来使用
import { defineComponent, ref } from 'vue'

const HelloWorld = defineComponent(function HelloWorld() {
  const count = ref(0)
  return { count }
})
console.log(HelloWorld)
// {
//     "name": "HelloWorld",
//      setup: function HelloWorld() {
// 	  	const count = ref(0)
//         return { count }
// 	 }
// }
```

从表现来看，`defineComponent` 只返回传递给它的对象或者将传递的函数处理成对象返回。这个对象最终会作为手动渲染函数的参数。

### `defineAsyncComponent API`

在`Vue2`中也有异步组件，只不过是使用`ES2015 import`异步加载模块，并返回一个`pormise`实现异步加载的效果：

```js
// 👉第一种方式：全局注册
Vue.component('async-webpack-example', function (resolve) {
  // 这个特殊的 `require` 语法将会告诉 webpack
  // 自动将你的构建代码切割成多个包，这些包
  // 会通过 Ajax 请求加载
  require(['./my-async-component'], resolve)
})
// 👉第二种方式：全局注册
Vue.component(
  'async-webpack-example',
  // 这个动态导入会返回一个 `Promise` 对象。
  () => import('./my-async-component')
)

// 👉第三种方式：局部注册
new Vue({
  // ...
  components: {
    'my-component': () => import('./my-async-component')
  }
})

// 👉第四种方式：定义一个异步工厂函数，返回一个异步组件配置对象
const AsyncComponent = () => ({
  // 需要加载的组件 (应该是一个 `Promise` 对象)
  component: import('./MyComponent.vue'),
  // 异步组件加载时使用的组件
  loading: LoadingComponent,
  // 加载失败时使用的组件
  error: ErrorComponent,
  // 展示加载时组件的延时时间。默认值是 200 (毫秒)
  delay: 200,
  // 如果提供了超时时间且组件加载也超时了，
  // 则使用加载失败时使用的组件。默认值是：`Infinity`
  timeout: 3000
})
```

- 在`Vue3`中提供了一个`defineAsyncComponent API`，可用于定义异步组件。可以创建一个只有在需要时才会进行加载的异步组件。

- 与`Vue2`中的配置方法基本相同：

```js
import { createApp, defineAsyncComponent } from 'vue'
// 👉第一种方式：全局注册
const AsyncComp = defineAsyncComponent(() =>
  import('./components/AsyncComponent.vue')
)

app.component('async-component', AsyncComp)


// 👉第二种方式：局部注册
createApp({
  // ...
  components: {
    AsyncComponent: defineAsyncComponent(() =>
      import('./components/AsyncComponent.vue')
    )
  }
})
```

- 高阶用法，可以接受一个配置对象：
  - `loader`函数 是一个异步加载组件的工厂函数
  - `loadingComponent`函数用于加载在***加载异步组件时***的组件
  - `errorComponent`函数用于加载失败时要使用的组件
  - `delay`属性用于在显示`loadingComponent`的延迟
  - `timeout`属性用于设定加载超时实践，超时则会显示错误组件
  - `suspensible`属性用于定义组件是否可挂起
  - `onError`函数，会接受`Vue`内部传出的几个参数：`error`, `retry`, `fail`, `attempts`用于发生错误时，将错误信息交给用户处理判断。

```js
import { defineAsyncComponent } from 'vue'

const AsyncComp = defineAsyncComponent({
  // 👉工厂函数，返回promise
  loader: () => import('./HelloWorld.vue'),
  // 👉加载异步组件时要使用的组件
  loadingComponent: LoadingComponent,
  // 👉加载失败时要使用的组件
  errorComponent: ErrorComponent,
  // 👉在显示 loadingComponent 之前的延迟 | 默认值：200（单位 ms）
  delay: 200,
  // 👉如果提供了 timeout ，并且加载组件的时间超过了设定值，将显示错误组件
  // 👉默认值：Infinity（即永不超时，单位 ms）
  timeout: 3000,
  // 👉定义组件是否可挂起 | 默认值：true
  suspensible: false,
  /**
   *
   * @param {*} error 错误信息对象
   * @param {*} retry 一个函数，用于指示当 promise 加载器 reject 时，加载器是否应该重试
   * @param {*} fail  一个函数，指示加载程序结束退出
   * @param {*} attempts 允许的最大重试次数
   */
  onError(error, retry, fail, attempts) {
    if (error.message.match(/fetch/) && attempts <= 3) {
      // 请求发生错误时重试，最多可尝试 3 次
      retry()
    } else {
      // 注意，retry/fail 就像 promise 的 resolve/reject 一样：
      // 必须调用其中一个才能继续错误处理。
      fail()
    }
  }
})

```

> [引用官方示例](https://v3.cn.vuejs.org/api/global-api.html#defineasynccomponent)

当我们的页面中有很多组件，但是有不必首次加载就出现的组件时，就可以使用异步组件处理，以减小当前页面的体积，提高加载速度。比如一个页面的表单、对话框、提示框等需要用户二次触发才会展示的组件。

## 分析

### `defineComponent API`

前面在回顾部分，我们已经通过console观察了`defineComponent`的返回内容，其内部实现就如其表现（表里如一）：

```js
function defineComponent(options) {
  return isFunction(options) ? { setup: options, name: options.name } : options
}
```

### `defineAsyncComponent API`

首先我们打印一下`defineAsyncComponent API`的返回值：

```js
const { defineAsyncComponent } = Vue
const AsyncComp = defineAsyncComponent(() =>import('./HelloWorld.vue'))
console.log(AsyncComp)
// {
//     name: "AsyncComponentWrapper"
// 	   setup: setup() { const instance = currentInstance; // already resolved if (resolvedComp) { return () => {…}
// 	   __asyncLoader: () => {…}
// 	   __asyncResolved: (...)
// }
```

从上面代码可以看出`defineAsyncComponent API`的返回值也是一个对象。并且这个函数有两个私有属性`__asyncLoader & __asyncResolved`。

> `defineAsyncComponent`的源码较`defineComponent`稍微困难，但是也并不复杂，下面的内容，我们先通过拆解的方式，学习一下。——分而治之，一种我非常推荐的学习方法。

接下来让我们一起看下`defineAsyncComponent`的部分源码：

- 解构`source` & 定义`load`函数
- 定义`load函数`,`load`函数的主要职责就是去加载用户传入的异步组件
  - `load`函数首先会进行异常处理，细节稍后说，这里先不聊
  - 加载成功，会`resolve`异步组件，并通过`resolvedComp`变量对组件进行引用
  - 在resolve时，会对当前状态和resolve的组件结果进行判断：
    - 如果当前没有取得异步组件，则返回null
    - 如果异步组件不是对象或者函数，会抛出警告

```js
function defineAsyncComponent(source) {
  if (isFunction(source)) {
    // 👉情况1：source 是工厂函数
    source = { loader: source }
  }
  
  // 👉解构source
  const {
    loader, // 是工厂函数
    loadingComponent, // 加载异步组件时要使用的组件
    errorComponent, // 加载失败时要使用的组件
    delay = 200, // 在显示 loadingComponent 之前的延迟 | 默认值：200（单位 ms）
    timeout, // // 如果提供了 timeout ，并且加载组件的时间超过了设定值，将显示错误组件
    suspensible = true,   // 定义组件是否可挂起 | 默认值：true
    /**
     *
     * @param {*} error 错误信息对象
     * @param {*} retry 一个函数，用于指示当 promise 加载器 reject 时，加载器是否应该重试
     * @param {*} fail  一个函数，指示加载程序结束退出
     * @param {*} attempts 允许的最大重试次数
     */
    onError: userOnError
  } = source
  
  // 👉状态一：pending状态
  let pendingRequest = null
  // 👉状态二：resolved状态
  let resolvedComp
  
  // 👉 定义负责加载组件的函数，调用load函数，就会去异步加载组件，如果成功，就会resolve异步组件，如果失败，会调用userOnError，交给用户判断
  const load = () => {
    let thisRequest
    return (
      pendingRequest ||
      (thisRequest = pendingRequest = loader() // 调用用户传入的异步工厂函数
        .catch(err => { 
          // 省略部分代码....
        })
        .then((comp) => {
          // 加载中状态
          // thisRequest默认值是 undefined，pendingRequest默认值是 null
          if (thisRequest !== pendingRequest && pendingRequest) {
            return pendingRequest
          }
          
          if (__DEV__ && !comp) {
            // 👉异步加载异常时抛出警告
            warn(
              `Async component loader resolved to undefined. ` +
                `If you are using retry(), make sure to return its return value.`
            )
          }
          
          // interop module default
          // 👉模块化相关
          if (comp &&(comp.__esModule || comp[Symbol.toStringTag] === 'Module')) {
            comp = comp.default
          }
          // 👉校验组件
          if (__DEV__ && comp && !isObject(comp) && !isFunction(comp)) {
            throw new Error(`Invalid async component load result: ${comp}`)
          }
          // 👉返回组件
          resolvedComp = comp
          return comp
        }))
    )
  }
  
  // 省略部分代码....
}
```

- 接上面没有说的异常处理：
  - `defineAsyncComponent` 允许用户配置`onError`函数，进行异步处理
  - `onError`函数会可以接受四个参数，回顾部分我们有说
  - 异常处理是在调用`loader`函数的`catch`中进行的

一起看下源码如何实现，已省略部分无关代码：

```js
function defineAsyncComponent(source) {
  // 省略部分代码....
    
  // 👉参数一：
  let retries = 0
  // 👉参数二：用于指示当 promise 加载器 reject 时，加载器是否应该重试
  const retry = () => {
    retries++
    pendingRequest = null
    return load()
  }
  
  // 👉 定义负责加载组件的函数，调用load函数，就会去异步加载组件，如果成功，就会resolve异步组件，如果失败，会调用userOnError，交给用户判断
  const load = () => {
    let thisRequest
    return (
      pendingRequest ||
      (thisRequest = pendingRequest = loader() // 调用用户传入的异步工厂函数
        .catch(err => { 
          // 👉错误信息
          err = err instanceof Error ? err : new Error(String(err))
          
          // 👉用户传入函数，用于等promise reject式，进行重新加载
          if (userOnError) {
              
            return new Promise((resolve, reject) => {
              // 👉定义重载函数 & 结束退出函数
              const userRetry = () => resolve(retry())
              const userFail = () => reject(err)
              
              // 👉用户传的 onError 函数
              // 👉err： 错误信息；userRetry：用于重新加载；userFail：指示加载程序结束退出；retries：重试的次数
              userOnError(err, userRetry, userFail, retries + 1)
            })
              
          } else {
            // 👉抛出错误
            throw err
          }
        })
        .then((comp) => {
          // 省略部分代码......
        }))
    )
  }
  
  // 省略部分代码....
}
```

可以看出在`catch`中，但`userOnError`存在时：

- 会返回一个`Promise`实例
- `Promise`实例会调用`userOnError`函数，并将当前错误信息、重载函数、退出函数、重载次数传给`userOnError`函数
- 在`load`函数外部，定义了重载次数`retries`，和负责重载的`retry`函数
- `retry`函数会对`retries`进行累加 & 重置`pendingRequest` & 执行`load`函数进行重载。

下面是最关键的部分，`defineAsyncComponent`内部其实还是通过调用`defineComponent`创建的异步组件配置对象，这个配置对象不同的是有一个私有属性`__asyncLoader` & 从新定义了配置对象的get函数。

上代码：

```js
function defineAsyncComponent(source) {

  // 省略部分代码......
 
  // 👉实际调用的还是defineComponent函数，利用闭包，返回的对象中的函数还能访问到load函数、resolvedComp变量、retry函数......
  return defineComponent({
    name: 'AsyncComponentWrapper',
    // 👉异步组件特有属性，用于判断是否是异步组件
    __asyncLoader: load,

    get __asyncResolved() {
      return resolvedComp
    },

    setup() {
      // 👉获取当前组件实例
      const instance = currentInstance!

      // already resolved
      // 👉已经加载完成，则返回用于创建异步组件的Vnode工厂函数
      if (resolvedComp) {
        return () => createInnerComp(resolvedComp!, instance)
      }
        
      // 👉定义onError函数，发生错误时的处理方式
      const onError = (err) => {
        pendingRequest = null
        handleError(
          err,
          instance,
          ErrorCodes.ASYNC_COMPONENT_LOADER,
          !errorComponent /* do not throw in dev if user provided error component */
        )
      }

      // suspense-controlled or SSR.
      // 👉 悬挂控制或者SSR
      if (
        (__FEATURE_SUSPENSE__ && suspensible && instance.suspense) ||
        (__NODE_JS__ && isInSSRComponentSetup)
      ) {
        // 👉调用load，加载异步组件
        return load()
          .then(comp => {
            return () => createInnerComp(comp, instance)
          })
          .catch(err => {
            onError(err)
            return () =>
              errorComponent
                ? createVNode(errorComponent, {
                    error
                  })
                : null
          })
      }
      
      // 👉这三个变量用于控制加载状态
      const loaded = ref(false)
      const error = ref()
      const delayed = ref(!!delay)

      if (delay) {
        // 👉处理延迟加载
        setTimeout(() => {
          delayed.value = false
        }, delay)
      }
      
      if (timeout != null) {
        // 👉处理加载超时
        setTimeout(() => {
          if (!loaded.value && !error.value) {
            const err = new Error(
              `Async component timed out after ${timeout}ms.`
            )
            onError(err)
            error.value = err
          }
        }, timeout)
      }
	  
      // 执行load函数
      load()
        .then(() => {
          // 👉加载成功，重置loaded.value 
          loaded.value = true
          if (instance.parent && isKeepAlive(instance.parent.vnode)) {
            // parent is keep-alive, force update so the loaded component's
            // name is taken into account
              
            // 👉如果父组件是keep-alive包裹的组件，强制更新父组件，
            // 👉以便将被加载的组件的名称能被记录在它的子组件列表中，
            // 👉建立父子组件依赖关系
            // 👉如果有读过第三篇的同学，应该知道发生了什么😋
            queueJob(instance.parent.update)
          }
        })
        .catch(err => {
          onError(err)
          error.value = err
        })
      
      // 👉setup 函数最终返回一个工厂函数
      // 👉这个工厂函数会根据状态返回组件的Vnode
      return () => {
        if (loaded.value && resolvedComp) {
          // 👉加载成功：返回异步组件的VNode
          return createInnerComp(resolvedComp, instance)
        } else if (error.value && errorComponent) {
          // 👉加载失败：返回失败时的组件Vnode
          return createVNode(errorComponent, {
            error: error.value
          })
        } else if (loadingComponent && !delayed.value) {
          // 👉加载中：返回加载异步组件时要使用的组件Vnode
          return createVNode(loadingComponent)
        }
      }
    }
  })
}

// 👉用于创建内部组件的 VNode
function createInnerComp(
  comp,
  { vnode: { ref, props, children } }
) {
  const vnode = createVNode(comp, props, children)
  // ensure inner component inherits the async wrapper's ref owner
  // 确保内部组件继承异步包裹自己的 ref
  // 原因：因为在我们在使用的defineAsyncComponent导出组件的时候，其实引入的是经过包裹的异步组件，
  // 但需要ref引用组件的时候，我们真是需要引入的是加载完成的组件，故需要将包裹组件的ref传给异步加载完成的组件
  vnode.ref = ref
  return vnode
}

```

调用`defineComponent API`，返回异步组件包裹组件。

- 定义存取器函数 get函数，用于获取异步组件结果
- 在`setup`函数中主要做了几件事：
  - 获取当前实例
  - 如果已经加载结束，返回一个创建异步组件`Vnode`的工厂函数
  - 定义`onError`函数，用于处理加载异常情况
  - 如果时悬挂控制或者`SSR`渲染时
    - 调用`load`函数，返回异步组件的`Vnode`
  - 定义`loaded`变量，用于记录加载状态
  - 定义`err`变量，用于记录错误异常
  - 定义`delayed`，用于判断延迟时间是否结束
  - 通过`setTimeout`，创建宏任务，来判断延迟与超时
  - 执行`load`函数，重置`loaded`状态，创建强制父组件更新任务
  - 读过[`RunTimeCore——scheduler`源码分析](https://juejin.cn/post/7033203252850245669)的同学肯定对`queueJob`不陌生
  - 最后返回一个工厂函数，这个函数会根据状态返回不同组件的`VNode`

`defineAsyncComponent API`的完整代码：

```js
function defineAsyncComponent(source) {
  if (isFunction(source)) {
    // 👉情况1：source 是工厂函数
    source = { loader: source }
  }

  const {
    loader, // 是工厂函数
    loadingComponent, // 加载异步组件时要使用的组件
    errorComponent, // 加载失败时要使用的组件
    delay = 200, // 在显示 loadingComponent 之前的延迟 | 默认值：200（单位 ms）
    timeout, // // 如果提供了 timeout ，并且加载组件的时间超过了设定值，将显示错误组件
    suspensible = true,   // 定义组件是否可挂起 | 默认值：true
    /**
     *
     * @param {*} error 错误信息对象
     * @param {*} retry 一个函数，用于指示当 promise 加载器 reject 时，加载器是否应该重试
     * @param {*} fail  一个函数，指示加载程序结束退出
     * @param {*} attempts 允许的最大重试次数
     */
    onError: userOnError
  } = source
  // 👉状态一：pending状态
  let pendingRequest = null
  // 👉状态二：resolved状态
  let resolvedComp
  
  // 👉参数一：
  let retries = 0
  // 👉参数二：用于指示当 promise 加载器 reject 时，加载器是否应该重试
  const retry = () => {
    retries++
    pendingRequest = null
    return load()
  }
  
  // 👉定义负责加载组件的函数，调用load函数，就会去异步加载组件，如果成功，就会resolve异步组件，如果失败，会调用userOnError，交给用户判断
  const load = () => {
    let thisRequest
    return (
      pendingRequest ||
      (thisRequest = pendingRequest = loader() // 调用用户传入的异步工厂函数
        .catch(err => {
          err = err instanceof Error ? err : new Error(String(err))
          
          // 用户传入函数，用于等promise reject式，进行重新加载
          if (userOnError) {
            return new Promise((resolve, reject) => {
              const userRetry = () => resolve(retry())
              const userFail = () => reject(err)
              // 👉用户传的 onError 函数
              // 👉err： 错误信息；userRetry：用于重新加载；userFail：指示加载程序结束退出；retries：重试的次数
              userOnError(err, userRetry, userFail, retries + 1)
            })
          } else {
            throw err
          }
        })
        .then((comp) => {
          if (thisRequest !== pendingRequest && pendingRequest) {
            return pendingRequest
          }
          if (__DEV__ && !comp) {
            warn(
              `Async component loader resolved to undefined. ` +
                `If you are using retry(), make sure to return its return value.`
            )
          }
          // interop module default
          // 👉模块化相关
          if (
            comp &&
            (comp.__esModule || comp[Symbol.toStringTag] === 'Module')
          ) {
            comp = comp.default
          }
          if (__DEV__ && comp && !isObject(comp) && !isFunction(comp)) {
            throw new Error(`Invalid async component load result: ${comp}`)
          }
          // 👉返回组件
          resolvedComp = comp
          return comp
        }))
    )
  }
 
  // 👉实际调用的还是defineComponent函数，利用闭包，返回的对象中的函数还能访问到load函数、resolvedComp变量、retry函数......
  return defineComponent({
    name: 'AsyncComponentWrapper',
    // 👉异步组件特有属性，用于判断是否是异步组件
    __asyncLoader: load,

    get __asyncResolved() {
      return resolvedComp
    },

    setup() {
      // 👉获取当前组件实例
      const instance = currentInstance!

      // already resolved
      // 👉已经加载完成，则返回用于创建异步组件的Vnode工厂函数
      if (resolvedComp) {
        return () => createInnerComp(resolvedComp!, instance)
      }
        
      // 👉发生错误时的处理方式
      const onError = (err) => {
        pendingRequest = null
        handleError(
          err,
          instance,
          ErrorCodes.ASYNC_COMPONENT_LOADER,
          !errorComponent /* do not throw in dev if user provided error component */
        )
      }

      // suspense-controlled or SSR.
      // 👉悬挂控制或者SSR
      if (
        (__FEATURE_SUSPENSE__ && suspensible && instance.suspense) ||
        (__NODE_JS__ && isInSSRComponentSetup)
      ) {
        // 👉调用load，加载异步组件
        return load()
          .then(comp => {
            return () => createInnerComp(comp, instance)
          })
          .catch(err => {
            onError(err)
            return () =>
              errorComponent
                ? createVNode(errorComponent, {
                    error
                  })
                : null
          })
      }
      
      // 👉这三个变量用于控制加载状态
      const loaded = ref(false)
      const error = ref()
      const delayed = ref(!!delay)

      if (delay) {
        // 👉延迟加载
        setTimeout(() => {
          delayed.value = false
        }, delay)
      }

      if (timeout != null) {
        setTimeout(() => {
          if (!loaded.value && !error.value) {
            // 👉加载超时
            const err = new Error(
              `Async component timed out after ${timeout}ms.`
            )
            onError(err)
            error.value = err
          }
        }, timeout)
      }

      load()
        .then(() => {
          // 👉加载成功，重置loaded.value 
          loaded.value = true
          if (instance.parent && isKeepAlive(instance.parent.vnode)) {
            // parent is keep-alive, force update so the loaded component's
            // name is taken into account
              
            // 👉如果父组件是keep-alive包裹的组件，强制更新父组件，
            // 👉以便将被加载的组件的名称能被记录在它的子组件列表中
            // 👉如果有读过第三篇的同学，应该知道发生了什么😋
            queueJob(instance.parent.update)
          }
        })
        .catch(err => {
          onError(err)
          error.value = err
        })
      
      // 👉setup 函数最终返回一个工厂函数，
      return () => {
        if (loaded.value && resolvedComp) {
          // 👉加载成功：返回异步组件的VNode
          return createInnerComp(resolvedComp, instance)
        } else if (error.value && errorComponent) {
            
          // 👉加载失败：返回失败时的组件Vnode
          return createVNode(errorComponent, {
            error: error.value
          })
        } else if (loadingComponent && !delayed.value) {
            
          // 👉加载中：返回加载异步组件时要使用的组件Vnode
          return createVNode(loadingComponent)
        }
      }
    }
  })
}

// 👉用于创建内部组件的 VNode
function createInnerComp(
  comp,
  { vnode: { ref, props, children } }
) {
  const vnode = createVNode(comp, props, children)
  // ensure inner component inherits the async wrapper's ref owner
  // 确保内部组件继承异步包裹自己的 ref 
  vnode.ref = ref
  return vnode
}

```

> 在此非常感谢各位的阅读，如果文章有疏漏之处，还望批评指正，大瑞不胜感激！
>
> 最后非常真诚(不要脸😂)的推荐下我的个人公众号：【coder狂想曲】。

参考资料：

- [官方文档](https://v3.cn.vuejs.org/api/global-api.html#defineasynccomponent)
- [`Vue-next`](https://github.com/vuejs/vue-next)
