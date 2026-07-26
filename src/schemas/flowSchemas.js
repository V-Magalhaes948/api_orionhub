// schemas/flowSchemas.js
import { z } from 'zod';
import { uuidParam } from './common.js';

const stepSchema = z.object({
  content: z.string().trim().min(1),
  completion_criteria: z.string().trim().min(1),
  closes_conversation: z.boolean().optional().default(false),
  include_catalog: z.boolean().optional().default(false),
});

export const flowParamsSchema = {
  params: uuidParam('botId'),
};

export const storeFlowSchema = {
  params: uuidParam('botId'),
  body: z.object({
    steps: z.array(stepSchema).min(1, 'O fluxo deve ter pelo menos uma etapa.'),
  }),
};

export const updateFlowSchema = storeFlowSchema;
