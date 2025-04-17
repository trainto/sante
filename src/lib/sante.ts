import { useCallback, useRef, useSyncExternalStore } from 'react';
import Cache from './cache';

const createSante = <T>() => {
  const cache = new Cache<T, keyof T>();

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

  const dispatch = <K extends keyof T>(
    key: K,
    valueOrFn: T[K] | ((prev: T[K] | undefined) => T[K]),
  ) => {
    if (valueOrFn instanceof Function) {
      const prev = cache.get(key);
      const next = valueOrFn(prev);
      cache.set(key, next);
    } else {
      cache.set(key, valueOrFn);
    }
  };

  return { useSante, dispatch };
};

export { createSante };
