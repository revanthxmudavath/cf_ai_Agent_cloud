import { z } from 'zod';


export interface ToolDefinition {
    name: string;
    description: string;
    parameters: z.ZodSchema<any>;
    execute: (params: any, context: ToolContext) => Promise<ToolResult>;
}

export interface ToolContext {
    userId: string;
    env: any;
    agent: any;
}


export interface ToolResult {
    success: boolean;
    data?: any;
    error?: string;
    message?: string;
}

// Task schemas

// ISO 8601 datetime string validator (strict format validation)
const isoDateTimeSchema = z.string().refine(
    (val) => {
        // Strict ISO 8601 regex: YYYY-MM-DDTHH:MM:SS.sssZ or YYYY-MM-DDTHH:MM:SSZ
        const iso8601Regex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z$/;

        if (!iso8601Regex.test(val)) {
            return false;
        }

        // Also verify it's a valid date (catches cases like 2026-02-30)
        const date = new Date(val);
        return !isNaN(date.getTime()) && date.toISOString() === val;
    },
    { message: 'Must be a valid ISO 8601 datetime string (e.g., "2026-02-20T17:00:00Z" or "2026-02-20T17:00:00.123Z")' }
).optional();

// Required (non-optional) version of ISO 8601 validator
const requiredIsoDateTimeSchema = z.string().refine(
    (val) => {
        const iso8601Regex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z$/;
        if (!iso8601Regex.test(val)) return false;
        const date = new Date(val);
        return !isNaN(date.getTime()) && date.toISOString() === val;
    },
    { message: 'Must be a valid ISO 8601 datetime string (e.g., "2026-02-20T17:00:00Z")' }
);

export const CreateTaskSchema = z.object({
    title: z.string().min(1).max(200).describe('Task title'),
    description: z.string().optional().describe('Task description (optional)'),
    dueDate: isoDateTimeSchema.describe('Task due date/time in ISO 8601 format (e.g., "2026-02-20T17:00:00Z"). Use UTC timezone with Z suffix.'),
    priority: z.enum(['low', 'medium', 'high']).optional().describe('Task priority level'),

});

export const ListTasksSchema = z.object({
      completed: z.boolean().optional(),
  });


export const UpdateTaskSchema = z.object({
      taskId: z.string().uuid().describe('Unique task identifier'),
      title: z.string().min(1).max(200).optional().describe('New task title'),
      description: z.string().optional().describe('New task description'),
      dueDate: isoDateTimeSchema.describe('New due date/time in ISO 8601 format (e.g., "2026-02-20T17:00:00Z")'),
      priority: z.enum(['low', 'medium', 'high']).optional().describe('New priority level'),
  });

export const CompleteTaskSchema = z.object({
    taskId: z.string().uuid(),
});

export const DeleteTaskSchema = z.object({
    taskId: z.string().uuid(),
});


// Weather schemas

export const GetWeatherSchema = z.object({
    city: z.string().min(1),
    countryCode: z.string().length(2).optional()
});


export interface WeatherData {
    city: string;
    country: string;
    temperature: number;
    feelsLike: number;
    humidity: number;
    description: string;
    windSpeed: number;
    timestamp: number;
  }


// Email schemas 

export const SendEmailSchema = z.object({
      to: z.string().email(),
      subject: z.string().min(1).max(200),
      textBody: z.string().min(1),
      htmlBody: z.string().optional(),
  });

export interface EmailResult {
      messageId: string;
      to: string;
      submittedAt: string;
  }

export const CreateCalendarEventSchema = z.object({
    summary: z.string().min(1).max(200).describe('Event title/summary'),
    description: z.string().optional().describe('Event description (optional)'),
    startTime: requiredIsoDateTimeSchema.describe('Event start time in ISO 8601 format (e.g., "2026-02-20T17:00:00Z"). Always use UTC timezone with Z suffix.'),
    endTime: isoDateTimeSchema.describe('Event end time in ISO 8601 format (e.g., "2026-02-20T18:00:00Z"). Defaults to 1 hour after start if not provided.'),
});

export const UpdateCalendarEventSchema = z.object({
    eventId: z.string().min(1).describe('Google Calendar event ID'),
    summary: z.string().min(1).max(200).optional().describe('New event title'),
    description: z.string().optional().describe('New event description'),
    startTime: isoDateTimeSchema.describe('New start time in ISO 8601 format (e.g., "2026-02-20T17:00:00Z")'),
    endTime: isoDateTimeSchema.describe('New end time in ISO 8601 format (e.g., "2026-02-20T18:00:00Z")'),
});

export const DeleteCalendarEventSchema = z.object({
    eventId: z.string().min(1),
});



export interface CalendarEventResult {
    eventId: string;
    summary: string;
    startTime: string;
    endTime: string;
    htmlLink: string;
}

// Tool calling with confirmation

export interface ConfirmationRequest {
    requestId: string;
    userId: string;
    code: string;
    toolCalls: ToolCallSummary[];
    timeout: number;
    timestamp: number;
}

export interface ToolCallSummary {
    toolName: string;
    parameters: Record<string, any>;
    description: string;
}

export interface ConfirmationResponse {
    requestId: string;
    approved: boolean;
    timestamp: number;
}

export type CreateTaskParams = z.infer<typeof CreateTaskSchema>;
export type ListTasksParams = z.infer<typeof ListTasksSchema>;
export type UpdateTaskParams = z.infer<typeof UpdateTaskSchema>;
export type CompleteTaskParams = z.infer<typeof CompleteTaskSchema>;
export type DeleteTaskParams = z.infer<typeof DeleteTaskSchema>;
export type GetWeatherParams = z.infer<typeof GetWeatherSchema>;
export type SendEmailParams = z.infer<typeof SendEmailSchema>;
export type CreateCalendarEventParams = z.infer<typeof CreateCalendarEventSchema>;
export type UpdateCalendarEventParams = z.infer<typeof UpdateCalendarEventSchema>;
export type DeleteCalendarEventParams = z.infer<typeof DeleteCalendarEventSchema>;