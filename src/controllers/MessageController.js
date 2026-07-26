import Message from '../models/Message.js';
import Conversation from '../models/Conversation.js';
import Bot from '../models/Bot.js';
import Instance from '../models/Instance.js';

import { status } from '../controllers/InstanceController.js';

import WhatsAppService from '../services/whatsAppService.js';
import MessageService from '../services/messageService.js';
import ContactIdentityService from '../services/contactIdentityService.js';

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

  async store(req, res) {
    try {
      const { conversationId } = req.params;
      const { content } = req.body;

      const conversation = await Conversation.findOne({
        where: { id: conversationId, status: 'open' },
        include: [
          {
            model: Bot,
            as: 'bot',
            where: { user_id: req.userId },
            include: [{ model: Instance, as: 'instance' }],
          },
        ],
      });

      if (!conversation) {
        return res
          .status(404)
          .json({ message: 'Conversa não encontrada ou está fechada.' });
      }

      const destination = conversation.contact_phone;
      const instance = conversation.bot.instance;

      if (instance.status != 1) {
        return res
          .status(404)
          .json({ message: 'O número da instância está desconectado.' });
      }

      //Emitir um socket.io aqui para gerar uma notificação também avisando-o.

      if (destination.endsWith('@lid')) {
        return res.status(422).json({
          message:
            'Este contato ainda não foi identificado pelo WhatsApp (sem número de telefone resolvido). Aguarde uma nova mensagem do contato antes de responder.',
        });
      }

      if (
        ContactIdentityService.isSamePhoneNumber(
          destination,
          instance.phone_number
        )
      ) {
        return res.status(422).json({
          message:
            'Esta conversa aponta para o número da própria instância — envio bloqueado para evitar auto-resposta.',
        });
      }

      const message = await MessageService.saveAndEmit({
        conversationId,
        content,
        role: 'assistant',
      });

      await WhatsAppService.sendText(instance, destination, content);

      return res.status(201).json(message);
    } catch (error) {
      return handleError(res, error);
    }
  }
}

export default new MessageController();
