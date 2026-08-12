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

const router = Router();

router.use('/auth', authRouter);
router.use('/users', authMiddleware, userRouter);
router.use('/bots', authMiddleware, botRouter);
router.use('/webhook', webhookRouter);
router.use('/instances', authMiddleware, instanceRouter);
router.use('/conversations', authMiddleware, conversationRouter);
router.use('/flows', authMiddleware, flowRouter);
router.use('/products', authMiddleware, productRouter);
router.use('/prompt-templates', authMiddleware, promptTemplateRouter);
router.use('/', flowStepTest);
router.use('/', uploadRouter);
router.use('/admin/users/', authMiddleware, adminMiddleware, adminUserRouter);
router.use('/plans', authMiddleware, planRouter);
router.use('/health', healthRouter);
router.use('/v1/stores', storesRouter);
router.use('/notifications', authMiddleware, notificationRouter);

export default router;
