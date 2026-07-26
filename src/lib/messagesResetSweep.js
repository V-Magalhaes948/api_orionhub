import { Queue, Worker } from 'bullmq';
import { Op } from 'sequelize';
import redis from '../queues/redis.js';
import User from '../models/User.js';
import Plan from '../models/Plan.js';

const QUEUE_NAME = 'messages-reset-sweep';
const SWEEP_INTERVAL_MS = 15 * 60 * 1000;

export const messagesResetQueue = new Queue(QUEUE_NAME, {
  connection: redis,
});

export function scheduleMessagesResetSweep() {
  return messagesResetQueue.add(
    'sweep',
    {},
    {
      repeat: { every: SWEEP_INTERVAL_MS },
      jobId: 'messages-reset-sweep',
    }
  );
}

export const messagesResetWorker = new Worker(
  QUEUE_NAME,
  async () => {
    const usersToReset = await User.findAll({
      where: {
        plan_status: 'active',
        messages_reset_at: { [Op.lt]: new Date() },
        is_admin: false,
      },
      include: [
        {
          model: Plan,
          as: 'plan',
          where: { max_messages_per_month: { [Op.gt]: 0 } },
          required: true,
        },
      ],
    });

    for (const user of usersToReset) {
      try {
        await user.update({
          messages_this_month: 0,
          messages_reset_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        });
      } catch (err) {
        console.error(
          `[messagesResetSweep] Falha ao resetar usuário ${user.id}:`,
          err.message
        );
      }
    }

    return { processed: usersToReset.length };
  },
  {
    connection: redis,
    concurrency: 1,
  }
);

messagesResetWorker.on('failed', (job, err) => {
  console.error(`[messagesResetSweep] Job ${job.id} falhou:`, err.message);
});
