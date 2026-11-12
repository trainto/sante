import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createSante } from '../src';

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
});
afterEach(() => vi.unstubAllGlobals());

describe('persistence', () => {
  it('isolates stores by name', () => {
    const first = createSante({ count: 0 }, { persist: { name: 'first', key: 'ALL' } });
    first.dispatch('count', 42);
    const second = createSante({ count: 100 }, { persist: { name: 'second', key: 'ALL' } });
    expect(second.getCached('count')).toBe(100);
    expect(
      createSante({ count: 0 }, { persist: { name: 'first', key: 'ALL' } }).getCached('count'),
    ).toBe(42);
  });

  it('restores only declared persisted keys and saves only those keys', () => {
    localStorage.setItem(
      'sante-persistence:test',
      JSON.stringify({ count: 42, name: 'foreign', extra: true }),
    );
    const store = createSante(
      { count: 0, name: 'initial' },
      { persist: { name: 'test', key: ['count'] } },
    );
    expect(store.getCached('count')).toBe(42);
    expect(store.getCached('name')).toBe('initial');
    store.dispatch('count', 43);
    expect(JSON.parse(localStorage.getItem('sante-persistence:test')!)).toEqual({ count: 43 });
  });

  it('does not write when unpersisted or unchanged keys are dispatched', () => {
    const store = createSante(
      { count: 0, name: '' },
      { persist: { name: 'test', key: ['count'] } },
    );
    const write = vi.spyOn(Storage.prototype, 'setItem');
    store.dispatch('name', 'new');
    store.dispatch('count', 0);
    expect(write).not.toHaveBeenCalled();
  });

  it('uses sessionStorage when requested', () => {
    const store = createSante(
      { count: 0 },
      { persist: { name: 'test', key: 'ALL', storage: 'session' } },
    );
    store.dispatch('count', 1);
    expect(sessionStorage.getItem('sante-persistence:test')).toBe('{"count":1}');
    expect(localStorage.getItem('sante-persistence:test')).toBeNull();
  });

  it.each(['{broken', 'null', '[]', '42'])(
    'falls back to initial state for invalid stored data: %s',
    (data) => {
      localStorage.setItem('sante-persistence:test', data);
      const onError = vi.fn();
      const store = createSante({ count: 0 }, { persist: { name: 'test', key: 'ALL', onError } });
      expect(store.getCached('count')).toBe(0);
      expect(onError).toHaveBeenCalledTimes(1);
    },
  );

  it('handles a SecurityError when storage access is unavailable', () => {
    vi.stubGlobal('window', {
      get localStorage() {
        throw new Error('SecurityError');
      },
    });
    const onError = vi.fn();
    const store = createSante({ count: 0 }, { persist: { name: 'test', key: 'ALL', onError } });
    store.dispatch('count', 1);
    expect(store.getCached('count')).toBe(1);
    expect(onError).toHaveBeenCalledTimes(2);
  });

  it('keeps live state usable when writing exceeds the storage quota', () => {
    const onError = vi.fn();
    const store = createSante({ count: 0 }, { persist: { name: 'test', key: 'ALL', onError } });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError');
    });
    expect(() => store.dispatch('count', 1)).not.toThrow();
    expect(store.getCached('count')).toBe(1);
    expect(onError).toHaveBeenCalledTimes(1);
  });

  it('handles values that cannot be JSON serialized without losing live state', () => {
    const onError = vi.fn();
    const store = createSante({ value: 0n }, { persist: { name: 'test', key: 'ALL', onError } });
    store.dispatch('value', 1n);
    expect(store.getCached('value')).toBe(1n);
    expect(onError).toHaveBeenCalledTimes(1);
  });

  it('rejects an empty persistence name and never automatically reads the old shared key', () => {
    expect(() => createSante({ count: 0 }, { persist: { name: '', key: 'ALL' } })).toThrow(
      'non-empty',
    );
    localStorage.setItem('sante-persistence', '{"count":42}');
    const store = createSante({ count: 0 }, { persist: { name: 'test', key: 'ALL' } });
    expect(store.getCached('count')).toBe(0);
  });

  it('supports numeric persisted keys and skips symbol keys', () => {
    const symbol = Symbol('ephemeral');
    const store = createSante(
      { 1: 'old', [symbol]: 'old' },
      { persist: { name: 'test', key: [1] } },
    );
    store.dispatch(1, 'new');
    const reloaded = createSante({ 1: 'old' }, { persist: { name: 'test', key: [1] } });
    expect(reloaded.getCached(1)).toBe('new');
    store.dispatch(symbol, 'new');
    expect(localStorage.getItem('sante-persistence:test')).toBe('{"1":"new"}');
  });
});
