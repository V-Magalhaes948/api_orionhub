import { z } from 'zod';

const booleanQueryParam = z
  .enum(['true', 'false'])
  .optional()
  .transform((val) => val === 'true');

export const listNotificationsSchema = {
  query: z.object({
    unread: booleanQueryParam,
  }),
};

export const markAllReadSchema = {};
