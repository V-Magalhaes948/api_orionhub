import { Router } from 'express';

import PromptTemplateController from '../controllers/PromptTemplateController.js';
import { cacheMiddleware } from '../middlewares/cache.js';

const router = Router();
router.get('/', cacheMiddleware(10), PromptTemplateController.index);

export default router;
