/**
 * Date Parser using Chrono.js - Dynamic Natural Language Date Parsing
 * Handles any date/time format without regex pattern matching
 */

// @ts-ignore - chrono-node has types but TypeScript doesn't resolve them correctly in Cloudflare Workers environment
import * as chrono from 'chrono-node';

/**
 * Convert an IANA timezone string to a numeric UTC offset in minutes.
 * Uses ISO 8601 convention: positive = east (UTC+X), negative = west (UTC-X).
 * Example: 'America/Caracas' (UTC-4) → -240
 *
 * Chrono-node's IANA string handling can fall back to the machine's local
 * timezone on some environments, causing wrong Date construction. Passing a
 * numeric offset avoids this entirely.
 */
function ianaToChronoOffset(timezone: string, date: Date): number {
  if (timezone === 'UTC') return 0;
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
      hour12: false,
    }).formatToParts(date);
    const get = (type: string) => parseInt(parts.find(p => p.type === type)?.value ?? '0');
    let hour = get('hour');
    if (hour === 24) hour = 0; // some locales return 24 for midnight
    const localAsUtcMs = Date.UTC(get('year'), get('month') - 1, get('day'), hour, get('minute'), get('second'));
    // ISO convention: (local - UTC) / 60000  → positive for east (UTC+X)
    return (localAsUtcMs - date.getTime()) / 60000;
  } catch {
    return 0; // fallback to UTC if timezone string is invalid
  }
}

export interface ParsedDate {
  phrase: string;           // Original phrase (e.g., "at 4pm today")
  isoDateTime: string;      // Calculated ISO 8601 (e.g., "2026-02-22T00:00:00Z")
  type: 'relative' | 'absolute';
  confidence: number;       // 0-1, how confident we are in the parse
}

export class DateParser {
  private userTimezone: string = 'UTC';

  /**
   * Set user's timezone for date parsing
   * @param timezone - IANA timezone string (e.g., "America/Los_Angeles")
   */
  setTimezone(timezone: string): void {
    this.userTimezone = timezone;
  }

  /**
   * Parse user message for date/time phrases using Chrono.js
   * Returns array of parsed dates with their ISO 8601 equivalents
   */
  parse(text: string): ParsedDate[] {
    const parsed: ParsedDate[] = [];
    const now = new Date();

    // Create a custom Chrono configuration
    const customChrono = chrono.casual.clone();

    // Convert IANA timezone to numeric offset for chrono.
    // chrono-node's IANA handling can fall back to the machine's local timezone
    // for Date construction on some environments. A numeric offset is always reliable.
    const tzOffset = ianaToChronoOffset(this.userTimezone, now);

    // Parse with user's timezone as reference
    // This tells Chrono: "when user says 4pm, they mean 4pm in THIS timezone"
    const results = customChrono.parse(text, {
      instant: now,
      timezone: tzOffset,  // numeric minutes offset (ISO: positive=east, negative=west)
    });

    // Convert Chrono results to our ParsedDate format
    for (const result of results) {
      if (result.start) {
        try {
          // Get the parsed date in the user's timezone
          const parsedDate = result.start.date();

          if (!parsedDate || isNaN(parsedDate.getTime())) {
            continue; // Skip invalid dates
          }

          // Convert to UTC ISO string
          const isoDateTime = parsedDate.toISOString().replace('.000Z', 'Z');

          // Determine if it's relative or absolute
          const isRelative = result.text.toLowerCase().match(
            /today|tomorrow|tonight|yesterday|next|last|in|ago|from now/i
          ) !== null;

          parsed.push({
            phrase: result.text,
            isoDateTime,
            type: isRelative ? 'relative' : 'absolute',
            confidence: this.calculateConfidence(result),
          });
        } catch (error) {
          console.error('[DateParser] Error parsing result:', error);
          continue;
        }
      }
    }

    return parsed;
  }

  /**
   * Calculate confidence score based on Chrono's certainty
   */
  private calculateConfidence(result: any): number {
    // Chrono doesn't provide explicit confidence, so we estimate based on:
    // 1. Whether all date components are certain
    // 2. Whether it found explicit time

    const hasDate = result.start.isCertain('day');
    const hasTime = result.start.isCertain('hour');
    const hasYear = result.start.isCertain('year');

    if (hasDate && hasTime && hasYear) return 0.98;
    if (hasDate && hasTime) return 0.95;
    if (hasDate) return 0.90;
    if (hasTime) return 0.85;

    return 0.70; // Default confidence
  }

  /**
   * Format parsed dates for display/logging
   */
  formatParsedDates(parsed: ParsedDate[]): string {
    if (parsed.length === 0) {
      return 'No dates detected';
    }

    return parsed.map(p =>
      `"${p.phrase}" → ${p.isoDateTime} (${Math.round(p.confidence * 100)}% confident)`
    ).join('\n');
  }

  /**
   * Build context string for LLM with parsed dates
   */
  buildDateContext(parsed: ParsedDate[]): string {
    if (parsed.length === 0) {
      return '';
    }

    let context = '\n\n🎯 PARSED DATES FROM USER MESSAGE:\n';
    context += '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n';

    parsed.forEach((p, idx) => {
      context += `${idx + 1}. User said: "${p.phrase}"\n`;
      context += `   → USE THIS DATE: "${p.isoDateTime}"\n`;
    });

    context += '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n';
    context += '⚠️ IMPORTANT: Use the dates above EXACTLY as provided. Do NOT calculate dates yourself.\n';

    return context;
  }
}
