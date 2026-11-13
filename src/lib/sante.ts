import { useCallback, useMemo, useRef, useSyncExternalStore } from 'react';
import Cache, { normalizeKey } from './cache.js';
import Persistence, { type PersistenceOptions } from './persistence.js';

type Produce<T> = (
  state: T[keyof T],
  recipe: (draft: T[keyof T]) => T[keyof T] | void,
) => T[keyof T];

export type SanteOptions<T> = {
  persist?: PersistenceOptions<T> & { key: readonly Extract<keyof T, string | number>[] | 'ALL' };
  produce?: Produce<T>;
};

type StatePatch<T, P> = P & { [K in keyof P]: K extends keyof T ? T[K] : never };

export type SanteStore<T, WithProduce extends boolean = false> = {
  useSante: {
    <K extends keyof T, R>(key: K, selector: (value: NoInfer<T[K]>) => R): R;
    // Keep the legacy signature last for Parameters/ReturnType consumers.
    <K extends keyof T>(key: K | readonly K[]): Pick<T, K>;
  };
  dispatch: {
    <K extends keyof T>(
      key: K,
      updater: (prev: T[K]) => NoInfer<WithProduce extends true ? T[K] | void : T[K]>,
    ): void;
    <K extends keyof T, V extends NoInfer<T[K]>>(
      key: K,
      value: V extends (...args: never[]) => unknown ? never : V,
    ): void;
  };
  dispatchMany: {
    <P extends Partial<T>>(updater: (prev: Readonly<T>) => StatePatch<T, P>): void;
    <P extends Partial<T>>(patch: StatePatch<T, P>): void;
  };
  getCached: <K extends keyof T>(key: K) => T[K] | undefined;
};

function snapshotReader<T, K extends keyof T>(cache: Cache<T>, keys: readonly K[]) {
  let snapshot: Pick<T, K> | undefined;
  return () => {
    for (const key of keys) {
      if (!cache.has(key)) throw new Error(`Key "${String(key)}" not found in cache.`);
    }
    const previous = snapshot;
    if (previous && keys.every((key) => Object.is(previous[key], cache.get(key)))) return previous;
    snapshot = Object.fromEntries(keys.map((key) => [key, cache.get(key)])) as Pick<T, K>;
    return snapshot;
  };
}

