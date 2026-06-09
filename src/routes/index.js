import { Router } from 'express';
import authRouter from './auth';
import authMiddleware from '../middlewares/auth.js';
import userRouter from './user';
import botRouter from './bots.js';

const router = Router();

router.use('/auth', authRouter);
router.use('/users', authMiddleware, userRouter);
router.use('/bots', authMiddleware, botRouter);

export default router;
