"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.rateLimiter = exports.RateLimiter = exports.RATE_LIMIT_SCRIPT = void 0;
const ioredis_1 = __importDefault(require("ioredis"));
const config_js_1 = require("./config.js");
exports.RATE_LIMIT_SCRIPT = `
local current = redis.call('GET', KEYS[1])

if current and tonumber(current) >= tonumber(ARGV[1]) then
  return 0
end

local next = redis.call('INCR', KEYS[1])

if next == 1 then
  redis.call('EXPIRE', KEYS[1], 3600)
end

return 1
`;
class RateLimiter {
    redis;
    constructor(redis) {
        this.redis = redis;
    }
    async tryConsume(limit, senderId, now = new Date()) {
        const window = Math.floor(now.getTime() / 3_600_000);
        const scope = config_js_1.config.rateLimitScope === 'per-sender'
            ? `:${senderId ?? 'unassigned'}`
            : '';
        const key = `email-rate:v2:${window}${scope}`;
        const result = await this.redis.eval(exports.RATE_LIMIT_SCRIPT, 1, key, String(limit));
        return Number(result) === 1;
    }
}
exports.RateLimiter = RateLimiter;
exports.rateLimiter = new RateLimiter(new ioredis_1.default(config_js_1.config.redisUrl));
