# Sante

A tiny React state-management library. Create a store, subscribe to top-level keys, and update those keys from components or ordinary functions.

Sante(상태) means state in Korean. Supports React 18 and later, TypeScript 5.4 and later, and both ESM and CommonJS packages.

This guide describes the **0.3.0 API**. Check the version available on npm with `npm view @trainto/sante version`, or the version installed in your app with `npm ls @trainto/sante` (`pnpm list @trainto/sante` for pnpm). If you use 0.2.3, read the upgrade guide before updating.

- Subscribe to the top-level fields each component needs.
- Update and read state outside React without a provider.
- Use immutable updates, or opt into Immer for draft updates.
- Persist selected fields in local or session storage.

- [Quick start](#quick-start)
- [Reading state](#reading-state)
- [Updating objects and arrays](#updating-objects-and-arrays)
- [Typing nullable values and empty arrays](#typing-nullable-values-and-empty-arrays)
- [Using Immer](#using-immer)
- [Saving state across reloads](#saving-state-across-reloads)
- [Next.js and server rendering](#nextjs-and-server-rendering)
- [Upgrading from 0.2.3](#upgrading-from-023)
- [API reference](#api-reference)
- [Development](#development)
- [Publishing to npm](#publishing-to-npm)

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

export const { useSante, dispatch, getCached } = createSante({ count: 0 });

export const increment = () => dispatch('count', (prev) => prev + 1);
```

Then use it from `src/Counter.tsx`:

<!-- example:quickstart/Counter.tsx -->
```tsx
'use client';

import { increment, useSante } from './store';

export function Counter() {
  const { count } = useSante('count');
  return <button onClick={increment}>Count: {count}</button>;
}
```

Render `<Counter />` in your app. Clicking the button updates `count`; all components subscribed to that key see the new value.

`useSante('count')` returns `{ count }`, so destructure the result. The `'use client'` directive is useful in Next.js and harmless in a normal React app. For request-specific server data, use the store factory pattern below.

## Reading state

- Read one key with `const { name } = useSante('name')`.
- Read several keys with `const { name, tels } = useSante(['name', 'tels'])`. Inline arrays work; you do not need to memoize them.
- Call `useSante` at the top level of a React component or custom hook.
- Use `getCached('name')` in event handlers, API helpers, or other ordinary functions. It reads the current value immediately and does not subscribe or cause a render.

The hook returns exactly the selected fields, including when the selection changes. Components subscribe to top-level keys: subscribe to `tels` to observe `tels.mobile`; a dotted key such as `'tels.mobile'` is not a supported selector. Parent renders and local React state can still cause a component to render.

Every key must be present in `initialState`, even if its value is `undefined`. `useSante` and `dispatch` throw for missing keys; `getCached` returns `undefined` for a missing key.

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

The example saves `count` but leaves `draft` in memory. Data is stored at `sante-persistence:counter-store`. Give separate stores different names. Instances with the same name read the same saved entry on creation, but their live state is not synchronized.

Only configured keys are restored and written. Writes happen synchronously during `dispatch`; save small JSON-compatible data such as preferences, and leave React nodes, callbacks, transient modals, and large frequently changing values out of the persisted key list. Symbol keys are never persisted. JSON does not preserve values such as `undefined`, `NaN`, dates, functions, Maps, or Sets in their original form.

If storage is unavailable or the saved JSON is invalid, the store starts with its initial state. Write failures do not prevent live state updates. Synchronous errors thrown by `onError` are also ignored so a reporting failure cannot interrupt initialization or updates.

Restored values are not runtime type-validated. If you change a saved field's schema, validate and migrate the old data yourself or choose a new store name. See the upgrade example below for a validated migration.

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

A dependency range of `^0.2.3` does not automatically accept `0.3.0`. After the release, update explicitly:

```bash
pnpm add @trainto/sante@^0.3.0
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
| `createSante(initialState, options?)` | Creates independent state and returns `useSante`, `dispatch`, and `getCached`. Options are `produce` and `persist`. |
| `useSante(keyOrKeys)` | React hook returning an object with exactly those fields. Accepts a single key or a readonly array. |
| `dispatch(key, value)` | Replaces one field and synchronously notifies subscribers if its value changed. |
| `dispatch(key, updater)` | Receives the current field value. Return its next value; with `produce`, a mutation-only recipe is also allowed. |
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

## Publishing to npm

For maintainers publishing a release:

1. Start from the reviewed release commit with a clean working tree. Confirm that `package.json` contains the intended version, update this guide when the API changes, and check that the version has not already been published with `npm view @trainto/sante versions --json`. npm versions cannot be overwritten. If a version bump is needed, use `npm version patch --no-git-tag-version` (or `minor` / `major` for the chosen release), then review and commit that change before publishing.
2. Install dependencies with `pnpm install --frozen-lockfile`, then run the checks from the Development section. Build before packaging so that `dist/` contains the release artifacts.
3. Confirm the npm account and inspect the package contents:

   ```bash
   npm whoami --registry https://registry.npmjs.org/
   npm pack --dry-run
   ```

   The package should contain `README.md`, `package.json`, and the four built files in `dist/`. Review this output before publishing.

4. Publish the verified checkout:

   ```bash
   npm publish --access public --tag latest --registry https://registry.npmjs.org/
   ```

   npm may require additional authentication even after `npm login`. If it reports that two-factor authentication is required, follow npm's [2FA setup guide](https://docs.npmjs.com/configuring-two-factor-authentication) for your account and complete the authentication requested during publication.

5. Verify the released version and default install tag:

   ```bash
   npm view @trainto/sante version
   npm view @trainto/sante dist-tags --json
   ```

The [npm package page](https://www.npmjs.com/package/@trainto/sante) gets its README from the published package. A README commit on GitHub alone does not update that page; include the updated README when publishing a new version. If the intended version is already published, choose a new version first.

The existing `pnpm run deploy` shortcut builds and publishes, but it does not run all the checks above. Use `pnpm run deploy` with the explicit `run`: newer pnpm versions also have a separate built-in `deploy` command.
