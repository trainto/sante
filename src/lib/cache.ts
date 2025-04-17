class Cache<T, K extends keyof T> {
  private cache = new Map<K, T[K]>();
  private subscribers = new Map<K, Set<() => void>>();

  subscribe(key: K, callback: () => void) {
    const callbacks = this.subscribers.get(key);
    if (callbacks) {
      callbacks.add(callback);
    } else {
      this.subscribers.set(key, new Set([callback]));
    }

    return () => {
      this.subscribers.get(key)?.delete(callback);
    };
  }

  get<KSpecific extends K>(key: KSpecific): T[KSpecific] | undefined {
    const value = this.cache.get(key);
    if (value !== undefined) {
      return value as T[KSpecific];
    }

    return undefined;
  }

  set(key: K, value: T[K]) {
    this.cache.set(key, value);
    const callbacks = this.subscribers.get(key);
    if (callbacks) {
      callbacks.forEach((callback) => callback());
    }
  }
}

export default Cache;
