import { Worker } from 'bullmq';
import redis from '../queues/redis.js';
import { sendPasswordResetEmail } from '../lib/mailer.js';

export const emailWorker = new Worker(
  'email',
  async (job) => {
    if (job.name === 'password-reset') {
      const { to, resetUrl } = job.data;
      await sendPasswordResetEmail(to, resetUrl);
    }
  },
  { connection: redis }
);

emailWorker.on('completed', (job) => {});

emailWorker.on('failed', (job, err) => {
  console.error(
    `[emailWorker] job ${job?.id} (${job?.name}) falhou após todas as tentativas:`,
    err.message
  );
});
