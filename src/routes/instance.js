import { Router } from 'express';
import InstanceController from '../controllers/InstanceController';

const router = Router();

router.get('/', InstanceController.index.bind(InstanceController));
router.post('/', InstanceController.store.bind(InstanceController));
router.delete('/:id', InstanceController.destroy.bind(InstanceController));
router.get('/:id/status', InstanceController.status.bind(InstanceController));
router.get('/:id/qrcode', InstanceController.qrcode.bind(InstanceController));

export default router;
