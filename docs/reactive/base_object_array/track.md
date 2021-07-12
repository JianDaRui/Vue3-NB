# 如何追踪变化track

通过第一章我们基本对Proxy有所了解，Vue3中是如何进行track呢？内部是如何维持数据与依赖之间的关系的？



```javascript

function createReactiveObject(target, handlers) {
	let proxy = new Proxy(target, handlers)
	return proxy
}
const handlers = { 
	get(target, key, receiver) {
		const res = Reflect.get(target, key, receiver)
		console.log("get的时候track")
		return res;
	}
}

let target = { name: "剑大瑞" }

let proxyTarget = createReactiveObject(target, handlers)

proxyTarget.name  // "get的时候track"
 				  // "剑大瑞"
```



使用WeakMap来维持数据依赖的关系， 依赖是多个的并且是唯一的，我们可以使用Set来存储依赖，用过Map来维持对象Key与Dep的关系。



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

function effectFunc() {
    proxyTarget.name = "Jiandarui"
}
console.log(targetMap);
```

