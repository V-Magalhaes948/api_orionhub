import Redis from 'ioredis';

const rateLimitRedis = new Redis({
  host: process.env.REDIS_HOST,
  port: process.env.REDIS_PORT || 6379,
  password: process.env.REDIS_PASSWORD || undefined,
  db: process.env.REDIS_DB ? Number(process.env.REDIS_DB) : 0,
  maxRetriesPerRequest: 1, // ← este SIM pode ser 1, é o de rate limit
  retryStrategy(times) {
    if (times > 5) return null;
    return Math.min(times * 200, 1000);
  },
  reconnectOnError: () => true,
  lazyConnect: false,
});

rateLimitRedis.on('connect', () =>
  console.log('✅ Redis (rate limit) conectado')
);
rateLimitRedis.on('error', (err) =>
  console.error('❌ Redis (rate limit) erro:', err.message)
);

export default rateLimitRedis;
