# 从创建到挂载

先看个`demo`:

```html
<div id="app">
  <input :value="input" @input="update" />
  <div>{{output}}</div>
</div>

<script>
const { ref, computed, effect } = Vue
const APP = {
  setup() {
    const input = ref(0)
    const output = computed(function computedEffect() { return input.value + 5})
    
    // 会触发 computedEffect & 下面的effect重新执行
    const update = _.debounce(e => { input.value = e.target.value*1 }, 50)
    
	  effect(function callback() {
        // 依赖收集
        console.log(input.value)
    })
    return {
      input,
      output,
      update
    }
  }
}
const app = Vue.createApp(APP)
app..mount('#app')
</script>
```

上面的代码，就是一个简单创建组件的过程。

通过调用`createAPP` API创建一个`app`实例，再调用`app`实例的`mount`方法，完成组件的挂载。



下面一起看下`Vue3`内部是如何实现从create `App` 到`mount`的。

`createApp` API 源码：

```typescript
export const createApp = ((...args) => {
  // 👉调用ensureRenderer函数创建 app 实例
  const app = ensureRenderer().createApp(...args)

  if (__DEV__) {
    injectNativeTagCheck(app)
    injectCompilerOptionsCheck(app)
  }
  // 👉结构出原始的mount方法
  const { mount } = app
  // 👉重写mount函数
  app.mount = (containerOrSelector: Element | ShadowRoot | string): any => {
    // 校验containerOrSelector
    const container = normalizeContainer(containerOrSelector)
    if (!container) return
      
    // _component属性存储的是跟组件，也就是我们调用createApp时，传入的组件获取组件
    const component = app._component
    // 判断组件是否符合条件
    // 如果为component不是函数式组件并且没有render函数，
    // 没有template， 则将挂载容器的innerHTML，作为template
    if (!isFunction(component) && !component.render && !component.template) {

      component.template = container.innerHTML
      // Vue2的兼容处理
      if (__COMPAT__ && __DEV__) {
        for (let i = 0; i < container.attributes.length; i++) {
          const attr = container.attributes[i]
          if (attr.name !== 'v-cloak' && /^(v-|:|@)/.test(attr.name)) {
            compatUtils.warnDeprecation(
              DeprecationTypes.GLOBAL_MOUNT_CONTAINER,
              null
            )
            break
          }
        }
      }
    }

    // 在执行mount之前清空挂载容器container中的内容
    container.innerHTML = ''
    // 挂载 container
    // 执行mount函数，mount函数会渲染并挂载组件
    const proxy = mount(container, false, container instanceof SVGElement)
    if (container instanceof Element) {
      // 移除v-cloak指令
      container.removeAttribute('v-cloak')
      // 设置 data-v-app 指令
      container.setAttribute('data-v-app', '')
    }
    return proxy
  }
  // 返回 app 实例
  return app
}) as CreateAppFunction<Element>
```

通过上面的代码知道，当调用`createApp`创建`app`实例的时候，`createApp`通过`ensureRenderer`函数创建`app`实例，并重写实例`mount`方法，并将`app`实例返回。

>  基础薄弱的同学，可能不理解，先结构`mount`再重写`mount`的操作。这其实与JS中遍历的存储方式有关，在JS中函数其实也是对象。当重写`mount`的时候，其实是将`mount`指向了一个新的内存地址。

重写的`mount`方法主要做了几件事：

- 调用`normalizeContainer`函数，校验挂载容器或者选择器
- 获取`app`实例上的跟组件，对组件进行判断，如果不符合条件，会将容器的`innerHTML`作为`template`。
- 清空容器内的`innerHTML`
- 执行结构出来的`mount`方法，挂在组件，`mount`方法会负责渲染挂载组件

下面我们看下创建app的`ensureRenderer`函数：

```typescript
// lazy create the renderer - this makes core renderer logic tree-shakable
// in case the user only imports reactivity utilities from Vue.
// 采用惰性方式创建渲染器 - 这使得核心渲染器逻辑树可tree-shakable
// 在某些情况下，用户只会使用Vue的响应式系统
let renderer: Renderer<Element> | HydrationRenderer

function ensureRenderer() {
  return renderer || (renderer = createRenderer<Node, Element>(rendererOptions))
}

```

`Vue3`选择将渲染器做层包装的主要原因就是为了`tree-shakable`，因为用户可能仅会使用`Vue3`的响应式系统。

通过代码可以知道，内部是通过`createRenderer` API，创建的渲染器函数。

而参数`rendererOptions`是一个渲染器配置项，主要包含了：

- 对`DOM`节点的：插入、动、创建、设置属性、克隆
- 对节点属性、`class`、`style`的`patch`

```typescript
export const render = ((...args) => {
  ensureRenderer().render(...args)
}) as RootRenderFunction<Element>

```

