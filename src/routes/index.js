import { Router } from 'express';

import authRouter from './auth';
import authMiddleware from '../middlewares/auth.js';
import userRouter from './user';
import botRouter from './bots.js';
import webhookRouter from './webhook';
import instanceRouter from './instance.js';
import conversationRouter from './conversations.js';

const router = Router();

router.use('/auth', authRouter);
router.use('/users', authMiddleware, userRouter);
router.use('/bots', authMiddleware, botRouter);
router.use('/webhook', webhookRouter);
router.use('/instances', authMiddleware, instanceRouter);
router.use('/conversations', authMiddleware, conversationRouter);

export default router;
