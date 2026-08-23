"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.router = void 0;
const express_1 = require("express");
const client_1 = require("@prisma/client");
const zod_1 = require("zod");
const db_js_1 = require("./db.js");
const config_js_1 = require("./config.js");
const scheduling_js_1 = require("./scheduling.js");
const queue_js_1 = require("./queue.js");
const auth_js_1 = require("./auth.js");
exports.router = (0, express_1.Router)();
const scheduleSchema = zod_1.z.object({ subject: zod_1.z.string().min(1), body: zod_1.z.string().min(1), recipients: zod_1.z.array(zod_1.z.string().email()).min(1), startTime: zod_1.z.coerce.date().refine(time => time.getTime() > Date.now(), 'Scheduled time must be in the future'), delayMs: zod_1.z.number().int().nonnegative(), hourlyLimit: zod_1.z.number().int().positive() });
exports.router.post('/auth/google', async (req, res) => { try {
    const result = await (0, auth_js_1.verifyGoogleCredential)(zod_1.z.object({ credential: zod_1.z.string() }).parse(req.body).credential);
    res.cookie((0, auth_js_1.sessionCookieName)(), result.cookie, { httpOnly: true, sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax', secure: process.env.NODE_ENV === 'production', maxAge: 7 * 86400000 });
    res.json(result.user);
}
catch {
    res.status(401).json({ error: 'Google authentication failed' });
} });
exports.router.post('/auth/logout', (_req, res) => { res.clearCookie((0, auth_js_1.sessionCookieName)(), { sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax', secure: process.env.NODE_ENV === 'production', path: '/' }); res.status(204).end(); });
async function requireUser(req, res) { const user = await (0, auth_js_1.userFromCookie)(req.cookies?.[(0, auth_js_1.sessionCookieName)()]); if (!user) {
    res.status(401).json({ error: 'Authentication required' });
    return null;
} return user; }
exports.router.get('/auth/me', async (req, res) => { const user = await (0, auth_js_1.userFromCookie)(req.cookies?.[(0, auth_js_1.sessionCookieName)()]); if (!user)
    return res.status(401).json({ error: 'Authentication required' }); res.json(user); });
exports.router.get('/dashboard', async (req, res) => {
    const user = await requireUser(req, res);
    if (!user)
        return;
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const sevenDaysAgo = new Date(startOfToday);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
    const userCampaigns = { campaign: { userId: user.id } };
    const [queued, processing, sent, failed, sentToday, totalAttempted, recentActivity, recentCampaigns, recentSent, recentScheduled] = await Promise.all([
        db_js_1.prisma.scheduledEmail.count({ where: { ...userCampaigns, status: client_1.EmailStatus.scheduled } }),
        db_js_1.prisma.scheduledEmail.count({ where: { ...userCampaigns, status: client_1.EmailStatus.processing } }),
        db_js_1.prisma.scheduledEmail.count({ where: { ...userCampaigns, status: client_1.EmailStatus.sent } }),
        db_js_1.prisma.scheduledEmail.count({ where: { ...userCampaigns, status: client_1.EmailStatus.failed } }),
        db_js_1.prisma.scheduledEmail.count({ where: { ...userCampaigns, status: client_1.EmailStatus.sent, sentAt: { gte: startOfToday } } }),
        db_js_1.prisma.scheduledEmail.count({ where: { ...userCampaigns, status: { in: [client_1.EmailStatus.sent, client_1.EmailStatus.failed] } } }),
        db_js_1.prisma.scheduledEmail.findMany({ where: userCampaigns, include: { campaign: { select: { subject: true } } }, orderBy: { updatedAt: 'desc' }, take: 8 }),
        db_js_1.prisma.campaign.findMany({ where: { userId: user.id }, include: { _count: { select: { emails: true } }, emails: { select: { status: true, scheduledTime: true }, orderBy: { scheduledTime: 'asc' }, take: 1 } }, orderBy: { createdAt: 'desc' }, take: 5 }),
        db_js_1.prisma.scheduledEmail.findMany({ where: { ...userCampaigns, status: client_1.EmailStatus.sent, sentAt: { gte: sevenDaysAgo } }, select: { sentAt: true } }),
        db_js_1.prisma.scheduledEmail.findMany({ where: { ...userCampaigns, status: { in: [client_1.EmailStatus.scheduled, client_1.EmailStatus.processing] }, scheduledTime: { gte: sevenDaysAgo } }, select: { scheduledTime: true } })
    ]);
    const calendarKey = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    const volumeByDay = Array.from({ length: 7 }, (_, index) => {
        const date = new Date(sevenDaysAgo);
        date.setDate(date.getDate() + index);
        const key = calendarKey(date);
        return { date: key, label: date.toLocaleDateString('en-US', { weekday: 'short' }), sent: recentSent.filter(email => email.sentAt && calendarKey(email.sentAt) === key).length, planned: recentScheduled.filter(email => calendarKey(email.scheduledTime) === key).length };
    });
    const deliveryRate = totalAttempted === 0 ? 0 : Math.round((sent / totalAttempted) * 100);
    res.json({ metrics: { queued, sentToday, sent, failed, deliveryRate }, queue: { queued, processing, completed: sent, failed }, activity: recentActivity, campaigns: recentCampaigns, volumeByDay });
});
exports.router.post('/campaigns', async (req, res) => { const user = await requireUser(req, res); if (!user)
    return; const input = scheduleSchema.parse(req.body); const effective = Math.min(input.hourlyLimit, config_js_1.config.maxEmailsPerHour); const times = (0, scheduling_js_1.calculateScheduledTimes)(input.startTime, input.recipients.length, input.delayMs, effective); const senders = await db_js_1.prisma.sender.findMany({ orderBy: { createdAt: 'asc' } }); const campaign = await db_js_1.prisma.campaign.create({ data: { userId: user.id, subject: input.subject, body: input.body, requestedStartTime: input.startTime, delayMs: input.delayMs, requestedHourlyLimit: input.hourlyLimit, effectiveHourlyLimit: effective, emails: { create: input.recipients.map((recipient, index) => ({ recipient, scheduledTime: times[index], senderId: senders.length ? senders[index % senders.length].id : undefined })) } }, include: { emails: true } }); await Promise.all(campaign.emails.map(email => (0, queue_js_1.enqueueScheduledEmail)(email))); res.status(201).json(campaign); });
exports.router.get('/emails/:status', async (req, res) => { const user = await requireUser(req, res); if (!user)
    return; const where = req.params.status === 'sent' ? { status: { in: [client_1.EmailStatus.sent, client_1.EmailStatus.failed] }, campaign: { userId: user.id } } : { status: client_1.EmailStatus.scheduled, campaign: { userId: user.id } }; const emails = await db_js_1.prisma.scheduledEmail.findMany({ where, include: { campaign: true }, orderBy: { scheduledTime: 'asc' } }); res.json(emails); });
