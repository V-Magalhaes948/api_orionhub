import { Worker } from 'bullmq';
import redis from '../queues/redis.js';
import webhookService from '../services/webhookService.js';

export const webhookWorker = new Worker(
  'webhook',
  async (job) => {
    await webhookService.process(job.data);
  },
  {
    connection: redis,
    concurrency: 5,
  }
);

webhookWorker.on('failed', (job, err) => {
  console.error(`[Worker] Job ${job.id} falhou:`, err.message);
});

webhookWorker.on('stalled', (jobId) => {
  console.warn(`[Worker] Job ${jobId} travado (stalled).`);
});
