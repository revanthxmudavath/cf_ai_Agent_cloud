import { describe, it, expect } from 'vitest';
import { DateCorrector } from '../../src/utils/DateCorrector';
import { ParsedDate } from '../../src/utils/DateParser';

describe('DateCorrector', () => {
  const corrector = new DateCorrector();

  describe('correctToolCallDates', () => {
    it('should correct past dates using parsed dates', () => {
      const parsedDates: ParsedDate[] = [
        {
          phrase: 'tomorrow at 3pm',
          isoDateTime: '2026-02-21T15:00:00Z',
          type: 'relative',
          confidence: 0.95
        }
      ];

      const toolCalls = [
        {
          tool: 'createTask',
          params: {
            title: 'Buy milk',
            dueDate: '2026-01-27T15:00:00Z', // Wrong date (in the past)
            priority: 'medium'
          }
        }
      ];

      const { toolCalls: corrected, report } = corrector.correctToolCallDates(toolCalls, parsedDates);

      expect(report.corrected).toBe(true);
      expect(report.changes).toHaveLength(1);
      expect(report.changes[0].field).toBe('dueDate');
      expect(report.changes[0].newValue).toBe('2026-02-21T15:00:00Z');
      expect(corrected[0].params.dueDate).toBe('2026-02-21T15:00:00Z');
    });

    it('should not correct valid future dates', () => {
      const futureDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

      const toolCalls = [
        {
          tool: 'createTask',
          params: {
            title: 'Future task',
            dueDate: futureDate
          }
        }
      ];

      const { toolCalls: corrected, report } = corrector.correctToolCallDates(toolCalls, []);

      expect(report.corrected).toBe(false);
      expect(report.changes).toHaveLength(0);
      expect(corrected[0].params.dueDate).toBe(futureDate);
    });

    it('should correct calendar event dates', () => {
      const parsedDates: ParsedDate[] = [
        {
          phrase: 'tomorrow at 2pm',
          isoDateTime: '2026-02-21T14:00:00Z',
          type: 'relative',
          confidence: 0.95
        }
      ];

      const toolCalls = [
        {
          tool: 'createCalendarEvent',
          params: {
            title: 'Meeting',
            startTime: '2026-01-15T14:00:00Z', // Past date
            endTime: '2026-01-15T15:00:00Z'
          }
        }
      ];

      const { toolCalls: corrected, report } = corrector.correctToolCallDates(toolCalls, parsedDates);

      expect(report.corrected).toBe(true);
      expect(corrected[0].params.startTime).toBe('2026-02-21T14:00:00Z');
    });

    it('should handle multiple tool calls', () => {
      const parsedDates: ParsedDate[] = [
        {
          phrase: 'tomorrow at 10am',
          isoDateTime: '2026-02-21T10:00:00Z',
          type: 'relative',
          confidence: 0.95
        }
      ];

      const toolCalls = [
        {
          tool: 'createTask',
          params: { title: 'Task 1', dueDate: '2026-01-01T10:00:00Z' }
        },
        {
          tool: 'createTask',
          params: { title: 'Task 2', dueDate: '2026-01-05T10:00:00Z' }
        }
      ];

      const { toolCalls: corrected, report } = corrector.correctToolCallDates(toolCalls, parsedDates);

      expect(report.corrected).toBe(true);
      expect(corrected[0].params.dueDate).toBe('2026-02-21T10:00:00Z');
      expect(corrected[1].params.dueDate).toBe('2026-02-21T10:00:00Z');
    });

    it('should handle tasks without dates', () => {
      const toolCalls = [
        {
          tool: 'createTask',
          params: { title: 'No date task' }
        }
      ];

      const { toolCalls: corrected, report } = corrector.correctToolCallDates(toolCalls, []);

      expect(report.corrected).toBe(false);
      expect(corrected[0].params.dueDate).toBeUndefined();
    });

    it('should default to tomorrow when no parsed dates available', () => {
      const now = new Date('2026-02-20T12:00:00Z').getTime();

      // Mock Date.now for predictable test
      const originalNow = Date.now;
      Date.now = () => now;

      const toolCalls = [
        {
          tool: 'createTask',
          params: {
            title: 'Old task',
            dueDate: '2026-01-10T15:00:00Z' // Past date
          }
        }
      ];

      const { toolCalls: corrected, report } = corrector.correctToolCallDates(toolCalls, []);

      expect(report.corrected).toBe(true);
      expect(corrected[0].params.dueDate).toContain('2026-02-21T15:00:00Z'); // Tomorrow with same time

      // Restore Date.now
      Date.now = originalNow;
    });
  });
});

