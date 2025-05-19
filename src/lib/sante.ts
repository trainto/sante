import { useCallback, useRef, useSyncExternalStore } from 'react';
import Cache from './cache';
import Persistence from './persistence';

const createSante = <T extends Record<keyof T, T[keyof T]>>(
  initalState: T,
  options?: {
    persist?: { key: (keyof T)[] | 'ALL'; storage?: 'local' | 'session' };
    produce?: (s: T[keyof T], r: (r: T[keyof T]) => void | T[keyof T]) => T[keyof T];
  },
) => {
  const cache = new Cache<T>();
  for (const key in initalState) {
    cache.set(key, initalState[key]);
  }

  if (options?.persist) {
    const persistence = Persistence(options.persist.storage);
    const storedValue = persistence.loadState();
    const parsedValue = JSON.parse(storedValue);
    for (const key in parsedValue) {
      cache.set(key as keyof T, parsedValue[key]);
    }
  }

  const useSante = <K extends keyof T>(key: K[] | K) => {
    const prevSnapshot = useRef<Pick<T, K>>(null);

    const createSubscriber = useCallback((key: (keyof T)[]) => {
      return (onStoreChange: () => void) => {
        const unSubscribers = key.map((k) => cache.subscribe(k, onStoreChange));

        return () => unSubscribers.forEach((u) => u());
      };
    }, []);

    const getSnapshot = useCallback(() => {
      const current = (Array.isArray(key) ? key : [key]).reduce(
        (acc, k) => {
          if (cache.has(k) === false) {
            throw new Error(`Key "${String(k)}" not found in cache.`);
          }
          acc[k] = cache.get(k) as T[K];
          return acc;
        },
        {} as Pick<T, K>,
      );

      if (prevSnapshot.current === null) {
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
      createSubscriber(Array.isArray(key) ? key : [key]),
      getSnapshot,
      getSnapshot,
    );

    return snapshot;
  };

  const dispatch = <K extends keyof T>(key: K, valueOrFn: T[K] | ((prev: T[K]) => T[K] | void)) => {
    let newValue = valueOrFn;
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

      newValue = next as T[K];
    }

    cache.set(key, newValue as T[K]);

    if (options?.persist && (options.persist.key === 'ALL' || options.persist.key.includes(key))) {
      Persistence(options.persist.storage).saveState(key, newValue);
    }
  };

  const getCached = <K extends keyof T>(key: K) => {
    return cache.get(key);
  };

  return { useSante, dispatch, getCached };
};

export { createSante };
