# Sante

A tiny and simple state-management for React.

Sante(상태) - means state in Korean.

```bash
npm install @trainto/sante
```

## First create a store
```ts
import { createSante } from '@trainto/sante';

const initial = {
  name: '';
  email: '';
  hobbies: [] as string[];
  tels: {
    mobile: '';
    work: '';
  }
};

const { useSante, dispatch } = createSante(initial);

const dispatchMobile = (mobile: string) => {
  dispatch((prev) => {
    return { ...prev, mobile };
  });
};

export { useSaten, disaptch, dispatchMobile };
```

## In your React component
```tsx
const Component = () => {
  const { name, tels } = useSante(['name', 'tels']);

  return (
    <div>
      <div>Name: {name}</div>
      <div>tels:</div>
      <div> - mobile: {tels.mobile}</div>
      <div> - work: {tels.work}</div>

      // ...
      // ...

      <button onClick={() => dispatch('name', newName)}>Apply</button>
      <button onClick={() => dispatchMobile(newNumber)}>Apply</button>
    </div>
  );
};
```

## With Immer
If you feel tired of working with nested states, then Immer!
```tsx
import { createSante } from '@trainto/sante';
import { produce } from 'immer';

const initial = {
  name: '';
  email: '';
  hobbies: [] as string[];
  tels: {
    mobile: '';
    work: '';
  }
};

const { useSante, dispatch } = createSante(initial, { produce });
export { useSante, dispatch };


// dispatching
const Component = () => {
  const { tels, hobbies } = useSante(['tels', 'hobbies']);

  return (
    <div>
      // ...
      // ...

      <button onClick={
        () => dispatch('tels', (prev) => { prev.mobile = '+82.10.xxxx.xxxx'; })
      }>
        Apply
      </button>
      <button onClick={() => dispatch('hobbies', (prev) => { prev.push('piano'); })}>
        Apply
      </button>
    </div>
  );
};
```

## Directly access to cache
```ts
import { createSante } from '@trainto/sante';

const initial = {
  name: '';
  email: '';
};

const { useSante, dispatch, getCached } = createSante(initial);
export { useSante, dispatch, getCached };

// getCached can be called from anywhere
getCached('name');
```