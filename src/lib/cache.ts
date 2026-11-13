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
    return this.setMany([[key, value]]).length > 0;
  }

  setMany(entries: readonly (readonly [keyof T, T[keyof T]])[]): (keyof T)[] {
    const changed = entries
      .map(([key, value]) => [normalizeKey(key), value] as const)
      .filter(([key, value]) => !this.cache.has(key) || !Object.is(this.cache.get(key), value));

    // Commit every value before notifying a subscriber that might read other keys.
    for (const [key, value] of changed) this.cache.set(key, value);
    const callbacks = new Set<() => void>();
    for (const [key] of changed) {
      this.subscribers.get(key)?.forEach((callback) => callbacks.add(callback));
    }
    [...callbacks].forEach((callback) => callback());
    return changed.map(([key]) => key);
  }
}

export default Cache;
