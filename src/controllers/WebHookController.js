import { randomUUID } from 'crypto';
import { webhookQueue } from '../queues/webhookQueue.js';

class WebhookController {
  async handle(req, res) {
    res.status(200).send('EVENT_RECEIVED');

    try {
      const { event } = req.body;
      const jobId = `${event}-${randomUUID()}`;
      await webhookQueue.add(event, req.body, { jobId });
    } catch (error) {
      console.error('[WebhookController] Erro ao enfileirar job:', error);
    }
  }
}

export default new WebhookController();
