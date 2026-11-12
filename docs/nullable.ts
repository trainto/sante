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
