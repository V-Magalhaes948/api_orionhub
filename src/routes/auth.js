import { Router } from 'express';
import rateLimit from 'express-rate-limit';

import AuthController from '../controllers/AuthController.js';
import { validate } from '../middlewares/validateJson.js';

import {
  loginSchema,
  refreshSchema,
  registerSchema,
  logoutSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  verifyEmailSchema,
  resendVerificationCodeSchema,
} from '../schemas/authSchemas.js';
import {
  loginRateLimit,
  registerRateLimit,
  forgotPasswordRateLimit,
  verifyEmailRateLimit,
  resendCodeRateLimit,
} from '../middlewares/rateLimit.js';

const router = Router();

router.post(
  '/register',
  registerRateLimit,
  validate(registerSchema),
  AuthController.register
);
router.post(
  '/login',
  loginRateLimit,
  validate(loginSchema),
  AuthController.login
);
router.post('/refresh', validate(refreshSchema), AuthController.refresh);
router.post('/logout', validate(logoutSchema), AuthController.logout);
router.post(
  '/forgot-password',
  forgotPasswordRateLimit,
  validate(forgotPasswordSchema),
  AuthController.forgotPassword
);
router.post(
  '/reset-password',
  validate(resetPasswordSchema),
  AuthController.resetPassword
);
router.post(
  '/verify-email',
  verifyEmailRateLimit,
  validate(verifyEmailSchema),
  AuthController.verifyEmail
);
router.post(
  '/resend-verification-code',
  resendCodeRateLimit,
  validate(resendVerificationCodeSchema),
  AuthController.resendVerificationCode
);

export default router;
