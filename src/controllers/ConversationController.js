import Conversation from '../models/Conversation.js';
import Bot from '../models/Bot.js';
import FlowSession from '../models/FlowSession.js';
import { handleError } from '../utils/handleError.js';
import { invalidateCache } from '../middlewares/cache.js';
import { logActivity } from '../utils/logActivity.js';
import SocketService from '../services/socketService.js';

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
  async index(req, res) {
    try {
      const { botId, status } = req.query;

      const where = {};
      if (botId) where.bot_id = botId;
      if (status) where.status = status;

      if (botId) {
        const bot = await Bot.findOne({
          where: { id: botId, user_id: req.userId },
        });
        if (!bot)
          return res.status(404).json({ message: 'Bot não encontrado.' });
      }

      const conversations = await Conversation.findAll({
        where,
        attributes: CONVERSATION_ATTRIBUTES,
        include: [
          {
            model: Bot,
            as: 'bot',
            attributes: [],
            where: { user_id: req.userId },
          },
        ],
        order: [['updated_at', 'DESC']],
      });

      return res.status(200).json(conversations);
    } catch (error) {
      return handleError(res, error);
    }
  }

  async show(req, res) {
    try {
      const conversation = await Conversation.findOne({
        where: { id: req.params.id },
        attributes: CONVERSATION_ATTRIBUTES,
        include: [
          {
            model: Bot,
            as: 'bot',
            attributes: [],
            where: { user_id: req.userId },
          },
        ],
      });

      if (!conversation) {
        return res
          .status(404)
          .json({ message: 'Conversation não encontrada.' });
      }

      return res.status(200).json(conversation);
    } catch (error) {
      return handleError(res, error);
    }
  }

  async resume(req, res) {
    try {
      const conversation = await Conversation.findOne({
        where: { id: req.params.id },
        attributes: ['id', 'bot_id', 'status'],
        include: [
          {
            model: Bot,
            as: 'bot',
            attributes: [],
            where: { user_id: req.userId },
          },
        ],
      });

      if (!conversation) {
        return res.status(404).json({ message: 'Conversa não encontrada.' });
      }

      if (conversation.status !== 'waiting') {
        return res.status(409).json({
          message: 'Esta conversa não está aguardando atendimento humano.',
        });
      }

      await conversation.update({ status: 'open' });

      await invalidateCache(req.userId, [
        '/conversations',
        `/conversations/${conversation.id}/messages`,
      ]);

      SocketService.emitToConversation(
        conversation.id,
        'conversation:resumed',
        {
          id: conversation.id,
          status: 'open',
        }
      );

      await logActivity({
        userId: req.userId,
        action: 'conversation.resumed',
        resourceType: 'conversation',
        resourceId: conversation.id,
        metadata: { bot_id: conversation.bot_id },
        ip: req.ip,
      });

      return res.status(200).json({
        message: 'Bot reativado nesta conversa.',
        conversationId: conversation.id,
      });
    } catch (error) {
      return handleError(res, error);
    }
  }

  async update(req, res) {
    try {
      const { status } = req.body;
      const flowSessionCleared = status === 'closed';

      const conversation = await Conversation.findOne({
        where: { id: req.params.id },
        attributes: ['id', 'bot_id', 'status'],
        include: [
          {
            model: Bot,
            as: 'bot',
            attributes: [],
            where: { user_id: req.userId },
          },
        ],
      });

      if (!conversation) {
        return res.status(404).json({ message: 'Conversa não encontrada.' });
      }

      await conversation.update({ status });

      if (flowSessionCleared) {
        await FlowSession.destroy({
          where: { conversation_id: conversation.id },
        });
      }

      await logActivity({
        userId: req.userId,
        action: 'conversation.status_changed',
        resourceType: 'conversation',
        resourceId: conversation.id,
        metadata: {
          new_status: status,
          flow_session_cleared: flowSessionCleared,
        },
        ip: req.ip,
      });

      await invalidateCache(req.userId, ['/conversations']);

      return res.status(200).json({
        message: 'Conversa atualizada com sucesso.',
        conversation: {
          id: conversation.id,
          status: conversation.status,
        },
      });
    } catch (error) {
      return handleError(res, error);
    }
  }
}

export default new ConversationController();
