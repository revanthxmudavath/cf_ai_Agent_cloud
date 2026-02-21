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
