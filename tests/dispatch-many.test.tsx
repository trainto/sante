import { act, cleanup, renderHook } from '@testing-library/react';
import { produce } from 'immer';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createSante, type SanteOptions } from '../src';

afterEach(cleanup);

describe('dispatchMany', () => {
  it('renders complete snapshots and leaves unselected keys alone', () => {
    const store = createSante({ a: 1, b: 2, other: 0 });
    const snapshots: { a: number; b: number }[] = [];
    const selected = renderHook(() => {
      const snapshot = store.useSante(['a', 'b']);
      snapshots.push(snapshot);
      return snapshot;
    });
    const unrelated = renderHook(() => store.useSante('other'));
    const previous = unrelated.result.current;
    act(() => store.dispatchMany({ a: 3, b: 4 }));
    expect(selected.result.current).toEqual({ a: 3, b: 4 });
    expect(snapshots.every(({ a, b }) => (a === 1 && b === 2) || (a === 3 && b === 4))).toBe(true);
    expect(unrelated.result.current).toBe(previous);
  });

  it('computes a partial patch from current state without mutating previous snapshots', () => {
    const store = createSante({ count: 0, user: { name: 'old' }, other: true });
    const oldUser = store.getCached('user');
    store.dispatch('count', 2);
    store.dispatchMany((prev) => ({ count: prev.count + 1, user: { ...prev.user, name: 'new' } }));
    expect(store.getCached('count')).toBe(3);
    expect(store.getCached('user')).toEqual({ name: 'new' });
    expect(store.getCached('other')).toBe(true);
    expect(oldUser).toEqual({ name: 'old' });
  });

  it('supports null, explicit undefined, and direct function values without invoking them', () => {
    const handler = vi.fn(() => 2);
    const store = createSante({
      user: { name: 'old' } as { name: string } | null,
      optional: 'old' as string | undefined,
      handler: (): number => 1,
    });
    store.dispatchMany({ user: null, optional: undefined, handler });
    expect(store.getCached('user')).toBeNull();
    expect(store.getCached('optional')).toBeUndefined();
    expect(store.getCached('handler')).toBe(handler);
    expect(handler).not.toHaveBeenCalled();
  });

  it('supports numeric, symbol, and own __proto__ keys in patches and updater snapshots', () => {
    const symbol = Symbol('state');
    const store = createSante({ 1: 'old', [symbol]: 0, ['__proto__']: 'old' });
    store.dispatchMany((prev) => {
      expect(Object.getPrototypeOf(prev)).toBe(Object.prototype);
      expect(Object.prototype.hasOwnProperty.call(prev, '__proto__')).toBe(true);
      return { 1: `${prev[1]}-new`, [symbol]: prev[symbol] + 1, ['__proto__']: 'new' };
    });
    expect(store.getCached(1)).toBe('old-new');
    expect(store.getCached(symbol)).toBe(1);
    expect(store.getCached('__proto__')).toBe('new');
  });

  it('rejects unknown keys before applying any changes or reading patch getters', () => {
    const store = createSante({ a: 1, b: 2 });
    const getA = vi.fn(() => 3);
    const invalid = {
      get a() {
        return getA();
      },
      missing: 4,
    } as { a: number };
    expect(() => store.dispatchMany(invalid)).toThrow('not found');
    expect(getA).not.toHaveBeenCalled();
    expect(store.getCached('a')).toBe(1);
    expect(store.getCached('b')).toBe(2);
  });

  it('does not partially commit when an updater or patch getter throws', () => {
    const store = createSante({ a: 1, b: 2 });
    expect(() =>
      store.dispatchMany(() => {
        throw new Error('Updater failed');
      }),
    ).toThrow('Updater failed');
    expect(() =>
      store.dispatchMany({
        a: 3,
        get b(): number {
          throw new Error('Getter failed');
        },
      }),
    ).toThrow('Getter failed');
    expect(store.getCached('a')).toBe(1);
    expect(store.getCached('b')).toBe(2);
  });

  it.each([null, undefined, 42, [], Promise.resolve({ a: 3 })])(
    'rejects invalid patch results without changing state: %s',
    (patch) => {
      const store = createSante({ a: 1 });
      expect(() => store.dispatchMany(() => patch as unknown as { a: number })).toThrow(
        'state patch object',
      );
      expect(store.getCached('a')).toBe(1);
    },
  );

  it('keeps snapshots stable for empty patches and Object.is-equal values', () => {
    const store = createSante({ a: NaN, b: 0 });
    const { result } = renderHook(() => store.useSante(['a', 'b']));
    const previous = result.current;
    act(() => store.dispatchMany({}));
    act(() => store.dispatchMany({ a: NaN, b: 0 }));
    expect(result.current).toBe(previous);
    act(() => store.dispatchMany({ b: -0 }));
    expect(Object.is(result.current.b, -0)).toBe(true);
  });

  it('accepts a patch object without a prototype', () => {
    const store = createSante({ a: 1, b: 2 });
    const patch = Object.assign(Object.create(null), { a: 3, b: 4 }) as { a: number; b: number };
    store.dispatchMany(patch);
    expect(store.getCached('a')).toBe(3);
    expect(store.getCached('b')).toBe(4);
  });

  it('rejects a class instance even when all its own keys match the state', () => {
    class CustomPatch {
      a = 3;
      b = 4;
    }
    const store = createSante({ a: 1, b: 2 });
    expect(() => store.dispatchMany(new CustomPatch())).toThrow('state patch object');
    expect(store.getCached('a')).toBe(1);
    expect(store.getCached('b')).toBe(2);
  });

  it('does not apply the field-level producer to a multi-key updater', () => {
    const producer =
      vi.fn<NonNullable<SanteOptions<{ user: { name: string }; count: number }>['produce']>>(
        produce,
      );
    const store = createSante({ user: { name: 'old' }, count: 0 }, { produce: producer });
    store.dispatchMany((prev) => ({ user: { ...prev.user, name: 'new' }, count: 1 }));
    expect(store.getCached('user')).toEqual({ name: 'new' });
    expect(store.getCached('count')).toBe(1);
    expect(producer).not.toHaveBeenCalled();
    store.dispatch('user', (draft) => {
      draft.name = 'single';
    });
    expect(store.getCached('user')).toEqual({ name: 'single' });
    expect(producer).toHaveBeenCalledTimes(1);
  });
});
