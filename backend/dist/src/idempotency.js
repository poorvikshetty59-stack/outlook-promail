"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.claimScheduledEmail = claimScheduledEmail;
const db_js_1 = require("./db.js");
async function claimScheduledEmail(emailId) {
    const result = await db_js_1.prisma.scheduledEmail.updateMany({ where: { id: emailId, status: 'scheduled' }, data: { status: 'processing', attempts: { increment: 1 } } });
    return result.count === 1;
}
