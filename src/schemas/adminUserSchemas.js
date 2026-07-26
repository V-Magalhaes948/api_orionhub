import { z } from 'zod';
import { uuidParam } from './common.js';

export const listUsersSchema = {
  query: z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    search: z.string().trim().max(255).optional().default(''),
    plan_id: z.string().uuid().optional().or(z.literal('')),
    account_status: z
      .enum(['active', 'suspended', 'deleted'])
      .optional()
      .or(z.literal('')),
  }),
};

export const updatePlanSchema = {
  params: uuidParam(),
  body: z
    .object({
      plan_id: z.string().uuid().nullable().optional(),
      duration_days: z.coerce.number().int().min(1).max(3650).optional(),
      addon_id: z.string().uuid().nullable().optional(),
      addon_duration_days: z.coerce
        .number()
        .int()
        .min(1)
        .max(3650)
        .nullable()
        .optional(),
    })
    .superRefine((data, ctx) => {
      if (data.plan_id && !data.duration_days) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['duration_days'],
          message: 'Informe a duração em dias para atribuir este plano',
        });
      }
      if (data.addon_id && !data.addon_duration_days) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['addon_duration_days'],
          message: 'Informe a duração em dias para atribuir este addon',
        });
      }
    }),
};

export const updateStatusSchema = {
  params: uuidParam(),
  body: z.object({
    account_status: z.enum(['active', 'suspended']),
    reason: z.string().trim().max(500).optional(),
  }),
};
