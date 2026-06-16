import Message from '../models/Message.js';
import Conversation from '../models/Conversation.js';
import Bot from '../models/Bot.js';
import { handleError } from '../utils/handleError.js';

const MESSAGE_ATTRIBUTES = [
  'id',
  'conversation_id',
  'content',
  'role',
  'message_id',
  'created_at',
];

class MessageController {
  async index(req, res) {
    try {
      const { conversationId } = req.params;

      const conversation = await Conversation.findOne({
        where: { id: conversationId },
        include: [{ model: Bot, as: 'bot', where: { user_id: req.userId } }],
      });

      if (!conversation) {
        return res.status(404).json({ message: 'Conversation not found' });
      }

      const messages = await Message.findAll({
        where: { conversation_id: conversationId },
        attributes: MESSAGE_ATTRIBUTES,
        order: [['created_at', 'ASC']],
      });

      return res.status(200).json(messages);
    } catch (error) {
      return handleError(res, error);
    }
  }
}

export default new MessageController();
