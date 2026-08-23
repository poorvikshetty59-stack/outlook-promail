import { describe, expect, it, vi } from 'vitest';
import { RateLimiter, RATE_LIMIT_SCRIPT } from '../src/rateLimiter.js';

describe('RateLimiter', () => {
  it('executes the atomic Lua increment script and returns its decision', async () => {
    const evalMock = vi.fn().mockResolvedValueOnce(1).mockResolvedValueOnce(0);
    const limiter = new RateLimiter({ eval: evalMock } as never);
    expect(await limiter.tryConsume(2, undefined, new Date('2026-01-01T00:00:00Z'))).toBe(true);
    expect(await limiter.tryConsume(2, undefined, new Date('2026-01-01T00:00:00Z'))).toBe(false);
    const expectedWindow = Math.floor(new Date('2026-01-01T00:00:00Z').getTime() / 3_600_000);
    expect(evalMock).toHaveBeenCalledWith(RATE_LIMIT_SCRIPT, 1, `email-rate:v2:${expectedWindow}`, '2');
  });
});