其实`render` API也是由`ensureRenderer`创建的。



接下来我们继续深入`createRenderer` API，

`createRenderer`函数；通过调用`baseCreateRenderer`函数，创建渲染器，并且通过前面的代码，我们知道`baseCreateRenderer`函数会返回一个对象，对象上面有`createAPP`方法，`render`方法，

```js
export function createRenderer<
  HostNode = RendererNode,
  HostElement = RendererElement
>(options: RendererOptions<HostNode, HostElement>) {
  return baseCreateRenderer<HostNode, HostElement>(options)
}
```

下面看下缩略版的`baseCreateRenderer`函数，这里我们直接看返回结果。

`baseCreateRenderer`函数：

```typescript
function baseCreateRenderer(
  options: RendererOptions,
  createHydrationFns?: typeof createHydrationFunctions
) {
    /**
     * 省略部分代码...
     */
    const render: RootRenderFunction = (vnode, container, isSVG) => {
        if (vnode == null) {
      		if (container._vnode) {
        		unmount(container._vnode, null, null, true)
      		}
    	} else {
      		patch(container._vnode || null, vnode, container, null, null, null, isSVG)
   		 }
    	flushPostFlushCbs()
    	container._vnode = vnode
  	}

    return {
      render,
      hydrate, // 服务端渲染相关
      createApp: createAppAPI(render, hydrate)
    }
}
```

从`return`的对象，可以知道，我们的`render` API 其实就是上面的这个`render`函数，`createAPP`，又包了一层，通过`createAppAPI`函数创建。

通过`ensureRenderer`我们可以知道，`createAppAPI`函数返回的是一个函数，而正这个函数创建的`app`实例。接下来进入关键部分。一起分析下`createAppAPI`函数。

> 其实我本来计划直接从`baseCreateRenderer`函数分析的，但是发现这么分析，可能大家并不会理解整个过程。所以有了这篇，这篇相当于一个铺垫，会引入`baseCreateRenderer`的分析。`baseCreateRenderer`函数包含的信息实在是太多了~~~



createAppAPI函数：

