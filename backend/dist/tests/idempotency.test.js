"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const updateMany = vitest_1.vi.fn();
vitest_1.vi.mock('../src/db.js', () => ({ prisma: { scheduledEmail: { updateMany } } }));
(0, vitest_1.describe)('claimScheduledEmail', () => {
    (0, vitest_1.it)('only claims a scheduled row once', async () => {
        updateMany.mockResolvedValueOnce({ count: 1 }).mockResolvedValueOnce({ count: 0 });
        const { claimScheduledEmail } = await import('../src/idempotency.js');
        (0, vitest_1.expect)(await claimScheduledEmail('email-1')).toBe(true);
        (0, vitest_1.expect)(await claimScheduledEmail('email-1')).toBe(false);
        (0, vitest_1.expect)(updateMany).toHaveBeenCalledWith(vitest_1.expect.objectContaining({ where: { id: 'email-1', status: 'scheduled' } }));
    });
});
