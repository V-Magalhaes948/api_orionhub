import Redis from 'ioredis';

const redis = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: process.env.REDIS_PORT || 6379,
  db: process.env.REDIS_DB ? Number(process.env.REDIS_DB) : 0,
  maxRetriesPerRequest: null,
  retryStrategy(times) {
    if (times > 10) return null;
    return Math.min(times * 500, 3000);
  },
  reconnectOnError: () => true,
  lazyConnect: false,
});

redis.on('connect', () => console.log('✅ Redis conectado'));
redis.on('error', () => {});

export default redis;
