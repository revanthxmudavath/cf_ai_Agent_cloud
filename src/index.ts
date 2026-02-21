import { Hono } from "hono"; // Hono web api framework for Cloudflare Workers
import { cors } from "hono/cors";
import { PersonalAssistant } from "./agent/PersonalAssistant";
import { Env } from "./types/env";
import { TaskWorkflow } from "./workflows/TaskWorkflow";
import {
clerkAuthMiddleware,
verifyWebSocketToken,
AuthVariables
} from "./middleware/auth";

const app = new Hono<{ Bindings: Env; Variables: AuthVariables }>();

app.use('*', cors({
origin: ['http://localhost:5173'], // Adjust as needed for your frontend origin
allowHeaders: ['Content-Type', 'Authorization'],
allowMethods: ['GET', 'POST', 'OPTIONS', 'PUT', 'DELETE'],
credentials: true,
}));

app.get('/health', (c) => {
return c.json({ status: 'healthy' });
});

// Apply authentication middleware to protected routes
app.use('/api/*', clerkAuthMiddleware);


// Get current user profile
app.get('/api/me', async (c) => {
const auth = c.get('auth');

const result = await c.env.DB.prepare(
    'SELECT id, name, timezone, email, google_calendar_connected, created_at FROM users WHERE id = ?'
).bind(auth.userId).first();

return c.json(result);
});

// Update user timezone
app.post('/api/me/timezone', async (c) => {
const auth = c.get('auth');
const { timezone } = await c.req.json();

if (!timezone || typeof timezone !== 'string') {
    return c.json({ error: 'Invalid timezone' }, 400);
}

try {
    await c.env.DB.prepare(
        'UPDATE users SET timezone = ?, updated_at = ? WHERE id = ?'
    ).bind(timezone, Math.floor(Date.now() / 1000), auth.userId).run();

    console.log(`[API] Updated timezone for user ${auth.userId}: ${timezone}`);
    return c.json({ success: true, timezone });
} catch (error) {
    console.error('[API] Error updating timezone:', error);
    return c.json({ error: 'Failed to update timezone' }, 500);
}
});

// get user tasks 
app.get('/api/tasks', async (c) => {
const auth = c.get('auth');
const completed = c.req.query('completed');

let query = 'SELECT * FROM tasks WHERE user_id = ?';
const params: any[] = [auth.userId];

if (completed !== undefined) {
    query += ' AND completed = ?';
    params.push(completed === 'true' ? 1 : 0);
}

query += ' ORDER BY created_at DESC';
const result = await c.env.DB.prepare(query).bind(...params).all();

return c.json({ tasks: result.results || [] });
});

// Get user conversations
app.get('/api/conversations', async (c) => {
const auth = c.get('auth');
const limit = parseInt(c.req.query('limit') || '50');

const result = await c.env.DB.prepare(
    'SELECT * FROM conversations WHERE user_id = ? ORDER BY timestamp DESC LIMIT ?'
).bind(auth.userId, limit).all();

return c.json({ conversations: result.results || [] });
});


// NANGO Integration routes

