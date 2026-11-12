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
