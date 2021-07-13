# 如何Track&Trigger

## 如何进行Track

通过第一章我们基本对Proxy有所了解，那么Vue3中是如何进行track呢？内部是如何维持数据与依赖之间的关系的？这次让我们带着问题思考一下。

target通过proxy代理后，产生一个proxy实例，这个实例用于与target相同的接口，当我们通过proxy读取数据时，会触发Getter函数，当设置新的值时，会触发Setter函数。故可以通过Getter函数进行Track。

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
	},
    set(target, key, value, receiver) {
        console.log("set函数")
        Reflect.set(target, key, value, receiver);
	}
}

let target = { name: "剑大瑞" }

let proxyTarget = createReactiveObject(target, handlers)

proxyTarget.name  // "get的时候track"
 				  // "剑大瑞"
```

这里通过createReactiveObject对proxy进行封装，对target、handler对象进行分离，方便后续进行一些较为复杂的扩展操作。

## 如何进行Trigger

当进行 proxy.key = newValue 时，会触发Setter函数，这里我们可以做一些依赖的派发工作，比如DOM的更新。

```html	
<template>
	<div>
    	{{proxy.name}}
	</div>
</template>
```

模板中name是通过Proxy代理产生的，当proxy.name赋新值时，会触发Setter，这时需要动态的去更新DOM，故在Setter中可以做一些依赖的触发操作。

```javascript
function track(target, key) {
   // 负责进行track
    console.log("track")
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

let proxyTarget = createReactiveObject(target, handlers)

proxyTarget.name  // "track"
proxyTarget.name = "Jiandarui" // "trigger"
```



