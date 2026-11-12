import { produce } from 'immer';
import { createSante } from '@trainto/sante';

const { useSante, dispatch } = createSante(
  { tels: { mobile: '', work: '' }, hobbies: [] as string[] },
  { produce },
);

export function Hobbies() {
  const { hobbies } = useSante('hobbies');
  return (
    <div>
      <p>{hobbies.join(', ')}</p>
      <button
        onClick={() =>
          dispatch('tels', (draft) => {
            draft.mobile = '+82.10.xxxx.xxxx';
          })
        }
      >
        Apply mobile
      </button>
      <button
        onClick={() =>
          dispatch('hobbies', (draft) => {
            draft.push('piano');
          })
        }
      >
        Add piano
      </button>
    </div>
  );
}
