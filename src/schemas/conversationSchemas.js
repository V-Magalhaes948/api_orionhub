import { z } from 'zod';
import { uuidParam } from './common.js';

export const listConversationsSchema = {
  query: z.object({
    botId: z.string().uuid().optional().or(z.literal('')),
    status: z.enum(['open', 'closed', 'waiting']).optional().or(z.literal('')),
    limit: z.coerce.number().int().min(1).max(100).optional(),
    page: z.coerce.number().int().min(1).optional(),
  }),
};

export const updateConversationSchema = {
  params: uuidParam(),
  body: z.object({
    status: z.enum(['open', 'closed', 'waiting']),
  }),
};
