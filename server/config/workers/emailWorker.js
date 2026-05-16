import { Worker } from 'bullmq';
import redisClient from '../config/redis.js';
import sendEmail from '../utils/sendEmail.js';
import { emailTemplates } from '../utils/emailTemplates.js';

// Dedupe: skip if same type+rideId sent in last 5 min
const isDupe = async (type, rideId) => {
  if (!rideId) return false;
  const key = `mail:${type}:${rideId}`;
  const exists = await redisClient.get(key);
  if (exists) return true;
  await redisClient.setEx(key, 300, '1');
  return false;
};

const worker = new Worker('email', async (job) => {
  const { type, recipient, payload } = job.data;

  if (await isDupe(type, payload?.rideId)) {
    console.log(`[emailWorker] dedupe skip: ${type} rideId=${payload?.rideId}`);
    return;
  }

  const template = emailTemplates[type];
  if (!template) throw new Error(`Unknown email type: ${type}`);

  await sendEmail({
    email:   recipient,
    subject: template.subject(payload),
    html:    template.html(payload),
    attachments: payload.attachments || [],
  });
}, {
  connection: redisClient,
  concurrency: 5,
});

worker.on('failed', (job, err) => {
  console.error(`[emailWorker] job ${job.id} failed:`, err.message);
});

export default worker;