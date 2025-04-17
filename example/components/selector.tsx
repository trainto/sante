import { useSante } from '../store';

const Selector = () => {
  const { user, todos } = useSante(['user', 'todos']);

  return (
    <div>
      <h2>Selector example</h2>
      <div>
        <div>Name: {user?.name}</div>
        <div>Done tasks:</div>
        <ul>
          {todos
            ?.filter((todo) => todo.completed)
            .map((todo) => <li key={todo.id}>{todo.title}</li>)}
        </ul>
      </div>
    </div>
  );
};

export default Selector;
