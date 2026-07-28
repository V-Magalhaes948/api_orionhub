import Message from '../models/Message.js';
import Instance from '../models/Instance.js';
import SocketService from './socketService.js';

const MessageService = {
  async findByMessageId(messageId) {
    if (!messageId) return null;
    return Message.findOne({ where: { message_id: messageId } });
  },

  async save({ conversationId, content, role, messageId = null }) {
    try {
      const message = await Message.create({
        conversation_id: conversationId,
        content,
        role,
        ...(messageId && { message_id: messageId }),
      });
      return { message, isNew: true };
    } catch (error) {
      if (error.name === 'SequelizeUniqueConstraintError' && messageId) {
        console.warn(
          `[MessageService] message_id=${messageId} já existe (corrida concorrente), reaproveitando registro existente.`
        );
        const existing = await this.findByMessageId(messageId);
        return { message: existing, isNew: false };
      }
      throw error;
    }
  },

  async saveAndEmit({ conversationId, content, role, messageId = null }) {
    const { message, isNew } = await this.save({
      conversationId,
      content,
      role,
      messageId,
    });

    if (isNew) {
      SocketService.emitToConversation(conversationId, 'message:new', {
        id: message.id,
        conversation_id: conversationId,
        content,
        role,
        created_at: message.created_at,
      });
    }

    return message;
  },
};

export default MessageService;
