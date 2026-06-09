import { Router } from 'express';
import BotController from '../controllers/BotController';

const router = Router();

router.get('/', BotController.index);
router.get('/:id', BotController.show);
router.post('/', BotController.store);
router.put('/:id', BotController.update);
router.delete('/:id', BotController.destroy);

export default router;
