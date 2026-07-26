import { Queue, Worker } from 'bullmq';
import { Op } from 'sequelize';
import redis from '../queues/redis.js';
import User from '../models/User.js';
import { expireUserAccess } from '../services/planExpirationService.js';
import { expireUserAddon } from '../services/planExpirationService.js';

const QUEUE_NAME = 'plan-expiration-sweep';
const SWEEP_INTERVAL_MS = 15 * 60 * 1000;

export const planExpirationQueue = new Queue(QUEUE_NAME, {
  connection: redis,
});

export function schedulePlanExpirationSweep() {
  return planExpirationQueue.add(
    'sweep',
    {},
    {
      repeat: { every: SWEEP_INTERVAL_MS },
      jobId: 'plan-expiration-sweep',
    }
  );
}

export const planExpirationWorker = new Worker(
  QUEUE_NAME,
  async () => {
    const expiredPlanUsers = await User.findAll({
      where: {
        plan_status: { [Op.ne]: 'expired' },
        plan_expires_at: { [Op.lt]: new Date() },
        is_admin: false,
      },
    });

    for (const user of expiredPlanUsers) {
      try {
        await expireUserAccess(user);
      } catch (err) {
        console.error(
          `[planExpirationSweep] Falha ao expirar plano ${user.id}:`,
          err.message
        );
      }
    }

    const expiredAddonUsers = await User.findAll({
      where: {
        addon_status: 'active',
        addon_expires_at: { [Op.lt]: new Date() },
        is_admin: false,
      },
    });

    for (const user of expiredAddonUsers) {
      try {
        await expireUserAddon(user);
      } catch (err) {
        console.error(
          `[planExpirationSweep] Falha ao expirar addon ${user.id}:`,
          err.message
        );
      }
    }

    return {
      processed: expiredPlanUsers.length + expiredAddonUsers.length,
    };
  },
  { connection: redis, concurrency: 1 }
);

planExpirationWorker.on('failed', (job, err) => {
  console.error(`[planExpirationSweep] Job ${job.id} falhou:`, err.message);
});
