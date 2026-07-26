import { createAdapter } from '@socket.io/redis-adapter';
import redis from '../queues/redis.js';

export function createSocketRedisAdapter() {
  const pubClient = redis.duplicate();
  const subClient = redis.duplicate();

  pubClient.on('error', (err) =>
    console.error('[SocketAdapter] Erro no pubClient Redis:', err.message)
  );
  subClient.on('error', (err) =>
    console.error('[SocketAdapter] Erro no subClient Redis:', err.message)
  );

  return createAdapter(pubClient, subClient);
}
