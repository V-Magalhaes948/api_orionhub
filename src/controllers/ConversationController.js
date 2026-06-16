import Conversation from '../models/Conversation.js';
import Bot from '../models/Bot.js';
import { handleError } from '../utils/handleError.js';

const CONVERSATION_ATTRIBUTES = [
  'id',
  'bot_id',
  'contact_phone',
  'contact_name',
  'status',
  'created_at',
  'updated_at',
];

class ConversationController {
  // async index(req, res) {
  //   try {
  //     const { botId } = req.params;
  //     const { status } = req.query;

  //     const bot = await Bot.findOne({
  //       where: { id: botId, user_id: req.userId },
  //     });

  //     if (!bot) {
  //       return res.status(404).json({ message: 'Bot not found' });
  //     }

  //     const where = { bot_id: botId };
  //     if (status) where.status = status;

  //     const conversations = await Conversation.findAll({
  //       where,
  //       attributes: CONVERSATION_ATTRIBUTES,
  //       order: [['updated_at', 'DESC']],
  //     });

  //     return res.status(200).json(conversations);
  //   } catch (error) {
  //     return handleError(res, error);
  //   }
  // }

  async show(req, res) {
    try {
      const conversation = await Conversation.findOne({
        where: { id: req.params.id },
        attributes: CONVERSATION_ATTRIBUTES,
        include: [{ model: Bot, as: 'bot', where: { user_id: req.userId } }],
      });

      if (!conversation) {
        return res.status(404).json({ message: 'Conversation not found' });
      }

      return res.status(200).json(conversation);
    } catch (error) {
      return handleError(res, error);
    }
  }

  async update(req, res) {
    try {
      const { status } = req.body;

      const conversation = await Conversation.findOne({
        where: { id: req.params.id },
        include: [{ model: Bot, as: 'bot', where: { user_id: req.userId } }],
      });

      if (!conversation) {
        return res.status(404).json({ message: 'Conversation not found' });
      }

      await conversation.update({ status });
      return res
        .status(200)
        .json({ message: 'Conversation updated successfully', conversation });
    } catch (error) {
      return handleError(res, error);
    }
  }
}

export default new ConversationController();
