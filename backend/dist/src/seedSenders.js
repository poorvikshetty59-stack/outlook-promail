"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const nodemailer_1 = __importDefault(require("nodemailer"));
const db_js_1 = require("./db.js");
const config_js_1 = require("./config.js");
async function main() {
    console.log('Creating Ethereal sender mailboxes...');
    for (let index = 0; index < config_js_1.config.senderPoolSize; index += 1) {
        const account = await nodemailer_1.default.createTestAccount();
        await db_js_1.prisma.sender.upsert({
            where: {
                email: account.user
            },
            update: {
                username: account.user,
                password: account.pass,
                host: account.smtp.host,
                port: account.smtp.port,
                name: `Promail ${index + 1}`
            },
            create: {
                email: account.user,
                username: account.user,
                password: account.pass,
                host: account.smtp.host,
                port: account.smtp.port,
                name: `Promail ${index + 1}`
            }
        });
        console.log(`Created sender ${index + 1}: ${account.user}`);
    }
    const senderCount = await db_js_1.prisma.sender.count();
    console.log(`Successfully configured ${senderCount} sender mailbox(es).`);
}
main()
    .catch((error) => {
    console.error('Failed to seed sender mailboxes:', error);
    process.exitCode = 1;
})
    .finally(async () => {
    await db_js_1.prisma.$disconnect();
});
