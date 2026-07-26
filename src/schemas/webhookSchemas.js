import { z } from 'zod';

export const webhookEventSchema = {
  body: z.object({
    event: z.string().trim().min(1),
    instance: z.string().optional(),
    data: z.record(z.any()),
  }),
};
