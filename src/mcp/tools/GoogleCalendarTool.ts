import { google } from 'googleapis';
import {
    ToolDefinition,
    ToolContext,
    ToolResult,
    CreateCalendarEventParams,
    CreateCalendarEventSchema,
    CalendarEventResult,
    UpdateCalendarEventSchema,
    UpdateCalendarEventParams,
    DeleteCalendarEventSchema,
    DeleteCalendarEventParams,
} from '../../types/tools.js';
import { u } from 'agents/dist/client-BZVYeBmf.js';


/**
 * Create a calendar event using Google Calendar API
 */
export const createCalendarEventTool: ToolDefinition = {
    name: 'createCalendarEvent',
    description: 'Create an event in Google Calendar. Use this when user explicitly asks to add something to their calendar. For actionable reminders ("remind me"), use createTask instead. Can be used alongside createTask if user wants both.',
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

/**
 * Update an existing calendar event using Google Calendar API
 */
export const updateCalendarEventTool: ToolDefinition = {
    name: 'updateCalendarEvent',
    description: 'Update an existing Google Calendar event. For task reminders, use updateTask instead.',
    parameters: UpdateCalendarEventSchema,

    async execute(params: UpdateCalendarEventParams, context: ToolContext): Promise<ToolResult> {
        try {

            const { eventId, summary, description, startTime, endTime } = params;

            // Step 1: Get environment variables
            const clientId = context.env.GOOGLE_CLIENT_ID;
            const clientSecret = context.env.GOOGLE_CLIENT_SECRET;
            const redirectUri = context.env.GOOGLE_REDIRECT_URI;
            const refreshToken = context.env.GOOGLE_REFRESH_TOKEN

            // Step 2: Validate credentials
            if (!clientId || !clientSecret || !redirectUri || !refreshToken) {
                return {
                    success: false,
                    error: 'Google API credentials not configured',
                };
            }

            // Step 3: Initialize OAuth2 client
            if (!context.agent.checkRateLimit(context.userId, 'calendar', 10, 3600000)) {
                return {
                    success: false,
                    error: 'Rate limit exceeded. You can update up to 10 calendar events per hour. Please try again later.',
                };
            }
            
            // Step 4: Initialize OAuth2 Client
            const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri);
            oauth2Client.setCredentials({ refresh_token: refreshToken });

            // Step 5: Initialize Calendar API
            const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

            // Step 6: First, get the existing event
            const existingEvent = await calendar.events.get({
                calendarId: 'primary',
                eventId: eventId,
            });

            if (!existingEvent.data) {
                return {
                    success: false,
                    error: `Event with ID ${eventId} not found`,
                };
            }

            // Step 7: Prepare updated event data
            const updatedEvent: any = {
                summary: summary || existingEvent.data.summary,
                description: description !== undefined ? description : existingEvent.data.description,
            }

            // Update start and end times if provided
            if (startTime) {
                updatedEvent.start = {
                    dateTime: new Date(startTime).toISOString(),
                    timeZone: 'UTC',
                };
            
                } else {
                    updatedEvent.start = existingEvent.data.start;
                }

            if (endTime) {
                updatedEvent.end = {
                    dateTime: new Date(endTime).toISOString(),
                    timeZone: 'UTC',
                };
            } else {
                updatedEvent.end = existingEvent.data.end;
            }


            // Step 8: Update event in Google Calendar
            const response = await calendar.events.update({
                calendarId: 'primary',
                eventId: eventId,
                requestBody: updatedEvent,
            });

            // Step 9: Extract result
            const eventData = response.data;

            const result: CalendarEventResult = {
                eventId: eventData.id!,
                summary: eventData.summary!,
                startTime: eventData.start!.dateTime!,
                endTime: eventData.end!.dateTime!,
                htmlLink: eventData.htmlLink!,
            };

            context.agent.recordRateLimitCall(context.userId, 'calendar');

            return {
                success: true,
                data: result,
                message: `Calendar event '${result.summary}' updated successfully.`,
            };
        } catch (error: any) {
            return {
                success: false,
                error: error.message || 'Failed to update calendar event',
            };
        }
    },
};

/**
 * Delete a calendar event using Google Calendar API
 */
export const deleteCalendarEventTool: ToolDefinition = {
    name: 'deleteCalendarEvent',
    description: 'Delete a Google Calendar event. For task reminders, use deleteTask instead.',
    parameters: DeleteCalendarEventSchema,

    async execute(params: DeleteCalendarEventParams, context: ToolContext): Promise<ToolResult> {

        try {
            const { eventId } = params;

            // Step 1: Get environment variables
            const clientId = context.env.GOOGLE_CLIENT_ID;
            const clientSecret = context.env.GOOGLE_CLIENT_SECRET;
            const redirectUri = context.env.GOOGLE_REDIRECT_URI;
            const refreshToken = context.env.GOOGLE_REFRESH_TOKEN


            // Step 2: Validate credentials
            if (!clientId || !clientSecret || !redirectUri || !refreshToken) {
                return {
                    success: false,
                    error: 'Google API credentials not configured',
                };
            }


            // Step 3: Rate limiting - 10 calendar deletions per hour per user
            if (!context.agent.checkRateLimit(context.userId, 'calendar', 10, 3600000)) {
                return {
                    success: false,
                    error: 'Rate limit exceeded. You can delete up to 10 calendar events per hour. Please try again later.',
                };
            }

            // Step 4: Initialize OAuth2 client
            const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri);
            oauth2Client.setCredentials({ refresh_token: refreshToken });


            // Step 5: Initialize Calendar API
            const calendar = google.calendar({ version: 'v3', auth: oauth2Client });


            // Step 6: Delete event from Google Calendar
            await calendar.events.delete({
                calendarId: 'primary',
                eventId: eventId,
            });

            // Step 7: Record rate limit
            context.agent.recordRateLimitCall(context.userId, 'calendar');

            return {
                success: true,
                message: `Calendar event with ID '${eventId}' deleted successfully.`,
            };
        } catch (error: any) {
            return {
                success: false,
                error: error.message || 'Failed to delete calendar event',
            };

        }
    },
};