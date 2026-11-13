import { act } from '@testing-library/react';
import { hydrateRoot } from 'react-dom/client';
import { renderToString } from 'react-dom/server';
import { afterEach, expect, it, vi } from 'vitest';
import { createSante } from '../src';

afterEach(() => {
  vi.unstubAllGlobals();
  localStorage.clear();
});

it('hydrates with the server initial state before rendering persisted browser state', async () => {
  vi.stubGlobal('window', undefined);
  const serverStore = createSante({ count: 0 }, { persist: { name: 'ssr', key: 'ALL' } });
  function ServerView() {
    return <span>{serverStore.useSante('count').count}</span>;
  }
  const html = renderToString(<ServerView />);
  expect(html).toBe('<span>0</span>');
  vi.unstubAllGlobals();

  localStorage.setItem('sante-persistence:ssr', '{"count":42}');
  const browserStore = createSante({ count: 0 }, { persist: { name: 'ssr', key: 'ALL' } });
  function BrowserView() {
    return <span>{browserStore.useSante('count').count}</span>;
  }
  const container = document.createElement('div');
  container.innerHTML = html;
  const onRecoverableError = vi.fn();
  let root: ReturnType<typeof hydrateRoot>;
  await act(async () => {
    root = hydrateRoot(container, <BrowserView />, { onRecoverableError });
  });
  expect(container.textContent).toBe('42');
  expect(onRecoverableError).not.toHaveBeenCalled();
  await act(async () => {
    root.unmount();
  });
});

it('creates independent stores for separate server requests without browser storage', () => {
  vi.stubGlobal('window', undefined);
  const first = createSante({ user: 'first' }, { persist: { name: 'user', key: 'ALL' } });
  const second = createSante({ user: 'second' }, { persist: { name: 'user', key: 'ALL' } });
  first.dispatch('user', 'changed');
  expect(second.getCached('user')).toBe('second');
});

it('keeps the server initial snapshot after a multi-key live-state update', () => {
  const store = createSante({ count: 0, label: 'initial' });
  store.dispatchMany({ count: 1, label: 'updated' });
  function View() {
    const { count, label } = store.useSante(['count', 'label']);
    return <span>{`${count}:${label}`}</span>;
  }
  expect(renderToString(<View />)).toBe('<span>0:initial</span>');
  expect(store.getCached('count')).toBe(1);
  expect(store.getCached('label')).toBe('updated');
});
