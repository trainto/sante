export type PersistenceOptions<T> = {
  name: string;
  storage?: 'local' | 'session';
  onError?: (error: unknown) => void;
  validate?: (candidate: unknown) => candidate is Partial<NoInfer<T>>;
} & (
  | { version?: undefined; migrate?: never }
  | { version: number; migrate?: (saved: unknown, fromVersion: number) => Partial<NoInfer<T>> }
);

function requireRecord(value: unknown): asserts value is Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Persisted state must be a JSON object.');
  }
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) {
    throw new Error('Persisted state must be a plain object.');
  }
}

function requireSynchronous(value: unknown) {
  if (
    value !== null &&
    (typeof value === 'object' || typeof value === 'function') &&
    typeof (value as { then?: unknown }).then === 'function'
  ) {
    // Consume an unsupported promise's rejection without using its result.
    void Promise.resolve(value).catch(() => {});
    throw new Error('Persistence callbacks must be synchronous.');
  }
}

export default function Persistence<T>(
  { name, storage = 'local', onError, version, migrate, validate }: PersistenceOptions<T>,
  keys: readonly (keyof T)[],
) {
  if (typeof name !== 'string' || name.trim() === '') {
    throw new Error('Persistence requires a non-empty store name.');
  }
  if (version !== undefined && (!Number.isSafeInteger(version) || version < 0)) {
    throw new Error('Persistence version must be a non-negative safe integer.');
  }
  if (migrate !== undefined && (version === undefined || typeof migrate !== 'function')) {
    throw new Error('Persistence migrate requires an explicit version and a function.');
  }
  if (validate !== undefined && typeof validate !== 'function') {
    throw new Error('Persistence validate must be a function.');
  }
  const legacyKey = `sante-persistence:${name}`;
  const storageKey = version === undefined ? legacyKey : `sante-persistence-v1:${name}`;

  const reportError = (error: unknown) => {
    try {
      onError?.(error);
    } catch {
      // Error reporting must not prevent restoring or updating live state.
    }
  };

  const loadState = (): { state: Partial<T>; needsRewrite: boolean } => {
    const empty = { state: {}, needsRewrite: false };
    if (typeof window === 'undefined') return empty;
    try {
      const browserStorage = window[`${storage}Storage`];
      let storedValue = browserStorage.getItem(storageKey);
      let legacy = false;
      if (storedValue === null && version !== undefined) {
        storedValue = browserStorage.getItem(legacyKey);
        legacy = true;
      }
      if (storedValue === null) return empty;
      let state: unknown = JSON.parse(storedValue);
      let needsRewrite = false;
      if (version !== undefined) {
        requireRecord(state);
        let storedVersion = 0;
        if (!legacy) {
          if (
            !Object.prototype.hasOwnProperty.call(state, 'version') ||
            !Object.prototype.hasOwnProperty.call(state, 'state') ||
            typeof state.version !== 'number' ||
            !Number.isSafeInteger(state.version) ||
            state.version < 0
          ) {
            throw new Error('Persisted version envelope is invalid.');
          }
          storedVersion = state.version;
          state = state.state;
        }
        needsRewrite = legacy;
        if (storedVersion !== version) {
          if (!migrate) {
            throw new Error(
              `Persisted version ${storedVersion} does not match ${version}; provide migrate.`,
            );
          }
          state = migrate(state, storedVersion);
          requireSynchronous(state);
          needsRewrite = true;
        }
      }
      requireRecord(state);
      const record = state;
      const candidate = Object.fromEntries(
        keys
          .filter(
            (key) => typeof key !== 'symbol' && Object.prototype.hasOwnProperty.call(record, key),
          )
          .map((key) => [key, record[key as string]]),
      ) as Partial<T>;
      if (validate) {
        const valid = validate(candidate);
        requireSynchronous(valid);
        // A type guard must return a real boolean, not an accidentally truthy value.
        if (valid !== true) throw new Error('Persisted state failed validation.');
      }
      return { state: candidate, needsRewrite };
    } catch (error) {
      reportError(error);
      return empty;
    }
  };

  const saveState = (state: Record<string, unknown>) => {
    if (typeof window === 'undefined') return;
    try {
      window[`${storage}Storage`].setItem(
        storageKey,
        JSON.stringify(version === undefined ? state : { version, state }),
      );
    } catch (error) {
      reportError(error);
    }
  };

  return { loadState, saveState };
}
