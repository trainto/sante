import { dispatch, useSante } from '../store';

const User = () => {
  const { user } = useSante(['user']);

  return (
    <div>
      <h2>User</h2>
      <div>Hello, my name is {user?.name}.</div>
      <input
        type="text"
        value={user?.name}
        onChange={(e) =>
          dispatch('user', (prev) =>
            prev == null ? { name: e.target.value, email: '' } : { ...prev, name: e.target.value },
          )
        }
      />
      <div>Email: {user?.email}</div>
      <input
        type="text"
        value={user?.email}
        onChange={(e) =>
          dispatch('user', (prev) =>
            prev == null ? { email: e.target.value, name: '' } : { ...prev, email: e.target.value },
          )
        }
      />
    </div>
  );
};

export default User;
