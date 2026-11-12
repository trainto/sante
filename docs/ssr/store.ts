import { createSante } from '@trainto/sante';

export type CounterState = { count: number };

export function createCounterStore(initialState: CounterState) {
  return createSante(initialState);
}
