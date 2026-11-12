import { StrictMode } from 'react';
import { act, cleanup, renderHook } from '@testing-library/react';
import { produce } from 'immer';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createSante } from '../src';
import Cache from '../src/lib/cache';

afterEach(cleanup);

describe('snapshots and subscriptions', () => {
  it('removes old fields when the selected keys shrink or become empty', () => {
    const store = createSante({ a: 1, b: 2 });
    const { result, rerender } = renderHook(({ keys }) => store.useSante(keys), {
      initialProps: { keys: ['a', 'b'] as readonly ('a' | 'b')[] },
    });
    expect(result.current).toEqual({ a: 1, b: 2 });
    rerender({ keys: ['a'] });
    expect(result.current).toEqual({ a: 1 });
    rerender({ keys: [] });
    expect(result.current).toEqual({});
  });

  it('switches between keys even when both values are undefined', () => {
    const store = createSante({ a: undefined, b: undefined });
    const { result, rerender } = renderHook(({ key }) => store.useSante(key), {
      initialProps: { key: 'a' as 'a' | 'b' },
    });
    rerender({ key: 'b' });
    expect(result.current).toEqual({ b: undefined });
  });

  it('keeps NaN snapshots stable and observes signed zero changes', () => {
    const store = createSante({ value: NaN });
    const { result, rerender } = renderHook(() => store.useSante('value'));
    const initial = result.current;
    act(() => store.dispatch('value', NaN));
    rerender();
    expect(result.current).toBe(initial);
    act(() => store.dispatch('value', 0));
    expect(Object.is(result.current.value, 0)).toBe(true);
    act(() => store.dispatch('value', -0));
    expect(Object.is(result.current.value, -0)).toBe(true);
  });

  it('does not rerender for unchanged or unselected values', () => {
    const store = createSante({ a: 1, b: 2 });
    let renders = 0;
    const { result } = renderHook(() => {
      renders++;
      return store.useSante('a');
    });
    const initial = result.current;
    const initialRenders = renders;
    act(() => store.dispatch('a', 1));
    act(() => store.dispatch('b', 3));
    expect(result.current).toBe(initial);
    expect(renders).toBe(initialRenders);
  });

  it('does not resubscribe when a fresh array contains the same keys', () => {
    const store = createSante({ a: 1, b: 2 });
    const subscribe = vi.spyOn(Cache.prototype, 'subscribe');
    const { rerender } = renderHook(() => store.useSante(['a', 'b']));
    expect(subscribe).toHaveBeenCalledTimes(2);
    rerender();
    expect(subscribe).toHaveBeenCalledTimes(2);
  });

  it('unsubscribes from replaced keys and subscribes to newly selected keys', () => {
    const store = createSante({ a: 1, b: 2 });
    const { result, rerender } = renderHook(({ key }) => store.useSante(key), {
      initialProps: { key: 'a' as 'a' | 'b' },
    });
    rerender({ key: 'b' });
    const snapshot = result.current;
    act(() => store.dispatch('a', 3));
    expect(result.current).toBe(snapshot);
    act(() => store.dispatch('b', 4));
    expect(result.current).toEqual({ b: 4 });
  });

  it('works under StrictMode with duplicate selected keys', () => {
    const store = createSante({ count: 0 });
    const { result } = renderHook(() => store.useSante(['count', 'count']), {
      wrapper: StrictMode,
    });
    act(() => store.dispatch('count', (prev) => prev + 1));
    expect(result.current).toEqual({ count: 1 });
  });

  it('supports numeric and symbol keys, including undefined initial values', () => {
    const symbol = Symbol('state');
    const store = createSante({ 1: 'first', [symbol]: undefined as string | undefined });
    const { result } = renderHook(() => store.useSante([1, symbol]));
    act(() => store.dispatch(1, 'second'));
    act(() => store.dispatch(symbol, 'symbol'));
    expect(result.current).toEqual({ 1: 'second', [symbol]: 'symbol' });
  });

  it('handles an own __proto__ state key without altering the snapshot prototype', () => {
    const store = createSante({ ['__proto__']: 'value' });
    const { result } = renderHook(() => store.useSante('__proto__'));
    expect(Object.getPrototypeOf(result.current)).toBe(Object.prototype);
    expect(Object.prototype.hasOwnProperty.call(result.current, '__proto__')).toBe(true);
    expect(result.current.__proto__).toBe('value');
  });
});

describe('dispatch', () => {
  it('stores function values through an updater without invoking the replacement', () => {
    const original = () => 1;
    const replacement = vi.fn(() => 2);
    const store = createSante({ handler: original });
    store.dispatch('handler', () => replacement);
    expect(store.getCached('handler')).toBe(replacement);
    expect(replacement).not.toHaveBeenCalled();
  });

  it('supports immutable updaters and explicit undefined state values', () => {
    const store = createSante({ user: { name: 'old' }, optional: 'old' as string | undefined });
    const oldUser = store.getCached('user');
    store.dispatch('user', (prev) => ({ ...prev, name: 'new' }));
    store.dispatch('optional', () => undefined);
    expect(store.getCached('user')).toEqual({ name: 'new' });
    expect(oldUser).toEqual({ name: 'old' });
    expect(store.getCached('optional')).toBeUndefined();
  });

  it('supports Immer mutations and preserves null replacements', () => {
    const store = createSante({ user: { name: 'old' } as { name: string } | null }, { produce });
    store.dispatch('user', (draft) => {
      if (draft) draft.name = 'new';
    });
    expect(store.getCached('user')).toEqual({ name: 'new' });
    store.dispatch('user', () => null);
    expect(store.getCached('user')).toBeNull();
  });

  it('rejects unknown keys for both values and updaters', () => {
    const store = createSante({ count: 0 });
    expect(() => store.dispatch('missing' as 'count', 1)).toThrow('not found');
    expect(() => store.dispatch('missing' as 'count', () => 1)).toThrow('not found');
  });
});
