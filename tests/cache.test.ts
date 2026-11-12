import { describe, expect, it, vi } from 'vitest';
import Cache from '../src/lib/cache';

describe('cache notifications', () => {
  it('uses Object.is to skip unchanged values', () => {
    const cache = new Cache<{ value: number }>();
    cache.set('value', NaN);
    const listener = vi.fn();
    cache.subscribe('value', listener);
    expect(cache.set('value', NaN)).toBe(false);
    expect(listener).not.toHaveBeenCalled();
    cache.set('value', 0);
    cache.set('value', -0);
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it('registers an undefined value as an existing key', () => {
    const cache = new Cache<{ value: undefined }>();
    expect(cache.set('value', undefined)).toBe(true);
    expect(cache.has('value')).toBe(true);
  });

  it('stops notifying after unsubscription', () => {
    const cache = new Cache<{ value: number }>();
    const listener = vi.fn();
    const unsubscribe = cache.subscribe('value', listener);
    unsubscribe();
    cache.set('value', 1);
    expect(listener).not.toHaveBeenCalled();
  });

  it('does not loop when a callback resubscribes during a notification', () => {
    const cache = new Cache<{ value: number }>();
    const listener = vi.fn(() => {
      unsubscribe();
      cache.subscribe('value', listener);
    });
    const unsubscribe = cache.subscribe('value', listener);
    cache.set('value', 1);
    expect(listener).toHaveBeenCalledTimes(1);
  });
});
