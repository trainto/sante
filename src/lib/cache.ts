class Cache<T> {
  private cache = new Map<keyof T, T[keyof T]>();
  private subscribers = new Map<keyof T, Set<() => void>>();

  subscribe(key: keyof T, callback: () => void) {
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

  has(key: keyof T): boolean {
    return this.cache.has(key);
  }

  get<K extends keyof T>(key: K): T[K] | undefined {
    const value = this.cache.get(key);
    return value as T[K] | undefined;
  }

  set(key: keyof T, value: T[keyof T]) {
    this.cache.set(key, value);
    const callbacks = this.subscribers.get(key);
    if (callbacks) {
      callbacks.forEach((callback) => callback());
    }
  }
}

export default Cache;
