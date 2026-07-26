import { Router } from 'express';

import InstanceController from '../controllers/InstanceController.js';
import {
  checkInstanceLimit,
  requireActivePlan,
} from '../middlewares/planLimits.js';
import { cacheMiddleware } from '../middlewares/cache.js';
import { validate } from '../middlewares/validateJson.js';
import {
  createInstanceSchema,
  instanceIdParamSchema,
} from '../schemas/instanceSchemas.js';

const router = Router();

router.get(
  '/',
  cacheMiddleware(60),
  InstanceController.index.bind(InstanceController)
);
router.get(
  '/:id/status',
  validate(instanceIdParamSchema),
  InstanceController.status.bind(InstanceController)
);
router.get(
  '/:id/qrcode',
  requireActivePlan(),
  validate(instanceIdParamSchema),
  InstanceController.qrcode.bind(InstanceController)
);
router.post(
  '/',
  checkInstanceLimit(),
  validate(createInstanceSchema),
  InstanceController.store.bind(InstanceController)
);
router.delete(
  '/:id',
  validate(instanceIdParamSchema),
  InstanceController.destroy.bind(InstanceController)
);

export default router;
