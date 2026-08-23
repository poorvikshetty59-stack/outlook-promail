import { Router, Request, Response } from 'express';
import { EmailStatus } from '@prisma/client';
import { z } from 'zod';
import { prisma } from './db.js';
import { config } from './config.js';
import { calculateScheduledTimes } from './scheduling.js';
import { enqueueScheduledEmail } from './queue.js';
import { sessionCookieName, userFromCookie, verifyGoogleCredential } from './auth.js';

export const router = Router();
const scheduleSchema = z.object({ subject: z.string().min(1), body: z.string().min(1), recipients: z.array(z.string().email()).min(1), startTime: z.coerce.date().refine(time => time.getTime() > Date.now(), 'Scheduled time must be in the future'), delayMs: z.number().int().nonnegative(), hourlyLimit: z.number().int().positive() });

router.post('/auth/google', async (req, res) => { try { const result = await verifyGoogleCredential(z.object({ credential: z.string() }).parse(req.body).credential); res.cookie(sessionCookieName(), result.cookie, { httpOnly: true, sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax', secure: process.env.NODE_ENV === 'production', maxAge: 7 * 86400000 }); res.json(result.user); } catch { res.status(401).json({ error: 'Google authentication failed' }); } });
router.post('/auth/logout', (_req, res) => { res.clearCookie(sessionCookieName(), { sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax', secure: process.env.NODE_ENV === 'production', path: '/' }); res.status(204).end(); });

async function requireUser(req: Request, res: Response) { const user = await userFromCookie(req.cookies?.[sessionCookieName()]); if (!user) { res.status(401).json({ error: 'Authentication required' }); return null; } return user; }
router.get('/auth/me', async (req, res) => { const user = await userFromCookie(req.cookies?.[sessionCookieName()]); if (!user) return res.status(401).json({ error: 'Authentication required' }); res.json(user); });
router.get('/dashboard', async (req, res) => {
	const user = await requireUser(req, res);
	if (!user) return;

	const now = new Date();
	const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
	const sevenDaysAgo = new Date(startOfToday);
	sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
	const userCampaigns = { campaign: { userId: user.id } };
	const [queued, processing, sent, failed, sentToday, totalAttempted, recentActivity, recentCampaigns, recentSent, recentScheduled] = await Promise.all([
		prisma.scheduledEmail.count({ where: { ...userCampaigns, status: EmailStatus.scheduled } }),
		prisma.scheduledEmail.count({ where: { ...userCampaigns, status: EmailStatus.processing } }),
		prisma.scheduledEmail.count({ where: { ...userCampaigns, status: EmailStatus.sent } }),
		prisma.scheduledEmail.count({ where: { ...userCampaigns, status: EmailStatus.failed } }),
		prisma.scheduledEmail.count({ where: { ...userCampaigns, status: EmailStatus.sent, sentAt: { gte: startOfToday } } }),
		prisma.scheduledEmail.count({ where: { ...userCampaigns, status: { in: [EmailStatus.sent, EmailStatus.failed] } } }),
		prisma.scheduledEmail.findMany({ where: userCampaigns, include: { campaign: { select: { subject: true } } }, orderBy: { updatedAt: 'desc' }, take: 8 }),
		prisma.campaign.findMany({ where: { userId: user.id }, include: { _count: { select: { emails: true } }, emails: { select: { status: true, scheduledTime: true }, orderBy: { scheduledTime: 'asc' }, take: 1 } }, orderBy: { createdAt: 'desc' }, take: 5 }),
		prisma.scheduledEmail.findMany({ where: { ...userCampaigns, status: EmailStatus.sent, sentAt: { gte: sevenDaysAgo } }, select: { sentAt: true } }),
		prisma.scheduledEmail.findMany({ where: { ...userCampaigns, status: { in: [EmailStatus.scheduled, EmailStatus.processing] }, scheduledTime: { gte: sevenDaysAgo } }, select: { scheduledTime: true } })
	]);

	const calendarKey = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
	const volumeByDay = Array.from({ length: 7 }, (_, index) => {
		const date = new Date(sevenDaysAgo);
		date.setDate(date.getDate() + index);
		const key = calendarKey(date);
		return { date: key, label: date.toLocaleDateString('en-US', { weekday: 'short' }), sent: recentSent.filter(email => email.sentAt && calendarKey(email.sentAt) === key).length, planned: recentScheduled.filter(email => calendarKey(email.scheduledTime) === key).length };
	});
	const deliveryRate = totalAttempted === 0 ? 0 : Math.round((sent / totalAttempted) * 100);

	res.json({ metrics: { queued, sentToday, sent, failed, deliveryRate }, queue: { queued, processing, completed: sent, failed }, activity: recentActivity, campaigns: recentCampaigns, volumeByDay });
});
router.post('/campaigns', async (req, res) => { const user = await requireUser(req, res); if (!user) return; const input = scheduleSchema.parse(req.body); const effective = Math.min(input.hourlyLimit, config.maxEmailsPerHour); const times = calculateScheduledTimes(input.startTime, input.recipients.length, input.delayMs, effective); const senders = await prisma.sender.findMany({ orderBy: { createdAt: 'asc' } }); const campaign = await prisma.campaign.create({ data: { userId: user.id, subject: input.subject, body: input.body, requestedStartTime: input.startTime, delayMs: input.delayMs, requestedHourlyLimit: input.hourlyLimit, effectiveHourlyLimit: effective, emails: { create: input.recipients.map((recipient, index) => ({ recipient, scheduledTime: times[index], senderId: senders.length ? senders[index % senders.length].id : undefined })) } }, include: { emails: true } }); await Promise.all(campaign.emails.map(email => enqueueScheduledEmail(email))); res.status(201).json(campaign); });
router.get('/emails/:status', async (req, res) => { const user = await requireUser(req, res); if (!user) return; const where = req.params.status === 'sent' ? { status: { in: [EmailStatus.sent, EmailStatus.failed] }, campaign: { userId: user.id } } : { status: EmailStatus.scheduled, campaign: { userId: user.id } }; const emails = await prisma.scheduledEmail.findMany({ where, include: { campaign: true }, orderBy: { scheduledTime: 'asc' } }); res.json(emails); });
