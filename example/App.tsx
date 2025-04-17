import Counter from './components/counter';
import Selector from './components/selector';
import Todo from './components/todo';
import User from './components/user';

function App() {
  return (
    <div className="container">
      <h1>Sante</h1>
      <User />
      <Counter />
      <Todo />
      <Selector />
    </div>
  );
}

export default App;
