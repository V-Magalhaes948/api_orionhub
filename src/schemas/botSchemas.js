import { z } from 'zod';
import { uuidParam } from './common.js';

export const createBotSchema = {
  body: z.object({
    name: z.string().trim().min(1).max(255),
    system_prompt: z.string().trim().min(1),
    instance_id: z.string().uuid(),
    mode: z.enum(['ai', 'manual']).optional().default('manual'),
  }),
};

export const updateBotSchema = {
  params: uuidParam(),
  body: z.object({
    name: z.string().trim().min(1).max(255).optional(),
    system_prompt: z.string().trim().min(1).optional(),
    mode: z.enum(['ai', 'manual']).optional(),
  }),
};
