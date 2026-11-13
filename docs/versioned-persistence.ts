import { createSante } from '@trainto/sante';

type CounterState = { count: number; draft: string };
type PersistedCounter = Pick<CounterState, 'count'>;

export function isPersistedCounter(data: unknown): data is Partial<PersistedCounter> {
  if (data === null || typeof data !== 'object' || Array.isArray(data)) return false;
  const saved = data as Record<string, unknown>;
  return (
    !Object.prototype.hasOwnProperty.call(saved, 'count') ||
    (typeof saved.count === 'number' && Number.isFinite(saved.count))
  );
}

export function migrateCounter(data: unknown, fromVersion: number): Partial<CounterState> {
  if (fromVersion !== 0 || data === null || typeof data !== 'object' || Array.isArray(data)) {
    throw new Error(`Unsupported counter schema: ${fromVersion}`);
  }
  const saved = data as Record<string, unknown>;
  const hasCount = Object.prototype.hasOwnProperty.call(saved, 'count');
  const hasCounter = Object.prototype.hasOwnProperty.call(saved, 'counter');
  if (!hasCount && !hasCounter) return {};
  // Schema 0 may use the old name "counter" or the existing name "count".
  const count = hasCount ? saved.count : saved.counter;
  if (typeof count !== 'number' || !Number.isFinite(count)) {
    throw new Error('Saved count must be a finite number.');
  }
  return { count };
}

const initialState: CounterState = { count: 0, draft: '' };
export const counterStore = createSante(initialState, {
  persist: {
    name: 'counter-store',
    key: ['count'],
    version: 1,
    migrate: migrateCounter,
    validate: isPersistedCounter,
    onError: (error) => console.error('Could not restore or save counter state:', error),
  },
});
