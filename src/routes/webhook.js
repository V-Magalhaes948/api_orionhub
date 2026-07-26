import { Router } from 'express';
import WebhookController from '../controllers/WebhookController.js';
import { validate } from '../middlewares/validateJson.js';
import { webhookEventSchema } from '../schemas/webhookSchemas.js';
import { verifyWebhookSecret } from '../middlewares/verifyWebhookSecret.js';

const router = Router();

router.post(
  '/',
  verifyWebhookSecret,
  validate(webhookEventSchema),
  WebhookController.handle
);

export default router;
