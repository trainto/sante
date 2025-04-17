import { useCallback, useRef, useSyncExternalStore } from 'react';
import Cache from './cache';

const createSante = <T>() => {
  const cache = new Cache<T, keyof T>();

  const useSante = <K extends keyof T>(key: K[]) => {
    const prevSnapshot = useRef<Partial<T>>({});

    const createSubscriber = useCallback((key: (keyof T)[]) => {
      return (onStoreChange: () => void) => {
        const unSubscribers = key.map((k) => cache.subscribe(k, onStoreChange));

        return () => unSubscribers.forEach((u) => u());
      };
    }, []);

    const getSnapshot = useCallback(() => {
      const current = key.reduce((acc, k) => {
        acc[k] = cache.get(k);
        return acc;
      }, {} as Partial<T>);

      for (const k in current) {
        if (current[k] !== prevSnapshot.current[k]) {
          prevSnapshot.current = current;
          return current;
        }
      }

      return prevSnapshot.current;
    }, [key]);

    const snapshot = useSyncExternalStore<Partial<T>>(
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
