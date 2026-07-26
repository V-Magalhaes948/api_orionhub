import WebhookLog from '../models/WebhookLog.js';
import connectionHandler from '../webhook/handlers/connectionHandler.js';
import messageHandler from '../webhook/handlers/messageHandler.js';

const EVENT_HANDLERS = {
  'connection.update': connectionHandler,
  'messages.upsert': messageHandler,
};

class WebhookService {
  async process(body) {
    const { event, instance } = body;

    await WebhookLog.create({
      instance_id: instance,
      type: event,
      payload: body,
      status: 'received',
    });

    const handler = EVENT_HANDLERS[event];

    if (!handler) {
      console.warn(`[WebhookService] No handler for event: "${event}"`);
      return;
    }

    await handler(body);
  }
}

export default new WebhookService();
