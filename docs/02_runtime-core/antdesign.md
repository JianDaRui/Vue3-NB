useRef

```TS
import type { Ref } from 'vue';
import { ref } from 'vue';

export default function useState<T, R = Ref<T>>(
  defaultStateValue?: T | (() => T),
): [R, (val: T) => void] {
  const initValue: T =
    typeof defaultStateValue === 'function' ? (defaultStateValue as any)() : defaultStateValue;

  const innerValue = ref(initValue) as Ref<T>;

  function triggerChange(newValue: T) {
    innerValue.value = newValue;
  }

  return [innerValue as unknown as R, triggerChange];
}

```

循环组件 获取组件实例

```ts
import type { Ref, ComponentPublicInstance } from 'vue';
import { onBeforeUpdate, ref } from 'vue';
import type { Key } from '../type';

type RefType = HTMLElement | ComponentPublicInstance;
export type RefsValue = Map<Key, RefType>;
type UseRef = [(key: Key) => (el: RefType) => void, Ref<RefsValue>];
const useRefs = (): UseRef => {
  const refs = ref<RefsValue>(new Map());

  const setRef = (key: Key) => (el: RefType) => {
    refs.value.set(key, el);
  };
  onBeforeUpdate(() => {
    refs.value = new Map();
  });
  return [setRef, refs];
};

export default useRefs;

```



useMemo

```typescript
import type { Ref, WatchSource } from 'vue';
import { ref, watch } from 'vue';

export default function useMemo<T>(
  getValue: () => T,
  condition: (WatchSource<unknown> | object)[],
  shouldUpdate?: (prev: any[], next: any[]) => boolean,
) {
  const cacheRef: Ref<T> = ref(getValue() as any);
  watch(condition, (next, pre) => {
    if (shouldUpdate) {
      if (shouldUpdate(next, pre)) {
        cacheRef.value = getValue();
      }
    } else {
      cacheRef.value = getValue();
    }
  });

  return cacheRef;
}

```



节流动画

```js
import raf from './raf';

export default function throttleByAnimationFrame(fn: (...args: any[]) => void) {
  let requestId: number;

  const later = (args: any[]) => () => {
    requestId = null;
    fn(...args);
  };

  const throttled = (...args: any[]) => {
    if (requestId == null) {
      requestId = raf(later(args));
    }
  };

  (throttled as any).cancel = () => raf.cancel(requestId!);

  return throttled;
}

export function throttleByAnimationFrameDecorator() {
  // eslint-disable-next-line func-names
  return function (target: any, key: string, descriptor: any) {
    const fn = descriptor.value;
    let definingProperty = false;
    return {
      configurable: true,
      get() {
        // eslint-disable-next-line no-prototype-builtins
        if (definingProperty || this === target.prototype || this.hasOwnProperty(key)) {
          return fn;
        }

        const boundFn = throttleByAnimationFrame(fn.bind(this));
        definingProperty = true;
        Object.defineProperty(this, key, {
          value: boundFn,
          configurable: true,
          writable: true,
        });
        definingProperty = false;
        return boundFn;
      },
    };
  };
}

```
