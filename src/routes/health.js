import { Router } from 'express';
import HealthController from '../controllers/HealthController.js';

const router = Router();

router.get('/', HealthController.check);

export default router;
