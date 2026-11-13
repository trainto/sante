'use client';

import { increment, useSante } from './store';

export function Counter() {
  const { count, label } = useSante(['count', 'label']);
  return (
    <button onClick={increment}>
      {label}: {count}
    </button>
  );
}
