import { Router } from 'express';
import authRouter from './auth';
import authMiddleware from '../middlewares/auth.js';
import userRouter from './user';

const router = Router();

router.use('/auth', authRouter);
router.use('/users', authMiddleware, userRouter);

export default router;
