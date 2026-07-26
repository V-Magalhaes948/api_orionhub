import connection from '../database/index.js';
import redis from '../queues/redis.js';

class HealthController {
  async check(req, res) {
    const checks = { server: 'up', db: 'unknown', redis: 'unknown' };
    let healthy = true;

    try {
      await connection.authenticate();
      checks.db = 'up';
    } catch (error) {
      checks.db = 'down';
      healthy = false;
    }

    try {
      await redis.ping();
      checks.redis = 'up';
    } catch (error) {
      checks.redis = 'down';
      healthy = false;
    }

    return res.status(healthy ? 200 : 503).json({
      status: healthy ? 'ok' : 'degraded',
      checks,
      timestamp: new Date().toISOString(),
    });
  }
}

export default new HealthController();
