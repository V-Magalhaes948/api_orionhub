import { randomUUID } from 'crypto';
import { webhookQueue } from '../queues/webhookQueue.js';

function buildJobId(body) {
  const { event, instance, data } = body;
  const messageId = data?.key?.id;

  if (event === 'messages.upsert' && instance && messageId) {
    return `messages.upsert-${instance}-${messageId}`;
  }

  return `${event}-${randomUUID()}`;
}

class WebhookController {
  async handle(req, res) {
    res.status(200).send('EVENT_RECEIVED');

    try {
      const { event } = req.body;
      const jobId = buildJobId(req.body);
      await webhookQueue.add(event, req.body, { jobId });
    } catch (error) {
      console.error('[WebhookController] Erro ao enfileirar job:', error);
    }
  }
}

export default new WebhookController();
