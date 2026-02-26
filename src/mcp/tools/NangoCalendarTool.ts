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
} from '../../types/tools';

/**
 * Get user's Google Calendar connection ID from database
 */
async function getConnectionId(db: any, userId: string): Promise<string | null> {
    try {
        const user = await db.prepare(
            'SELECT google_calendar_connection_id FROM users WHERE id = ?'
        ).bind(userId).first();

        return user?.google_calendar_connection_id || null;
    } catch (error) {
        console.error('[NangoCalendarTool] Error fetching connection ID:', error);
        return null;
    }
}

/**
 * Helper to make Nango proxy API requests
 * Uses Nango's proxy to call Google Calendar API with user's OAuth token
 */
async function nangoProxyRequest(
    env: any,
    connectionId: string,
    endpoint: string,
    method: string = 'GET',
    body?: any
): Promise<Response> {
    const response = await fetch(`https://api.nango.dev/proxy${endpoint}`, {
        method,
        headers: {
            'Authorization': `Bearer ${env.NANGO_SECRET_KEY}`,
            'Connection-Id': connectionId,  // Use Nango's connectionId, not userId
            'Provider-Config-Key': 'google-calendar',
            'Content-Type': 'application/json',
        },
        body: body ? JSON.stringify(body) : undefined,
    });

    return response;
}

/**
 * Check if user has Google Calendar connected via Nango
 */
async function checkCalendarConnection(db: any, userId: string): Promise<boolean> {
    try {
        const connectionId = await getConnectionId(db, userId);
        return connectionId !== null;
    } catch {
        return false;
    }
}

/**
 * Create a calendar event using Nango proxy to Google Calendar API
 */
export const createCalendarEventTool: ToolDefinition = {
    name: 'createCalendarEvent',
    description: 'Create an event in Google Calendar. Use this when user explicitly asks to add something to their calendar. For actionable reminders ("remind me"), use createTask instead.',
    parameters: CreateCalendarEventSchema,

    async execute(params: CreateCalendarEventParams, context: ToolContext): Promise<ToolResult> {
        try {
            const { summary, description, startTime, endTime } = params;

            // Get connection ID from database
            const connectionId = await getConnectionId(context.agent.env.DB, context.userId);
            if (!connectionId) {
                return {
                    success: false,
                    error: 'Google Calendar is not connected. Please connect your calendar in Settings.',
                };
            }

            // Rate limiting - 10 calendar events per hour per user
            if (!context.agent.checkRateLimit(context.userId, 'calendar', 10, 3600000)) {
                return {
                    success: false,
                    error: 'Rate limit exceeded. You can create up to 10 calendar events per hour.',
                };
            }

            // Prepare event data (startTime and endTime are now ISO 8601 strings)
            const eventStartTime = new Date(startTime).toISOString();
            const eventEndTime = endTime
                ? new Date(endTime).toISOString()
                : new Date(new Date(startTime).getTime() + 60 * 60 * 1000).toISOString(); // Default 1 hour after start

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

            // Use Nango proxy to call Google Calendar API
            const response = await nangoProxyRequest(
                context.env,
                connectionId,
                '/calendar/v3/calendars/primary/events',
                'POST',
                event
            );

            if (!response.ok) {
                const error = await response.text();
                console.error('[Calendar] Create failed:', error);
                return {
                    success: false,
                    error: `Failed to create calendar event: ${response.status}`,
                };
            }

            const eventData: any = await response.json();

            const result: CalendarEventResult = {
                eventId: eventData.id,
                summary: eventData.summary,
                startTime: eventData.start?.dateTime,
                endTime: eventData.end?.dateTime,
                htmlLink: eventData.htmlLink,
            };

            context.agent.recordRateLimitCall(context.userId, 'calendar');

            return {
                success: true,
                data: result,
                message: `Calendar event '${summary}' created successfully.`,
            };

        } catch (error: any) {
            console.error('[Calendar] Create error:', error);
            return {
                success: false,
                error: error.message || 'Failed to create calendar event',
            };
        }
    },
};

/**
 * Update an existing calendar event using Nango proxy
 */
