import { describe, expect, it } from 'vitest';
import { calculateScheduledTimes } from '../src/scheduling.js';

describe('calculateScheduledTimes', () => {
  it('spaces recipients and spills into the next hour', () => {
    const start = new Date('2026-01-01T00:00:00.000Z');
    const times = calculateScheduledTimes(start, 4, 30 * 60 * 1000, 10);
    expect(times.map(time => time.getTime() - start.getTime())).toEqual([0, 30 * 60 * 1000, 60 * 60 * 1000, 90 * 60 * 1000]);
  });
  it('uses the requested hourly limit when delay leaves capacity', () => {
    const start = new Date('2026-01-01T00:00:00.000Z');
    const times = calculateScheduledTimes(start, 3, 1000, 2);
    expect(times[2].getTime() - start.getTime()).toBe(60 * 60 * 1000);
  });
});
