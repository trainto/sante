export type PersistenceOptions = {
  name: string;
  storage?: 'local' | 'session';
  onError?: (error: unknown) => void;
};

export default function Persistence({ name, storage = 'local', onError }: PersistenceOptions) {
  if (typeof name !== 'string' || name.trim() === '') {
    throw new Error('Persistence requires a non-empty store name.');
  }
  const storageKey = `sante-persistence:${name}`;

  const loadState = (): Record<string, unknown> => {
    if (typeof window === 'undefined') return {};
    try {
      const storedValue = window[`${storage}Storage`].getItem(storageKey);
      if (storedValue === null) return {};
      const parsedValue: unknown = JSON.parse(storedValue);
      if (parsedValue === null || typeof parsedValue !== 'object' || Array.isArray(parsedValue)) {
        throw new Error('Persisted state must be a JSON object.');
      }
      return parsedValue as Record<string, unknown>;
    } catch (error) {
      onError?.(error);
      return {};
    }
  };

  const saveState = (state: Record<string, unknown>) => {
    if (typeof window === 'undefined') return;
    try {
      window[`${storage}Storage`].setItem(storageKey, JSON.stringify(state));
    } catch (error) {
      onError?.(error);
    }
  };

  return { loadState, saveState };
}
