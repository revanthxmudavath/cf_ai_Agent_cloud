/**
 * Date Corrector - Fixes incorrect dates in LLM-generated tool calls
 * Uses parsed dates from DateParser to correct hallucinated dates
 */

import { ParsedDate } from './DateParser';

export interface CorrectionReport {
  corrected: boolean;
  changes: Array<{
    toolName: string;
    field: string;
    oldValue: string;
    newValue: string;
    reason: string;
  }>;
}

export class DateCorrector {
  /**
   * Correct dates in tool calls using parsed dates and validation
   */
  correctToolCallDates(
    toolCalls: Array<{ tool: string; params: any }>,
    parsedDates: ParsedDate[]
  ): { toolCalls: Array<{ tool: string; params: any }>; report: CorrectionReport } {
    const report: CorrectionReport = { corrected: false, changes: [] };
    const now = Date.now();
    const oneWeekAgo = now - (7 * 24 * 60 * 60 * 1000);

    const correctedToolCalls = toolCalls.map(toolCall => {
      const correctedParams = { ...toolCall.params };

      // Handle createTask and updateTask dueDate
      if ((toolCall.tool === 'createTask' || toolCall.tool === 'updateTask') && correctedParams.dueDate) {
        const correctedDate = this.correctDate(
          correctedParams.dueDate,
          parsedDates,
          now,
          oneWeekAgo
        );

        if (correctedDate && correctedDate !== correctedParams.dueDate) {
          report.corrected = true;
          report.changes.push({
            toolName: toolCall.tool,
            field: 'dueDate',
            oldValue: correctedParams.dueDate,
            newValue: correctedDate,
            reason: 'Date was in the past or incorrect, corrected using parsed dates'
          });
          correctedParams.dueDate = correctedDate;
        }
      }

      // Handle calendar events
      if (toolCall.tool === 'createCalendarEvent' || toolCall.tool === 'updateCalendarEvent') {
        if (correctedParams.startTime) {
          const correctedStart = this.correctDate(
            correctedParams.startTime,
            parsedDates,
            now,
            oneWeekAgo
          );
          if (correctedStart && correctedStart !== correctedParams.startTime) {
            report.corrected = true;
            report.changes.push({
              toolName: toolCall.tool,
              field: 'startTime',
              oldValue: correctedParams.startTime,
              newValue: correctedStart,
              reason: 'Start time was in the past, corrected using parsed dates'
            });
            correctedParams.startTime = correctedStart;
          }
        }

        if (correctedParams.endTime) {
          const correctedEnd = this.correctDate(
            correctedParams.endTime,
            parsedDates,
            now,
            oneWeekAgo
          );
          if (correctedEnd && correctedEnd !== correctedParams.endTime) {
            report.corrected = true;
            report.changes.push({
              toolName: toolCall.tool,
              field: 'endTime',
              oldValue: correctedParams.endTime,
              newValue: correctedEnd,
              reason: 'End time was in the past, corrected using parsed dates'
            });
            correctedParams.endTime = correctedEnd;
          }
        }
      }

      return { tool: toolCall.tool, params: correctedParams };
    });

    return { toolCalls: correctedToolCalls, report };
  }

  /**
   * Correct a single date string
   * PRIORITY: Parsed dates from DateParser (timezone-aware) > LLM dates (timezone-naive)
   */
  private correctDate(
    dateStr: string,
    parsedDates: ParsedDate[],
    now: number,
    oneWeekAgo: number
  ): string | null {
    try {
      console.log(`[DateCorrector] Checking date: ${dateStr}`);

      // PRIORITY 1: If we have high-confidence parsed dates, ALWAYS use them
      if (parsedDates.length > 0) {
        const bestMatch = parsedDates.find(p => p.confidence > 0.85);
        if (bestMatch) {
          console.log(`[DateCorrector] Found high-confidence parsed date: ${bestMatch.isoDateTime} (${Math.round(bestMatch.confidence * 100)}%)`);

          // Check if LLM-generated date differs from parsed date
          const llmDate = new Date(dateStr).getTime();
          const parsedDate = new Date(bestMatch.isoDateTime).getTime();

          // If they differ by more than 1 minute, use the parsed date AS-IS
          const timeDiff = Math.abs(llmDate - parsedDate);
          if (timeDiff > 60000) {  // 1 minute threshold
            console.log(`[DateCorrector] ⚠️  LLM date differs by ${Math.round(timeDiff / 1000 / 60)} minutes from parsed date`);
            console.log(`[DateCorrector] ✅ Using parsed date (has correct timezone conversion): ${bestMatch.isoDateTime}`);
            return bestMatch.isoDateTime;  // Use parsed date AS-IS (already has correct UTC time)
          } else {
            console.log(`[DateCorrector] ✅ LLM date matches parsed date, no correction needed`);
          }
        }
      }

      // PRIORITY 2: No parsed dates OR dates match - validate the date
      const dateMs = new Date(dateStr).getTime();

      // If date is valid and recent, keep it
      if (!isNaN(dateMs) && dateMs > oneWeekAgo) {
        console.log(`[DateCorrector] ✅ Date is valid and recent, keeping as-is`);
        return null; // No correction needed
      }

      // PRIORITY 3: Date is invalid/old - try to fix with parsed dates
      console.log(`[DateCorrector] ⚠️  Date is invalid or in the past`);

      if (parsedDates.length > 0) {
        const bestMatch = parsedDates.find(p => p.confidence > 0.85);
        if (bestMatch) {
          console.log(`[DateCorrector] ✅ Using parsed date: ${bestMatch.isoDateTime}`);
          // For invalid dates, preserve time if parsed date is midnight
          const originalTime = this.extractTime(dateStr);
          const parsedTime = this.extractTime(bestMatch.isoDateTime);

          if (originalTime && parsedTime === '00:00') {
            const corrected = this.replaceTime(bestMatch.isoDateTime, originalTime);
            console.log(`[DateCorrector] Preserved original time: ${corrected}`);
            return corrected;
          }
          return bestMatch.isoDateTime;
        }
      }

      // PRIORITY 4: No parsed dates available - default to tomorrow
      console.log(`[DateCorrector] ⚠️  No parsed dates available, defaulting to tomorrow`);
      const tomorrow = new Date(now + 24 * 60 * 60 * 1000);
      const originalTime = this.extractTime(dateStr);

      if (originalTime) {
        const year = tomorrow.getUTCFullYear();
        const month = String(tomorrow.getUTCMonth() + 1).padStart(2, '0');
        const day = String(tomorrow.getUTCDate()).padStart(2, '0');
        return `${year}-${month}-${day}T${originalTime}:00Z`;
      }

      return tomorrow.toISOString();
    } catch (error) {
      console.error('[DateCorrector] Error correcting date:', error);
      return null;
    }
  }

  /**
   * Extract time portion (HH:MM) from ISO date string
   */
  private extractTime(isoDate: string): string | null {
    const match = isoDate.match(/T(\d{2}:\d{2})/);
    return match ? match[1] : null;
  }

  /**
   * Replace time in ISO date string while preserving date
   */
  private replaceTime(isoDate: string, time: string): string {
    return isoDate.replace(/T\d{2}:\d{2}:\d{2}/, `T${time}:00`);
  }
}
