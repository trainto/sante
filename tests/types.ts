import { produce } from 'immer';
import { createSante, type SanteOptions } from '../src';

// Compiled by `pnpm typecheck`, never executed.
export function checkStoreTypes() {
  const store = createSante({ user: { name: '' }, optional: '' as string | undefined });
  store.dispatch('user', (prev) => ({ ...prev, name: 'new' }));
  store.dispatch('optional', () => undefined);
  // @ts-expect-error Plain updaters must return state, not void.
  store.dispatch('user', (prev) => {
    prev.name = 'new';
  });
  // @ts-expect-error Unknown state keys are rejected.
  store.dispatch('missing', 'new');
  // @ts-expect-error State value types remain specific to the selected key.
  store.dispatch('user', 'new');
  const selection: { user: { name: string } } = store.useSante(['user'] as const);
  // @ts-expect-error Unselected fields are not part of the snapshot.
  void selection.optional;

  const immutable = createSante({ user: { name: '' } as { name: string } | null }, { produce });
  immutable.dispatch('user', (draft) => {
    if (draft) draft.name = 'new';
  });
  immutable.dispatch('user', () => null);

  const functionStore = createSante({ handler: (): number => 1 });
  functionStore.dispatch('handler', () => () => 2);
  // @ts-expect-error A function value must be wrapped in an updater.
  functionStore.dispatch('handler', () => 2);

  const options: SanteOptions<{ user: { name: string } }> = {};
  const optionalProducer = createSante({ user: { name: '' } }, options);
  // @ts-expect-error An optional producer cannot safely permit void updaters.
  optionalProducer.dispatch('user', (prev) => {
    prev.name = 'new';
  });
  // @ts-expect-error Persistence requires an explicit store name.
  createSante({ count: 0 }, { persist: { key: 'ALL' } });
}
