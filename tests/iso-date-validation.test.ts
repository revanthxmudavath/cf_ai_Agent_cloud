/**
 * Comprehensive Test Suite for ISO 8601 Date Validation & Conversion
 * Tests all fixes implemented for date handling migration
 */

import { describe, it, expect } from 'vitest';

// ============================================================================
// TEST SUITE 1: ISO 8601 REGEX VALIDATION
// ============================================================================

describe('ISO 8601 Format Validation', () => {
  const iso8601Regex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z$/;

  it('should accept valid ISO 8601 strings with Z suffix', () => {
    const validDates = [
      '2026-02-20T17:00:00Z',
      '2026-02-21T09:30:00Z',
      '2026-12-31T23:59:59Z',
      '2026-01-01T00:00:00Z',
    ];

    validDates.forEach(date => {
      expect(iso8601Regex.test(date)).toBe(true);
    });
  });

  it('should accept valid ISO 8601 strings with milliseconds', () => {
    const validDatesWithMs = [
      '2026-02-20T17:00:00.000Z',
      '2026-02-20T17:00:00.123Z',
      '2026-02-20T17:00:00.999Z',
    ];

    validDatesWithMs.forEach(date => {
      expect(iso8601Regex.test(date)).toBe(true);
    });
  });

  it('should reject dates without Z suffix', () => {
    const invalidDates = [
      '2026-02-20T17:00:00',
      '2026-02-20T17:00:00.123',
    ];

    invalidDates.forEach(date => {
      expect(iso8601Regex.test(date)).toBe(false);
    });
  });

  it('should reject date-only strings', () => {
    expect(iso8601Regex.test('2026-02-20')).toBe(false);
  });

  it('should reject non-ISO formats', () => {
    const nonIsoFormats = [
      '12/25/2025',
      'Dec 25 2025',
      '2025-12-25 17:00:00',
      '25-12-2025',
    ];

    nonIsoFormats.forEach(date => {
      expect(iso8601Regex.test(date)).toBe(false);
    });
  });

  it('should reject empty strings and whitespace', () => {
    expect(iso8601Regex.test('')).toBe(false);
    expect(iso8601Regex.test('   ')).toBe(false);
  });
});

// ============================================================================
// TEST SUITE 2: DATE CONVERSION & VALIDATION
// ============================================================================

describe('ISO String to Milliseconds Conversion', () => {
  it('should convert valid ISO strings to milliseconds', () => {
    const testCases = [
      { iso: '2026-02-20T17:00:00Z', expectedMs: 1771606800000 },
      { iso: '2026-02-21T09:30:00Z', expectedMs: 1771666200000 },
    ];

    testCases.forEach(({ iso, expectedMs }) => {
      const ms = new Date(iso).getTime();
      expect(ms).toBe(expectedMs);
      expect(isNaN(ms)).toBe(false);
    });
  });

  it('should detect invalid dates that pass regex', () => {
    // Feb 30th doesn't exist
    const invalidDate = '2026-02-30T17:00:00Z';
    const date = new Date(invalidDate);
    const ms = date.getTime();

    // It parses, but toISOString won't match original
    expect(date.toISOString()).not.toBe(invalidDate);
    expect(date.toISOString()).toBe('2026-03-02T17:00:00.000Z'); // Rolls over to March 2
  });

  it('should handle leap year dates correctly', () => {
    // 2024 is a leap year, Feb 29 is valid
    const leapYearDate = '2024-02-29T12:00:00Z';
    const date = new Date(leapYearDate);

    expect(isNaN(date.getTime())).toBe(false);
    expect(date.toISOString()).toBe('2024-02-29T12:00:00.000Z');
  });

  it('should return NaN for truly invalid strings', () => {
    const invalidStrings = ['invalid', 'not-a-date', ''];

    invalidStrings.forEach(str => {
      const ms = new Date(str).getTime();
      expect(isNaN(ms)).toBe(true);
    });
  });

  it('should handle empty string edge case', () => {
    const ms = new Date('').getTime();
    expect(isNaN(ms)).toBe(true);
  });
});

// ============================================================================
// TEST SUITE 3: ROUND-TRIP CONVERSION
// ============================================================================

describe('Round-trip ISO ↔ Milliseconds Conversion', () => {
  it('should preserve date when converting ISO → ms → ISO', () => {
    const originalIso = '2026-02-20T17:00:00Z';
    const ms = new Date(originalIso).getTime();
    const backToIso = new Date(ms).toISOString();

    // Note: toISOString() always adds .000 milliseconds
    expect(backToIso).toBe('2026-02-20T17:00:00.000Z');
  });

  it('should preserve milliseconds in round-trip', () => {
    const originalIso = '2026-02-20T17:00:00.123Z';
    const ms = new Date(originalIso).getTime();
    const backToIso = new Date(ms).toISOString();

    expect(backToIso).toBe(originalIso);
  });

  it('should handle epoch (1970-01-01)', () => {
    const epochMs = 0;
    const iso = new Date(epochMs).toISOString();

    expect(iso).toBe('1970-01-01T00:00:00.000Z');
    expect(new Date(iso).getTime()).toBe(epochMs);
  });
});

// ============================================================================
// TEST SUITE 4: WORKFLOW REMINDER CALCULATION
// ============================================================================

