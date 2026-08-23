"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const rateLimiter_js_1 = require("../src/rateLimiter.js");
(0, vitest_1.describe)('RateLimiter', () => {
    (0, vitest_1.it)('executes the atomic Lua increment script and returns its decision', async () => {
        const evalMock = vitest_1.vi.fn().mockResolvedValueOnce(1).mockResolvedValueOnce(0);
        const limiter = new rateLimiter_js_1.RateLimiter({ eval: evalMock });
        (0, vitest_1.expect)(await limiter.tryConsume(2, undefined, new Date('2026-01-01T00:00:00Z'))).toBe(true);
        (0, vitest_1.expect)(await limiter.tryConsume(2, undefined, new Date('2026-01-01T00:00:00Z'))).toBe(false);
        const expectedWindow = Math.floor(new Date('2026-01-01T00:00:00Z').getTime() / 3_600_000);
        (0, vitest_1.expect)(evalMock).toHaveBeenCalledWith(rateLimiter_js_1.RATE_LIMIT_SCRIPT, 1, `email-rate:v2:${expectedWindow}`, '2');
    });
});
