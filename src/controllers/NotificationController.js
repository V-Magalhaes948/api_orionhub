import Notification from '../models/Notification.js';
import { handleError } from '../utils/handleError.js';

const NOTIFICATION_ATTRIBUTES = [
  'id',
  'type',
  'title',
  'message',
  'metadata',
  'read',
  'created_at',
];

class NotificationController {
  async index(req, res) {
    try {
      const { unread } = req.query;

      const where = { user_id: req.userId };
      if (unread) where.read = false;

      const notifications = await Notification.findAll({
        where,
        attributes: NOTIFICATION_ATTRIBUTES,
        order: [['created_at', 'DESC']],
        limit: 50,
      });

      return res.status(200).json(notifications);
    } catch (error) {
      return handleError(res, error);
    }
  }

  async markAllRead(req, res) {
    try {
      await Notification.update(
        { read: true },
        { where: { user_id: req.userId, read: false } }
      );
      return res.status(204).send();
    } catch (error) {
      return handleError(res, error);
    }
  }
}

export default new NotificationController();
