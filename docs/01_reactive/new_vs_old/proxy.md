# `Object.defineProperty`与`Proxy`

## `Object.defineProperty`

在`Vue2`中，其内部是通过`Object.defineProperty`来实现变化侦测和依赖收集的。该方法可以直接在一个对象上定义一个新属性或者修改一个现有属性。接受三个参数，分别是`targetObject`、`key`及一个针对key的`descriptorObject`，返回值是传递给函数的对象。

但是`Object.defineProperty`存在一些问题：

- 直接修改`Array`的`length`属性存在兼容性问题。

```js
let demoArray = [1,2,3]
Object.defineProperty(demoArray, 'length', { 
    set: function() { 
        console.log('length changed!')
    } 
})
// Uncaught TypeError: Cannot redefine property: length
// at Function.defineProperty (<anonymous>)
// at <anonymous>:2:8
```

- 直接给`Object`添加属性或者删除属性，`Object.defineProperty`无法触发依赖。

```javascript
let obj = { name: "jiandarui", age: 18 };
obj = Object.defineProperty(obj, 'age', {
  	configurable: true,
    get: function() {
        console.log("get value")
    },
    set: function(value) { 
        console.log('set value')
    } 
})
obj.gender = "man"; // 没有触发 Getter
delete obj.age // 没有触发 Setter
```

- 只能对`targetObject`的属性进行侦测，不能针对整个`targetObject`进行侦测。

```js
function defineReactive(data, key, val) {
	Object.defineProperty(data, key, {
        configurable: true,
        enumerable: true,
        get: function() {
            // 在这里做依赖收集
            console.log("依赖收集")
            return val;
        }，
        set: function(newVal) {
        	if(val === newVal) {
                return val;
            }
        	// 在这里做变化侦测
        	console.log("变化侦测")
       		val = newVal;
    	}
    })
}
```

针对这三个问题，`Vue2`中分别采取了不同的措施:

- 针对数组变化，增加了数组拦截器。
- 针对新增和删除对象属性分别增加了`$set`、`$delete`。
- 针对`value`为对象的情况，采用递归的方式进行依赖收集。

PS：在第二章中我们会回顾这几部分。

前几年由于`ES6`在浏览器中的支持度并不理想。故`Vue2`只能使用`Object.defineProperty`。但是随着浏览器对`ES6`支持度的提升。在`Vue3`中则使用了`Proxy`。

## `Proxy`

proxy相对于`Object.defineProperty`可以直接对整个`targetObject`进行拦截，他接受两个参数，分别是target、handler，并返回一个代理对象，handler可配置的方法有**13**种，包括属性查找、赋值、枚举、函数调用、原型、属性描述相关的方法。

```javascript
let obj = { name: "罗翔"}
cosnt handler = {
    get: function(target, key, receiver) {
        console.log("get")
    },
    set: function(target, key, value, receiver) {
        console.log("set")
        return Reflect.set(target, key, value, receiver)
    }
}
let proxy = new Proxy(obj, handler);
proxy.name 
proxy.name = "张三";

```



> 这里说到Proxy，就不得不提一下它的好基友：Reflect。Reflect上的方法基本与Object相同，[但又纯在细微的差别](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Reflect/Comparing_Reflect_and_Object_methods)。
>
> Reflect上的方法与Proxy方法命名相同。可以对target进行映射。`Object.defineProperty(obj, name, desc)`在无法定义属性时，会抛出一个错误，或者修改后原属性被覆盖的情况。Reflect则对这些问题进行了优化。
>
> 当需要调用Object上的方法时，我们可以直接调用Reflect。Reflect相当于直接对Javascript的操作做了一层拦截。

这里我们可以一起学习下`Vue3`中使用了Proxy的哪些特性。

### 针对普通`Object`类型

#### `get()`

