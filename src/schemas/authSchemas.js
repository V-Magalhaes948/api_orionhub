import { z } from 'zod';

export const registerSchema = {
  body: z.object({
    name: z.string().trim().min(3).max(255),
    email: z.string().trim().toLowerCase().email(),
    password: z.string().min(6).max(50),
  }),
};

export const loginSchema = {
  body: z.object({
    email: z.string().trim().toLowerCase().email(),
    password: z.string().min(1),
  }),
};

export const refreshSchema = {
  body: z.object({
    refreshToken: z.string().min(1),
  }),
};

export const logoutSchema = {
  body: z.object({
    refreshToken: z.string().min(1),
  }),
};

export const forgotPasswordSchema = {
  body: z.object({
    email: z.string().trim().toLowerCase().email(),
  }),
};

export const resetPasswordSchema = {
  body: z.object({
    token: z.string().min(1),
    password: z.string().min(6).max(50),
  }),
};

export const verifyEmailSchema = {
  body: z.object({
    email: z.string().trim().toLowerCase().email(),
    code: z
      .string()
      .length(6)
      .regex(/^\d+$/, 'Código deve conter apenas números'),
  }),
};

export const resendVerificationCodeSchema = {
  body: z.object({
    email: z.string().trim().toLowerCase().email(),
  }),
};
