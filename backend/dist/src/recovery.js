"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.recoverScheduledEmails = recoverScheduledEmails;
const db_js_1 = require("./db.js");
const queue_js_1 = require("./queue.js");
async function recoverScheduledEmails() {
    await db_js_1.prisma.scheduledEmail.updateMany({ where: { status: 'processing' }, data: { status: 'scheduled', error: null } });
    const pending = await db_js_1.prisma.scheduledEmail.findMany({ where: { status: 'scheduled' }, select: { id: true, scheduledTime: true } });
    await Promise.all(pending.map(queue_js_1.enqueueScheduledEmail));
    return pending.length;
}
