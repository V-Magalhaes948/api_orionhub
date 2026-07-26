import { z } from 'zod';
import { uuidParam } from './common.js';

export const flowStepTestSchema = {
  params: uuidParam('botId'),
  body: z.object({
    content: z.string().trim().min(1),
    completion_criteria: z.string().trim().min(1),
    closes_conversation: z.boolean().optional().default(false),
    next_step_content: z.string().trim().min(1).optional().nullable(),
    user_message: z.string().trim().min(1),
    history: z
      .array(
        z.object({
          role: z.enum(['user', 'assistant']),
          content: z.string(),
        })
      )
      .optional()
      .default([]),
  }),
};
