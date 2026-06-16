import WebhookLog from '../models/WebhookLog.js';
import connectionHandler from '../webhook/handlers/connectionHandler.js';
import messageHandler from '../webhook/handlers/messageHandler.js';

class WebhookController {
  async handle(req, res) {
    res.status(200).send('EVENT_RECEIVED');

    try {
      const { event, instance } = req.body;

      await WebhookLog.create({
        instance_id: instance,
        type: event,
        payload: req.body,
        status: 'received',
      });

      switch (event) {
        case 'connection.update':
          await connectionHandler(req.body);
          break;
        case 'messages.upsert':
          await messageHandler(req.body);
          break;
        default:
          break;
      }
    } catch (error) {
      console.error('Webhook error:', error.message);
    }
  }
}

export default new WebhookController();
