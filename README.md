# Sante

A tiny and simple state-management library for React 18 and later.

TypeScript consumers need TypeScript 5.4 or later.

Sante(상태) means state in Korean.

```bash
npm install @trainto/sante
```

## Create and use a store

Select one key or a readonly array of keys. `useSante` always returns an object containing exactly the selected fields. Components subscribe only to those fields.

Without `produce`, an updater must return the next state. Treat existing objects and arrays as immutable.

Every selected or dispatched key must exist in `initialState`; initialize optional values with `undefined`. To store a function, return it from an updater: `dispatch('handler', () => nextHandler)`.

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

## With Immer

Install Immer separately: `npm install immer`. Supplying `produce` allows updaters to mutate a draft and return nothing, or return a replacement value, including `null`.

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

## Persistence

Give every independent store a unique, stable `name`. Stores using the same name intentionally share saved data on reload; live instances are not synchronized. Only declared persisted keys are restored and saved. Writes are synchronous, and storage or serialization failures leave the live state usable. `onError` optionally reports those failures.

Persist JSON-compatible values. JSON does not preserve values such as `undefined`, `NaN`, dates, functions, or symbols; symbol keys are never persisted. Restored values are not runtime type-validated, so use a new store name when changing an incompatible state schema.

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

### Upgrading persistence from 0.2.3

`persist.name` is now required. Data is stored under `sante-persistence:<name>`. The previous shared `sante-persistence` entry is not automatically loaded because it may contain data from unrelated stores. To migrate existing data, explicitly validate and copy the relevant fields to the new entry before creating the store.

## Server rendering

Create a store for each server request and initialize it with that request's state. Pass the same initial state to the browser. Do not share a module-level server store between users or change the initial state before hydration.

Server rendering and the first hydration snapshot use `initialState`. After hydration, components render the current browser state, including any restored persistence. Browser storage is never accessed when `window` is unavailable.

## Development

```bash
pnpm install
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

README examples are checked against the files in `docs/`, which are included in type checking.