function createSante<T extends object>(
  initialState: T,
  options: SanteOptions<T> & { produce: Produce<T> },
): SanteStore<T, true>;
function createSante<T extends object>(initialState: T, options?: SanteOptions<T>): SanteStore<T>;
function createSante<T extends object>(initialState: T, options?: SanteOptions<T>) {
  const cache = new Cache<T>();
  const serverCache = new Cache<T>();
  const initialKeys = Reflect.ownKeys(initialState) as (keyof T)[];
  for (const key of initialKeys) {
    cache.set(key, initialState[key]);
    serverCache.set(key, initialState[key]);
  }

  const persistedKeys = initialKeys.filter((key) => {
    if (typeof key === 'symbol' || !options?.persist) return false;
    return (
      options.persist.key === 'ALL' ||
      options.persist.key.some((persistedKey) => normalizeKey(persistedKey) === normalizeKey(key))
    );
  });
  const getPersistedState = () =>
    Object.fromEntries(persistedKeys.map((key) => [key, cache.get(key)]));
  const persistence = options?.persist ? Persistence(options.persist, persistedKeys) : undefined;
  if (persistence) {
    const { state: storedState, needsRewrite } = persistence.loadState();
    for (const key of persistedKeys) {
      if (Object.prototype.hasOwnProperty.call(storedState, key)) {
        cache.set(key, storedState[key] as T[typeof key]);
      }
    }
    if (needsRewrite) persistence.saveState(getPersistedState());
  }

  function useSante<K extends keyof T, R>(key: K, selector: (value: NoInfer<T[K]>) => R): R;
  function useSante<K extends keyof T>(key: K | readonly K[]): Pick<T, K>;
  function useSante<K extends keyof T, R>(
    key: K | readonly K[],
    selector?: (value: T[K]) => R,
  ): Pick<T, K> | R {
    if (selector !== undefined && (typeof selector !== 'function' || Array.isArray(key))) {
      throw new Error('A selector requires a single state key and a function.');
    }
    const requestedKeys = [...new Set((Array.isArray(key) ? key : [key]).map(normalizeKey))] as K[];
    const previousKeys = useRef<readonly K[] | null>(null);
    if (
      previousKeys.current === null ||
      previousKeys.current.length !== requestedKeys.length ||
      requestedKeys.some((value, index) => value !== previousKeys.current?.[index])
    ) {
      previousKeys.current = requestedKeys;
    }
    const keys = previousKeys.current;

    const subscribe = useCallback(
      (onStoreChange: () => void) => {
        const unsubscribe = keys.map((selectedKey) => cache.subscribe(selectedKey, onStoreChange));
        return () => unsubscribe.forEach((stop) => stop());
      },
      [keys],
    );
    const getSnapshot = useMemo(() => snapshotReader(cache, keys), [keys]);
    const getServerSnapshot = useMemo(() => snapshotReader(serverCache, keys), [keys]);
    const readers = useMemo(() => {
      if (!selector) return [getSnapshot, getServerSnapshot] as const;
      const selectedKey = keys[0];
      // Each selector render owns its memo; committed readers keep their own closure.
      // Browser and server readers share the memo to reuse matching initial selections.
      let memo: { value: T[K]; selection: R } | undefined;
      const select = (snapshot: Pick<T, K>) => {
        const value = snapshot[selectedKey];
        if (memo && Object.is(memo.value, value)) return memo.selection;
        const selection = selector(value);
        // Only cache a successful calculation, including undefined/function results.
        memo = { value, selection };
        return selection;
      };
      return [() => select(getSnapshot()), () => select(getServerSnapshot())] as const;
    }, [getSnapshot, getServerSnapshot, keys, selector]);
    return useSyncExternalStore<Pick<T, K> | R>(subscribe, readers[0], readers[1]);
  }

  const persistChanged = (changedKeys: readonly (keyof T)[]) => {
    if (persistence && changedKeys.some((key) => persistedKeys.includes(normalizeKey(key)))) {
      persistence.saveState(getPersistedState());
    }
  };

  const dispatch = <K extends keyof T>(key: K, valueOrFn: T[K] | ((prev: T[K]) => T[K] | void)) => {
    if (!cache.has(key)) throw new Error(`Key "${String(key)}" not found in cache.`);
    const prev = cache.get(key) as T[K];
    const next =
      typeof valueOrFn === 'function'
        ? options?.produce
          ? options.produce(prev, (draft) =>
              (valueOrFn as (prev: T[K]) => T[K] | void)(draft as T[K]),
            )
          : (valueOrFn as (prev: T[K]) => T[K] | void)(prev)
        : valueOrFn;
    const changed = cache.set(key, next as T[K]);
    if (changed) persistChanged([key]);
  };

  const dispatchMany = (patchOrUpdater: Partial<T> | ((prev: Readonly<T>) => Partial<T>)) => {
    const patch =
      typeof patchOrUpdater === 'function'
        ? patchOrUpdater(
            Object.fromEntries(initialKeys.map((key) => [key, cache.get(key)])) as Readonly<T>,
          )
        : patchOrUpdater;
    if (patch === null || typeof patch !== 'object' || Array.isArray(patch)) {
      throw new Error('dispatchMany requires a state patch object.');
    }
    const prototype = Object.getPrototypeOf(patch);
    if (prototype !== Object.prototype && prototype !== null) {
      throw new Error('dispatchMany requires a state patch object.');
    }

    const keys = Reflect.ownKeys(patch) as (keyof T)[];
    for (const key of keys) {
      if (!cache.has(key)) throw new Error(`Key "${String(key)}" not found in cache.`);
    }
    // Read all patch values before committing, including potentially throwing getters.
    const entries = keys.map((key) => [key, patch[key] as T[typeof key]] as const);
    persistChanged(cache.setMany(entries));
  };

  const getCached = <K extends keyof T>(key: K) => cache.get(key);
  return { useSante, dispatch, dispatchMany, getCached };
}

export { createSante };
