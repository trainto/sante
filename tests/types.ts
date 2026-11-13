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

  store.dispatchMany({ user: { name: 'many' }, optional: undefined });
  store.dispatchMany((prev) => ({ user: { ...prev.user, name: 'many' } }));
  functionStore.dispatchMany({ handler: () => 2 });
  // @ts-expect-error Unknown keys are rejected in object patches.
  store.dispatchMany({ user: { name: 'many' }, missing: true });
  // @ts-expect-error Unknown keys are rejected in updater results too.
  store.dispatchMany(() => ({ user: { name: 'many' }, missing: true }));
  // @ts-expect-error Patch values must match each field's type.
  store.dispatchMany({ user: 'wrong' });
  // @ts-expect-error undefined is allowed only when the field permits it.
  store.dispatchMany({ user: undefined });
  // @ts-expect-error Updater result values must match each field's type.
  store.dispatchMany(() => ({ user: undefined }));
  // @ts-expect-error Multiple-key updaters must return a patch, not void.
  store.dispatchMany(() => {});
  // @ts-expect-error Async updaters cannot be committed synchronously.
  store.dispatchMany(async () => ({ user: { name: 'many' } }));
  store.dispatchMany((prev) => {
    // @ts-expect-error The updater receives a readonly top-level state snapshot.
    prev.optional = 'changed';
    return {};
  });
  // @ts-expect-error Immer does not enable mutation-only dispatchMany updaters.
  immutable.dispatchMany(() => {});

  const symbol = Symbol('typed');
  const keyed = createSante({ 1: 'first', [symbol]: 0 });
  keyed.dispatchMany({ 1: 'second', [symbol]: 1 });
  keyed.dispatchMany((prev) => ({ 1: prev[1], [symbol]: prev[symbol] + 1 }));
  // @ts-expect-error Numeric and symbol key values retain their specific types.
  keyed.dispatchMany({ 1: 1, [symbol]: 'wrong' });

  const options: SanteOptions<{ user: { name: string } }> = {};
  const optionalProducer = createSante({ user: { name: '' } }, options);
  // @ts-expect-error An optional producer cannot safely permit void updaters.
  optionalProducer.dispatch('user', (prev) => {
    prev.name = 'new';
  });
  // @ts-expect-error Persistence requires an explicit store name.
  createSante({ count: 0 }, { persist: { key: 'ALL' } });
}
