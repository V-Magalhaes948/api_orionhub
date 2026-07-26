import { Router } from 'express';

import AdminUserController from '../controllers/AdminUserController.js';
import { validate } from '../middlewares/validateJson.js';
import {
  listUsersSchema,
  updatePlanSchema,
  updateStatusSchema,
} from '../schemas/adminUserSchemas.js';
import { uuidParam } from '../schemas/common.js';
import { cacheMiddleware } from '../middlewares/cache.js';

const router = new Router();

router.get(
  '/',
  cacheMiddleware(30),
  validate(listUsersSchema),
  AdminUserController.index
);
router.get('/:id', validate({ params: uuidParam() }), AdminUserController.show);
router.patch(
  '/:id/plan',
  validate(updatePlanSchema),
  AdminUserController.updatePlan
);
router.patch(
  '/:id/status',
  validate(updateStatusSchema),
  AdminUserController.updateStatus
);
router.delete(
  '/:id',
  validate({ params: uuidParam() }),
  AdminUserController.destroy
);

export default router;
