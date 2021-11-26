# 第五篇 `Vue3 RunTimeCore`——`apiInject`源码分析

大家好，我是剑大瑞。

这边文章我们要学习`Vue`中一种跨组件通信的`API`：`provide / inject`。

本篇主要内容有`provide / inject`的使用方法，及其实现原理。

文章共计1600字，读完只需三分钟。

## 回顾

- 在`Vue`中当需要面临祖孙组件通信的问题时，我们可以使用`provide / inject API`

- `provide / inject API`必须成对使用，`provide`允许一个祖先组件向其所有子孙后代注入一个依赖

- 只要两个关系保持上下游的关系，不管层级有多深，都可以生效

- provide应该是一个对象或者一个返回对象的函数

- `inject` 选项应该是：

  - 一个字符串数组，或
  - 一个对象，对象的 `key` 是本地的绑定名，`value` 是：
    - 在可用注入内容中搜索用的 `key` (字符串或`Symbol`，或
    - 一个对象，该对象的：
      - `from` `property` 是在可用的注入内容中搜索用的 `key` (字符串或 `Symbol`)
      - `default` `property` 是降级情况下使用的` value`

  > 提示：提示：`provide` 和 `inject` 绑定并不是响应式的。这是刻意为之的。然而，如果你传入了一个响应式的对象，那么其对象的` property` 仍是响应式的。——引用官方文档

这里看下示例代码

```html
<script src="./vue.global.js"></script>
<!-- 根组件 -->
<script type="text/x-template" id="root">
	<ChildCompontent></ChildCompontent>
</script>
<script>
    // 👉这里在配置项中罗列除了多种方式，使用时只需要选择一种既可以
	Vue.createApp({
      components: {
    	ChildCompontent
  	},
  	mounted() {
    	console.log(this)
  	}
     // 👉第一种方式: 对象形式
     provide: {
         foo: 'bar',
     },
     // 👉第二种方式：函数形式
     provide() {
    	return {
      		foo: 'bar'
    	}
  	}
	}).mount('#root')
</script>
<!-- 子组件 -->
<script type="text/x-template" id="child">
	<GrandSonCompontent></GrandSonCompontent>
</script>
	const ChildCompontent = {
		name: "ChildCompontent",
		template: "#child",
		component: {
			GrandSonCompontent
		},
  		mounted() {
    		console.log(this)
  		}
	}
<script>

</script>
<!-- 孙组件 -->
<script type="text/x-template" id="grandSon">
	<template>	
    	<div>{{ foo }}</div>
    </template>
</script>
<script>
    // 👉这里在配置项中罗列除了多种方式，使用时只需要选择一种既可以
	const GrandSonCompontent = {
        name: "GrandSonCompontent",
		template: "#grandSon",
        // 可以在data中进行引用
        data() {
    		return {
      			bar: this.foo
    		}
  		},
  		mounted() {
    		console.log(this)
  		}
        // 👉第一种方式：字符串
		inject: ['foo'],
        // 👉第二种方式：设置默认值
        inject: {
    		foo: { default: 'foo' }
  		}
    	// 👉第三种方式：from表示其源property
        inject: {
    		foo: {
      			from: 'bar',
      			default: 'foo'
    		}
  		}
    	// 👉第四种方式：使用工厂函数
    	inject: {
    		foo: {
      			from: 'bar',
      			default: () => [1, 2, 3]
    		}
  		}
    }
</script>
```

上面代码非常简单，主要罗列了`provide / inject API`的几种使用方式。非常推荐大家亲自实践一下。

## 分析

`provide / inject API`的实现方式也非常简单，在上面的代码中，我们在每个组件的`mounted`阶段都做了打印，从控制台可以知道，`vue`组件在调用`provide`组件的每个子组件甚至是孙组件都设置了一个`provides`属性。里面主要存储的就是顶层组件`provide`的依赖。

在调用`inject API`的组件中其实主要是通过访问当前组件的`provides`属性，再返回当前`key`对应的`value`即可。

### `provide API`

下面我们一起分析下`provide API`的源码：

```js
// 👉广播
export function provide(key, value) {
  if (!currentInstance) {
  // 👉当前实例必须存在
    if (__DEV__) {
      warn(`provide() can only be used inside setup().`)
    }
  } else {
    // 👉获取当实例上的provides
    let provides = currentInstance.provides
    // by default an instance inherits its parent's provides object
    // but when it needs to provide values of its own, it creates its
    // own provides object using parent provides object as prototype.
    // this way in `inject` we can simply look up injections from direct
    // parent and let the prototype chain do the work.
    // 👉默认情况下，实例继承其父级的provides对象，
    // 👉但当它需要provide自己的值时，
    // 👉它会使用父级provide对象作为原型创建自己的provide对象。
    // 👉通过这种方式，在“inject”中，我们可以简单地查找来自直接父级的注入，并让原型链完成工作。
    
    // 👉获取父组件的provides
    const parentProvides =
      currentInstance.parent && currentInstance.parent.provides
    if (parentProvides === provides) {
      provides = currentInstance.provides = Object.create(parentProvides)
    }
    // 👉给provides对象赋值
    provides[key] = value
  }
}
```

从上面的代码我们可以知道`provide`主要做了一下几件事：

- 对当前实例进行判断，只有实例存在时，才能继续
- 获取当前组件的`provides`对象 & 父组件的`parentProvides`对象
- 主要是为了让`provides`对象继承`parentProvides`对象，做了一个原型继承操作
- 直接给`provides`对象赋值，这时实例上就有了相应的`key: value`

### `Inject API`

趁热打铁，分析下`inject`的源码：

```js
// 👉注入
export function inject( key, defaultValue, treatDefaultAsFactory = false ) {
  // fallback to `currentRenderingInstance` so that this can be called in
  // a functional component
    
  // 👉回退到“currentRenderingInstance”，以便可以在函数式组件中调用它
  const instance = currentInstance || currentRenderingInstance
  if (instance) {
    // #2400
    // to support `app.use` plugins,
    // fallback to appContext's `provides` if the intance is at root
      
    // 👉为了支持 `app.use` 插件，
    // 👉如果当前实例是跟组件需回退到 app 上下文问的`provides`对象
      
    // 👉instance.parent == null，说明当前实例是跟组件，
    // 👉这时provides对象是全局上下文的provides对象
    // 👉否则从当前实例的父组件上获取provides对象
    const provides =
      instance.parent == null
        ? instance.vnode.appContext && instance.vnode.appContext.provides
        : instance.parent.provides
    
    if (provides && key in provides) {
      return provides[key]
    } else if (arguments.length > 1) {
        
      // 👉defaultValue是函数的情况
      return treatDefaultAsFactory && isFunction(defaultValue)
        ? defaultValue.call(instance.proxy)
        : defaultValue
    } else if (__DEV__) {
      warn(`injection "${String(key)}" not found.`)
    }
  } else if (__DEV__) {
    warn(`inject() can only be used inside setup() or functional components.`)
  }
}
```

上面`inject API`的代码也很简单，主要以下几件事：

- 获取当前实例
- 获取当前实例父组件的provides对象，如果父组件不存在，则获取自身的`provides`对象
- 根据参数情况，返回key所对应的`value`

## 总结

没有阅读源码之前，我刚开始以为，`Vue`会在`inject`组件中，一直会向上查找，通过递归获取`provide`组件中的依赖。

阅读之后，发现我还是想的复杂了，`Vue`直接将`provide`的依赖，层层挂载在了每一个子孙组件的`provides`对象上，在`inject`组件中，直接通过获取父组件或者自身的`provides`对象上的依赖并返回即可。

参考文献：

- [`Vue官网`](https://v3.cn.vuejs.org/api/options-composition.html#provide-inject)
- [`GitHub Vue-next`](https://github.com/vuejs/vue-next)

