export function normalizeKey<K extends PropertyKey>(key: K): K {
  return (typeof key === 'number' ? String(key) : key) as K;
}

class Cache<T> {
  private cache = new Map<keyof T, T[keyof T]>();
  private subscribers = new Map<keyof T, Set<() => void>>();

  subscribe(key: keyof T, callback: () => void) {
    key = normalizeKey(key);
    let callbacks = this.subscribers.get(key);
    if (!callbacks) {
      callbacks = new Set();
      this.subscribers.set(key, callbacks);
    }
    callbacks.add(callback);

    return () => {
      const current = this.subscribers.get(key);
      current?.delete(callback);
      if (current?.size === 0) this.subscribers.delete(key);
    };
  }

  has(key: keyof T): boolean {
    return this.cache.has(normalizeKey(key));
  }

  get<K extends keyof T>(key: K): T[K] | undefined {
    const value = this.cache.get(normalizeKey(key));
    return value as T[K] | undefined;
  }

  set<K extends keyof T>(key: K, value: T[K]): boolean {
    key = normalizeKey(key);
    if (this.cache.has(key) && Object.is(this.cache.get(key), value)) return false;
    this.cache.set(key, value);
    const callbacks = this.subscribers.get(key);
    if (callbacks) {
      [...callbacks].forEach((callback) => callback());
    }
    return true;
  }
}

export default Cache;
