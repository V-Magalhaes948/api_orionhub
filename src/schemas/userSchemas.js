import { z } from 'zod';

export const updateUserSchema = {
  body: z.object({
    name: z.string().trim().min(3).max(255).optional(),
    email: z.string().trim().toLowerCase().email().optional(),
    password: z.string().min(6).max(50).optional(),
  }),
};
