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
