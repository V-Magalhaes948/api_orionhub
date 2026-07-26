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
} from '../schemas/authSchemas.js';
import {
  loginRateLimit,
  registerRateLimit,
  forgotPasswordRateLimit,
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

export default router;
