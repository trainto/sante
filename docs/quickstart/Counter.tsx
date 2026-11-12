'use client';

import { increment, useSante } from './store';

export function Counter() {
  const { count } = useSante('count');
  return <button onClick={increment}>Count: {count}</button>;
}
