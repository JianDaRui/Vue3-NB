# Vue3 diff算法

PatchElement === patchChildren

*processFragment* === patchChildren

大家好，我是剑大

Vue3 在处理节点的时候会对Vnode进行diff，diff的主要目的是提高节点复用率，避免频繁的创建卸载节点。

Vue3 在对子节点进行diff的之后会有两种类型判断：一个是有key 的子节点，一个是没有key的子节点。

## `Diff` 无`key`子节点

- 获取最小公共长度
- patch公共部分节点
- 如果旧节点序列的长度大于新节点队列长度，对旧节点进行卸载
- 否则挂载新的节点



## `Diff` 有`key`子节点队列

### 起始位置节点类型相同



### 结束位置节点类型相同



### 相同部分遍历结束，新队列中有新增节点，进行挂载



### 相同部分遍历结束，新队列中少节点，进行卸载



### 乱序情况



#### 为新子节点构建key:index映射



#### 从左向右遍历旧自队列，patch匹配的相同类型的节点，移除不存在的节点





#### 移动可复用节点，挂载新增节点



![](/Users/xuguorui/study/Vue3-NB/docs/assets/iamges/diff/key1.png)

![](/Users/xuguorui/study/Vue3-NB/docs/assets/iamges/diff/key2.png)

![](/Users/xuguorui/study/Vue3-NB/docs/assets/iamges/diff/key3.png)

![](/Users/xuguorui/study/Vue3-NB/docs/assets/iamges/diff/key4.png)

![](/Users/xuguorui/study/Vue3-NB/docs/assets/iamges/diff/key5.png)

![](/Users/xuguorui/study/Vue3-NB/docs/assets/iamges/diff/key6.png)

![乱序情况示例](/Users/xuguorui/study/Vue3-NB/docs/assets/iamges/diff/示例.png)

![乱序情况示例2](/Users/xuguorui/study/Vue3-NB/docs/assets/iamges/diff/示例2.png)