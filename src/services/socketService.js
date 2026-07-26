import { io } from '../server.js';

const SocketService = {
  emitToUser(userId, event, payload) {
    io.to(`user:${userId}`).emit(event, payload);
  },

  emitToConversation(conversationId, event, payload) {
    io.to(`conversation:${conversationId}`).emit(event, payload);
  },

  emitNotification(userId, type, title, message, metadata = {}) {
    this.emitToUser(userId, 'notification', {
      type,
      title,
      message,
      at: new Date().toISOString(),
      ...metadata,
    });
  },
};

export default SocketService;
