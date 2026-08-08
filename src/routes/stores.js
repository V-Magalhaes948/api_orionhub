import { Router } from 'express';

import StoreController from '../controllers/StoreController.js';

import authMiddleware from '../middlewares/auth.js';

import { cacheMiddleware } from '../middlewares/cache.js';

const router = Router();

// Rotas fixas/autenticadas primeiro
router.get('/me', authMiddleware, StoreController.me);
router.get('/check-slug/:slug', StoreController.checkSlug);
router.post('/', authMiddleware, StoreController.store);

// Rotas públicas com wildcard por último
router.get('/:slug', cacheMiddleware(10), StoreController.index);
router.get(
  '/:slug/products',
  cacheMiddleware(120),
  StoreController.indexProducts
);
router.get(
  '/:slug/featured-products',
  cacheMiddleware(120),
  StoreController.featuredProducts
);

export default router;
