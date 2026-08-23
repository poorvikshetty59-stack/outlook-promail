import nodemailer from 'nodemailer';
import { prisma } from './db.js';
import { config } from './config.js';

async function main(): Promise<void> {
  console.log('Creating Ethereal sender mailboxes...');

  for (let index = 0; index < config.senderPoolSize; index += 1) {
    const account = await nodemailer.createTestAccount();

    await prisma.sender.upsert({
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

    console.log(
      `Created sender ${index + 1}: ${account.user}`
    );
  }

  const senderCount = await prisma.sender.count();

  console.log(
    `Successfully configured ${senderCount} sender mailbox(es).`
  );
}

main()
  .catch((error: unknown) => {
    console.error('Failed to seed sender mailboxes:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });