import { Queue } from 'bullmq';
import redisClient from '../redis.js';

export const emailQueue = new Queue('email', {
  connection: redisClient,
  defaultJobOptions: {
    attempts:    5,
    backoff:     { type: 'exponential', delay: 1000 },
    removeOnComplete: 100,
    removeOnFail:    500,
  },
});

export const queueEmail = async ({ type, recipient, payload }) => {
  return emailQueue.add(type, { type, recipient, payload }, {
    jobId: `${type}:${recipient}:${Date.now()}`,
  });
};