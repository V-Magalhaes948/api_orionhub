import { Router } from 'express';

import UserController from '../controllers/UserController.js';
import { cacheMiddleware } from '../middlewares/cache.js';
import { updateUserSchema } from '../schemas/userSchemas.js';
import { validate } from '../middlewares/validateJson.js';

const router = Router();

router.get('/me', cacheMiddleware(20), UserController.show);
router.put('/me', validate(updateUserSchema), UserController.update);
// router.delete('/me', UserController.destroy);

export default router;