- 用于拦截对象属性的读取
- 接受三个参数target(原对象)、key（要读取的属性）、receiver（Proxy对象实例或者继承Proxy的对象）
- 返回值可自定义
- 可继承

```javascript
let p = new Proxy({ name: "罗翔" }, {
  get: function(target, key, receiver) {
    console.log("called: " + key);
    return Reflect.get(target, key, receiver);
  }
});

console.log(p.a); // "called: a"
```

#### `set()`

- 用于设置对象属性的值
- 接受四个参数target、key、newValue（新设置的值）、receiver
- 返回true，严格模式返回false会报TypeError异常

```javascript
let p = new Proxy({ name: "罗翔", profession: "司机" }, {
  set: function(target, key, value, receiver) {
    console.log("called: " + key+ ": " + value);
    return Reflect.set(target, key, value, receiver);
  }
});
p.profession = "律师"
```

#### `deleteProperty()`

- 用于拦截对对象属性的delete操作（弥补了Object.definedProperty属性对delete操作无感的问题）。
- 接受参数：target、key
- 返回布尔值： true成功，false失败

```javascript
var p = new Proxy({}, {
  deleteProperty: function(target, prop) {
    console.log('called: ' + prop);
    return true;
  }
});

delete p.a; // "called: a"
```

#### `has()`

- 用于拦截in操作
- 接受参数target、key
- 返回布尔值，true存在，false不存在
- 拦截只对`in`运算符生效，对`for...in`循环不生效

```javascript
// ECMAScript 6入门
let stu1 = {name: '张三', score: 59};
let stu2 = {name: '李四', score: 99};

let handler = {
  has(target, prop) {
    if (prop === 'score' && target[prop] < 60) {
      console.log(`${target.name} 不及格`);
      return false;
    }
    return prop in target;
  }
}

let oproxy1 = new Proxy(stu1, handler);
let oproxy2 = new Proxy(stu2, handler);

'score' in oproxy1
// 张三 不及格
// false

'score' in oproxy2
// true

for (let a in oproxy1) {
  console.log(oproxy1[a]);
}
// 张三
// 59

for (let b in oproxy2) {
  console.log(oproxy2[b]);
}
```

#### `ownKeys()`

