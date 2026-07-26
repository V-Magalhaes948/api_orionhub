import { Router } from 'express';
import ProductController from '../controllers/ProductController.js';
import {
  checkProductLimit,
  blockIfSelectionPending,
} from '../middlewares/planLimits.js';
import { cacheMiddleware } from '../middlewares/cache.js';
import { validate } from '../middlewares/validateJson.js';
import {
  listProductsSchema,
  createProductSchema,
  productIdParamSchema,
  updateProductSchema,
} from '../schemas/productSchemas.js';

const router = Router();

router.get('/selection', ProductController.selectionStatus);
router.post('/selection', ProductController.confirmSelection);

router.get(
  '/',
  cacheMiddleware(120),
  validate(listProductsSchema),
  ProductController.index
);
router.post(
  '/',
  checkProductLimit(),
  blockIfSelectionPending(),
  validate(createProductSchema),
  ProductController.store
);
router.get('/:id', validate(productIdParamSchema), ProductController.show);
router.put(
  '/:id',
  blockIfSelectionPending(),
  validate(updateProductSchema),
  ProductController.update
);
router.delete(
  '/:id',
  validate(productIdParamSchema),
  ProductController.destroy
);

export default router;
