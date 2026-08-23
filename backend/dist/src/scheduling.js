"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.calculateScheduledTimes = calculateScheduledTimes;
exports.nextHourWithJitter = nextHourWithJitter;
const HOUR_MS = 60 * 60 * 1000;
function calculateScheduledTimes(startTime, recipientCount, delayMs, hourlyLimit) {
    if (recipientCount < 0 || delayMs < 0 || hourlyLimit <= 0)
        throw new Error('Invalid scheduling parameters');
    const delayCapacity = delayMs === 0 ? hourlyLimit : Math.floor((HOUR_MS - 1) / delayMs) + 1;
    const perHour = Math.min(hourlyLimit, delayCapacity);
    return Array.from({ length: recipientCount }, (_, index) => {
        const hourOffset = Math.floor(index / perHour) * HOUR_MS;
        const offsetWithinHour = (index % perHour) * delayMs;
        return new Date(startTime.getTime() + hourOffset + offsetWithinHour);
    });
}
function nextHourWithJitter(now = new Date(), random = Math.random) {
    const next = new Date(now);
    next.setMinutes(0, 0, 0);
    next.setTime(next.getTime() + HOUR_MS);
    next.setTime(next.getTime() + Math.floor(random() * 5000));
    return next;
}
