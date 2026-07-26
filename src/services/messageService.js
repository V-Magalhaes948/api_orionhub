import Message from '../models/Message.js';
import Instance from '../models/Instance.js';
import SocketService from './socketService.js';

const MessageService = {
  async findByMessageId(messageId) {
    if (!messageId) return null;
    return Message.findOne({ where: { message_id: messageId } });
  },

  async save({ conversationId, content, role, messageId = null }) {
    return Message.create({
      conversation_id: conversationId,
      content,
      role,
      ...(messageId && { message_id: messageId }),
    });
  },

  async saveAndEmit({ conversationId, content, role, messageId = null }) {
    const saved = await this.save({ conversationId, content, role, messageId });

    SocketService.emitToConversation(conversationId, 'message:new', {
      id: saved.id,
      conversation_id: conversationId,
      content,
      role,
      created_at: saved.created_at,
    });

    return saved;
  },
};

export default MessageService;
