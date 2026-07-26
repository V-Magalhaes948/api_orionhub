import { Queue } from 'bullmq';
import redis from './redis.js';

export const webhookQueue = new Queue('webhook', {
  connection: redis,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 1000 },
    removeOnComplete: true,
    removeOnFail: 1000,
  },
});
