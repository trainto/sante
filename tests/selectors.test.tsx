import { Component, StrictMode, Suspense, startTransition, useState, type ReactNode } from 'react';
import { act, cleanup, render, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createSante } from '../src';
import Cache from '../src/lib/cache';

afterEach(cleanup);

describe('single-key selectors', () => {
  it('keeps hook order and subscriptions when switching between legacy and selector calls', () => {
    const store = createSante({ count: 2 });
    const subscribe = vi.spyOn(Cache.prototype, 'subscribe');
    const { result, rerender } = renderHook(
      ({ selected }) =>
        selected ? store.useSante('count', (count) => count * 2) : store.useSante('count'),
      { initialProps: { selected: false } },
    );
    expect(result.current).toEqual({ count: 2 });
    rerender({ selected: true });
    expect(result.current).toBe(4);
    act(() => store.dispatch('count', 3));
    expect(result.current).toBe(6);
    rerender({ selected: false });
    expect(result.current).toEqual({ count: 3 });
    expect(subscribe).toHaveBeenCalledTimes(1);
  });

  it('skips rendering for unchanged selected values and unrelated keys', () => {
    const store = createSante({ user: { name: 'Joon', age: 20 }, other: 0 });
    let renders = 0;
    const { result } = renderHook(() => {
      renders++;
      return store.useSante('user', (user) => user.name);
    });
    const initialRenders = renders;
    act(() => store.dispatch('user', (user) => ({ ...user, age: 21 })));
    act(() => store.dispatch('other', 1));
    expect(result.current).toBe('Joon');
    expect(renders).toBe(initialRenders);
    act(() => store.dispatch('user', (user) => ({ ...user, name: 'New' })));
    expect(result.current).toBe('New');
    expect(renders).toBeGreaterThan(initialRenders);
  });

  it('caches allocating output for a stable selector and does not resubscribe on parent renders', () => {
    const store = createSante({ user: { name: 'Joon', age: 20 } });
    const selector = vi.fn((user: { name: string }) => ({ name: user.name }));
    const subscribe = vi.spyOn(Cache.prototype, 'subscribe');
    const { result, rerender } = renderHook(() => store.useSante('user', selector));
    const initial = result.current;
    const initialCalls = selector.mock.calls.length;
    rerender();
    expect(result.current).toBe(initial);
    expect(selector).toHaveBeenCalledTimes(initialCalls);
    expect(subscribe).toHaveBeenCalledTimes(1);
    act(() => store.dispatch('user', (user) => ({ ...user, age: 21 })));
    expect(result.current).toEqual(initial);
    expect(result.current).not.toBe(initial);
  });

  it('supports inline allocating selectors without an uncached snapshot loop', () => {
    const store = createSante({ user: { name: 'Joon', age: 20 } });
    let renders = 0;
    const { result, rerender } = renderHook(() => {
      if (++renders > 20) throw new Error('Selector render loop');
      return store.useSante('user', (user) => ({ name: user.name }));
    });
    const initial = result.current;
    rerender();
    expect(result.current).toEqual(initial);
    expect(result.current).not.toBe(initial);
    act(() => store.dispatch('user', (user) => ({ ...user, age: 21 })));
    expect(result.current).toEqual(initial);
    expect(renders).toBeLessThan(20);
  });

  it('recomputes when an inline selector captures a new index and ignores other item changes', () => {
    const first = { id: 'first' };
    const second = { id: 'second' };
    const store = createSante({ items: [first, second] });
    const subscribe = vi.spyOn(Cache.prototype, 'subscribe');
    let renders = 0;
    const { result, rerender } = renderHook(
      ({ index }) => {
        renders++;
        return store.useSante('items', (items) => items[index]);
      },
      { initialProps: { index: 0 } },
    );
    expect(result.current).toBe(first);
    rerender({ index: 1 });
    expect(result.current).toBe(second);
    expect(subscribe).toHaveBeenCalledTimes(1);
    const before = renders;
    act(() => store.dispatch('items', [{ id: 'new first' }, second]));
    expect(result.current).toBe(second);
    expect(renders).toBe(before);
    act(() => store.dispatch('items', [first, { id: 'new second' }]));
    expect(result.current).toEqual({ id: 'new second' });
  });

  it('switches selector functions without a store update or resubscription', () => {
    const store = createSante({ user: { name: 'Joon', age: 20 } });
    const name = (user: { name: string; age: number }) => user.name;
    const age = (user: { name: string; age: number }) => String(user.age);
    const subscribe = vi.spyOn(Cache.prototype, 'subscribe');
    const { result, rerender } = renderHook(({ selector }) => store.useSante('user', selector), {
      initialProps: { selector: name },
    });
    rerender({ selector: age });
    expect(result.current).toBe('20');
    expect(subscribe).toHaveBeenCalledTimes(1);
    act(() => store.dispatch('user', { name: 'New', age: 21 }));
    expect(result.current).toBe('21');
  });

  it('switches keys with equal undefined values and removes the old subscription', () => {
    const store = createSante({
      a: undefined as number | undefined,
      b: undefined as number | undefined,
    });
    const selector = (value: number | undefined) => value ?? 0;
    let renders = 0;
    const { result, rerender } = renderHook(
      ({ key }) => {
        renders++;
        return store.useSante(key, selector);
      },
      { initialProps: { key: 'a' as 'a' | 'b' } },
    );
    rerender({ key: 'b' });
    const before = renders;
    act(() => store.dispatch('a', 1));
    expect(result.current).toBe(0);
    expect(renders).toBe(before);
    act(() => store.dispatch('b', 2));
    expect(result.current).toBe(2);
  });

  it.each([null, undefined])(
    'caches %s results and skips rendering when selected output stays equal',
    (value) => {
      const store = createSante({ count: 0 });
      const selector = vi.fn(() => value);
      let renders = 0;
      const { result, rerender } = renderHook(() => {
        renders++;
        return store.useSante('count', selector);
      });
      const calls = selector.mock.calls.length;
      rerender();
      expect(selector).toHaveBeenCalledTimes(calls);
      const before = renders;
      act(() => store.dispatch('count', 1));
      expect(result.current).toBe(value);
      expect(renders).toBe(before);
    },
  );

  it('compares selected NaN and signed zero with Object.is', () => {
    const store = createSante({ info: { value: NaN, other: 0 } });
    let renders = 0;
    const { result } = renderHook(() => {
      renders++;
      return store.useSante('info', (info) => info.value);
    });
    const before = renders;
    act(() => store.dispatch('info', { value: NaN, other: 1 }));
    expect(Number.isNaN(result.current)).toBe(true);
    expect(renders).toBe(before);
    act(() => store.dispatch('info', { value: 0, other: 1 }));
    expect(Object.is(result.current, 0)).toBe(true);
    act(() => store.dispatch('info', { value: -0, other: 1 }));
    expect(Object.is(result.current, -0)).toBe(true);
  });

  it('returns stored function values without invoking them', () => {
    const original = vi.fn(() => 1);
    const replacement = vi.fn(() => 2);
    const store = createSante({ handler: original });
    const { result } = renderHook(() => store.useSante('handler', (handler) => handler));
    expect(result.current).toBe(original);
    act(() => store.dispatch('handler', () => replacement));
    expect(result.current).toBe(replacement);
    expect(original).not.toHaveBeenCalled();
    expect(replacement).not.toHaveBeenCalled();
  });

  it('supports numeric, symbol, and own __proto__ keys', () => {
    const symbol = Symbol('state');
    const store = createSante({
      1: { label: 'first' },
      [symbol]: undefined as string | undefined,
      ['__proto__']: { label: 'own' },
    });
    const { result } = renderHook(() => [
      store.useSante(1, (value) => value.label),
      store.useSante(symbol, (value) => value?.toUpperCase()),
      store.useSante('__proto__', (value) => value.label),
    ]);
    expect(result.current).toEqual(['first', undefined, 'own']);
    act(() =>
      store.dispatchMany({
        1: { label: 'second' },
        [symbol]: 'new',
        ['__proto__']: { label: 'next' },
      }),
    );
    expect(result.current).toEqual(['second', 'NEW', 'next']);
  });

  it('computes a stable selector once for a multi-key dispatch', () => {
    const store = createSante({ info: { count: 0 }, other: 0 });
    const selector = vi.fn((info: { count: number }) => info.count);
    const { result } = renderHook(() => store.useSante('info', selector));
    const before = selector.mock.calls.length;
    act(() => store.dispatchMany({ info: { count: 1 }, other: 1 }));
    expect(result.current).toBe(1);
    expect(selector).toHaveBeenCalledTimes(before + 1);
  });

  it('works in StrictMode when a changed field has unchanged selected output', () => {
    const store = createSante({ user: { name: 'Joon', age: 20 } });
    let renders = 0;
    const { result } = renderHook(
      () => {
        renders++;
        return store.useSante('user', (user) => user.name);
      },
      { wrapper: StrictMode },
    );
    const before = renders;
    act(() => store.dispatch('user', (user) => ({ ...user, age: 21 })));
    expect(result.current).toBe('Joon');
    expect(renders).toBe(before);
  });

  it('rejects arrays or nonfunctions as selector arguments at runtime', () => {
    const store = createSante({ count: 0 });
    const invalid = store.useSante as unknown as (key: unknown, selector: unknown) => unknown;
    expect(() => invalid(['count'], (value: number) => value)).toThrow('single state key');
    expect(() => invalid('count', 1)).toThrow('function');
  });

  it('propagates selector errors to an error boundary and recovers on a valid remount', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const store = createSante({ count: 0 });
    class Boundary extends Component<{ children: ReactNode }, { failed: boolean }> {
      state = { failed: false };
      static getDerivedStateFromError() {
        return { failed: true };
      }
      render() {
        return this.state.failed ? <span>Failed selector</span> : this.props.children;
      }
    }
    function View() {
      const count = store.useSante('count', (value) => {
        if (value === 1) throw new Error('Invalid count');
        return value;
      });
      return <span data-testid="value">{count}</span>;
    }
    const view = render(
      <Boundary>
        <View />
      </Boundary>,
    );
    act(() => store.dispatch('count', 1));
    expect(view.getByText('Failed selector')).toBeDefined();
    act(() => store.dispatch('count', 2));
    view.rerender(
      <Boundary key="recovered">
        <View />
      </Boundary>,
    );
    expect(view.getByTestId('value').textContent).toBe('2');
  });

  it('keeps committed selectors isolated from a suspended transition', async () => {
    const first = { id: 'first' };
    const store = createSante({ items: [first, { id: 'second' }] });
    let resolve!: () => void;
    const pending = new Promise<void>((done) => {
      resolve = done;
    });
    let blocked = true;
    let selectSecond!: () => void;
    function Item({ index }: { index: number }) {
      const item = store.useSante('items', (items) => items[index]);
      if (index === 1 && blocked) throw pending;
      return <span data-testid="item">{item?.id}</span>;
    }
    function App() {
      const [index, setIndex] = useState(0);
      selectSecond = () => setIndex(1);
      return (
        <Suspense fallback={<span>Loading</span>}>
          <Item index={index} />
        </Suspense>
      );
    }
    const view = render(<App />);
    await act(async () => {
      startTransition(selectSecond);
    });
    expect(view.getByTestId('item').textContent).toBe('first');
    await act(async () => {
      store.dispatch('items', [first, { id: 'latest second' }]);
    });
    expect(view.getByTestId('item').textContent).toBe('first');
    await act(async () => {
      blocked = false;
      resolve();
    });
    expect(view.getByTestId('item').textContent).toBe('latest second');
  });
});