// Create Nango connect session and return token
app.post('/api/integrations/google-calendar/connect', async (c) => {
      const auth = c.get('auth');

      try {
          console.log('[Nango] ===== Starting Calendar Connection =====');
          console.log('[Nango] User ID:', auth.userId);

          // Get user details for Nango session
          const user = await c.env.DB.prepare(
              'SELECT name, email FROM users WHERE id = ?'
          ).bind(auth.userId).first();

          console.log('[Nango] User from DB:', { name: user?.name, email: user?.email });
          console.log('[Nango] NANGO_SECRET_KEY exists:', !!c.env.NANGO_SECRET_KEY);

          // Create Nango connect session
          const nangoPayload = {
              end_user: {
                  id: auth.userId,
                  email: user?.email || auth.email || 'no-email@example.com',
                  display_name: user?.name || 'User',
              },
              allowed_integrations: ['google-calendar'],
          };

          console.log('[Nango] Request payload:', JSON.stringify(nangoPayload, null, 2));

          const response = await fetch('https://api.nango.dev/connect/sessions', {
              method: 'POST',
              headers: {
                  'Authorization': `Bearer ${c.env.NANGO_SECRET_KEY}`,
                  'Content-Type': 'application/json',
              },
              body: JSON.stringify(nangoPayload),
          });

          console.log('[Nango] Response status:', response.status);
          console.log('[Nango] Response headers:', Object.fromEntries(response.headers.entries()));

          const responseText = await response.text();
          console.log('[Nango] Response body (raw):', responseText);

          if (!response.ok) {
              console.error('[Nango] ❌ API Error - Status:', response.status);
              console.error('[Nango] ❌ Error body:', responseText);

              let errorMessage = 'Failed to create calendar connection session';
              try {
                  const errorJson = JSON.parse(responseText);
                  // Extract string error message, handle both string and object formats
                  if (typeof errorJson.message === 'string') {
                      errorMessage = errorJson.message;
                  } else if (typeof errorJson.error === 'string') {
                      errorMessage = errorJson.error;
                  } else if (errorJson.error && typeof errorJson.error.message === 'string') {
                      errorMessage = errorJson.error.message;
                  }
                  console.error('[Nango] ❌ Parsed error:', errorJson);
              } catch (e) {
                  console.error('[Nango] ❌ Could not parse error as JSON');
              }

              return c.json({
                  error: errorMessage,
                  details: responseText
              }, 401);
          }

          // Parse successful response
        let responseData;
        try {
            responseData = JSON.parse(responseText);
            console.log('[Nango] ✅ Parsed response:', JSON.stringify(responseData, null, 2));
        } catch (e) {
            console.error('[Nango] ❌ Failed to parse success response as JSON');
            return c.json({ error: 'Invalid response from Nango' }, 500);
        }

        // Extract data from Nango's wrapper (handles nested structure)
        const data = responseData.data || responseData;

        // Validate response has required fields
        if (!data.connect_link) {
            console.error('[Nango] ❌ Missing connect_link in response');
            console.error('[Nango] ❌ Response data:', data);
            return c.json({ error: 'Invalid response - missing connect link' }, 500);
        }

        console.log('[Nango] ✅ Connect URL:', data.connect_link);
        console.log('[Nango] ✅ Session token:', data.token ? 'Present' : 'Missing');
        console.log('[Nango] ✅ Expires at:', data.expires_at);

        return c.json({
            token: data.token,
            connectUrl: data.connect_link,
            expiresAt: data.expires_at,
        });
      } catch (error: any) {
          console.error('[Nango] ❌ Exception:', error);
          console.error('[Nango] ❌ Stack:', error.stack);
          return c.json({
              error: 'Failed to initiate calendar connection',
              details: error.message
          }, 500);
      }
  });

// Check Google Calendar connection status
app.get('/api/integrations/google-calendar/status', async (c) => {
    const auth = c.get('auth');

    try {
        console.log('[Nango] ===== Checking Calendar Status =====');
        console.log('[Nango] User ID:', auth.userId);

        // Check database for stored connection (set by webhook)
        const user = await c.env.DB.prepare(
            'SELECT google_calendar_connected, google_calendar_connection_id FROM users WHERE id = ?'
        ).bind(auth.userId).first();

        const connected = user?.google_calendar_connected === 1 && !!user?.google_calendar_connection_id;

        console.log('[Nango] Calendar connected:', connected);
        if (connected) {
            console.log('[Nango] Connection ID:', user.google_calendar_connection_id);
        }

        return c.json({ connected });
    } catch (error) {
        console.error('[Nango] Failed to check calendar status:', error);
        return c.json({ connected: false, error: 'exception' });
    }
});

// Callback after user completes OAuth (called by frontend with connectionId from Nango SDK)
app.post('/api/integrations/google-calendar/callback', async (c) => {
    const auth = c.get('auth');

    try {
        const body = await c.req.json();
        const { connectionId } = body;

        if (!connectionId) {
            return c.json({ error: 'connectionId is required' }, 400);
        }

        console.log('[Nango Callback] Storing connection from frontend SDK:', { userId: auth.userId, connectionId });

        // Store connectionId in database (same as webhook handler)
        await c.env.DB.prepare(
            'UPDATE users SET google_calendar_connection_id = ?, google_calendar_connected = 1, updated_at = ? WHERE id = ?'
        ).bind(connectionId, Math.floor(Date.now() / 1000), auth.userId).run();

        console.log('[Nango Callback] ✅ Database updated successfully');

        return c.json({ success: true, message: 'Google Calendar connected successfully', connectionId });
    } catch (error) {
        console.error('[Nango Callback] Error:', error);
        return c.json({ error: 'Failed to process callback' }, 500);
    }
});

