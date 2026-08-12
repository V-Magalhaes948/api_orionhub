import { io } from '../server.js';
import Notification from '../models/Notification.js';

const SocketService = {
  emitToUser(userId, event, payload) {
    io.to(`user:${userId}`).emit(event, payload);
  },

  emitToConversation(conversationId, event, payload) {
    io.to(`conversation:${conversationId}`).emit(event, payload);
  },

  async emitNotification(userId, type, title, message, metadata = {}) {
    let saved;
    try {
      saved = await Notification.create({
        user_id: userId,
        type,
        title,
        message,
        metadata,
      });
    } catch (err) {
      console.error(
        '[SocketService] Erro ao persistir notificação:',
        err.message
      );
    }

    this.emitToUser(userId, 'notification', {
      id: saved?.id,
      type,
      title,
      message,
      at: saved?.created_at ?? new Date().toISOString(),
      ...metadata,
    });
  },
};

export default SocketService;