export const updateCalendarEventTool: ToolDefinition = {
    name: 'updateCalendarEvent',
    description: 'Update an existing Google Calendar event.',
    parameters: UpdateCalendarEventSchema,

    async execute(params: UpdateCalendarEventParams, context: ToolContext): Promise<ToolResult> {
        try {
            const { eventId, summary, description, startTime, endTime } = params;

            // Get connection ID from database
            const connectionId = await getConnectionId(context.agent.env.DB, context.userId);
            if (!connectionId) {
                return {
                    success: false,
                    error: 'Google Calendar is not connected.',
                };
            }

            if (!context.agent.checkRateLimit(context.userId, 'calendar', 10, 3600000)) {
                return {
                    success: false,
                    error: 'Rate limit exceeded.',
                };
            }

            // First get existing event
            const getResponse = await nangoProxyRequest(
                context.env,
                connectionId,
                `/calendar/v3/calendars/primary/events/${eventId}`
            );

            if (!getResponse.ok) {
                return {
                    success: false,
                    error: `Event not found: ${eventId}`,
                };
            }

            const existingEvent: any = await getResponse.json();

            // Build update payload (merge with existing)
            const updatedEvent: any = {
                summary: summary || existingEvent.summary,
                description: description !== undefined ? description : existingEvent.description,
            };

            if (startTime) {
                updatedEvent.start = {
                    dateTime: new Date(startTime).toISOString(),
                    timeZone: 'UTC',
                };
            } else {
                updatedEvent.start = existingEvent.start;
            }

            if (endTime) {
                updatedEvent.end = {
                    dateTime: new Date(endTime).toISOString(),
                    timeZone: 'UTC',
                };
            } else {
                updatedEvent.end = existingEvent.end;
            }

            // Update via Nango proxy
            const updateResponse = await nangoProxyRequest(
                context.env,
                connectionId,
                `/calendar/v3/calendars/primary/events/${eventId}`,
                'PUT',
                updatedEvent
            );

            if (!updateResponse.ok) {
                const error = await updateResponse.text();
                console.error('[Calendar] Update failed:', error);
                return {
                    success: false,
                    error: `Failed to update event: ${updateResponse.status}`,
                };
            }

            const eventData: any = await updateResponse.json();

            const result: CalendarEventResult = {
                eventId: eventData.id,
                summary: eventData.summary,
                startTime: eventData.start?.dateTime,
                endTime: eventData.end?.dateTime,
                htmlLink: eventData.htmlLink,
            };

            context.agent.recordRateLimitCall(context.userId, 'calendar');

            return {
                success: true,
                data: result,
                message: `Calendar event '${result.summary}' updated successfully.`,
            };
        } catch (error: any) {
            console.error('[Calendar] Update error:', error);
            return {
                success: false,
                error: error.message || 'Failed to update calendar event',
            };
        }
    },
};

/**
 * Delete a calendar event using Nango proxy
 */
export const deleteCalendarEventTool: ToolDefinition = {
    name: 'deleteCalendarEvent',
    description: 'Delete a Google Calendar event.',
    parameters: DeleteCalendarEventSchema,

    async execute(params: DeleteCalendarEventParams, context: ToolContext): Promise<ToolResult> {
        try {
            const { eventId } = params;

            // Get connection ID from database
            const connectionId = await getConnectionId(context.agent.env.DB, context.userId);
            if (!connectionId) {
                return {
                    success: false,
                    error: 'Google Calendar is not connected.',
                };
            }

            if (!context.agent.checkRateLimit(context.userId, 'calendar', 10, 3600000)) {
                return {
                    success: false,
                    error: 'Rate limit exceeded.',
                };
            }

            const response = await nangoProxyRequest(
                context.env,
                connectionId,
                `/calendar/v3/calendars/primary/events/${eventId}`,
                'DELETE'
            );

            // Google returns 204 No Content on success
            if (!response.ok && response.status !== 204) {
                const error = await response.text();
                console.error('[Calendar] Delete failed:', error);
                return {
                    success: false,
                    error: `Failed to delete event: ${response.status}`,
                };
            }

            context.agent.recordRateLimitCall(context.userId, 'calendar');

            return {
                success: true,
                message: `Calendar event '${eventId}' deleted successfully.`,
            };
        } catch (error: any) {
            console.error('[Calendar] Delete error:', error);
            return {
                success: false,
                error: error.message || 'Failed to delete calendar event',
            };
        }
    },
};