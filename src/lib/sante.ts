import { useCallback, useRef, useSyncExternalStore } from 'react';
import Cache from './cache';

const createSante = <T extends Record<keyof T, T[keyof T]>>(
  initalState: T,
  options?: {
    produce?: (s: T[keyof T], r: (r: T[keyof T]) => void | T[keyof T]) => T[keyof T];
  },
) => {
  const cache = new Cache<T>();
  for (const key in initalState) {
    cache.set(key, initalState[key]);
  }

  const useSante = <K extends keyof T>(key: K[]) => {
    const prevSnapshot = useRef<Pick<T, K>>(null);

    const createSubscriber = useCallback((key: (keyof T)[]) => {
      return (onStoreChange: () => void) => {
        const unSubscribers = key.map((k) => cache.subscribe(k, onStoreChange));

        return () => unSubscribers.forEach((u) => u());
      };
    }, []);

    const getSnapshot = useCallback(() => {
      const current = key.reduce(
        (acc, k) => {
          const val = cache.get(k);
          if (val != null) {
            acc[k] = val;
          }
          return acc;
        },
        {} as Pick<T, K>,
      );

      if (prevSnapshot.current == null) {
        prevSnapshot.current = current;
        return current;
      }

      for (const k in current) {
        if (current[k] !== prevSnapshot.current[k]) {
          prevSnapshot.current = current;
          return current;
        }
      }

      return prevSnapshot.current;
    }, [key]);

    const snapshot = useSyncExternalStore<Pick<T, K>>(
      createSubscriber(key),
      getSnapshot,
      getSnapshot,
    );

    return snapshot;
  };

  const dispatch = <K extends keyof T>(key: K, valueOrFn: T[K] | ((prev: T[K]) => T[K] | void)) => {
    if (valueOrFn instanceof Function) {
      if (cache.has(key) === false) {
        throw new Error(`Key "${String(key)}" not found in cache.`);
      }

      const prev = cache.get(key);

      const next = options?.produce
        ? options.produce(prev as T[K], (draft) => {
            const result = valueOrFn(draft as T[K]);
            if (result != null) {
              return result;
            }
          })
        : valueOrFn(prev as T[K]);
      cache.set(key, next as T[K]);
    } else {
      cache.set(key, valueOrFn);
    }
  };

  const getCached = <K extends keyof T>(key: K) => {
    return cache.get(key);
  };

  return { useSante, dispatch, getCached };
};

export { createSante };