- 用于拦截对象资深属性的读取操作，可以拦截的操作
  - [`Object.getOwnPropertyNames()`](https://developer.mozilla.org/zh-CN/docs/Web/JavaScript/Reference/Global_Objects/Object/getOwnPropertyNames)
  - [`Object.getOwnPropertySymbols()`](https://developer.mozilla.org/zh-CN/docs/Web/JavaScript/Reference/Global_Objects/Object/getOwnPropertySymbols)
  - [`Object.keys()`](https://developer.mozilla.org/zh-CN/docs/Web/JavaScript/Reference/Global_Objects/Object/keys)
  - [`Reflect.ownKeys()`](https://developer.mozilla.org/zh-CN/docs/Web/JavaScript/Reference/Global_Objects/Reflect/ownKeys)
  - `for...in`循环
- 参数target
- 返回结果必须为一个数组

```javascript
let p = new Proxy({}, {
  ownKeys: function(target) {
    console.log('called');
    return ['a', 'b', 'c'];
  }
});

console.log(Object.getOwnPropertyNames(p)); // "called"
```

### 针对`Map`、`Set`类型

​		在Vue2并不支持Map、Set、WeakMap、WeakSet类型。这次Vue3做到了。Vue3中针对通过Proxy创建Map、Set类型代理方法的handler参数做了一些特殊的处理，先挖一个坑，在后面的章节我们会详细讲解一下。这里我们先回顾下Map、Set类型的方法。[传送门](https://es6.ruanyifeng.com/#docs/set-map)

#### Set

- 类似数组，成员唯一，没有重复的值

##### 实例属性：

- size：返回Set实例成员总数

```js
let set = new Set([1,2,3])
set.size // 3
```

##### 实例方法

- add(value)：给实例添加某个值，返回Set结构本身

- has()：返回一个boolean值，表示该值是否为Set实例成员

- delete(value)：删除某个值

- clear()：清楚所有成员，没有返回值

```js
// add
set.add('a').add('b')

// has
set.has(1)

// delete
set.size // 5
set.delete('b')
set.size // 4

// clear
set.size // 4
set.clear()
set.size // 0
```

##### 遍历操作

- keys()：返回键名的遍历器

- values()：返回键值的遍历器
- entries()：返回键值对的遍历器
- forEach()：使用回调函数遍历每个成员，类似于Array.prototype.forEach()，本质是一个遍历器模式

```js
// keys
let set = new Set(['a', 'b', 'c']);
console.log([...set.keys()]) // ['a', 'b', 'c']

// values
console.log([...set.values()]) // ['a', 'b', 'c']
// entries
console.log([...set.entries()]) // [['a', 'a'], ['b', 'b'], ['c', 'c']]
// forEach
set.forEach(value => console.log(value))
```

#### WeakSet

##### 特点

- 成员只能是对象
- 对成员保持的都是弱引用
- 因为弱引用的关系，成员随时可能被垃圾回收机制回收，故不可遍历

##### 实例方法

- add(value)：向 WeakSet 实例添加一个新成员。
- has(value)：返回一个布尔值，表示某个值是否在.
- delete(value)：清除 WeakSet 实例的指定成员。

```js
let a = [1, 'a'], b = [2, 'b'], c = [3, 'c'];
let weak_set = new WeakSet();
// add 
weak_set.add(a)
weak_set.add(b)

// has
weak_set.has(c) // false

// delete
weak_set.delete(b)
weak_set.has(b) // false
```

#### Map

##### 特点

- 类似于字典，本质是键值对的集合
- 相较于Object将key转为字符串，Map不会对添加成员的key进行转换
- key唯一

##### 实例属性

- size：返回实例成总数量
- set(key, value)：为实例添加成员
- get(key)：返回key对应的value，没有对应的key，则返回undefined
- has(key)：返回一个boolean值，表示key是否在当前Map实例中
- delete(key)：删除Map实例的某个键，返回true，如果删除失败，返回false
- clear()：清除Map实例所有成员，没有返回值。

```js
const map = new Map();
// size 
map.size // 0

// set
map.set('a', true);
map.set('b', false);
map.size // 2

// get
let obj = {name: "jiandarui" }
map.get(obj) // undefined
map.set(obj, { age: 18 })

// has
map.has(obj) // true

// delete
map.delete(obj) 
map.has(obj) // false

// clear
map.clear()
map.size // 0
```

##### 遍历方法

- keys()：返回实例键名的遍历器。
- values()：返回实例键值的遍历器。
- entries()：返回实例所有成员的遍历器。
- forEach()：与Set.prototype.forEach()相似，遍历 Map 的所有成员。

```js
const map = new Map([
  ['name', 'JDR'],
  ['age',  18],
]);
// keys
console.log([...map.keys()]); // ['name', 'age']

// values
console.log([...map.values()]); // ['JDR', 18]

// entries
console.log([...map.entries()]); // [['name', 'JDR'], ['age',  18]]

// forEach
map.forEach(function(value, key, map) {
  console.log("Key: %s, Value: %s", key, value);
});
```

#### WeakMap

##### 特点

- 类似于Map，键名只接受对象类型（null除外）
- 对键名保持弱引用
- 不可遍历

##### 方法

- set(key, value)：给实例添加成员
- get(key)：获取实例key对应的value
- has(key)：判断实例是否有成员key
- delete(key)：删除实例对应的key

```javascript
const weak_map = new WeakMap();
const key = {name: 'JDR'};

// set
weak_map.set(key, 1);

//get
weak_map.get(key) // 1

// has
weak_map.has(key) // true

// delete
weak_map.delete(key) // true
```



