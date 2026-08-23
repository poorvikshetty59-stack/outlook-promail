import { prisma } from './db.js';
import { enqueueScheduledEmail } from './queue.js';

export async function recoverScheduledEmails(): Promise<number> {
  await prisma.scheduledEmail.updateMany({ where: { status: 'processing' }, data: { status: 'scheduled', error: null } });
  const pending = await prisma.scheduledEmail.findMany({ where: { status: 'scheduled' }, select: { id: true, scheduledTime: true } });
  await Promise.all(pending.map(enqueueScheduledEmail));
  return pending.length;
}
