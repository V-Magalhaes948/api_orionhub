import { z } from 'zod';
import { uuidParam } from './common.js';

export const listMessagesSchema = {
  params: uuidParam('conversationId'),
};

export const storeMessageSchema = {
  params: uuidParam('conversationId'),
  body: z.object({
    content: z.string().trim().min(1).max(4096),
  }),
};
