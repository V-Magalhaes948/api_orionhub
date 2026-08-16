import { Router } from 'express';

import authRouter from './auth';
import userRouter from './user';
import botRouter from './bots.js';
import webhookRouter from './webhook';
import instanceRouter from './instance.js';
import conversationRouter from './conversations.js';
import flowRouter from './flows.js';
import planRouter from './plans.js';
import flowStepTest from './flowStepTest.js';
import productRouter from './products.js';
import uploadRouter from './uploads.js';
import adminUserRouter from './adminUser.js';
import healthRouter from './health.js';
import promptTemplateRouter from './promptTemplate.js';
import storesRouter from './stores.js';
import notificationRouter from './notifications.js';

import authMiddleware from '../middlewares/auth.js';
import adminMiddleware from '../middlewares/adminOnly.js';
import {
  blockPlanAccess,
  requireActivePlan,
} from '../middlewares/planLimits.js';

const router = Router();

router.use('/auth', authRouter);
router.use('/users', authMiddleware, requireActivePlan(), userRouter);
router.use(
  '/bots',
  authMiddleware,
  requireActivePlan(),
  blockPlanAccess(['Essential']),
  botRouter
);
router.use('/webhook', webhookRouter);
router.use(
  '/instances',
  authMiddleware,
  requireActivePlan(),
  blockPlanAccess(['Essential']),
  instanceRouter
);
router.use(
  '/conversations',
  authMiddleware,
  requireActivePlan(),
  blockPlanAccess(['Essential']),
  conversationRouter
);
router.use(
  '/flows',
  authMiddleware,
  requireActivePlan(),
  blockPlanAccess(['Essential']),
  flowRouter
);
router.use('/products', authMiddleware, requireActivePlan(), productRouter);
router.use(
  '/prompt-templates',
  authMiddleware,
  requireActivePlan(),
  blockPlanAccess(['Essential']),
  promptTemplateRouter
);

// Rotas SEM restrição de plano — precisam vir ANTES de qualquer catch-all em '/'
router.use('/admin/users/', authMiddleware, adminMiddleware, adminUserRouter);
router.use('/plans', planRouter);
router.use('/health', healthRouter);
router.use('/v1/stores', storesRouter);
router.use('/notifications', authMiddleware, notificationRouter);

// Catch-alls em '/' — SEMPRE por último, senão engolem tudo que vier depois
router.use(
  '/',
  authMiddleware,
  requireActivePlan(),
  blockPlanAccess(['Essential']),
  flowStepTest
);
router.use(
  '/',
  authMiddleware,
  requireActivePlan(),
  blockPlanAccess(['Essential']),
  uploadRouter
);

export default router;
