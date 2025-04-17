import { createSante } from '../src';

type Store = {
  user: {
    name: string;
    email: string;
  };
  counter: number;
  todos: {
    id: number;
    title: string;
    completed: boolean;
  }[];
};

const { useSante, dispatch } = createSante<Store>();

export { useSante, dispatch };
