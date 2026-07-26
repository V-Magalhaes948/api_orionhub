import { Router } from 'express';

import BotController from '../controllers/BotController';
import { cacheMiddleware } from '../middlewares/cache.js';
import { validate } from '../middlewares/validateJson.js';
import { createBotSchema, updateBotSchema } from '../schemas/botSchemas.js';
import { uuidParam } from '../schemas/common.js';

const router = Router();

router.get('/', cacheMiddleware(120), BotController.index);
router.post('/', validate(createBotSchema), BotController.store);
router.get('/:id', validate({ params: uuidParam() }), BotController.show);
router.patch('/:id', validate(updateBotSchema), BotController.update);
router.delete('/:id', validate({ params: uuidParam() }), BotController.destroy);

export default router;
