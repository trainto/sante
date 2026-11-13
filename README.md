# Sante

A tiny React state-management library with direct subscriptions to top-level keys. Pick the fields your component needs; Sante handles subscription routing and keeps the selected result stable.

Sante(상태) means state in Korean. Supports React 18 and later, TypeScript 5.4 and later, and both ESM and CommonJS packages.

This guide covers **0.4.0**, including single-key selectors, `dispatchMany`, and versioned persistence. Check your installed version with `npm ls @trainto/sante` (`pnpm list @trainto/sante` for pnpm). If you use 0.2.3, read the upgrade guide before updating.

- **Direct key subscriptions.** A state update notifies subscribers of the changed keys.
- **Stable multi-key results.** Select several fields with an inline key array, without writing a selector function or adding a shallow-comparison helper.
- **Select within a field.** Read a nested value or array item with a single-key selector; unchanged results skip store-driven renders.
- Update and read state outside React without a provider.
- Use immutable updates, or opt into Immer for draft updates.
- Persist selected fields in local or session storage.

- [Why key subscriptions?](#why-key-subscriptions)
- [Quick start](#quick-start)
- [Reading state](#reading-state)
- [Selecting part of a field](#selecting-part-of-a-field)
- [Updating objects and arrays](#updating-objects-and-arrays)
- [Updating several fields together](#updating-several-fields-together)
- [Typing nullable values and empty arrays](#typing-nullable-values-and-empty-arrays)
- [Using Immer](#using-immer)
- [Saving state across reloads](#saving-state-across-reloads)
- [Versioning and validating saved state](#versioning-and-validating-saved-state)
- [Next.js and server rendering](#nextjs-and-server-rendering)
- [Upgrading from 0.3.0](#upgrading-from-030)
- [Upgrading from 0.2.3](#upgrading-from-023)
- [API reference](#api-reference)
- [Development](#development)

## Why key subscriptions?

Reading several fields is a single hook call:

```tsx
const { count, label } = useSante(['count', 'label']);
```

Sante registers this subscription against `count` and `label`. An update to another key, such as `draft`, does not notify it. The hook also keeps its returned object stable while the key selection and its values remain the same, comparing each selected value with `Object.is`.

This gives you two useful defaults:

- **Updates are routed by key.** Subscribers to unrelated keys are not called just to discover that their selected values stayed the same.
- **Selection results are cached for you.** Inline key arrays work across renders. You do not need to memoize the array or configure equality handling for the returned object.

If you are coming from Zustand, selecting several fields into a new object or array is a common use case for [`useShallow`](https://zustand.docs.pmnd.rs/learn/guides/prevent-rerenders-with-use-shallow). Sante's key-list API handles that selection directly. A single-value Zustand selector generally does not need `useShallow`.

These are guarantees about subscription routing and snapshot stability. Parent renders and local React state can still render a component. Subscriptions are at the top-level key; [single-key selectors](#selecting-part-of-a-field) can narrow the value that causes a store-driven render.

## Quick start

Install Sante in an app that already has React:

```bash
npm install @trainto/sante
# or
pnpm add @trainto/sante
```

For a client-side React app, create a shared store once in `src/store.ts`. Creating it outside components lets multiple components use the same state.

<!-- example:quickstart/store.ts -->
```ts
import { createSante } from '@trainto/sante';

export const { useSante, dispatch, getCached } = createSante({
  count: 0,
  label: 'Count',
  draft: '',
});

export const increment = () => dispatch('count', (prev) => prev + 1);
```

Then use it from `src/Counter.tsx`:

<!-- example:quickstart/Counter.tsx -->
```tsx
'use client';

import { increment, useSante } from './store';

export function Counter() {
  const { count, label } = useSante(['count', 'label']);
  return (
    <button onClick={increment}>
      {label}: {count}
    </button>
  );
}
```

Render `<Counter />` in your app. Clicking the button updates `count`; all components subscribed to that key see the new value. Updating `draft` with `dispatch('draft', 'new text')` does not notify the counter's subscription. The inline `['count', 'label']` selection needs no memoization or shallow-comparison helper.

`useSante(['count', 'label'])` returns `{ count, label }`; selecting one key with `useSante('count')` returns `{ count }`. Destructure either result. The `'use client'` directive is useful in Next.js and harmless in a normal React app. For request-specific server data, use the store factory pattern below.

## Reading state

- Read one key with `const { name } = useSante('name')`.
- Read several keys with `const { name, tels } = useSante(['name', 'tels'])`. Inline arrays work; you do not need to memoize them.
- Call `useSante` at the top level of a React component or custom hook.
- Use `getCached('name')` in event handlers, API helpers, or other ordinary functions. It reads the current value immediately and does not subscribe or cause a render.

The hook returns exactly the selected fields, including when the selection changes. Components subscribe to top-level keys: subscribe to `tels` to observe `tels.mobile`; a dotted key such as `'tels.mobile'` is not supported. Use `useSante('tels', tels => tels.mobile)` to select that nested value. Parent renders and local React state can still cause a component to render.

Every key must be present in `initialState`, even if its value is `undefined`. `useSante` and `dispatch` throw for missing keys; `getCached` returns `undefined` for a missing key.

## Selecting part of a field

Pass a selector as the second argument to read part of one field. Unlike `useSante('user')`, which returns `{ user }`, `useSante('user', selector)` returns the selector's result directly. TypeScript infers both the field value and the result.

<!-- example:selectors.tsx -->
```tsx
import { createSante } from '@trainto/sante';

type User = { name: string; age: number };
type Item = { id: string; title: string };

export const { useSante, dispatch } = createSante({
  user: null as User | null,
  items: [] as Item[],
});

export function UserName() {
  const name = useSante('user', (user) => user?.name ?? 'Guest');
  return <span>{name}</span>;
}

export function ItemTitle({ index }: { index: number }) {
  const item = useSante('items', (items) => items[index]);
  return <span>{item?.title ?? 'No item'}</span>;
}
```

`UserName` subscribes to the `user` key. Replacing `user` with a new object that changes only `age` runs the selector, but its unchanged name skips a store-driven render. Updating an unrelated key does not notify this subscription. `ItemTitle` similarly skips an update when another item changes and the selected item retains its reference. Changing the `index` prop recalculates the selection even without a store update.

Update objects and arrays immutably, as with React state: replace the top-level object or array and return unchanged items as-is. For example, use `dispatch('items', items => items.map((item, i) => i === index ? { ...item, title: 'New' } : item))`. Mutating an existing object does not notify subscribers; selecting an object whose reference stays the same also cannot detect mutations inside it.

For selectors returning a string, number, boolean, or an existing item, no extra memoization is usually needed. Results are compared with **`Object.is`**: equal primitive values match, while objects and arrays match only when they are the same instance.

```ts
Object.is('Joon', 'Joon'); // true
Object.is({ name: 'Joon' }, { name: 'Joon' }); // false
```

For example, `user => user?.name` skips a store-driven render when only `age` changes. But `user => ({ name: user?.name })` builds a new object when the input changes, so an age-only update can still render the component. This affects render optimization, not the correctness of the selected data. Return the name directly when that is all you need. There is no shallow or deep comparison of selector results.

Sante caches the result while the input and selector function stay the same, so returning objects or arrays does not cause an uncached-snapshot render loop.

Inline selectors are supported. A new selector function reference recalculates its result on a React render; an allocating inline selector therefore returns a new reference on a parent render too. If computation is expensive or you need that result reference to survive parent renders, define a selector outside the component or use `useCallback` with all captured values in its dependencies. `useCallback` does not make newly allocated objects equal after an input change. It also does not prevent renders caused by a parent or local React state.

Selectors must be pure and synchronous. They may run more than once during React rendering and must not mutate state, dispatch updates, or perform side effects. Promises are not awaited. Keep captured values and initial state consistent between server rendering and hydration.

This overload accepts **one top-level key**. To read several top-level fields, continue using `useSante(['count', 'label'])`; its returned object remains automatically stable without a selector or shallow-comparison helper. Existing calls without a selector keep their return shape and behavior.

## Updating objects and arrays

Use `dispatch(key, nextValue)` to replace a field, or `dispatch(key, prev => nextValue)` when the next value depends on the current one. Updates and `getCached` reads are synchronous.

Without Immer, treat `prev` as immutable and return a new object or array when changing nested data. Sante compares each top-level value with `Object.is`; mutating an object and returning the same reference will not notify subscribers. A mutation-only updater that returns nothing is rejected by TypeScript.

The following store provides an action for updating a nested phone number:

<!-- example:basic.tsx -->
```tsx
import { useState } from 'react';
import { createSante } from '@trainto/sante';

export const { useSante, dispatch, getCached } = createSante({
  name: '',
  email: '',
  hobbies: [] as string[],
  tels: { mobile: '', work: '' },
});

export const dispatchMobile = (mobile: string) => {
  dispatch('tels', (prev) => ({ ...prev, mobile }));
};

export function Profile() {
  const { name, tels } = useSante(['name', 'tels']);
  const [newName, setNewName] = useState('');
  const [newNumber, setNewNumber] = useState('');

  return (
    <div>
      <p>
        {name}: {tels.mobile}
      </p>
      <input value={newName} onChange={(event) => setNewName(event.target.value)} />
      <button onClick={() => dispatch('name', newName)}>Apply name</button>
      <input value={newNumber} onChange={(event) => setNewNumber(event.target.value)} />
      <button onClick={() => dispatchMobile(newNumber)}>Apply mobile</button>
    </div>
  );
}

// Read state outside React:
getCached('name');
```

Functions can be stored as values too. For a function-valued top-level key, return the function from an updater: `dispatch('handler', () => nextHandler)`. Functions nested inside objects, such as modal callbacks, can be included in an ordinary object value.

## Updating several fields together

Use `dispatchMany(patch)` when related fields must change together. It replaces the specified top-level values and leaves other fields unchanged. All changed values are committed before subscribers are notified, and a callback subscribed to several changed keys is notified once.

<!-- example:dispatch-many.ts -->
```ts
import { createSante } from '@trainto/sante';

type State = {
  layer: { title: string } | null;
  crops: string[] | null;
  count: number;
};

const initialState: State = { layer: null, crops: null, count: 0 };
export const { dispatch, dispatchMany, getCached, useSante } = createSante(initialState);

export const closeEditor = () => dispatchMany({ layer: null, crops: null });

export const addCrop = (crop: string) =>
  dispatchMany((prev) => ({
    count: prev.count + 1,
    crops: [...(prev.crops ?? []), crop],
  }));
```

An updater receives a snapshot of the current full state and must synchronously return a plain patch object. Its top-level fields are readonly in TypeScript; nested objects and arrays still share references with live state. Keep the updater free of side effects: do not mutate that state or call `dispatch` / `dispatchMany` from it. Return new nested values instead. `dispatchMany` does not apply the configured Immer producer; use immutable updates even when the store enables `produce`.

Every patch key must exist in the initial state. Unknown keys, invalid patch results, and errors thrown while computing or reading the patch are rejected before any of its values are committed. This does not undo side effects performed by an updater or a getter. Empty patches and unchanged values do not notify subscribers. An explicit `undefined` clears a field that permits it; omitting a key leaves it unchanged. Function values in a patch are stored directly, for example `dispatchMany({ handler: nextHandler })`.

If persisted fields change, one complete persisted snapshot is written after notifying subscribers. Storage errors leave all committed live values intact. This guarantees a complete store update, rather than a particular number of React renders.

## Typing nullable values and empty arrays

Give nullable fields and empty arrays an explicit type. Otherwise TypeScript may infer only `null`, or an array that cannot accept any item. This is useful for state such as a signed-in user, an open modal, or a list loaded later.

<!-- example:nullable.ts -->
```ts
import { createSante } from '@trainto/sante';

type State = {
  user: { name: string } | null;
  hobbies: string[];
};

const initialState: State = { user: null, hobbies: [] };
export const userStore = createSante(initialState);

userStore.dispatch('user', { name: 'Joon' });
userStore.dispatch('hobbies', (prev) => [...prev, 'piano']);
userStore.dispatch('user', null);
```

Returning `null` from an updater is supported when the field allows it. If a field can become `undefined`, include `undefined` in its type and initialize the key explicitly.

## Using Immer

Install Immer separately:

```bash
npm install immer
```

Pass `produce` when creating the store. Updaters may then mutate a draft and return nothing, or return a replacement value such as `null`. Follow Immer's recipe rules: mutate the draft or return a replacement, rather than doing both in one recipe.

<!-- example:immer.tsx -->
```tsx
import { produce } from 'immer';
import { createSante } from '@trainto/sante';

const { useSante, dispatch } = createSante(
  { tels: { mobile: '', work: '' }, hobbies: [] as string[] },
  { produce },
);

export function Hobbies() {
  const { hobbies } = useSante('hobbies');
  return (
    <div>
      <p>{hobbies.join(', ')}</p>
      <button
        onClick={() =>
          dispatch('tels', (draft) => {
            draft.mobile = '+82.10.xxxx.xxxx';
          })
        }
      >
        Apply mobile
      </button>
      <button
        onClick={() =>
          dispatch('hobbies', (draft) => {
            draft.push('piano');
          })
        }
      >
        Add piano
      </button>
    </div>
  );
}
```

For `undefined`-valued state, use a direct replacement such as `dispatch('optional', undefined)`. In an Immer recipe, returning nothing means keeping the draft result.

## Saving state across reloads

Persistence restores saved fields when a store is created in the browser. Configure only the keys you want to save:

<!-- example:persistence.ts -->
```ts
import { createSante } from '@trainto/sante';

export const counterStore = createSante(
  { count: 0, draft: '' },
  {
    persist: {
      name: 'counter-store',
      key: ['count'], // Or 'ALL' to persist all string and numeric keys.
      storage: 'local', // Or 'session'.
      onError: (error) => console.error('Could not persist counter state:', error),
    },
  },
);
```

| Option | Meaning |
| --- | --- |
| `name` | Required stable name, unique to each independent store. |
| `key` | An array of top-level keys, or `'ALL'` for all string and numeric keys in the initial state. |
| `storage` | `'local'` (default) persists across browser sessions; `'session'` lasts for the tab's session. |
| `onError` | Optional callback for storage, JSON, or serialization failures. |
| `version` | Optional non-negative safe integer identifying the saved schema. Enables versioned storage. |
| `migrate` | Optional synchronous transformation from another schema version. Requires `version`. |
| `validate` | Optional synchronous type guard for the filtered restored partial state. |

The example saves `count` but leaves `draft` in memory. Data is stored at `sante-persistence:counter-store`. Give separate stores different names. Instances with the same name read the same saved entry on creation, but their live state is not synchronized.

Only configured keys are restored and written. Writes happen synchronously during `dispatch`; save small JSON-compatible data such as preferences, and leave React nodes, callbacks, transient modals, and large frequently changing values out of the persisted key list. Symbol keys are never persisted. JSON does not preserve values such as `undefined`, `NaN`, dates, functions, Maps, or Sets in their original form.

If storage is unavailable or the saved JSON is invalid, the store starts with its initial state. Write failures do not prevent live state updates. Synchronous errors thrown by `onError` are also ignored so a reporting failure cannot interrupt initialization or updates.

Without `validate`, restored values are not runtime type-validated. Use the options below when saved fields may change schema. The upgrade example later in this guide covers migration from the old shared entry used by 0.2.3.

## Versioning and validating saved state

Set `version` to identify the current schema, `migrate` to convert older data, and `validate` to check restored values. For example, this store accepts a finite numeric `count`; its migration supports schema 0 using either `counter` or `count`:

<!-- example:versioned-persistence.ts -->
```ts
import { createSante } from '@trainto/sante';

type CounterState = { count: number; draft: string };
type PersistedCounter = Pick<CounterState, 'count'>;

export function isPersistedCounter(data: unknown): data is Partial<PersistedCounter> {
  if (data === null || typeof data !== 'object' || Array.isArray(data)) return false;
  const saved = data as Record<string, unknown>;
  return (
    !Object.prototype.hasOwnProperty.call(saved, 'count') ||
    (typeof saved.count === 'number' && Number.isFinite(saved.count))
  );
}

export function migrateCounter(data: unknown, fromVersion: number): Partial<CounterState> {
  if (fromVersion !== 0 || data === null || typeof data !== 'object' || Array.isArray(data)) {
    throw new Error(`Unsupported counter schema: ${fromVersion}`);
  }
  const saved = data as Record<string, unknown>;
  const hasCount = Object.prototype.hasOwnProperty.call(saved, 'count');
  const hasCounter = Object.prototype.hasOwnProperty.call(saved, 'counter');
  if (!hasCount && !hasCounter) return {};
  // Schema 0 may use the old name "counter" or the existing name "count".
  const count = hasCount ? saved.count : saved.counter;
  if (typeof count !== 'number' || !Number.isFinite(count)) {
    throw new Error('Saved count must be a finite number.');
  }
  return { count };
}

const initialState: CounterState = { count: 0, draft: '' };
export const counterStore = createSante(initialState, {
  persist: {
    name: 'counter-store',
    key: ['count'],
    version: 1,
    migrate: migrateCounter,
    validate: isPersistedCounter,
    onError: (error) => console.error('Could not restore or save counter state:', error),
  },
});
```

Without `version`, the existing key `sante-persistence:counter-store` and raw JSON format stay unchanged, including when you add only `validate`. With `version`, data is stored at `sante-persistence-v1:counter-store` as `{ version, state }`. The `v1` prefix describes the encoding format; keep the same store name when increasing your schema version so the previous entry can be migrated.

If the versioned entry is absent, Sante reads the named raw entry as schema 0. `version: 0` can adopt it without migration; other versions require `migrate`. Versioned writes never modify or delete that raw entry. A present but invalid versioned entry does not fall back to the raw entry. The shared `sante-persistence` entry from 0.2.3 still needs the separate upgrade migration below.

If you later remove `version`, the store reads the raw entry again, which may contain an older snapshot. Keep versioning enabled after adopting it; changing the schema version and removing versioning are different operations.

Restoration follows this order: read the schema version, migrate if it differs, keep only initialized configured keys, validate that partial state, then combine it with initial values. Migration sees the full old data so it can rename removed keys; validation sees only the fields that will be restored. Missing top-level keys keep their initial values. Nested objects are replaced as whole values rather than deep-merged. Same-version data is validated too. If you roll back to an older app schema, `migrate` must explicitly support the newer saved version or reject it.

Both callbacks must be synchronous and free of external side effects. `migrate` returns a plain partial-state object; `validate` returns a boolean type guard. Promise/thenable results are rejected. Ordinary writes do not run these callbacks, and `validate` is not a general guard for `dispatch` values. Persist JSON-compatible data; JSON's limitations described above still apply.

Successful migration or raw schema-0 adoption writes the current complete persisted snapshot once. If that write fails, the valid restored live state remains available. A retry or another store creation can run the migration again, so do not rely on it executing only once globally. Normal same-version restoration does not write during initialization.

Read, version, migration, or validation failures report `onError` and use initial state without overwriting data during initialization. A later actual change to a persisted key saves current state and may replace the failed versioned entry. Unpersisted changes and unchanged values do not write. Storage failure does not roll back live state updates.

## Next.js and server rendering

Create a new store instance for request-specific state, and give the browser the same initial data used to render that request. A store factory keeps different requests independent:

<!-- example:ssr/store.ts -->
```ts
import { createSante } from '@trainto/sante';

export type CounterState = { count: number };

export function createCounterStore(initialState: CounterState) {
  return createSante(initialState);
}
```

In a Next.js Client Component, use a lazy `useState` initializer to keep that instance across renders:

<!-- example:ssr/Counter.tsx -->
```tsx
'use client';

import { useState } from 'react';
import { createCounterStore, type CounterState } from './store';

export function Counter({ initialState }: { initialState: CounterState }) {
  const [store] = useState(() => createCounterStore(initialState));
  const { count } = store.useSante('count');

  return (
    <button onClick={() => store.dispatch('count', (prev) => prev + 1)}>Count: {count}</button>
  );
}
```

A Server Component can render `<Counter initialState={{ count: 0 }} />`; replace `0` with the data for that request. If several children need the same instance, pass it down or share it through React context.

Avoid recreating a store every render or sharing one mutable server store between users. Supply the desired server state through `initialState`; server rendering and the first hydration snapshot use that initial value. After hydration, the hook renders the current browser state, including any restored persistence. Browser storage is not accessed on the server.

If the `initialState` prop changes later, the existing store remains in place. Dispatch the new values explicitly, or remount the component with a new key when you want a fresh store.

If the factory also enables persistence, the name identifies durable browser state, not a server request. Use a stable name for the intended store, user, or widget and keep it consistent across reloads; random request IDs would prevent restoring earlier data. Independent widgets or different accounts sharing one browser should use distinct names. Server requests do not share browser storage, while browser instances with the same name read the same saved entry. Pass one store instance to children when they should share live state.

## Upgrading from 0.3.0

0.4.0 adds `useSante(key, selector)`, `dispatchMany`, and the `version`, `migrate`, and `validate` persistence options. Existing calls without these options retain their behavior; named persistence keeps its existing storage key and format unless you enable `version`. Selectors compare results with `Object.is`, as explained above.

A dependency range of `^0.3.0` does not automatically accept `0.4.0`. Update explicitly:

```bash
npm install @trainto/sante@^0.4.0
# or
pnpm add @trainto/sante@^0.4.0
```

## Upgrading from 0.2.3

0.3.0 includes compatibility changes. Valid existing calls to `createSante(initialState)`, `useSante(key)`, `dispatch(key, valueOrReturningUpdater)`, and `getCached(key)` keep the same API. Ordinary stores do not need a `name`; it is required only when enabling persistence.

The release fixes subscriptions when selected keys change, uses `Object.is` to detect state changes, isolates persisted stores by name, and uses the initial state for server rendering and the first hydration snapshot. It also supplies separate TypeScript declarations for ESM and CommonJS consumers. Review the checks below before upgrading an existing app.

| Existing behavior | What to check when upgrading |
| --- | --- |
| `persist: { key: [...] }` | Add a stable `name`. Migrate saved data before creating the named store if you need to retain it. |
| Persistence restored every saved field | Only configured keys from the initial state are restored. Add any required fields to `persist.key`. |
| Mutation-only updater without `produce` | Return a new value, or supply Immer's `produce`. |
| Optional key absent from initial state | Initialize it explicitly, for example with `undefined`. Direct dispatch no longer creates missing keys. |
| TypeScript older than 5.4 | Upgrade TypeScript before using the new declarations. |
| State dispatched before server rendering | Pass the desired request state as `initialState` and reuse that initial data for browser hydration. |
| Persistence writes deferred with a timer | Writes now happen during `dispatch`, and only changed persisted keys trigger a write. |

A dependency range of `^0.2.3` does not automatically accept `0.4.0`. Apply the compatibility checks above and update explicitly:

```bash
pnpm add @trainto/sante@^0.4.0
```

### Retaining old saved state

0.2.3 used one shared entry, `sante-persistence`, for every persisted store. The new named store does not automatically read it because its fields may belong to unrelated stores.

This example validates and copies an old numeric `count` into the new entry before creating the store. Adjust the field checks and target name for your own schema. It does not overwrite existing named data or remove the shared entry that other old stores may still use.

<!-- example:migration.ts -->
```ts
import { createSante } from '@trainto/sante';

function migrateCounterPersistence() {
  if (typeof window === 'undefined') return;
  try {
    const target = 'sante-persistence:counter-store';
    if (window.localStorage.getItem(target) !== null) return;
    const legacy = window.localStorage.getItem('sante-persistence');
    if (legacy === null) return;

    const saved: unknown = JSON.parse(legacy);
    if (
      saved !== null &&
      typeof saved === 'object' &&
      'count' in saved &&
      typeof saved.count === 'number' &&
      Number.isFinite(saved.count)
    ) {
      window.localStorage.setItem(target, JSON.stringify({ count: saved.count }));
    }
  } catch {
    // Continue with initial state if storage or old data cannot be read.
  }
}

// Migrate before creating the named store. Keep the shared legacy entry,
// since other stores may still use it.
migrateCounterPersistence();
export const counterStore = createSante(
  { count: 0 },
  { persist: { name: 'counter-store', key: ['count'] } },
);
```

## API reference

| API | Behavior |
| --- | --- |
| `createSante(initialState, options?)` | Creates independent state and returns `useSante`, `dispatch`, `dispatchMany`, and `getCached`. Options are `produce` and `persist`. |
| `useSante(keyOrKeys)` | React hook returning an object with exactly those fields. Accepts a single key or a readonly array. |
| `useSante(key, selector)` | React hook subscribing to one key and returning the selector result directly. Store-driven renders are skipped when the result is `Object.is` equal. |
| `dispatch(key, value)` | Replaces one field and synchronously notifies subscribers if its value changed. |
| `dispatch(key, updater)` | Receives the current field value. Return its next value; with `produce`, a mutation-only recipe is also allowed. |
| `dispatchMany(patchOrUpdater)` | Atomically replaces specified top-level fields. An updater receives current full state and returns a partial patch; Immer recipes are not applied. |
| `getCached(key)` | Reads the current field value without subscribing. Returns `undefined` if the key is missing. |

The package has separate ESM and CommonJS declarations for NodeNext and bundler TypeScript resolution. NodeNext ESM projects also need explicit `.js` extensions in their own relative imports.

## Development

CI uses Node.js 22 and pnpm 9.15.9.

```bash
pnpm install
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm check:package
```

README code examples are kept in `docs/`, included in type checking, and checked for synchronization by the tests. Package checks load the built ESM and CommonJS artifacts from an isolated consumer and verify NodeNext and bundler TypeScript resolution.
