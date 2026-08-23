import crypto from 'node:crypto';
import { OAuth2Client } from 'google-auth-library';
import { prisma } from './db.js';
import { config } from './config.js';

const googleClient = new OAuth2Client(config.googleClientId);
const cookieName = 'scheduler_session';

function sign(value: string): string {
  return `${value}.${crypto.createHmac('sha256', config.sessionSecret).update(value).digest('hex')}`;
}

export async function verifyGoogleCredential(credential: string) {
  const ticket = await googleClient.verifyIdToken({ idToken: credential, audience: config.googleClientId });
  const payload = ticket.getPayload();
  if (!payload?.sub || !payload.email || !payload.name) throw new Error('Google profile is incomplete');
  const user = await prisma.user.upsert({ where: { googleId: payload.sub }, update: { email: payload.email, name: payload.name, avatarUrl: payload.picture }, create: { googleId: payload.sub, email: payload.email, name: payload.name, avatarUrl: payload.picture } });
  return { user, cookie: sign(user.id) };
}

export function sessionCookieName() { return cookieName; }
export async function userFromCookie(value?: string) {
  if (!value) return null;
  const [userId, signature] = value.split('.');
  const expected = crypto.createHmac('sha256', config.sessionSecret).update(userId).digest('hex');
  if (!userId || !signature || signature.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return null;
  return prisma.user.findUnique({ where: { id: userId } });
}
