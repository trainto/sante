import { useState } from 'react';
import { createSante } from '@trainto/sante';

export const { useSante, dispatch, getCached } = createSante({
  name: '',
  email: '',
  hobbies: [] as string[],
  tels: { mobile: '', work: '' },
});

export const dispatchMobile = (mobile: string) => {
  dispatch('tels', (prev) => ({ ...prev, mobile }));
};

export function Profile() {
  const { name, tels } = useSante(['name', 'tels']);
  const [newName, setNewName] = useState('');
  const [newNumber, setNewNumber] = useState('');

  return (
    <div>
      <p>
        {name}: {tels.mobile}
      </p>
      <input value={newName} onChange={(event) => setNewName(event.target.value)} />
      <button onClick={() => dispatch('name', newName)}>Apply name</button>
      <input value={newNumber} onChange={(event) => setNewNumber(event.target.value)} />
      <button onClick={() => dispatchMobile(newNumber)}>Apply mobile</button>
    </div>
  );
}

// Read state outside React:
getCached('name');
