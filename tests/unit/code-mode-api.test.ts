import { describe, it, expect } from 'vitest';
import { generateToolDocs } from '../../src/mcp/CodeModeAPI';

/**
 * Unit tests for CodeModeAPI / ToolDocumentation
 *
 * Guards against three previously introduced bugs:
 *   1. createTask example used a raw millisecond timestamp instead of ISO 8601 string
 *   2. createCalendarEvent example used raw millisecond timestamps and had a typo ("meating")
 *   3. updateCalendarEvent example had a trailing comma (invalid JSON) and raw timestamp
 */

describe('ToolDocumentation - generateToolDocs examples', () => {
  it('generateToolDocs returns a non-empty documentation string', () => {
    const docs = generateToolDocs();
    expect(typeof docs).toBe('string');
    expect(docs.length).toBeGreaterThan(0);
    expect(docs).toContain('###');
  });

  it('createTask dueDate example is an ISO 8601 string, not a raw millisecond number', () => {
    const docs = generateToolDocs();
    // Must NOT contain a 13-digit Unix ms timestamp as the dueDate value
    expect(docs).not.toMatch(/"dueDate":\s*\d{13}/);
    // Must contain a valid ISO 8601 date string
    expect(docs).toMatch(/"dueDate":\s*"\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z"/);
  });

  it('createCalendarEvent uses ISO 8601 strings and has no typo in summary', () => {
    const docs = generateToolDocs();
    // No Unix ms timestamps anywhere in the calendar event section
    expect(docs).not.toMatch(/"startTime":\s*\d{13}/);
    expect(docs).not.toMatch(/"endTime":\s*\d{13}/);
    // Must contain ISO 8601 dates
    expect(docs).toMatch(/"startTime":\s*"\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z"/);
    expect(docs).toMatch(/"endTime":\s*"\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z"/);
    // Typo fix
    expect(docs).not.toContain('meating');
  });

  it('updateCalendarEvent uses ISO 8601 startTime and has no trailing comma', () => {
    const docs = generateToolDocs();
    // No raw Unix timestamps for startTime in update example
    expect(docs).not.toMatch(/"startTime":\s*\d{13}/);
    // Must not have trailing comma pattern (comma followed by whitespace then })
    expect(docs).not.toMatch(/,\s*\n\s*\}/);
    // Must contain a valid ISO 8601 startTime somewhere in the docs
    expect(docs).toMatch(/"startTime":\s*"\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z"/);
  });

  it('all expected tool names appear in the documentation', () => {
    const docs = generateToolDocs();
    const tools = [
      'createTask', 'listTasks', 'updateTask', 'completeTask', 'deleteTask',
      'getWeather', 'sendEmail', 'createCalendarEvent', 'updateCalendarEvent', 'deleteCalendarEvent',
    ];
    for (const tool of tools) {
      expect(docs, `Expected tool "${tool}" to appear in docs`).toContain(tool);
    }
  });
});
