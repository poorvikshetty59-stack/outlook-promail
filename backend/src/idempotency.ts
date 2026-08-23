import { prisma } from './db.js';

export async function claimScheduledEmail(emailId: string): Promise<boolean> {
  const result = await prisma.scheduledEmail.updateMany({ where: { id: emailId, status: 'scheduled' }, data: { status: 'processing', attempts: { increment: 1 } } });
  return result.count === 1;
}