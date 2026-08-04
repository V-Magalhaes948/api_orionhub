import { Router } from 'express';

import StoreController from '../controllers/StoreController.js';

const router = Router();

router.get('/:slug', StoreController.index);
router.get('/:slug/products', StoreController.indexProducts);
router.get('/:slug/featured-products', StoreController.featuredProducts);

export default router;
