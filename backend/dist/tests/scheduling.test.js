"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const scheduling_js_1 = require("../src/scheduling.js");
(0, vitest_1.describe)('calculateScheduledTimes', () => {
    (0, vitest_1.it)('spaces recipients and spills into the next hour', () => {
        const start = new Date('2026-01-01T00:00:00.000Z');
        const times = (0, scheduling_js_1.calculateScheduledTimes)(start, 4, 30 * 60 * 1000, 10);
        (0, vitest_1.expect)(times.map(time => time.getTime() - start.getTime())).toEqual([0, 30 * 60 * 1000, 60 * 60 * 1000, 90 * 60 * 1000]);
    });
    (0, vitest_1.it)('uses the requested hourly limit when delay leaves capacity', () => {
        const start = new Date('2026-01-01T00:00:00.000Z');
        const times = (0, scheduling_js_1.calculateScheduledTimes)(start, 3, 1000, 2);
        (0, vitest_1.expect)(times[2].getTime() - start.getTime()).toBe(60 * 60 * 1000);
    });
});
