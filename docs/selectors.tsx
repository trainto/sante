import { createSante } from '@trainto/sante';

type User = { name: string; age: number };
type Item = { id: string; title: string };

export const { useSante, dispatch } = createSante({
  user: null as User | null,
  items: [] as Item[],
});

export function UserName() {
  const name = useSante('user', (user) => user?.name ?? 'Guest');
  return <span>{name}</span>;
}

export function ItemTitle({ index }: { index: number }) {
  const item = useSante('items', (items) => items[index]);
  return <span>{item?.title ?? 'No item'}</span>;
}
