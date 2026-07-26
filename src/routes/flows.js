import { Router } from 'express';

import FlowController from '../controllers/FlowController.js';
import { validate } from '../middlewares/validateJson.js';
import {
  flowParamsSchema,
  storeFlowSchema,
  updateFlowSchema,
} from '../schemas/flowSchemas.js';

const router = Router();

router.get('/:botId', validate(flowParamsSchema), FlowController.show);
router.post('/:botId', validate(storeFlowSchema), FlowController.store);
router.put('/:botId', validate(updateFlowSchema), FlowController.update);
router.delete('/:botId', validate(flowParamsSchema), FlowController.destroy);
export default router;
