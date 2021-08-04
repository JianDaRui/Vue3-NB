# 字典与集合

## 经过Proxy代理的Map实例

```js
let map = new Map([[1, 2], [3, 4], [5, 6]]);
let mapHandler = {
  get(target, key, receiver) {
     console.log(`get: ${key}`) // 进行 for of 遍历时需要注释掉
    if(key === "size") {
      return Reflect.get(target, "size", target)
    }
    var value = Reflect.get(target, key, receiver)
    // 查看 value 类型
    console.log(typeof value)
    return typeof value == 'function' ? value.bind(target) : value
  },
  set(target, key, value, receiver) {
    console.log(`set ${key} : ${value}`)
    return Reflect.set(target, key, value, receiver)
  }
}
let proxyMap = new Proxy(map, mapHandler);
// size 属性
console.log(proxyMap.size) 
// 输出:
// get: size  
// 3

// get 方法
console.log(proxyMap.get(1))
// 输出:
// get: get
// value: function
// 2

// set 方法
console.log(proxyMap.set('name', 'daRui')) 
// 输出:
// get: set  
// value: function  
// {1 => 2, 3 => 4, 5 => 6, "name" => "daRui"}

// has 方法
console.log(proxyMap.has('name'))
// 输出：
// get: has
// value: function
// true

// delete
console.log(proxyMap.delete(1))
// 输出:
// get: delete
// value: function
// true

// keys 方法
console.log(proxyMap.keys())
// 输出
// get: keys
// value: function
// MapIterator {3, 5, "name"}

// values 方法
console.log(proxyMap.values())
// 输出
// get: values
// value: function
// MapIterator {4, 6, "daRui"}

// entries 方法
console.log(proxyMap.entries())

// forEach
proxyMap.forEach(item => {
  console.log(item)
});
// 输出
// get: entries
// value: function
// MapIterator {3 => 4, 5 => 6, "name" => "daRui"}
// get: forEach
// value: function
// 4
// 6
// daRui

// 相当于entries()
// 需要注释 console, 否则抛出 Uncaught TypeError: Cannot convert a Symbol value to a string
for(let [key, value] of proxyMap) {
  console.log(key, value)
}
// 输出
// 3, 4
// 5, 6
// "name", "daRui"
```

## 经过Proxy代理下Set实例

```js
let set = new Set([1, 2, 3, 4, 5])
let setHandler = {
  get(target, key, value, receiver) {
    if (key === 'size') {
      return Reflect.get(target, 'size', target)
    }
    console.log(`get: ${key}`)
    var value = Reflect.get(target, key, receiver)
    console.log(`value: ${typeof value}`)
    return typeof value == 'function' ? value.bind(target) : 
  },
  set(target, key, value, receiver) {
    console.log(`set ${key} : ${value}`)
    return Reflect.set(target, key, value, receiver)
  },
}
let proxySet = new Proxy(set, setHandler)

// add
console.log(proxySet.add('name', 'daRui'))
// 输出
// get: add
// value: function 
// true
// 6

// has
console.log(proxySet.has('name'))
// 输出
// get: has
// value: function
// true
      
// size
console.log(proxySet.size)
// 输出
// get: size
// 6

// delete
console.log(proxySet.delete(1))
// 输出
// get: delete
// value: function
// true

// keys
console.log(proxySet.keys())
// 输出
// get: keys
// value: function
// SetIterator {2, 3, 4, 5, "name"}

// values
console.log(proxySet.values())
// 输出
// get: values
// value: function
// SetIterator {2, 3, 4, 5, "name"}

// entries
console.log(proxySet.entries())
// 输出
// get: entries
// value: function
// SetIterator {2 => 2, 3 => 3, 4 => 4, 5 => 5, "name" => "name"}
      
// 相当于entries
proxySet.forEach((item) => {
  console.log(item)
})
// 输出
// get: forEach
// value: function
// 2
// 3
// 4
// 5
// name

for (let value of proxySet) {
  console.log(value)
}
// 输出
// value: function
// 2
// 3
// 4
// 5
// name

// clear
console.log(proxySet.clear())
// 输出
// get: clear
// value: function
```

通过上面两段代码实例可以知道：

- 经过Proxy代理的集合，在调用属性或者方法的时候都只会触发handler中的get函数

- 通过Reflect.get获取的value，如果是属于集合的方法，需要对改变this指向

- 集合的size属性在调用是需要判断（原因我暂时不知道啊，大神可指教）

  

