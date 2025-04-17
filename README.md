# Sante

A tiny and simple state-management for React.

```bash
npm install @trainto/sante
```

## First create a store
```ts
import { createSante } from '@trainto/sante';

type Store = {
  name: string;
  email: string;
  hobbies: string[];
  tels: {
    mobile: string;
    work: string;
  }
};

const { useSante, dispatch } = createSante<Store>();

const dispatchMobile = (mobile: string) => {
  dispatch((prev) => {
    if (prev == null) {
      return { mobile, work: '' };
    }

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
      <div> - mobile: {tels?.mobile}</div>
      <div> - work: {tels?.work}</div>

      ...
      ...
      <button onClick={() => dispatch('name', newName)}>Apply</button>
      <button onClick={() => dispatchMobile(newNumber)}>Apply</button>
    </div>
  );
};
```