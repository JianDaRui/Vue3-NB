# 依赖是谁&如何维护数据与依赖的关系
## 依赖是谁？

在Vue2中，所谓的依赖就是Watcher。在Observe遍历侦测的过程中，会为data的每一个key所对应的value维护一个Dep实例用来存储与之相关的所有Watcher。当value发生变化的时候，就会去遍历dep，通知所有相关Wacher。

在每一个Watcher在实例化的过程中都会为其创建一个deps属性，这个watcher.deps内存储的是与当前watcher相关的所有Dep实例，由此可以知道deps与watcher其实一种多对多的关系。而不是简单的观察者模式中所谓的一对多的关系。

为了保证每个watcher的唯一性，会为这个watcher创建一个唯一的id。以避免在notify时，重复调用相同的watcher.update

在Vue3中的源码中并没有发现Watcher实例，但是新增了effect。effect与watcher的结构非常相似，它就是Vue3中的依赖。也就是Vue3中新增的概念：**副作用**。

下面我们先贴一下watcher和effect简版代码，可以大概看一下。相较于watcher，effect更加的简洁，轻巧。

```javascript
// Vue2
export default class Watcher {
  vm;
  expression;
  cb;
  id;
  deep;
  user;
  lazy;
  sync;
  dirty;
  active;
  deps;
  newDeps;
  depIds;
  newDepIds;
  before;
  getter;
  value;

  constructor (vm,expOrFn,cb,options,isRenderWatcher) {
    this.vm = vm
    if (isRenderWatcher) {
      vm._watcher = this
    }
    vm._watchers.push(this)
    // options
    if (options) {
      this.deep = !!options.deep
      this.user = !!options.user
      this.lazy = !!options.lazy
      this.sync = !!options.sync
      this.before = options.before
    } else {
      this.deep = this.user = this.lazy = this.sync = false
    }
    this.cb = cb
    this.id = ++uid // uid for batching
    this.active = true
    this.dirty = this.lazy // for lazy watchers
    this.deps = []
    this.newDeps = []
    this.depIds = new Set()
    this.newDepIds = new Set()
    this.expression = process.env.NODE_ENV !== 'production'
      ? expOrFn.toString()
      : ''
    if (typeof expOrFn === 'function') {
    } else {
    }
    this.value = this.lazy
      ? undefined
      : this.get()
  }

  get () {}

  addDep (dep: Dep) {}

  cleanupDeps () {}

  update () {}

  run () {}

  evaluate () {}

  depend () {}

  teardown () {}
}

// Vue3
function createReactiveEffect(fn, options) {
  const effect = function reactiveEffect() {
    // 暂时省略...
  }
  effect.id = uid++
  effect.allowRecurse = !!options.allowRecurse
  effect._isEffect = true
  effect.active = true
  effect.raw = fn // 用来保存原函数
  effect.deps = []
  effect.options = options
  return effect
}
```

effect正是通过createReactiveEffect函数创建的，重点在于`effect.deps = []`，它与watcher.deps相同，负责维护与当前effect相关的所有dep。



```javascript
function createReactiveEffect(fn, options) {
  const effect = function reactiveEffect() {
    if(!effect.active) {
		return fn()
    }
  }
  effect.id = uid++
  effect._isEffect = true
  effect.active = true
  effect.raw = fn
  effect.deps = []
  effect.options = options
  return effect
}
function effect(fn, options) {
	const effect = createReactiveEffect(fn, options)
    
    return effect;
}
```

## 如何维护依赖与数据的关系

在Vue2中，是通过Observe、Dep、Watcher来维持value与watcher之间的关系。

但是Vue3中没有了上面的几个类。那它是如何维持value与effect之间的关系的呢？

我们看一段伪代码：

```javascript
import { reactive } from "vue"
let count = reactive(0)
let obj = reactive({
  name: "剑大瑞"，
  age: 18,
  beGoogAt: "createBug"
})
setTimeout(() => {
    ++count;
    obj.name = "jiandarui"
})
```

上面的代码主要是想说明，track的数据类型有可能是原始类型有可能是对象对象，track中如何维护data与effect之间的关系呢？

这里就要想到我们先前铺垫的Map、WeakMap、Set、WeakSet了。

>  在Javascript中如果使用对象类型作为数据的obj的key，会发生隐式转换，最终所有的key会转为 [object Object]

- 使用WeakMap来维持数据与依赖的关系，target作为key，value我们可以思考下：
  - 因为target中的单个value的变化就有可能导致我们写的组件、watcher或者computed发生变化，这些都是effect实现的。
  - 所以这里的data与effect的颗粒度要控制在单个 `value: effects`上。
  - 而我们的value的数据类型也可能是原始类型或者对象类型。
- 使用Map维持target.key与effect的关系。
  - 而effect可以是多个
  - 且每个effect是唯一的
- 使用Set作为Dep，来维持每一个key对应的所有effect。

搞清楚如何处理data与effect的关系后，我们可以一起简单实现下：


```javascript
const targetMap = new WeakMap()

function track(target, key) {
    // 首先尝试获取target对应的所有依赖
	let depsMap = targetMap.get(target)
    if(!depsMap) {
        // 如果没有，则创建
        depsMap = new Map()
        targetMap.set(target, depsMap)
     }
     // 获取target[key]对应的所有依赖
    let dep = depsMap.get(key)
    if(!dep) {
       // 如果没有，则创建
       dep = new Set()
       depsMap.set(key, dep)
     }
    
    if(!dep.has(activeEffect)) {
       // 添加effect
       dep.add(activeEffect)
       // 添加dep至相关的effect
       activeEffect.deps.push(dep)
     }
}

function trigger(target, key, newValue, oldValue) {
    console.log("trigger")
}

function createReactiveObject(target, handlers) {
	let proxy = new Proxy(target, handlers)
	return proxy
}

const handlers = { 
	get(target, key, receiver) {
		const res = Reflect.get(target, key, receiver)
		track(target, key);
		return res;
	},
    set(target, key, newValue, receiver) {
        const res = Reflect.set(target, key, newValue, receiver);
        trigger(target, key, newValue)
        return res
	}
}

let target = { name: "剑大瑞" }

function activeEffect() {
    console.log("DOM更新")
}
activeEffect.deps = [];

let proxyTarget = createReactiveObject(target, handlers)

proxyTarget.name  
proxyTarget.name = "Jiandarui"
```

<img :src="$withBase('/img/data_effect.svg')" width="600" height="auto" style="margin: 0 auto;" alt="effect">

通过上面的代码 & 结构图，我们基本将data与effect的关系梳理清楚了。不要忘记的是每一个effect都有一个deps属性，用于存储与之相关的所有dep。

## 触发所有依赖

但data发生变化的时候，会触发trigger，这里我们给trigger函数传入target、key、newValue作为参数。

如果key对应的value发生变化，这需要通过target、key获取到所有的effect，并执行。

```javascript
function trigger(target, key, newValue) {
	const depsMap = targetMap.get(target)
    if(!depsMap) {
        // 说明还没有进行过track
        return 
    }
    const effects = new Set();
    const add = effectsToAdd => {
        if(effectsToAdd) {
            effectsToAdd.forEach(effect => {
				if(effect !== activeEffect) {
               		effects.add(effect)
                }
            })
        }
    }
    
    const effectsToAdd = depsMap.get(key)
    add(effectsToAdd);
    
    const run = effect => {
        effect()
    }
    
    // 遍历执行所有的effect;
    effects.forEach(run);
}
```

