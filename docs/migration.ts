import { createSante } from '@trainto/sante';

function migrateCounterPersistence() {
  if (typeof window === 'undefined') return;
  try {
    const target = 'sante-persistence:counter-store';
    if (window.localStorage.getItem(target) !== null) return;
    const legacy = window.localStorage.getItem('sante-persistence');
    if (legacy === null) return;

    const saved: unknown = JSON.parse(legacy);
    if (
      saved !== null &&
      typeof saved === 'object' &&
      'count' in saved &&
      typeof saved.count === 'number' &&
      Number.isFinite(saved.count)
    ) {
      window.localStorage.setItem(target, JSON.stringify({ count: saved.count }));
    }
  } catch {
    // Continue with initial state if storage or old data cannot be read.
  }
}

// Migrate before creating the named store. Keep the shared legacy entry,
// since other stores may still use it.
migrateCounterPersistence();
export const counterStore = createSante(
  { count: 0 },
  { persist: { name: 'counter-store', key: ['count'] } },
);
