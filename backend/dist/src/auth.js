"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.verifyGoogleCredential = verifyGoogleCredential;
exports.sessionCookieName = sessionCookieName;
exports.userFromCookie = userFromCookie;
const node_crypto_1 = __importDefault(require("node:crypto"));
const google_auth_library_1 = require("google-auth-library");
const db_js_1 = require("./db.js");
const config_js_1 = require("./config.js");
const googleClient = new google_auth_library_1.OAuth2Client(config_js_1.config.googleClientId);
const cookieName = 'scheduler_session';
function sign(value) {
    return `${value}.${node_crypto_1.default.createHmac('sha256', config_js_1.config.sessionSecret).update(value).digest('hex')}`;
}
async function verifyGoogleCredential(credential) {
    const ticket = await googleClient.verifyIdToken({ idToken: credential, audience: config_js_1.config.googleClientId });
    const payload = ticket.getPayload();
    if (!payload?.sub || !payload.email || !payload.name)
        throw new Error('Google profile is incomplete');
    const user = await db_js_1.prisma.user.upsert({ where: { googleId: payload.sub }, update: { email: payload.email, name: payload.name, avatarUrl: payload.picture }, create: { googleId: payload.sub, email: payload.email, name: payload.name, avatarUrl: payload.picture } });
    return { user, cookie: sign(user.id) };
}
function sessionCookieName() { return cookieName; }
async function userFromCookie(value) {
    if (!value)
        return null;
    const [userId, signature] = value.split('.');
    const expected = node_crypto_1.default.createHmac('sha256', config_js_1.config.sessionSecret).update(userId).digest('hex');
    if (!userId || !signature || signature.length !== expected.length || !node_crypto_1.default.timingSafeEqual(Buffer.from(signature), Buffer.from(expected)))
        return null;
    return db_js_1.prisma.user.findUnique({ where: { id: userId } });
}
