import { z } from 'zod';
import { uuidParam } from './common.js';

export const createInstanceSchema = {
  body: z.object({
    name: z.string().trim().min(3).max(100),
  }),
};

export const instanceIdParamSchema = {
  params: uuidParam(),
};
