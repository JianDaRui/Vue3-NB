# Vue3 diff算法

PatchElement === patchChildren

*processFragment* === patchChildren

大家好，我是剑大

Vue3 在处理节点的时候会对Vnode进行diff，diff的主要目的是提高节点复用率，避免频繁的创建卸载节点。

Vue3 在对子节点进行diff的之后会有两种类型判断：一个是有key 的子节点，一个是没有key的子节点。



## `diff` 无`key`子节点

在处理被标记为`UNKEYED_FRAGMENT`时。

- 首先会通过新旧自序列获取最小共同长度`commonLength`。

- 对公共部分循环遍历patch。
- patch 结束，再处理剩余的新旧节点。
- 如果oldLength > newLength，说明需要对旧节点进行unmount
- 否则，说明有新增节点，需要进行mount;

![无key自序列](/Users/xuguorui/study/Vue3-NB/docs/assets/iamges/diff/unkey.png)

这里贴下省略后的代码。

```javascript
const patchUnkeyedChildren = (c1, c2,...res) => {
    c1 = c1 || EMPTY_ARR
    c2 = c2 || EMPTY_ARR
    // 获取新旧子节点的长度
    const oldLength = c1.length
    const newLength = c2.length
    // 1. 取得公共长度。最小长度
    const commonLength = Math.min(oldLength, newLength)
    let i
    // 2. patch公共部分
    for (i = 0; i < commonLength; i++) { 
      patch(...)
    }
    // 3. 卸载旧节点
    if (oldLength > newLength) {
      // remove old
      unmountChildren(...)
    } else {
      // mount new
      // 4. 否则挂载新的子节点
      mountChildren(...)
    }
  }
```

从上面的代码可以看出，在处理无`key`子节点的时候，逻辑还是非常简单粗暴的。准确的说处理无`key`子节点的效率并不高。

因为不管是直接对公共部分`patch`，还是直接对新增节点进行`mountChildren`（其实是遍历子节点，进行`patch`操作），其实都是在递归进行`patch`，这就会影响到性能。

## `diff` 有`key`子节点队列

在diff有key子序列的时候，会进行细分处理。主要会经过以下一种情况的判断：

- 起始位置节点类型相同。
- 结束位置节点类型相同。
- 相同部分处理完，有新增节点。
- 相同部分处理完，有旧节点需要卸载。
- 首尾相同，但中间部分存在可复用乱序节点。

在开始阶段，会先生面三个指正，分别是:

- i = 0，指向新旧序列的开始位置
- e1 = oldLength - 1，指向旧序列的结束位置
- e2 = newLength - 1，指向新序列的结束位置

![有key子序列](/Users/xuguorui/study/Vue3-NB/docs/assets/iamges/diff/key.png)

```javascript
let i = 0
const l2 = c2.length
let e1 = c1.length - 1 // prev ending index
let e2 = l2 - 1 // next ending index
```

下面开始分情况进行diff处理。

### 起始位置节点类型相同

![起始位置相同](/Users/xuguorui/study/Vue3-NB/docs/assets/iamges/diff/key1.png)

- 对于起始位置类型相同的节点，从左向右进行diff遍历。

- 如果新旧节点类型相同，则进行patch处理
- 节点类型不同，则break，跳出遍历diff

```javascript
//  i <= 2 && i <= 3
while (i <= e1 && i <= e2) {
  const n1 = c1[i]
  const n2 = c2[i]
  if (isSameVNodeType(n1, n2)) {
    // 如果是相同的节点类型，则进行递归patch
    patch(...)
  } else {
    // 否则退出
    break
  }
  i++
}
```

上面上略了部分代码，但不影响主要逻辑。

从代码可以知道，遍历时，利用前面在函数全局上下文中声明的三个指针，进行遍历判断。

保证能充分遍历到开始位置相同的位置，`i <= e1 && i <= e2`。

