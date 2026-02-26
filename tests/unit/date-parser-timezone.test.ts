/**
 * Test: DateParser timezone-aware "tomorrow" parsing
 *
 * Scenario: User local time is Feb 25, 2026 8:41 PM (UTC-4)
 *           UTC equivalent: Feb 26, 2026 00:41:00Z
 *
 * User says: "remind me to buy eggs tomorrow at 12 pm"
 * Expected:  Feb 26 12:00 PM local (UTC-4) = 2026-02-26T16:00:00Z
 * Bug (UTC): Feb 27 12:00 PM UTC            = 2026-02-27T12:00:00Z (WRONG)
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { DateParser } from '../../src/utils/DateParser';

describe('DateParser - timezone-aware relative date parsing', () => {
  // Simulate: user local time is Feb 25 8:41 PM (UTC-4)
  // UTC clock is already Feb 26 00:41 — the bug scenario
  const FAKE_UTC_NOW = new Date('2026-02-26T00:41:00Z');

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(FAKE_UTC_NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('WITH timezone fix (UTC-4): "tomorrow at 12 pm" = Feb 26 noon local', () => {
    const parser = new DateParser();
    // America/Caracas is a stable UTC-4 zone with no DST
    parser.setTimezone('America/Caracas');

    const results = parser.parse('remind me to buy eggs tomorrow at 12 pm');

    expect(results.length).toBeGreaterThan(0);
    // Feb 25 is "today" in UTC-4 (local 20:41)
    // "tomorrow" = Feb 26 local, noon = 12:00 local (UTC-4) = 16:00 UTC
    expect(results[0].isoDateTime).toBe('2026-02-26T16:00:00Z');
  });

  it('WITHOUT fix (UTC default): "tomorrow at 12 pm" incorrectly gives Feb 27', () => {
    const parser = new DateParser();
    // Default timezone is UTC — simulates the bug
    parser.setTimezone('UTC');

    const results = parser.parse('remind me to buy eggs tomorrow at 12 pm');

    expect(results.length).toBeGreaterThan(0);
    // UTC clock says it's already Feb 26, so "tomorrow" = Feb 27 UTC
    // This is WRONG for a UTC-4 user whose "today" is still Feb 25
    expect(results[0].isoDateTime).toBe('2026-02-27T12:00:00Z');
  });

  it('WITH timezone fix: "today at 11 pm" = Feb 25 11pm local (the original bug)', () => {
    const parser = new DateParser();
    parser.setTimezone('America/Caracas'); // UTC-4

    const results = parser.parse('remind me to work on finetuning today at 11 pm');

    expect(results.length).toBeGreaterThan(0);
    // "today" in UTC-4 = Feb 25 (UTC clock is Feb 26 00:41 but local is Feb 25 20:41)
    // "11 pm" local (UTC-4) = Feb 26 03:00 UTC
    expect(results[0].isoDateTime).toBe('2026-02-26T03:00:00Z');
  });

  it('WITHOUT fix (UTC): "today at 11 pm" incorrectly gives Feb 26 11pm UTC', () => {
    const parser = new DateParser();
    parser.setTimezone('UTC');

    const results = parser.parse('remind me to work on finetuning today at 11 pm');

    expect(results.length).toBeGreaterThan(0);
    // Bug: UTC "today" = Feb 26, 11pm UTC = 2026-02-26T23:00:00Z
    // This was exactly what the runtime logs showed
    expect(results[0].isoDateTime).toBe('2026-02-26T23:00:00Z');
  });
});
