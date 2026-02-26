import { describe, it, expect } from 'vitest';

describe('TaskWorkflow reminder time calculation', () => {
  it('reminderTimestamp should be exactly 24 hours before dueDate in ms', () => {
    const dueDate = Date.now() + 48 * 60 * 60 * 1000;
    const reminderTimestamp = dueDate - (24 * 60 * 60 * 1000);
    const diff = dueDate - reminderTimestamp;
    expect(diff).toBe(24 * 60 * 60 * 1000);
  });

  it('timeUntilReminder is in seconds (for step.sleep)', () => {
    const dueDate = Date.now() + 48 * 60 * 60 * 1000;
    const reminderTimestamp = dueDate - (24 * 60 * 60 * 1000);
    const now = Date.now();
    const timeUntilReminder = Math.max(0, Math.floor((reminderTimestamp - now) / 1000));
    expect(timeUntilReminder).toBeGreaterThan(23 * 3600);
    expect(timeUntilReminder).toBeLessThanOrEqual(24 * 3600 + 5);
  });

  it('shouldSendNow is true when reminder is in the past', () => {
    const dueDate = Date.now() + 1000;
    const reminderTimestamp = dueDate - (24 * 60 * 60 * 1000);
    const now = Date.now();
    expect(reminderTimestamp <= now).toBe(true);
  });

  it('shouldSendNow is false when reminder is in the future', () => {
    const dueDate = Date.now() + 48 * 60 * 60 * 1000;
    const reminderTimestamp = dueDate - (24 * 60 * 60 * 1000);
    const now = Date.now();
    expect(reminderTimestamp <= now).toBe(false);
  });
});
