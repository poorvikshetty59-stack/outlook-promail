"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.config = void 0;
require("dotenv/config");
const configuredRedisUrl = process.env.REDIS_URL ?? 'redis://localhost:6379';
const redisUrl = configuredRedisUrl.includes('.upstash.io') &&
    configuredRedisUrl.startsWith('redis://')
    ? `rediss://${configuredRedisUrl.slice('redis://'.length)}`
    : configuredRedisUrl;
if (process.env.NODE_ENV === 'production' &&
    /localhost|127\.0\.0\.1/.test(configuredRedisUrl)) {
    throw new Error('REDIS_URL must point to a hosted Redis service in production');
}
if (process.env.NODE_ENV === 'production' &&
    /localhost|127\.0\.0\.1/.test(process.env.DATABASE_URL ?? '')) {
    throw new Error('DATABASE_URL must point to hosted PostgreSQL in production');
}
exports.config = {
    port: Number(process.env.PORT ?? 4000),
    frontendUrl: process.env.FRONTEND_URL ?? 'http://localhost:3000',
    redisUrl,
    maxEmailsPerHour: Number(process.env.MAX_EMAILS_PER_HOUR ?? 100),
    rateLimitScope: process.env.RATE_LIMIT_SCOPE === 'per-sender'
        ? 'per-sender'
        : 'global',
    workerConcurrency: Number(process.env.WORKER_CONCURRENCY ?? 5),
    minSendDelayMs: Number(process.env.MIN_SEND_DELAY_MS ?? 250),
    senderPoolSize: Number(process.env.ETHEREAL_SENDER_POOL_SIZE ?? 3),
    // Mailtrap SMTP
    smtpHost: process.env.SMTP_HOST ?? '',
    smtpPort: Number(process.env.SMTP_PORT ?? 2525),
    smtpUser: process.env.SMTP_USER ?? '',
    smtpPassword: process.env.SMTP_PASSWORD ?? '',
    smtpFrom: process.env.SMTP_FROM ?? 'test@example.com',
    googleClientId: process.env.GOOGLE_CLIENT_ID ?? '',
    sessionSecret: process.env.SESSION_SECRET ??
        'local-development-secret'
};
