import redis from '../queues/redis.js';

export function cacheMiddleware(ttl = 60) {
  return async (req, res, next) => {
    if (req.method !== 'GET') return next();

    const key = `cache:${req.userId}:${req.originalUrl}`;

    try {
      const cached = await redis.get(key);
      if (cached) {
        return res.status(200).json(JSON.parse(cached));
      }

      const originalJson = res.json.bind(res);
      res.json = (data) => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          redis.set(key, JSON.stringify(data), 'EX', ttl).catch(() => {});
        }
        return originalJson(data);
      };

      next();
    } catch (err) {
      console.error('[CACHE ERROR]', err.message);
      next();
    }
  };
}

export async function invalidateCache(userId, patterns = []) {
  try {
    const keys = await redis.keys(`cache:${userId}:*`);
    if (!keys.length) return;

    if (patterns.length === 0) {
      await redis.del(...keys);
      return;
    }

    const toDelete = keys.filter((key) =>
      patterns.some((p) => key.includes(p))
    );
    if (toDelete.length) await redis.del(...toDelete);
  } catch {}
}
