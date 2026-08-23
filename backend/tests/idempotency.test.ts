import { describe, expect, it, vi } from 'vitest';

const updateMany = vi.fn();
vi.mock('../src/db.js', () => ({ prisma: { scheduledEmail: { updateMany } } }));

describe('claimScheduledEmail', () => {
  it('only claims a scheduled row once', async () => {
    updateMany.mockResolvedValueOnce({ count: 1 }).mockResolvedValueOnce({ count: 0 });
    const { claimScheduledEmail } = await import('../src/idempotency.js');
    expect(await claimScheduledEmail('email-1')).toBe(true);
    expect(await claimScheduledEmail('email-1')).toBe(false);
    expect(updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'email-1', status: 'scheduled' } }));
  });
});
