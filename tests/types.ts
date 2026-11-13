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

export function checkPersistenceTypes() {
  const initialState = { count: 0, name: '' };
  const validate = (candidate: unknown): candidate is Partial<{ count: number }> =>
    candidate !== null && typeof candidate === 'object';
  const store = createSante(initialState, {
    persist: { name: 'typed', key: ['count'], version: 1, migrate: () => ({ count: 1 }), validate },
  });
  // Partial migration/validation must not narrow the full store's inferred state.
  store.dispatch('name', 'still available');
  const name: string = store.useSante('name').name;
  void name;
  createSante(initialState, { persist: { name: 'typed', key: 'ALL', validate } });
  createSante(initialState, {
    persist: {
      name: 'typed',
      key: 'ALL',
      version: 1,
      migrate: (saved, version) => {
        const fromVersion: number = version;
        void fromVersion;
        // @ts-expect-error Saved migration input is untrusted until narrowed.
        void saved.count;
        return {};
      },
    },
  });
  createSante(initialState, {
    // @ts-expect-error Migration requires an explicit schema version.
    persist: { name: 'typed', key: 'ALL', migrate: () => ({ count: 1 }) },
  });
  // @ts-expect-error Schema versions are numeric.
  createSante(initialState, { persist: { name: 'typed', key: 'ALL', version: '1' } });
  createSante(initialState, {
    // @ts-expect-error Migration must return a synchronous partial state.
    persist: { name: 'typed', key: 'ALL', version: 1, migrate: async () => ({ count: 1 }) },
  });
  createSante(initialState, {
    // @ts-expect-error A migration cannot widen an initialized field to a wrong type.
    persist: { name: 'typed', key: 'ALL', version: 1, migrate: () => ({ count: 'wrong' }) },
  });
  // @ts-expect-error Validators must be synchronous type guards.
  createSante(initialState, { persist: { name: 'typed', key: 'ALL', validate: async () => true } });
  createSante(initialState, {
    persist: {
      name: 'typed',
      key: 'ALL',
      // @ts-expect-error Validators cannot change the store's initialized field types.
      validate: (candidate: unknown): candidate is Partial<{ count: string }> => candidate !== null,
    },
  });
}

export function checkSelectorTypes() {
  const store = createSante({ user: null as { name: string } | null, count: 0 });
  const oldSingle: { count: number } = store.useSante('count');
  const oldMultiple: { count: number; user: { name: string } | null } = store.useSante([
    'count',
    'user',
  ] as const);
  const legacyArgs: Parameters<typeof store.useSante> = ['count'];
  const legacyArrayArgs: Parameters<typeof store.useSante> = [['count', 'user']];
  const legacyReturn: ReturnType<typeof store.useSante> = { count: 0, user: null };
  const legacyCount: number = legacyReturn.count;
  void [legacyArgs, legacyArrayArgs, legacyReturn, legacyCount];
  const name: string | undefined = store.useSante('user', (user) => user?.name);
  const doubled: number = store.useSante('count', (count) => count * 2);
  const functionValue: () => number = store.useSante('count', (count) => () => count);
  void [oldSingle, oldMultiple, name, doubled, functionValue];
  // @ts-expect-error Selectors accept only one key.
  store.useSante(['count'] as const, (count) => count);
  // @ts-expect-error Unknown keys remain rejected.
  store.useSante('missing', (value) => value);
  // @ts-expect-error The selector must be a function.
  store.useSante('count', 1);
  // @ts-expect-error A selector cannot widen the key's input type.
  store.useSante('count', (value: string) => value.length);
  // @ts-expect-error Nullable state must be narrowed before accessing fields.
  store.useSante('user', (user) => user.name);
  // @ts-expect-error The input is the selected field, not the full state.
  store.useSante('user', (user) => user?.count);
  // @ts-expect-error The result retains its inferred type.
  const wrong: string = store.useSante('count', (count) => count * 2);
  void wrong;
  const symbol = Symbol('selector');
  const keyed = createSante({ 1: 'one', [symbol]: 2 });
  const numeric: string = keyed.useSante(1, (value) => value.toUpperCase());
  const symbolic: number = keyed.useSante(symbol, (value) => value * 2);
  void [numeric, symbolic];
}