一旦遇到类型不同的节点，就会跳出diff遍历。

### 结束位置节点类型相同

![结束位置相同](/Users/xuguorui/study/Vue3-NB/docs/assets/iamges/diff/key2.png)

开始位置相同`diff` 结束，会紧接着从队列尾部开始遍历 `diff`。

此时需要对尾指针e1、e2进行递减。

```javascript
//  i <= 2 && i <= 3
// 结束后： e1 = 0 e2 =  1
while (i <= e1 && i <= e2) {
  const n1 = c1[e1]
  const n2 = c2[e2]
  if (isSameVNodeType(n1, n2)) {
    // 相同的节点类型
    patch(...)
  } else {
    // 否则退出
    break
  }
  e1--
  e2--
}
```

从代码可以看出，diff逻辑与第一种基本一样，相同类型进行patch处理。

不同类型break，跳出循环遍历。

并且对尾指针进行递减操作。

### 相同部分遍历结束，新队列中有新增节点，进行挂载

经过上面两种情况的处理，已经patch完首尾相同部分的节点，接下来是对新序列中的新增节点进行patch处理。

![挂载新增节点](/Users/xuguorui/study/Vue3-NB/docs/assets/iamges/diff/key3.png)

在经过上面两种请款处理之后，如果有新增节点，可能会出现 i >  e1 && i <= e2的情况。

这种情况下意味着新的子节点队列中有新增节点。

这时会对新增节点进行patch。

```javascript
// 3. common sequence + mount
// (a b)
// (a b) c
// i = 2, e1 = 1, e2 = 2
// (a b)
// c (a b)
// i = 0, e1 = -1, e2 = 0
if (i > e1) {
  if (i <= e2) {
    const nextPos = e2 + 1
    // nextPos < l2，说明有已经patch过尾部节点，
    // 否则会获取父节点作为锚点
    const anchor = nextPos < l2 ? c2[nextPos].el : parentAnchor
    while (i <= e2) {
      patch(null, c2[i], anchor, ...others)
      i++
    }
  }
}
```

从上面的代码可以知道，patch的时候没有传第一个参数，最终会走mount的逻辑。

> 可以看这篇[主要分析patch的过程](https://mp.weixin.qq.com/s/hzpNGWFCLMC2vJNSmP2vsQ)

在patch的过程中，会递增i指针。

并通过nextPos来获取锚点。

如果nextPos < l2，则以已经patch的节点作为锚点，否则以父节点作为锚点。

### 相同部分遍历结束，新队列中少节点，进行卸载



![卸载旧节点](/Users/xuguorui/study/Vue3-NB/docs/assets/iamges/diff/key4.png)

如果处理完收尾相同的节点，出现`i > e2` && `i <= e1`的情况，则意味着有旧节点需要进行卸载操作。

```javascript
// 4. common sequence + unmount
// (a b) c
// (a b)
// i = 2, e1 = 2, e2 = 1
// a (b c)
// (b c)
// i = 0, e1 = 0, e2 = -1
// 公共序列 卸载旧的
else if (i > e2) {
  while (i <= e1) {
    unmount(c1[i], parentComponent, parentSuspense, true)
    i++
  }
}
```

通过代码可以知道，这种情况下，会递增i指针，对旧节点进行卸载。

### 乱序情况



#### 为新子节点构建key:index映射



#### 从左向右遍历旧自队列，patch匹配的相同类型的节点，移除不存在的节点





#### 移动可复用节点，挂载新增节点











![](/Users/xuguorui/study/Vue3-NB/docs/assets/iamges/diff/key5.png)

![](/Users/xuguorui/study/Vue3-NB/docs/assets/iamges/diff/key6.png)

![乱序情况示例](/Users/xuguorui/study/Vue3-NB/docs/assets/iamges/diff/示例.png)

![乱序情况示例2](/Users/xuguorui/study/Vue3-NB/docs/assets/iamges/diff/示例2.png)