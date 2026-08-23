import Redis from 'ioredis';
import { config } from './config.js';

export const RATE_LIMIT_SCRIPT = `
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

export class RateLimiter {
  constructor(
    private readonly redis: Pick<Redis, 'eval'>
  ) {}

  async tryConsume(
    limit: number,
    senderId?: string,
    now = new Date()
  ): Promise<boolean> {
    const window = Math.floor(
      now.getTime() / 3_600_000
    );

    const scope =
      config.rateLimitScope === 'per-sender'
        ? `:${senderId ?? 'unassigned'}`
        : '';

    const key = `email-rate:v2:${window}${scope}`;

    const result = await this.redis.eval(
      RATE_LIMIT_SCRIPT,
      1,
      key,
      String(limit)
    );

    return Number(result) === 1;
  }
}

export const rateLimiter = new RateLimiter(
  new Redis(config.redisUrl)
);