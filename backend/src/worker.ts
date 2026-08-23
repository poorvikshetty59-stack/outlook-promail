import { DelayedError, Worker, Job } from 'bullmq';
import nodemailer from 'nodemailer';
import Redis from 'ioredis';

import { prisma } from './db.js';
import { config } from './config.js';
import { EMAIL_QUEUE_NAME } from './queue.js';
import { rateLimiter } from './rateLimiter.js';
import { nextHourWithJitter } from './scheduling.js';
import { claimScheduledEmail } from './idempotency.js';
import { recoverScheduledEmails } from './recovery.js';

const pacingRedis = new Redis(config.redisUrl);

const pacingScript = `
local now = tonumber(ARGV[1])
local delay = tonumber(ARGV[2])
local previous = tonumber(redis.call('GET', KEYS[1]) or '0')
local slot = math.max(now, previous + delay)
redis.call('SET', KEYS[1], slot, 'PX', 3600000)
return slot
`;

async function waitForSendSlot(): Promise<void> {
  const slot = Number(
    await pacingRedis.eval(
      pacingScript,
      1,
      'email-send-pacing',
      String(Date.now()),
      String(config.minSendDelayMs)
    )
  );

  const wait = slot - Date.now();

  if (wait > 0) {
    await new Promise(resolve => setTimeout(resolve, wait));
  }
}

function createMailTransport(sender?: { host: string; port: number; username: string; password: string; email: string }) {
  if (
    !config.smtpHost ||
    !config.smtpUser ||
    !config.smtpPassword
  ) {
    if (!sender) throw new Error('SMTP is not configured and no seeded sender mailbox is available');

    return {
      transport: nodemailer.createTransport({
        host: sender.host,
        port: sender.port,
        secure: sender.port === 465,
        auth: { user: sender.username, pass: sender.password },
        connectionTimeout: 15000
      }),
      from: sender.email
    };
  }

  const transport = nodemailer.createTransport({
    host: config.smtpHost,
    port: config.smtpPort,
    secure: config.smtpPort === 465,
    auth: {
      user: config.smtpUser,
      pass: config.smtpPassword
      },
      connectionTimeout: 15000
  });

  return {
    transport,
    from: config.smtpFrom || config.smtpUser
  };
}

async function processEmail(
  job: Job<{ emailId: string }>
): Promise<void> {
  const email = await prisma.scheduledEmail.findUnique({
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

  if (!(await claimScheduledEmail(email.id))) {
    return;
  }

  const effectiveLimit = Math.min(
    email.campaign.effectiveHourlyLimit,
    config.maxEmailsPerHour
  );

  const allowed = await rateLimiter.tryConsume(
    effectiveLimit,
    email.senderId ?? undefined
  );

  if (!allowed) {
    console.log(
      `Rate limit reached; delaying job: ${job.id}`
    );

    await prisma.scheduledEmail.update({
      where: {
        id: email.id
      },
      data: {
        status: 'scheduled'
      }
    });

    await job.moveToDelayed(
      nextHourWithJitter().getTime(),
      job.token
    );

    throw new DelayedError();
  }

  try {
    await waitForSendSlot();

    const sender = email.senderId
      ? await prisma.sender.findUnique({ where: { id: email.senderId } })
      : await prisma.sender.findFirst();
    const mailer = createMailTransport(sender ?? undefined);

    console.log(
      `Sending email to: ${email.recipient}`
    );

    const result = await mailer.transport.sendMail({
      from: mailer.from,
      to: email.recipient,
      subject: email.campaign.subject,
      text: email.campaign.body
    });

    await prisma.scheduledEmail.update({
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

    console.log(
      `Email sent successfully; job completed: ${job.id}`
    );

    console.log(
      `Message ID: ${result.messageId}`
    );
  } catch (error) {
    await prisma.scheduledEmail.update({
      where: {
        id: email.id
      },
      data: {
        status: 'failed',
        failedAt: new Date(),
        error:
          error instanceof Error
            ? error.message
            : String(error)
      }
    });

    console.error(
      `Email sending failed; job marked as failed: ${job.id}`,
      error
    );

    throw error;
  }
}

export const emailWorker = new Worker(
  EMAIL_QUEUE_NAME,
  processEmail,
  {
    connection: {
      url: config.redisUrl
    },
    concurrency: config.workerConcurrency,
    skipVersionCheck: true
  }
);

emailWorker.on('ready', () => {
  console.log('Worker started');
  console.log('Redis connected');

  const smtpTransport =
    config.smtpHost &&
    config.smtpUser &&
    config.smtpPassword
      ? nodemailer.createTransport({
          host: config.smtpHost,
          port: config.smtpPort,
          secure: config.smtpPort === 465,
          auth: {
            user: config.smtpUser,
            pass: config.smtpPassword
          }
        })
      : null;

  const smtpCheck = smtpTransport ? smtpTransport.verify() : Promise.resolve();

  void smtpCheck
    .then(() => {
      console.log(config.smtpHost
        ? `SMTP connected: ${config.smtpHost}:${config.smtpPort}`
        : 'SMTP credentials not configured; using seeded sender mailbox');
    })
    .then(() => prisma.$queryRaw`SELECT 1`)
    .then(() => recoverScheduledEmails())
    .then(count => {
      console.log(
        `Database connected; recovered ${count} scheduled emails`
      );
    })
    .then(() => {
      console.log(
        'Waiting for scheduled email jobs...'
      );
    })
    .catch(error => {
      console.error(
        'Worker startup failed',
        error
      );
    });
});

emailWorker.on('error', error => {
  console.error(
    'Worker Redis error',
    error
  );
});

emailWorker.on('failed', (job, error) => {
  console.error(
    `Email job ${job?.id} failed`,
    error
  );
});