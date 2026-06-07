import { Router } from 'express';
import AuthController from '../controllers/AuthController.js';
// import authMiddleware from '../middlewares/auth.js';
const router = Router();

router.post('/register', AuthController.register);
router.post('/login', AuthController.login);

export default router;
