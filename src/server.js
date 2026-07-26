import { Server } from 'socket.io';
import { createServer } from 'http';
import jwt from 'jsonwebtoken';

import app from './app.js';
import { createSocketRedisAdapter } from './lib/socketRedisAdapter.js';
import './workers/webhookWorker.js';
import './workers/emailWorker.js';
import { schedulePlanExpirationSweep } from './lib/planExpirationSweep.js';
import { scheduleMessagesResetSweep } from './lib/messagesResetSweep.js';
import { scheduleInstanceStatusSweep } from './lib/instanceStatusSweep.js';
import Bot from './models/Bot.js';
import Conversation from './models/Conversation.js';

const httpServer = createServer(app);

export const io = new Server(httpServer, {
  cors: {
    origin: process.env.FRONT_URL || 'http://localhost:5174',
    methods: ['GET', 'POST'],
  },
});

io.adapter(createSocketRedisAdapter());

io.use((socket, next) => {
  try {
    const token =
      socket.handshake.auth?.token ||
      socket.handshake.headers?.authorization?.split(' ')[1];

    if (!token) return next(new Error('No token provided'));

    const decoded = jwt.verify(token, process.env.TOKEN_SECRET);
    socket.userId = decoded.id;
    return next();
  } catch {
    return next(new Error('Invalid token'));
  }
});

io.on('connection', (socket) => {
  console.log(`Socket conectado: ${socket.id} (user ${socket.userId})`);

  socket.join(`user:${socket.userId}`);

  socket.on('join:conversation', async (conversationId) => {
    try {
      const conversation = await Conversation.findOne({
        where: { id: conversationId },
        include: [{ model: Bot, as: 'bot', where: { user_id: socket.userId } }],
      });

      if (!conversation) {
        console.warn(
          `[Socket] ${socket.id} tentou entrar em conversation:${conversationId} sem permissão.`
        );
        return;
      }

      socket.join(`conversation:${conversationId}`);
      console.log(
        `Socket ${socket.id} entrou em conversation:${conversationId}`
      );
    } catch (err) {
      console.error('[Socket] Erro ao validar join:conversation:', err.message);
    }
  });

  socket.on('disconnect', () => {
    console.log(`Socket desconectado: ${socket.id}`);
  });
});

const PORT = process.env.PORT || 3001;
httpServer.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
  scheduleMessagesResetSweep()
    .then(() =>
      console.log('[messageExpirationSweep] Agendado (a cada 15 min).')
    )
    .catch((err) =>
      console.error('[messageExpirationSweep] Falha ao agendar:', err.message)
    );
  schedulePlanExpirationSweep()
    .then(() => console.log('[planExpirationSweep] Agendado (a cada 15 min).'))
    .catch((err) =>
      console.error('[planExpirationSweep] Falha ao agendar:', err.message)
    );
  scheduleInstanceStatusSweep()
    .then(() => console.log('[instanceStatusSweep] Agendado (a cada 5 min).'))
    .catch((err) =>
      console.error('[instanceStatusSweep] Falha ao agendar:', err.message)
    );
});
