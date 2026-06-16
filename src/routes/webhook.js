import { Router } from 'express';
import WebhookController from '../controllers/WebhookController';

const router = Router();

router.get('/', (req, res) => res.status(200).send('OK'));
router.post('/', WebhookController.handle);

export default router;
