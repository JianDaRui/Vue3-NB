# 依赖是谁&如何维护数据与依赖的关系
## 依赖是谁？

我们知道在Vue2中，所谓的依赖就是Watcher。在Observe遍历侦测的过程中，会为data的每一个key所对应的value维护一个Dep实例用来存储与之相关的所有Watcher。当value发生变化的时候，就会去遍历dep，通知所有相关Wacher。

在Vue3中的源码中并没有发现Watcher实例，但是新增了effect。这个Effect就相当于Vue2中的Watcher。当数据发生变化的时候，就会去遍历执行所有的effect。

在Vue3中所谓的依赖就是effect。

## 如何维护依赖与数据的关系

我们知道在Vue2中，是通过Observe、Object.defineProperty、Dep、Watcher来维持value与watcher之间的关系。

但是Vue3中没有了Observe、Object.defineProperty、Dep、Watcher。那它是如何维持value与effect之间的关系的呢？

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

- 因为key可能是Object类型，所以可以使用WeakMap来维持数据与依赖的关系，target作为key，value为相当于Dep，用来维持所有key与effect的关系。  

- 使用Map维持target.key与Dep的关系。
- 因为每一个key可能影响到多个effect，并且每次value发生变化后，所有的依赖仅需通知一次，这意味着Dep中的每个effect都是唯一的， 我们使用Set来维持每一个key对应的所有effect。


```javascript
const targetMap = new WeakMap()

function effectFunc() {
    proxyTarget.name = "Jiandarui"
}

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
       dep = new Set()
       depsMap.set(key, dep)
     }
    if(!dep.has(effectFunc)) {
       dep.add(effectFunc)
     }
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
	}
}

let target = { name: "剑大瑞" }

let proxyTarget = createReactiveObject(target, handlers)

proxyTarget.name  // "get的时候track"
 				  // "剑大瑞"
console.log(targetMap);
```

<img :src="$withBase('/img/data_effect.svg')" width="600" height="auto" style="margin: 0 auto;" alt="代理模式">

