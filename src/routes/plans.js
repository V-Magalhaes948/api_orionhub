import { Router } from 'express';

import PlanController from '../controllers/PlanController.js';
import { cacheMiddleware } from '../middlewares/cache.js';

const router = Router();
router.get('/', cacheMiddleware(10), PlanController.index);
router.get('/:id/addons', PlanController.addons);

export default router;
