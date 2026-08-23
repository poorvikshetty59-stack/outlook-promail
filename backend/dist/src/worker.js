"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.emailWorker = void 0;
const bullmq_1 = require("bullmq");
const nodemailer_1 = __importDefault(require("nodemailer"));
const ioredis_1 = __importDefault(require("ioredis"));
const db_js_1 = require("./db.js");
const config_js_1 = require("./config.js");
const queue_js_1 = require("./queue.js");
const rateLimiter_js_1 = require("./rateLimiter.js");
const scheduling_js_1 = require("./scheduling.js");
const idempotency_js_1 = require("./idempotency.js");
const recovery_js_1 = require("./recovery.js");
const pacingRedis = new ioredis_1.default(config_js_1.config.redisUrl);
const pacingScript = `
local now = tonumber(ARGV[1])
local delay = tonumber(ARGV[2])
local previous = tonumber(redis.call('GET', KEYS[1]) or '0')
local slot = math.max(now, previous + delay)
redis.call('SET', KEYS[1], slot, 'PX', 3600000)
return slot
`;
async function waitForSendSlot() {
    const slot = Number(await pacingRedis.eval(pacingScript, 1, 'email-send-pacing', String(Date.now()), String(config_js_1.config.minSendDelayMs)));
    const wait = slot - Date.now();
    if (wait > 0) {
        await new Promise(resolve => setTimeout(resolve, wait));
    }
}
function createMailTransport(sender) {
    if (!config_js_1.config.smtpHost ||
        !config_js_1.config.smtpUser ||
        !config_js_1.config.smtpPassword) {
        if (!sender)
            throw new Error('SMTP is not configured and no seeded sender mailbox is available');
        return {
            transport: nodemailer_1.default.createTransport({
                host: sender.host,
                port: sender.port,
                secure: sender.port === 465,
                auth: { user: sender.username, pass: sender.password },
                connectionTimeout: 15000
            }),
            from: sender.email
        };
    }
    const transport = nodemailer_1.default.createTransport({
        host: config_js_1.config.smtpHost,
        port: config_js_1.config.smtpPort,
        secure: config_js_1.config.smtpPort === 465,
        auth: {
            user: config_js_1.config.smtpUser,
            pass: config_js_1.config.smtpPassword
        },
        connectionTimeout: 15000
    });
    return {
        transport,
        from: config_js_1.config.smtpFrom || config_js_1.config.smtpUser
    };
}
async function processEmail(job) {
    const email = await db_js_1.prisma.scheduledEmail.findUnique({
        where: {
            id: job.data.emailId
        },
        include: {
            campaign: true
        }
    });
    if (!email || email.status !== 'scheduled') {
        return;
    }
    console.log(`Processing email job: ${job.id}`);
    if (!(await (0, idempotency_js_1.claimScheduledEmail)(email.id))) {
        return;
    }
    const effectiveLimit = Math.min(email.campaign.effectiveHourlyLimit, config_js_1.config.maxEmailsPerHour);
    const allowed = await rateLimiter_js_1.rateLimiter.tryConsume(effectiveLimit, email.senderId ?? undefined);
    if (!allowed) {
        console.log(`Rate limit reached; delaying job: ${job.id}`);
        await db_js_1.prisma.scheduledEmail.update({
            where: {
                id: email.id
            },
            data: {
                status: 'scheduled'
            }
        });
        await job.moveToDelayed((0, scheduling_js_1.nextHourWithJitter)().getTime(), job.token);
        throw new bullmq_1.DelayedError();
    }
    try {
        await waitForSendSlot();
        const sender = email.senderId
            ? await db_js_1.prisma.sender.findUnique({ where: { id: email.senderId } })
            : await db_js_1.prisma.sender.findFirst();
        const mailer = createMailTransport(sender ?? undefined);
        console.log(`Sending email to: ${email.recipient}`);
        const result = await mailer.transport.sendMail({
            from: mailer.from,
            to: email.recipient,
            subject: email.campaign.subject,
            text: email.campaign.body
        });
        await db_js_1.prisma.scheduledEmail.update({
            where: {
                id: email.id
            },
            data: {
                status: 'sent',
                sentAt: new Date(),
                messageId: result.messageId,
                senderId: sender?.id
            }
        });
        console.log(`Email sent successfully; job completed: ${job.id}`);
        console.log(`Message ID: ${result.messageId}`);
    }
    catch (error) {
        await db_js_1.prisma.scheduledEmail.update({
            where: {
                id: email.id
            },
            data: {
                status: 'failed',
                failedAt: new Date(),
                error: error instanceof Error
                    ? error.message
                    : String(error)
            }
        });
        console.error(`Email sending failed; job marked as failed: ${job.id}`, error);
        throw error;
    }
}
exports.emailWorker = new bullmq_1.Worker(queue_js_1.EMAIL_QUEUE_NAME, processEmail, {
    connection: {
        url: config_js_1.config.redisUrl
    },
    concurrency: config_js_1.config.workerConcurrency,
    skipVersionCheck: true
});
exports.emailWorker.on('ready', () => {
    console.log('Worker started');
    console.log('Redis connected');
    const smtpTransport = config_js_1.config.smtpHost &&
        config_js_1.config.smtpUser &&
        config_js_1.config.smtpPassword
        ? nodemailer_1.default.createTransport({
            host: config_js_1.config.smtpHost,
            port: config_js_1.config.smtpPort,
            secure: config_js_1.config.smtpPort === 465,
            auth: {
                user: config_js_1.config.smtpUser,
                pass: config_js_1.config.smtpPassword
            }
        })
        : null;
    const smtpCheck = smtpTransport ? smtpTransport.verify() : Promise.resolve();
    void smtpCheck
        .then(() => {
        console.log(config_js_1.config.smtpHost
            ? `SMTP connected: ${config_js_1.config.smtpHost}:${config_js_1.config.smtpPort}`
            : 'SMTP credentials not configured; using seeded sender mailbox');
    })
        .then(() => db_js_1.prisma.$queryRaw `SELECT 1`)
        .then(() => (0, recovery_js_1.recoverScheduledEmails)())
        .then(count => {
        console.log(`Database connected; recovered ${count} scheduled emails`);
    })
        .then(() => {
        console.log('Waiting for scheduled email jobs...');
    })
        .catch(error => {
        console.error('Worker startup failed', error);
    });
});
exports.emailWorker.on('error', error => {
    console.error('Worker Redis error', error);
});
exports.emailWorker.on('failed', (job, error) => {
    console.error(`Email job ${job?.id} failed`, error);
});
