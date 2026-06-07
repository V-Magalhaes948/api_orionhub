import { Router } from 'express';
import authRouter from './auth';
import authMiddleware from '../middlewares/auth.js';
// import userRouter from './user';

const router = Router();

router.use('/auth', authRouter);
// router.use(authMiddleware, '/users', userRouter); // Validar o Token para acessar as rotas de usuário

export default router;
