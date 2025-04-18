import { dispatch, useSante } from '../store';

const Counter = () => {
  const { counter } = useSante('counter');

  return (
    <div>
      <h2>Counter</h2>
      <div>Count: {counter}</div>
      <div>
        <button onClick={() => dispatch('counter', (prev) => (prev == null ? -1 : prev - 1))}>
          -
        </button>
        <button onClick={() => dispatch('counter', (prev) => (prev == null ? 1 : prev + 1))}>
          +
        </button>
      </div>
    </div>
  );
};

export default Counter;
