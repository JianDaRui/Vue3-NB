# `Object.defineProperty`与`Proxy`

## Object.defineProperty

在Vue2中，其内部是通过Object.defineProperty来实现变化侦测和依赖收集的。该方法可以直接在一个对象上定义一个新属性或者修改一个现有属性。接受三个参数，分别是targetObject、key及一个针对key的descriptorObject，返回值是传递给函数的对象。

但是Object.defineProperty存在一些问题：

- 对通过直接修改Array的length存在兼容性问题。

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

- 直接给Object添加属性或者删除属性，`Object.defineProperty`无法触发依赖。

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

- 只能对targetObject的属性进行侦测，不能针对整个targetObject进行侦测。

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

针对这三个问题，Vue2中分别采取了不同的措施:

- 针对新增和删除属性分别增加了$set、$delete.
- 针对数组变化，增加了数组拦截器。
- 针对value为对象的情况，采用递归的方式进行依赖收集。

PS：在第二章中我们会回顾这几部分。

前几年由于ES6在浏览器中的支持度并不理想。故Vue2只能使用Object.defineProperty。但是随着浏览器对ES6支持度的提升。在Vue3中则使用了Proxy。

## Proxy

下面我们可以一起Vue3中使用了Proxy的那些特性。

proxy

但是这个方法是有很多缺点的，尤大为了解决  带来的问题也做了很多工作：

- 无法检测到对象属性的新增或者删除一个属性
  - 为此增加了$delete、$set 
  - 只能劫持对象的属性，如果需要深度侦测，必须通过深度遍历

```javascript
// 对象侦测代码

```



- 无法检测会改变数组自身数据的变化（增删改）：
  - 无法侦测通过数组小标所带来的的变换
  - 无法侦测length属性所导致的变化
  - 无法侦测会改变自身的方法所带来的变化
  - 为此增加了数组拦截器

但是他也有优点，就是兼容性好一些。

```javascript
// 数组拦截器


```



随着浏览器各大厂商对ES6最新语法的支持，Vue3中作者使用了Proxy。proxy相较于Object.defineProperty更加强大：

- 可以直接监听对象而非属性
- 可以直接监听数组的变化



get()

set()

delete()



