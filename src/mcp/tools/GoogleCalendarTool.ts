import { google } from 'googleapis';
import {
    ToolDefinition,
    ToolContext,
    ToolResult,
    CreateCalendarEventParams,
    CreateCalendarEventSchema,
    CalendarEventResult,
} from '../../types/tools.js';


/**
 * Create a calendar event using Google Calendar API
 */
export const createCalendarEventTool: ToolDefinition = {
    name: 'createCalendarEvent',
    description: 'Create an event in Google Calendar with title, description and time',
    parameters: CreateCalendarEventSchema,

    async execute(params: CreateCalendarEventParams, context: ToolContext): Promise<ToolResult> {
        try {
            const { summary, description, startTime, endTime } = params;

            // Step 1: Get environment variables
            const clientId = context.env.GOOGLE_CLIENT_ID;
            const clientSecret = context.env.GOOGLE_CLIENT_SECRET;
            const redirectUri = context.env.GOOGLE_REDIRECT_URI;
            const refreshToken = context.env.GOOGLE_REFRESH_TOKEN;

            // Step 2: Validate credentials
            if (!clientId || !clientSecret || !redirectUri || !refreshToken) {
                return {
                    success: false,
                    error: 'Google API credentials not configured',
                };
            }

            // Step 3: Rate limiting - 10 calendar events per hour per user
            if (!context.agent.checkRateLimit(context.userId, 'calendar', 10, 3600000)) {
                return {
                    success: false,
                    error: 'Rate limit exceeded. You can create up to 10 calendar events per hour. Please try again later.',
                };
            }

            // Step 4: Initialize OAuth2 client
            const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri);
            oauth2Client.setCredentials({ refresh_token: refreshToken });

            // Step 5: Initialize Calendar API
            const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

            // Step 6: Prepare event data
            const eventStartTime = new Date(startTime).toISOString();
            const eventEndTime = endTime 
                ? new Date(endTime).toISOString()
                : new Date(startTime + 60 * 60 * 1000).toISOString(); // Default to 1 hour duration

            
            const event = {
                summary: summary,
                description: description || '',
                start: {
                    dateTime: eventStartTime,
                    timeZone: 'UTC',
                },
                end: {
                    dateTime: eventEndTime,
                    timeZone: 'UTC',
                },
            };

            // Step 7: Create event in Google Calendar
            const response = await calendar.events.insert({
                calendarId: 'primary',
                requestBody: event,
            });

            // Step 8: Extract result
            const eventData = response.data;

            const result: CalendarEventResult = {
                eventId: eventData.id!,
                summary: eventData.summary!,
                startTime: eventData.start!.dateTime!,
                endTime: eventData.end!.dateTime!,
                htmlLink: eventData.htmlLink!,
            };

            // Step 9: Record rate limit 
            context.agent.recordRateLimitCall(context.userId, 'calendar');

            return {
                success: true,
                data: result,
                message: `Calendar event '${summary}' created successfully.`,
            };

        } catch (error: any) {
            return {
                success: false,
                error: error.message || 'Failed to create calendar event',
            };
        }
    },
};