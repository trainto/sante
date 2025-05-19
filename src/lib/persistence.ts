export default function Persistence(storage: 'local' | 'session' = 'local') {
  const storageKey = `sante-persistence`;

  const loadState = () => {
    if (typeof window !== 'undefined') {
      const storedValue = window[`${storage}Storage`].getItem(storageKey);
      return storedValue ? storedValue : '{}';
    }

    return '{}';
  };

  const saveState = (key: string | number | symbol, value: unknown) => {
    setTimeout(() => {
      if (typeof window !== 'undefined') {
        const storedValue = loadState();
        const parsedValue = storedValue ? JSON.parse(storedValue) : {};
        parsedValue[key] = value;
        window[`${storage}Storage`].setItem(storageKey, JSON.stringify(parsedValue));
      }
    });
  };

  return { loadState, saveState };
}
