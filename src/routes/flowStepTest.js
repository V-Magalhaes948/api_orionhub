import { Router } from 'express';

import FlowStepController from '../controllers/FlowStepTestController.js';
import authMiddleware from '../middlewares/auth.js';
import { validate } from '../middlewares/validateJson.js';
import { flowStepTestSchema } from '../schemas/flowStepTestSchemas.js';

const router = Router();

router.post(
  '/bots/:botId/flow-steps/test',
  authMiddleware,
  validate(flowStepTestSchema),
  FlowStepController.store
);

export default router;
