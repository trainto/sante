import { createSante } from '@trainto/sante';

type State = {
  layer: { title: string } | null;
  crops: string[] | null;
  count: number;
};

const initialState: State = { layer: null, crops: null, count: 0 };
export const { dispatch, dispatchMany, getCached, useSante } = createSante(initialState);

export const closeEditor = () => dispatchMany({ layer: null, crops: null });

export const addCrop = (crop: string) =>
  dispatchMany((prev) => ({
    count: prev.count + 1,
    crops: [...(prev.crops ?? []), crop],
  }));
