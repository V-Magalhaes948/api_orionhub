import { Router } from 'express';
import UserController from '../controllers/UserController.js';
const router = Router();

router.get('/', UserController.index);
router.get('/me', UserController.show);
router.put('/me', UserController.update);
router.delete('/me', UserController.destroy);

export default router;
