import { Router } from 'express';

import StoreController from '../controllers/StoreController.js';

const router = Router();

router.get('/:slug', StoreController.index);
router.get('/:slug/products', StoreController.indexProducts);

export default router;
