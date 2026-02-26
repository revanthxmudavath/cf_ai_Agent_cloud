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

      // Handle calendar events — use first parsed date for startTime, second for endTime
      if (toolCall.tool === 'createCalendarEvent' || toolCall.tool === 'updateCalendarEvent') {
        // Use parsedDates[0] for startTime, parsedDates[1] for endTime (if available)
        const startDates = parsedDates.length > 0 ? [parsedDates[0]] : [];
        const endDates = parsedDates.length > 1 ? [parsedDates[1]] : [];

        let startTimeCorrected = false;
        if (correctedParams.startTime) {
          const correctedStart = this.correctDate(
            correctedParams.startTime,
            startDates,
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
              reason: 'Start time corrected using first parsed date'
            });
            correctedParams.startTime = correctedStart;
            startTimeCorrected = true;
          }
        }

        if (correctedParams.endTime) {
          let correctedEnd: string | null = null;

          if (endDates.length > 0) {
            // Use second parsed date for endTime
            correctedEnd = this.correctDate(correctedParams.endTime, endDates, now, oneWeekAgo);
          } else if (correctedParams.startTime) {
            // Only one parsed date: derive endTime as startTime + 1 hour
            const startMs = new Date(correctedParams.startTime).getTime();
            if (!isNaN(startMs)) {
              const derivedEnd = new Date(startMs + 60 * 60 * 1000).toISOString();
              const endMs = new Date(correctedParams.endTime).getTime();
              // Override if endTime is invalid, in the past, OR if startTime was corrected
              // (LLM derived endTime from its UTC-naive startTime — now inconsistent)
              if (isNaN(endMs) || endMs < now - (7 * 24 * 60 * 60 * 1000) || startTimeCorrected) {
                correctedEnd = derivedEnd;
              }
            }
          }

          if (correctedEnd && correctedEnd !== correctedParams.endTime) {
            report.corrected = true;
            report.changes.push({
              toolName: toolCall.tool,
              field: 'endTime',
              oldValue: correctedParams.endTime,
              newValue: correctedEnd,
              reason: endDates.length > 0
                ? 'End time corrected using second parsed date'
                : 'End time derived as 1 hour after corrected start time'
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
