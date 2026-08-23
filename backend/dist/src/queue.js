"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.emailQueue = exports.EMAIL_QUEUE_NAME = void 0;
exports.enqueueScheduledEmail = enqueueScheduledEmail;
const bullmq_1 = require("bullmq");
const config_js_1 = require("./config.js");
exports.EMAIL_QUEUE_NAME = 'scheduled-email';
exports.emailQueue = new bullmq_1.Queue(exports.EMAIL_QUEUE_NAME, {
    connection: { url: config_js_1.config.redisUrl },
    skipVersionCheck: true
});
async function enqueueScheduledEmail(email) {
    await exports.emailQueue.add('send-email', { emailId: email.id }, {
        jobId: email.id,
        delay: Math.max(0, email.scheduledTime.getTime() - Date.now()),
        removeOnComplete: 1000,
        removeOnFail: 5000
    });
}
