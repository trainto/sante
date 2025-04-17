import { useState } from 'react';
import { dispatch, useSante } from '../store';

const Todo = () => {
  const [newTitle, setNewTitle] = useState('');

  const { todos } = useSante(['todos']);

  return (
    <div>
      <h2>Todo</h2>

      <ul>
        {todos?.map((todo, i) => (
          <li key={todo.id}>
            <input
              type="checkbox"
              checked={todo.completed}
              onChange={() =>
                dispatch('todos', (prev) => {
                  if (prev == null) return [];
                  const newTodos = [...prev];
                  newTodos[i] = { ...newTodos[i], completed: !newTodos[i].completed };
                  return newTodos;
                })
              }
            />
            {todo.title}
          </li>
        ))}
      </ul>

      <input type="text" value={newTitle} onChange={(e) => setNewTitle(e.target.value)} />
      <button
        onClick={() => {
          dispatch('todos', (prev) => [
            ...(prev ?? []),
            {
              id: prev == null ? 1 : prev[prev.length - 1].id + 1,
              title: newTitle,
              completed: false,
            },
          ]);
          setNewTitle('');
        }}
      >
        Add
      </button>
    </div>
  );
};

export default Todo;