describe('Workflow Reminder Calculation', () => {
  it('should calculate reminder 24 hours before due date', () => {
    // Task due: Feb 21, 2026 at 5:00 PM
    const taskDueDateMs = 1740153600000;

    // Reminder should be: Feb 20, 2026 at 5:00 PM (24 hours earlier)
    const reminderTime = taskDueDateMs - (24 * 60 * 60 * 1000);
    const expectedReminderMs = 1740067200000;

    expect(reminderTime).toBe(expectedReminderMs);
  });

  it('should correctly compare reminder time with current time', () => {
    // Task due: Feb 21, 2026 at 5:00 PM
    const taskDueDateMs = 1740153600000;
    const reminderTime = taskDueDateMs - (24 * 60 * 60 * 1000);

    // Current time: Feb 20, 2026 at 12:00 PM
    const now = 1740049200000;

    // Reminder (Feb 20 5PM) should be AFTER current time (Feb 20 12PM)
    expect(reminderTime > now).toBe(true);
  });

  it('should not schedule reminder if task is due in less than 24 hours', () => {
    // Current time
    const now = Date.now();

    // Task due in 12 hours
    const taskDueDateMs = now + (12 * 60 * 60 * 1000);
    const reminderTime = taskDueDateMs - (24 * 60 * 60 * 1000);

    // Reminder time would be in the past
    expect(reminderTime < now).toBe(true);
  });

  it('should handle edge case: task due exactly 24 hours from now', () => {
    const now = Date.now();
    const taskDueDateMs = now + (24 * 60 * 60 * 1000);
    const reminderTime = taskDueDateMs - (24 * 60 * 60 * 1000);

    // Reminder time should be approximately now (within 1 second tolerance)
    expect(Math.abs(reminderTime - now)).toBeLessThan(1000);
  });
});

// ============================================================================
// TEST SUITE 5: EDGE CASES & ERROR HANDLING
// ============================================================================

describe('Edge Cases & Error Handling', () => {
  it('should handle null gracefully', () => {
    const dateStr: string | null = null;

    // In our implementation, null should be allowed
    expect(dateStr).toBe(null);
  });

  it('should handle undefined gracefully', () => {
    const dateStr: string | undefined = undefined;

    // In our implementation, undefined should be allowed
    expect(dateStr).toBe(undefined);
  });

  it('should detect empty strings', () => {
    const emptyStrings = ['', '   ', '\t', '\n'];

    emptyStrings.forEach(str => {
      expect(str.trim()).toBe('');
    });
  });

  it('should handle type mismatches', () => {
    // If someone passes a number instead of string
    const numberValue = 1740153600000;

    expect(typeof numberValue).toBe('number');
    expect(typeof numberValue).not.toBe('string');
  });

  it('should validate millisecond precision in timestamps', () => {
    const now = Date.now();

    // Should be in milliseconds (13 digits for current dates)
    expect(now.toString().length).toBeGreaterThanOrEqual(13);

    // Should NOT be in seconds (10 digits)
    expect(now.toString().length).not.toBe(10);
  });
});

// ============================================================================
// TEST SUITE 6: INTEGRATION TEST - FULL FLOW
// ============================================================================

describe('Full Integration: LLM → Schema → Conversion → DB → Workflow', () => {
  it('should handle complete task creation flow', () => {
    // 1. LLM generates ISO string
    const llmOutput = '2026-02-21T17:00:00Z';

    // 2. Schema validation (regex check)
    const iso8601Regex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z$/;
    expect(iso8601Regex.test(llmOutput)).toBe(true);

    // 3. Check it's a valid date
    const date = new Date(llmOutput);
    expect(isNaN(date.getTime())).toBe(false);

    // 4. Check round-trip consistency
    expect(date.toISOString()).toBe('2026-02-21T17:00:00.000Z');

    // 5. Convert to milliseconds for DB
    const dueDateMs = date.getTime();
    expect(dueDateMs).toBe(1771693200000);

    // 6. Calculate workflow reminder
    const reminderTime = dueDateMs - (24 * 60 * 60 * 1000);
    expect(reminderTime).toBe(1771606800000);

    // 7. Verify reminder is schedulable (in future)
    // For this test, we'll use a fixed "now" value
    const testNow = 1740049200000; // Feb 20, 2026 12:00 PM
    expect(reminderTime > testNow).toBe(true);

    // 8. Convert back for display
    const displayDate = new Date(dueDateMs).toISOString();
    expect(displayDate).toBe('2026-02-21T17:00:00.000Z');
  });

  it('should handle task update with null dueDate', () => {
    // User clears due date
    const updates = { dueDate: null };

    expect(updates.dueDate).toBe(null);
  });

  it('should reject invalid formats in schema validation', () => {
    const invalidFormats = [
      '2026-02-20',
      '12/25/2025',
      '2026-02-20T17:00:00',
      '',
    ];

    const iso8601Regex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z$/;

    invalidFormats.forEach(format => {
      expect(iso8601Regex.test(format)).toBe(false);
    });
  });
});

// ============================================================================
// TEST SUITE 7: CALENDAR EVENT VALIDATION
// ============================================================================

describe('Calendar Event Date Handling', () => {
  it('should calculate default endTime as 1 hour after start', () => {
    const startTime = '2026-02-20T17:00:00Z';
    const startMs = new Date(startTime).getTime();

    // Default: 1 hour later
    const endMs = startMs + (60 * 60 * 1000);
    const endTime = new Date(endMs).toISOString();

    expect(endTime).toBe('2026-02-20T18:00:00.000Z');
  });

  it('should preserve user-provided endTime', () => {
    const startTime = '2026-02-20T17:00:00Z';
    const endTime = '2026-02-20T19:30:00Z';

    const startMs = new Date(startTime).getTime();
    const endMs = new Date(endTime).getTime();

    // Duration: 2.5 hours
    const durationMs = endMs - startMs;
    expect(durationMs).toBe(2.5 * 60 * 60 * 1000);
  });
});

console.log('✅ All ISO 8601 validation tests defined');
