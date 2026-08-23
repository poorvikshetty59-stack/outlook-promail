import { Queue } from 'bullmq';
import { config } from './config.js';

export const EMAIL_QUEUE_NAME = 'scheduled-email';
export const emailQueue = new Queue(EMAIL_QUEUE_NAME, {
  connection: { url: config.redisUrl },
  skipVersionCheck: true
});

export async function enqueueScheduledEmail(email: { id: string; scheduledTime: Date }): Promise<void> {
  await emailQueue.add('send-email', { emailId: email.id }, {
    jobId: email.id,
    delay: Math.max(0, email.scheduledTime.getTime() - Date.now()),
    removeOnComplete: 1000,
    removeOnFail: 5000
  });
}
