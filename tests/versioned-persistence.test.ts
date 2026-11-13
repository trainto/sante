import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createSante, type SanteOptions } from '../src';

type State = { count: number; name: string };
const initialState: State = { count: 0, name: 'initial' };
const legacyKey = 'sante-persistence:versioned-test';
const versionedKey = 'sante-persistence-v1:versioned-test';

function validateCounter(candidate: unknown): candidate is Partial<Pick<State, 'count'>> {
  return (
    candidate !== null &&
    typeof candidate === 'object' &&
    !Array.isArray(candidate) &&
    (!Object.prototype.hasOwnProperty.call(candidate, 'count') ||
      (typeof (candidate as { count: unknown }).count === 'number' &&
        Number.isFinite((candidate as { count: number }).count)))
  );
}

function seed(version: unknown, state: unknown) {
  localStorage.setItem(versionedKey, JSON.stringify({ version, state }));
}

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
});
afterEach(() => vi.unstubAllGlobals());

describe('versioned persistence', () => {
  it('checks same-version field types only when an explicit validator is provided', () => {
    seed(1, { count: 'invalid' });
    const unvalidated = createSante(initialState, {
      persist: { name: 'versioned-test', key: ['count'], version: 1 },
    });
    expect(unvalidated.getCached('count')).toBe('invalid');
    const onError = vi.fn();
    const validated = createSante(initialState, {
      persist: {
        name: 'versioned-test',
        key: ['count'],
        version: 1,
        validate: validateCounter,
        onError,
      },
    });
    expect(validated.getCached('count')).toBe(0);
    expect(onError).toHaveBeenCalledTimes(1);
    expect(JSON.parse(localStorage.getItem(versionedKey)!)).toEqual({
      version: 1,
      state: { count: 'invalid' },
    });
  });

  it('validates same-version filtered state without rewriting it or filling defaults first', () => {
    seed(1, { count: 42, name: 'foreign', extra: true });
    const validation = vi.fn();
    const write = vi.spyOn(Storage.prototype, 'setItem');
    const store = createSante(initialState, {
      persist: {
        name: 'versioned-test',
        key: ['count'],
        version: 1,
        validate: (candidate): candidate is Partial<State> => {
          validation(candidate);
          return validateCounter(candidate);
        },
      },
    });
    expect(validation).toHaveBeenCalledWith({ count: 42 });
    expect(store.getCached('count')).toBe(42);
    expect(store.getCached('name')).toBe('initial');
    expect(write).not.toHaveBeenCalled();
  });

  it('migrates the full old state before filtering and rewrites once with current defaults', () => {
    seed(0, { counter: 42, retired: true });
    const migrate = vi.fn((saved: unknown, fromVersion: number) => {
      expect(fromVersion).toBe(0);
      return { count: (saved as { counter: number }).counter, foreign: true };
    });
    const write = vi.spyOn(Storage.prototype, 'setItem');
    const options: SanteOptions<State> = {
      persist: { name: 'versioned-test', key: 'ALL', version: 1, migrate },
    };
    const store = createSante(initialState, options);
    expect(migrate).toHaveBeenCalledWith({ counter: 42, retired: true }, 0);
    expect(store.getCached('count')).toBe(42);
    expect(write).toHaveBeenCalledTimes(1);
    expect(write).toHaveBeenCalledWith(
      versionedKey,
      JSON.stringify({ version: 1, state: { count: 42, name: 'initial' } }),
    );
    createSante(initialState, options);
    expect(migrate).toHaveBeenCalledTimes(1);
    expect(write).toHaveBeenCalledTimes(1);
  });

  it('keeps raw metadata-looking user fields unambiguous during version-0 adoption', () => {
    const raw = JSON.stringify({ version: 99, state: { count: 42 }, count: 7 });
    localStorage.setItem(legacyKey, raw);
    const defaults = { version: 0, state: { count: 0 }, count: 0 };
    const unversioned = createSante(defaults, { persist: { name: 'versioned-test', key: 'ALL' } });
    expect(unversioned.getCached('version')).toBe(99);
    expect(unversioned.getCached('state')).toEqual({ count: 42 });
    const versioned = createSante(defaults, {
      persist: { name: 'versioned-test', key: 'ALL', version: 0 },
    });
    expect(versioned.getCached('version')).toBe(99);
    expect(JSON.parse(localStorage.getItem(versionedKey)!)).toEqual({
      version: 0,
      state: JSON.parse(raw),
    });
    expect(localStorage.getItem(legacyKey)).toBe(raw);
  });

  it('migrates named legacy data without changing it on initialization or later writes', () => {
    const raw = '{"counter":42,"foreign":true}';
    localStorage.setItem(legacyKey, raw);
    const migrate = vi.fn((saved: unknown) => ({ count: (saved as { counter: number }).counter }));
    const store = createSante(initialState, {
      persist: { name: 'versioned-test', key: ['count'], version: 1, migrate },
    });
    expect(migrate).toHaveBeenCalledWith({ counter: 42, foreign: true }, 0);
    expect(store.getCached('count')).toBe(42);
    store.dispatch('count', 43);
    expect(localStorage.getItem(legacyKey)).toBe(raw);
    expect(JSON.parse(localStorage.getItem(versionedKey)!)).toEqual({
      version: 1,
      state: { count: 43 },
    });
    expect(
      createSante(initialState, { persist: { name: 'versioned-test', key: ['count'] } }).getCached(
        'count',
      ),
    ).toBe(0);
  });

  it('skips migrate for schema-0 adoption and reads only the new entry on later creation', () => {
    localStorage.setItem(legacyKey, '{"count":42}');
    const migrate = vi.fn(() => ({ count: 99 }));
    const options: SanteOptions<State> = {
      persist: { name: 'versioned-test', key: ['count'], version: 0, migrate },
    };
    const first = createSante(initialState, options);
    expect(first.getCached('count')).toBe(42);
    expect(migrate).not.toHaveBeenCalled();
    // An old-format consumer may keep updating its independent legacy entry.
    localStorage.setItem(legacyKey, '{"count":7}');
    const read = vi.spyOn(Storage.prototype, 'getItem');
    const second = createSante(initialState, options);
    expect(second.getCached('count')).toBe(42);
    expect(read).toHaveBeenCalledTimes(1);
    expect(read).toHaveBeenCalledWith(versionedKey);
    expect(migrate).not.toHaveBeenCalled();
  });

  it('handles getItem throwing without rewriting and can save after a later persisted change', () => {
    const onError = vi.fn();
    const read = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('SecurityError');
    });
    const write = vi.spyOn(Storage.prototype, 'setItem');
    const store = createSante(initialState, {
      persist: { name: 'versioned-test', key: ['count'], version: 1, onError },
    });
    expect(store.getCached('count')).toBe(0);
    expect(read).toHaveBeenCalledTimes(1);
    expect(onError).toHaveBeenCalledTimes(1);
    expect(write).not.toHaveBeenCalled();
    read.mockRestore();
    store.dispatch('count', 7);
    expect(write).toHaveBeenCalledTimes(1);
    expect(JSON.parse(localStorage.getItem(versionedKey)!)).toEqual({
      version: 1,
      state: { count: 7 },
    });
  });

  it('starts missing data with initial state without calling migrate, validate, or writing', () => {
    const migrate = vi.fn(() => ({ count: 1 }));
    const validation = vi.fn();
    const write = vi.spyOn(Storage.prototype, 'setItem');
    const store = createSante(initialState, {
      persist: {
        name: 'versioned-test',
        key: 'ALL',
        version: 1,
        migrate,
        validate: (candidate): candidate is Partial<State> => {
          validation(candidate);
          return true;
        },
      },
    });
    expect(store.getCached('count')).toBe(0);
    expect(migrate).not.toHaveBeenCalled();
    expect(validation).not.toHaveBeenCalled();
    expect(write).not.toHaveBeenCalled();
  });

  it('keeps missing top-level defaults and replaces nested values without deep merging', () => {
    seed(1, { user: { name: 'saved' } });
    const store = createSante(
      { user: { name: 'initial', email: 'initial' }, count: 0 },
      {
        persist: { name: 'versioned-test', key: 'ALL', version: 1 },
      },
    );
    expect(store.getCached('user')).toEqual({ name: 'saved' });
    expect(store.getCached('count')).toBe(0);
  });

  it('preserves numeric and own __proto__ fields while excluding symbols and foreign keys', () => {
    const symbol = Symbol('memory');
    const foreign = '{"version":1,"state":{"1":42,"__proto__":{"polluted":true},"foreign":true}}';
    localStorage.setItem(versionedKey, foreign);
    const store = createSante(
      { 1: 0, ['__proto__']: { polluted: false }, [symbol]: 0 },
      {
        persist: { name: 'versioned-test', key: 'ALL', version: 1 },
      },
    );
    expect(store.getCached(1)).toBe(42);
    expect(store.getCached('__proto__')).toEqual({ polluted: true });
    expect(Object.prototype).not.toHaveProperty('polluted');
    store.dispatchMany({ 1: 43, [symbol]: 1 });
    expect(JSON.parse(localStorage.getItem(versionedKey)!)).toEqual({
      version: 1,
      state: { 1: 43, ['__proto__']: { polluted: true } },
    });
    const ordinary = createSante(
      { 1: 0 },
      { persist: { name: 'versioned-test', key: 'ALL', version: 1 } },
    );
    expect(ordinary.getCached(1)).toBe(43);
  });

  it('stores only in the configured session storage and writes multi-key changes once', () => {
    sessionStorage.setItem(legacyKey, '{"count":7}');
    const store = createSante(initialState, {
      persist: { name: 'versioned-test', key: 'ALL', version: 0, storage: 'session' },
    });
    const write = vi.spyOn(Storage.prototype, 'setItem');
    store.dispatchMany({ count: 8, name: 'next' });
    expect(write).toHaveBeenCalledTimes(1);
    expect(JSON.parse(sessionStorage.getItem(versionedKey)!)).toEqual({
      version: 0,
      state: { count: 8, name: 'next' },
    });
    expect(sessionStorage.getItem(legacyKey)).toBe('{"count":7}');
    expect(localStorage.getItem(versionedKey)).toBeNull();
  });

  it.each([0, 2])(
    'rejects schema %s without migrate, but saves on the next persisted change',
    (fromVersion) => {
      seed(fromVersion, { count: 42 });
      const original = localStorage.getItem(versionedKey);
      const onError = vi.fn();
      const write = vi.spyOn(Storage.prototype, 'setItem');
      const store = createSante(initialState, {
        persist: { name: 'versioned-test', key: ['count'], version: 1, onError },
      });
      expect(store.getCached('count')).toBe(0);
      expect(onError).toHaveBeenCalledTimes(1);
      expect(localStorage.getItem(versionedKey)).toBe(original);
      store.dispatch('name', 'next');
      store.dispatch('count', 0);
      expect(write).not.toHaveBeenCalled();
      store.dispatchMany({ count: 7, name: 'latest' });
      expect(write).toHaveBeenCalledTimes(1);
      expect(JSON.parse(localStorage.getItem(versionedKey)!)).toEqual({
        version: 1,
        state: { count: 7 },
      });
    },
  );

  it('requires migrate for legacy adoption into a nonzero schema and preserves legacy on later writes', () => {
    localStorage.setItem(legacyKey, '{"count":42}');
    const onError = vi.fn();
    const store = createSante(initialState, {
      persist: { name: 'versioned-test', key: ['count'], version: 1, onError },
    });
    expect(store.getCached('count')).toBe(0);
    expect(onError).toHaveBeenCalledTimes(1);
    expect(localStorage.getItem(versionedKey)).toBeNull();
    store.dispatch('count', 7);
    expect(localStorage.getItem(legacyKey)).toBe('{"count":42}');
  });

  it('allows explicit migration from a future version', () => {
    seed(2, { count: 42 });
    const migrate = vi.fn(() => ({ count: 7 }));
    const store = createSante(initialState, {
      persist: { name: 'versioned-test', key: ['count'], version: 1, migrate },
    });
    expect(store.getCached('count')).toBe(7);
    expect(migrate).toHaveBeenCalledWith({ count: 42 }, 2);
    expect(JSON.parse(localStorage.getItem(versionedKey)!)).toEqual({
      version: 1,
      state: { count: 7 },
    });
  });

  it.each([
    '{broken',
    'null',
    '[]',
    '{}',
    '{"version":"1","state":{}}',
    '{"version":-1,"state":{}}',
    '{"version":1.5,"state":{}}',
    '{"version":1,"state":[]}',
  ])(
    'does not rewrite or fall back to valid legacy when a versioned entry is invalid: %s',
    (raw) => {
      localStorage.setItem(versionedKey, raw);
      localStorage.setItem(legacyKey, '{"count":42}');
      const onError = vi.fn();
      const write = vi.spyOn(Storage.prototype, 'setItem');
      const store = createSante(initialState, {
        persist: { name: 'versioned-test', key: ['count'], version: 1, onError },
      });
      expect(store.getCached('count')).toBe(0);
      expect(onError).toHaveBeenCalledTimes(1);
      expect(write).not.toHaveBeenCalled();
      expect(localStorage.getItem(versionedKey)).toBe(raw);
    },
  );

  it('reports a corrupt new entry when no legacy item exists and recovers on a changed persisted key', () => {
    localStorage.setItem(versionedKey, '{broken');
    const onError = vi.fn();
    const store = createSante(initialState, {
      persist: { name: 'versioned-test', key: ['count'], version: 1, onError },
    });
    expect(store.getCached('count')).toBe(0);
    expect(onError).toHaveBeenCalledTimes(1);
    store.dispatch('count', 1);
    expect(JSON.parse(localStorage.getItem(versionedKey)!)).toEqual({
      version: 1,
      state: { count: 1 },
    });
  });

  it('validates migration output and does not commit or rewrite a rejected candidate', () => {
    seed(0, { counter: 'invalid' });
    const original = localStorage.getItem(versionedKey);
    const onError = vi.fn();
    const write = vi.spyOn(Storage.prototype, 'setItem');
    const store = createSante(initialState, {
      persist: {
        name: 'versioned-test',
        key: ['count'],
        version: 1,
        migrate: () => ({ count: 'invalid' }) as unknown as Partial<State>,
        validate: validateCounter,
        onError,
      },
    });
    expect(store.getCached('count')).toBe(0);
    expect(onError).toHaveBeenCalledTimes(1);
    expect(write).not.toHaveBeenCalled();
    expect(localStorage.getItem(versionedKey)).toBe(original);
  });

  it('keeps memory usable after migration throws and saves the next update even if reporting throws', () => {
    seed(0, { counter: 42 });
    const onError = vi.fn(() => {
      throw new Error('Reporter failed');
    });
    const write = vi.spyOn(Storage.prototype, 'setItem');
    const store = createSante(initialState, {
      persist: {
        name: 'versioned-test',
        key: ['count'],
        version: 1,
        migrate() {
          throw new Error('Migration failed');
        },
        onError,
      },
    });
    expect(onError).toHaveBeenCalledTimes(1);
    expect(write).not.toHaveBeenCalled();
    store.dispatch('count', 7);
    expect(store.getCached('count')).toBe(7);
    expect(write).toHaveBeenCalledTimes(1);
  });

  it.each([
    () => null,
    () => [],
    () => new Map(),
    () => Promise.resolve({ count: 7 }),
    () => Promise.reject(new Error('Async failed')),
  ])(
    'rejects invalid or asynchronous migration output without unhandled promise rejections: %s',
    async (result) => {
      seed(0, { count: 42 });
      const onError = vi.fn();
      const store = createSante(initialState, {
        persist: {
          name: 'versioned-test',
          key: ['count'],
          version: 1,
          migrate: () => result() as unknown as Partial<State>,
          onError,
        },
      });
      expect(store.getCached('count')).toBe(0);
      expect(onError).toHaveBeenCalledTimes(1);
      await Promise.resolve();
    },
  );

  it.each([
    () => false,
    () => 1,
    () => ({}),
    () => {
      throw new Error('Validation failed');
    },
    () => Promise.resolve(true),
    () => Promise.reject(new Error('Async failed')),
  ])('rejects invalid or asynchronous validators: %s', async (result) => {
    seed(1, { count: 42 });
    const onError = vi.fn();
    const validate = result as unknown as (candidate: unknown) => candidate is Partial<State>;
    const store = createSante(initialState, {
      persist: { name: 'versioned-test', key: ['count'], version: 1, validate, onError },
    });
    expect(store.getCached('count')).toBe(0);
    expect(onError).toHaveBeenCalledTimes(1);
    await Promise.resolve();
  });

  it('allows a null-prototype migration result and missing fields in a validated partial', () => {
    seed(0, { retired: 42 });
    const store = createSante(initialState, {
      persist: {
        name: 'versioned-test',
        key: 'ALL',
        version: 1,
        migrate: () => Object.create(null) as Partial<State>,
        validate: validateCounter,
      },
    });
    expect(store.getCached('count')).toBe(0);
    expect(store.getCached('name')).toBe('initial');
    expect(JSON.parse(localStorage.getItem(versionedKey)!)).toEqual({
      version: 1,
      state: initialState,
    });
  });

  it('retains migrated live state after rewrite failure and retries on the next change', () => {
    localStorage.setItem(legacyKey, '{"counter":42}');
    const migrate = vi.fn(() => ({ count: 42 }));
    const onError = vi.fn();
    const write = vi.spyOn(Storage.prototype, 'setItem').mockImplementationOnce(() => {
      throw new Error('QuotaExceededError');
    });
    const options: SanteOptions<State> = {
      persist: { name: 'versioned-test', key: ['count'], version: 1, migrate, onError },
    };
    const store = createSante(initialState, options);
    expect(store.getCached('count')).toBe(42);
    expect(onError).toHaveBeenCalledTimes(1);
    expect(localStorage.getItem(versionedKey)).toBeNull();
    store.dispatch('count', 43);
    expect(write).toHaveBeenCalledTimes(2);
    expect(JSON.parse(localStorage.getItem(versionedKey)!)).toEqual({
      version: 1,
      state: { count: 43 },
    });
    createSante(initialState, options);
    expect(migrate).toHaveBeenCalledTimes(1);
    expect(localStorage.getItem(legacyKey)).toBe('{"counter":42}');
  });

  it('supports validation without version while retaining the raw key and write format', () => {
    localStorage.setItem(legacyKey, '{"count":"invalid"}');
    const onError = vi.fn();
    const store = createSante(initialState, {
      persist: { name: 'versioned-test', key: ['count'], validate: validateCounter, onError },
    });
    expect(store.getCached('count')).toBe(0);
    expect(onError).toHaveBeenCalledTimes(1);
    store.dispatch('count', 7);
    expect(localStorage.getItem(legacyKey)).toBe('{"count":7}');
    expect(localStorage.getItem(versionedKey)).toBeNull();
  });

  it('does not validate ordinary dispatch writes', () => {
    seed(1, { count: 42 });
    const validation = vi.fn();
    const store = createSante(initialState, {
      persist: {
        name: 'versioned-test',
        key: ['count'],
        version: 1,
        validate: (candidate): candidate is Partial<State> => {
          validation(candidate);
          return validateCounter(candidate);
        },
      },
    });
    store.dispatch('count', 43);
    expect(validation).toHaveBeenCalledTimes(1);
  });

  it.each([-1, 0.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1, '1', null])(
    'rejects invalid configured version %s before accessing storage',
    (version) => {
      const read = vi.spyOn(Storage.prototype, 'getItem');
      expect(() =>
        createSante(initialState, {
          persist: { name: 'versioned-test', key: 'ALL', version: version as number },
        }),
      ).toThrow('non-negative safe integer');
      expect(read).not.toHaveBeenCalled();
    },
  );

  it('rejects migrate without a configured version at runtime too', () => {
    const persist = {
      name: 'versioned-test',
      key: 'ALL',
      migrate: () => ({ count: 1 }),
    } as unknown as SanteOptions<State>['persist'];
    expect(() => createSante(initialState, { persist })).toThrow('explicit version');
  });
});
