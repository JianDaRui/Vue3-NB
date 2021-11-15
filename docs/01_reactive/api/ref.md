# Ref

## 源码

```typescript
const convert = <T extends unknown>(val: T): T =>
  isObject(val) ? reactive(val) : val

class RefImpl<T> {
  private _value: T

  public readonly __v_isRef = true

  constructor(private _rawValue: T, public readonly _shallow: boolean) {
    // 将值转换为响应式
    this._value = _shallow ? _rawValue : convert(_rawValue)
  }
    
  // get时进行track
  get value() {
      
    track(toRaw(this), TrackOpTypes.GET, 'value')
      
    return this._value
  }
    
  // set时进行trigger
  set value(newVal) {
    if (hasChanged(toRaw(newVal), this._rawValue)) {
      this._rawValue = newVal
      this._value = this._shallow ? newVal : convert(newVal)
        
      trigger(toRaw(this), TriggerOpTypes.SET, 'value', newVal)
    }
  }
}

// 创建RefImpl实例的工场函数
function createRef(rawValue: unknown, shallow = false) {
  if (isRef(rawValue)) {
    return rawValue
  }
  return new RefImpl(rawValue, shallow)
}
```



## API

### ref

### shallowRef

### isRef

### toRef

### toRefs

### unref

### proxyRefs

### customRef

### triggerRef

### Ref

### ToRefs

### UnwrapRef

### ShallowUnwrapRef

### RefUnwrapBailTypes