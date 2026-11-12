import { createSante } from '@trainto/sante';

export const { useSante, dispatch, getCached } = createSante({ count: 0 });

export const increment = () => dispatch('count', (prev) => prev + 1);
