import { describe, expect, it, vi } from 'vitest';
import Cache from '../src/lib/cache';

describe('cache notifications', () => {
  it('commits all changed keys before notifying each overlapping subscriber once', () => {
    const cache = new Cache<{ a: number; b: number; other: number }>();
    cache.setMany([
      ['a', 1],
      ['b', 2],
      ['other', 0],
    ]);
    const listener = vi.fn(() => {
      expect(cache.get('a')).toBe(3);
      expect(cache.get('b')).toBe(4);
    });
    const unrelated = vi.fn();
    cache.subscribe('a', listener);
    cache.subscribe('b', listener);
    cache.subscribe('other', unrelated);

    expect(
      cache.setMany([
        ['a', 3],
        ['b', 4],
        ['other', 0],
      ]),
    ).toEqual(['a', 'b']);
    expect(listener).toHaveBeenCalledTimes(1);
    expect(unrelated).not.toHaveBeenCalled();
  });

  it('skips empty and unchanged multi-key updates using Object.is', () => {
    const cache = new Cache<{ a: number; b: number }>();
    cache.setMany([
      ['a', NaN],
      ['b', 0],
    ]);
    const listener = vi.fn();
    cache.subscribe('a', listener);
    cache.subscribe('b', listener);
    expect(cache.setMany([])).toEqual([]);
    expect(
      cache.setMany([
        ['a', NaN],
        ['b', 0],
      ]),
    ).toEqual([]);
    expect(listener).not.toHaveBeenCalled();
    expect(
      cache.setMany([
        ['a', NaN],
        ['b', -0],
      ]),
    ).toEqual(['b']);
    expect(listener).toHaveBeenCalledTimes(1);
  });

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