describe('DateCorrector - calendar event start/end date separation', () => {
  it('uses parsedDates[0] for startTime and parsedDates[1] for endTime when two dates exist', () => {
    const corrector = new DateCorrector();
    const parsedDates: ParsedDate[] = [
      { phrase: '2pm', isoDateTime: '2026-03-01T14:00:00Z', confidence: 0.9, type: 'absolute' },
      { phrase: '3pm', isoDateTime: '2026-03-01T15:00:00Z', confidence: 0.9, type: 'absolute' },
    ];
    const oldDate = '2020-01-01T14:00:00Z'; // old date that will be corrected
    const toolCalls = [{
      tool: 'createCalendarEvent',
      params: { summary: 'Meeting', startTime: oldDate, endTime: oldDate }
    }];
    const { toolCalls: corrected } = corrector.correctToolCallDates(toolCalls, parsedDates);
    expect(corrected[0].params.startTime).toBe('2026-03-01T14:00:00Z');
    expect(corrected[0].params.endTime).toBe('2026-03-01T15:00:00Z');
    // Must be different - not zero-duration
    expect(corrected[0].params.startTime).not.toBe(corrected[0].params.endTime);
  });

  it('derives endTime as 1 hour after startTime when only one parsed date exists', () => {
    const corrector = new DateCorrector();
    const parsedDates: ParsedDate[] = [
      { phrase: '2pm', isoDateTime: '2026-03-01T14:00:00Z', confidence: 0.9, type: 'absolute' },
    ];
    const oldDate = '2020-01-01T14:00:00Z';
    const toolCalls = [{
      tool: 'createCalendarEvent',
      params: { summary: 'Meeting', startTime: oldDate, endTime: oldDate }
    }];
    const { toolCalls: corrected } = corrector.correctToolCallDates(toolCalls, parsedDates);
    expect(corrected[0].params.startTime).toBe('2026-03-01T14:00:00Z');
    // endTime should be 1 hour after startTime = 15:00
    const endTime = new Date(corrected[0].params.endTime).getTime();
    const startTime = new Date(corrected[0].params.startTime).getTime();
    expect(endTime - startTime).toBe(60 * 60 * 1000); // exactly 1 hour
  });

  it('re-derives endTime as correctedStart + 1h when startTime was corrected and only one parsed date', () => {
    const corrector = new DateCorrector();
    const parsedDates: ParsedDate[] = [
      { phrase: '2pm', isoDateTime: '2026-03-01T14:00:00Z', confidence: 0.9, type: 'absolute' },
    ];
    const oldStart = '2020-01-01T14:00:00Z'; // old - will be corrected
    const validEnd = '2026-03-01T16:00:00Z'; // LLM-provided endTime (irrelevant when startTime is corrected)
    const toolCalls = [{
      tool: 'createCalendarEvent',
      params: { summary: 'Meeting', startTime: oldStart, endTime: validEnd }
    }];
    const { toolCalls: corrected } = corrector.correctToolCallDates(toolCalls, parsedDates);
    expect(corrected[0].params.startTime).toBe('2026-03-01T14:00:00Z');
    // When startTime is corrected and only 1 parsed date exists, endTime = correctedStart + 1h
    expect(corrected[0].params.endTime).toBe('2026-03-01T15:00:00.000Z');
  });
});