// Disconnect Google Calendar
app.post('/api/integrations/google-calendar/disconnect', async (c) => {
    const auth = c.get('auth');

    try {
        // Get the connection ID from database
        const user = await c.env.DB.prepare(
            'SELECT google_calendar_connection_id FROM users WHERE id = ?'
        ).bind(auth.userId).first();

        if (user && user.google_calendar_connection_id) {
            console.log('[Nango] Deleting connection:', user.google_calendar_connection_id);

            // Delete connection from Nango using connection ID
            await fetch(
                `https://api.nango.dev/connection/${user.google_calendar_connection_id}`,
                {
                    method: 'DELETE',
                    headers: {
                        'Authorization': `Bearer ${c.env.NANGO_SECRET_KEY}`,
                    },
                }
            );
        }
    } catch (error) {
        console.error('[Nango] Failed to delete connection:', error);
    }

    // Update user record
    await c.env.DB.prepare(
        'UPDATE users SET google_calendar_connection_id = NULL, google_calendar_connected = 0, updated_at = ? WHERE id = ?'
    ).bind(Math.floor(Date.now() / 1000), auth.userId).run();

    console.log('[Nango] User disconnected successfully');

    return c.json({ success: true });
});

// Receive Nango Connection notification
app.post('/api/webhooks/nango', async (c) => {
    try {
        const event = await c.req.json();
        console.log('[Nango Webhook] Received event:', JSON.stringify(event, null, 2));

        if (event.type === 'auth' && event.operation === 'creation' && event.success) {
            const userId = event.endUser.endUserId; // This is the auth.userId we passed during connect session
            const connectionId = event.connectionId;

            console.log('[Nango Webhook] Storing connection:', { userId, connectionId });

            // Update user record with connection ID (use 'id' not 'clerk_id')
            await c.env.DB.prepare(`
                UPDATE users
                SET google_calendar_connection_id = ?,
                    google_calendar_connected = 1,
                    updated_at = ?
                WHERE id = ?
            `).bind(connectionId, Math.floor(Date.now() / 1000), userId).run();

            console.log('[Nango Webhook] ✅ Database updated successfully');
        }

        return c.json({ success: true });
    } catch (error) {
        console.error('[Nango Webhook] Error processing webhook:', error);
        return c.json({ success: false, error: 'Failed to process webhook' }, 500);
    }
});


// ==================== WEBSOCKET (TOKEN-BASED AUTH) ====================

app.get('/ws', async (c) => {
    const upgradeHeader = c.req.header("Upgrade");
    if (upgradeHeader !== "websocket") {
        return c.json({ error: "Expected WebSocket Upgrade" }, 426);
    }

    // Get token from query param
    const token = c.req.query('token');
    if (!token) {
        return c.json({ error: "Authentication token required" }, 401);
    }

    // Verify token
    const auth = await verifyWebSocketToken(token, c.env.CLERK_SECRET_KEY, c.env.DB);
    if (!auth) {
        return c.json({ error: "Invalid authentication token" }, 401);
    }

    try {
        // Route to Durable Object using verified userId
        const id = c.env.AGENT.idFromName(auth.userId);
        const stub = c.env.AGENT.get(id);

        // Pass userId to Durable Object
        const url = new URL(c.req.url);
        url.searchParams.set('userId', auth.userId);

        const modifiedRequest = new Request(url.toString(), c.req.raw);
        return stub.fetch(modifiedRequest);
    } catch (error) {
        console.error('Error connecting to Durable Object:', error);
        return c.json({ error: 'Failed to establish WebSocket connection' }, 500);
    }
});

export { PersonalAssistant, TaskWorkflow };

export default {
    async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
        return app.fetch(request, env, ctx);
    },
};