```typescript
export function createAppAPI<HostElement>(
  render: RootRenderFunction,
  hydrate?: RootHydrateFunction
): CreateAppFunction<HostElement> {

  // createApp API
  return function createApp(rootComponent, rootProps = null) {
    if (rootProps != null && !isObject(rootProps)) {
      __DEV__ && warn(`root props passed to app.mount() must be an object.`)
      rootProps = null
    }
    
    // 创建App执行上下文，其实就是一个JS对象
    const context = createAppContext()
    // 插件集合
    const installedPlugins = new Set()

    let isMounted = false
    
    // app 上下文实例
    const app: App = (context.app = {
      _uid: uid++,
      _component: rootComponent as ConcreteComponent,
      _props: rootProps,
      _container: null,
      _context: context,
      _instance: null,

      version,
      
      get config() {
        return context.config
      },

      set config(v) {
        if (__DEV__) {
          warn(
            `app.config cannot be replaced. Modify individual options instead.`
          )
        }
      },
      
      // 配置插件的方法
      // 在配置的时候会判断是否重复，如果已经存在，会给出提示
      // 我们的插件可以是一个函数或者一个有install方法的类实例
      // 如果是install类型，会传入app实例和options
      // 如果是函数，这传入app实例，和options配置项
      use(plugin: Plugin, ...options: any[]) {
        if (installedPlugins.has(plugin)) {
          __DEV__ && warn(`Plugin has already been applied to target app.`)
        } else if (plugin && isFunction(plugin.install)) {
          installedPlugins.add(plugin)
          plugin.install(app, ...options)
        } else if (isFunction(plugin)) {
          installedPlugins.add(plugin)
          plugin(app, ...options)
        } else if (__DEV__) {
          warn(
            `A plugin must either be a function or an object with an "install" ` +
              `function.`
          )
        }
        return app
      },
      // 混入
      mixin(mixin: ComponentOptions) {
        if (__FEATURE_OPTIONS_API__) {
          if (!context.mixins.includes(mixin)) {
            context.mixins.push(mixin)
          } else if (__DEV__) {
            warn(
              'Mixin has already been applied to target app' +
                (mixin.name ? `: ${mixin.name}` : '')
            )
          }
        } else if (__DEV__) {
          warn('Mixins are only available in builds supporting Options API')
        }
        return app
      },
      
      // 配置全局组件
      component(name: string, component?: Component): any {
        if (__DEV__) {
          validateComponentName(name, context.config)
        }
        if (!component) {
          return context.components[name]
        }
        if (__DEV__ && context.components[name]) {
          warn(`Component "${name}" has already been registered in target app.`)
        }
        context.components[name] = component
        return app
      },
      // 配置全局指令
      directive(name: string, directive?: Directive) {
        if (__DEV__) {
          validateDirectiveName(name)
        }

        if (!directive) {
          return context.directives[name] as any
        }
        if (__DEV__ && context.directives[name]) {
          warn(`Directive "${name}" has already been registered in target app.`)
        }
        context.directives[name] = directive
        return app
      },

      // 挂载方法
      mount(
        rootContainer: HostElement,
        isHydrate?: boolean,
        isSVG?: boolean
      ): any {
        if (!isMounted) {
          // 创建Vnode
          const vnode = createVNode(
            rootComponent as ConcreteComponent,
            rootProps
          )
          // store app context on the root VNode.
          // this will be set on the root instance on initial mount.
          vnode.appContext = context

          // HMR root reload
          if (__DEV__) {
            context.reload = () => {
              render(cloneVNode(vnode), rootContainer, isSVG)
            }
          }

          if (isHydrate && hydrate) {
            hydrate(vnode as VNode<Node, Element>, rootContainer as any)
          } else {
            // 渲染vnode
            render(vnode, rootContainer, isSVG)
          }
          // 完成mounted
          isMounted = true
          app._container = rootContainer
          // for devtools and telemetry
          ;(rootContainer as any).__vue_app__ = app

          if (__DEV__ || __FEATURE_PROD_DEVTOOLS__) {
            app._instance = vnode.component
            devtoolsInitApp(app, version)
          }
          // 返回组件Proxy
          return vnode.component!.proxy
        } else if (__DEV__) {
          warn(
            `App has already been mounted.\n` +
              `If you want to remount the same app, move your app creation logic ` +
              `into a factory function and create fresh app instances for each ` +
              `mount - e.g. \`const createMyApp = () => createApp(App)\``
          )
        }
      },
      // 卸载组件
      unmount() {
        if (isMounted) {
          // 卸载时， Vnode === null
          render(null, app._container)
          if (__DEV__ || __FEATURE_PROD_DEVTOOLS__) {
            app._instance = null
            devtoolsUnmountApp(app)
          }
          delete app._container.__vue_app__
        } else if (__DEV__) {
          warn(`Cannot unmount an app that is not mounted.`)
        }
      },
      // 派发数据其实就是往上下文的provides属性上配置value
      provide(key, value) {
        if (__DEV__ && (key as string | symbol) in context.provides) {
          warn(
            `App already provides property with key "${String(key)}". ` +
              `It will be overwritten with the new value.`
          )
        }
        // TypeScript doesn't allow symbols as index type
        // https://github.com/Microsoft/TypeScript/issues/24587
        context.provides[key as string] = value

        return app
      }
    })
    // 兼容处理
    if (__COMPAT__) {
      installAppCompatProperties(app, context, render)
    }

    return app
  }
}
```

> `app`对象中配置了`use`、`mixin`、`component`、`directive`、`mount`、`unmount`、`provide`函数，并且这些函数最终都会返回`app`对象，所以我们可以实现链式调用：
>
> `app.use().component().mixin().mount()`

通过上面的代码，可以知道，`createAPP`函数，最终返回的是一个`app`配置对象。而在`createAPP` API中，从`app`中结构出来的`mount`方法，就是上面的`mount`，`mount`方法会调用`createVnode`方法创建`Vnode`，调用`baseCreateRenderer`函数中的`render`方法，去完成`Vnode`的渲染工作。

当我们在代码中执行`app.mount('#app')`的时候，就会完成`Vnode`的创建渲染工作。



> `createVnode`函数返回的`Vnode`其实就是一个`Vnode`的`JS`描述对象，我们在https://juejin.cn/post/7042480099299426341中分析过。

`createAppContext`函数，实例上下文对象：

```typescript
export function createAppContext(): AppContext {
  return {
    app: null as any,
    config: {
      isNativeTag: NO,
      performance: false,
      globalProperties: {},
      optionMergeStrategies: {},
      errorHandler: undefined,
      warnHandler: undefined,
      compilerOptions: {}
    },
    mixins: [],
    components: {},
    directives: {},
    provides: Object.create(null),
    optionsCache: new WeakMap(),
    propsCache: new WeakMap(),
    emitsCache: new WeakMap()
  }
}
```

## 总结

在分析这里的整个链路的过程中，我也很疑惑，尤大为什么要把链路整这么深？从`createApp`到`createApp`，中间间隔了四五层函数。

当我看了`baseCreateRenderer`函数的部分源码后才有所体会，主要是代码职责的拆分。让`baseCreateRenderer`主要复制`Vnode`的`patch`、渲染工作，`createApp`去负责创建实例。

在`createApp`函数中利用闭包去访问`baseCreateRenderer`中定义的所有方法。



这篇结束，下来就是`baseCreateRenderer`的学习分析，这篇可是能填好多坑啊。