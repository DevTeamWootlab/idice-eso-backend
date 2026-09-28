import { ValueTransformer } from 'typeorm';

export const decimalTransformer: ValueTransformer = {
  to: (value?: number | string | null) => value,
  from: (value?: number | string | null) => {
    if (value === null || value === undefined) return null;
    return typeof value === 'number' ? value : Number(value);
  },
};
