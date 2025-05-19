import { createSante } from '../src';
import { produce } from 'immer';

const initialState = {
  user: {
    name: '',
    email: '',
  },
  counter: 0,
  todos: [] as { id: number; title: string; completed: boolean }[],
};

const { useSante, dispatch } = createSante(initialState, {
  produce,
  persist: { key: ['counter'] },
});

export { useSante, dispatch };
