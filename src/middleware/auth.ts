import { Context, Next } from 'hono';
import { verifyToken } from '@clerk/backend';
import { Env } from '../types/env';

export interface AuthenticatedContext {
userId: string;      // Internal DB user ID (UUID)
clerkId: string;     // Clerk user ID
email?: string;
}

export type AuthVariables = {
auth: AuthenticatedContext;
}

/**
 * Middleware to verify Clerk JWT on HTTP routes
 */
export async function clerkAuthMiddleware(c: Context<{ Bindings: Env; Variables: AuthVariables }>, next: Next) {
try {
    const authHeader = c.req.header('Authorization');

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return c.json({ error: 'Missing or invalid Authorization header' }, 401);
    }

    const token = authHeader.substring(7);

    // Verify JWT using Clerk's backend SDK
    const payload = await verifyToken(token, {
        secretKey: c.env.CLERK_SECRET_KEY,
    });

    if (!payload || !payload.sub) {
        return c.json({ error: 'Invalid token' }, 401);
    }

    const clerkId = payload.sub;

    // Look up or create internal user
    const user = await findOrCreateUserByClerkId(
        c.env.DB,
        clerkId,
            (payload as any).email
        );

        // Attach user info to context
        c.set('auth', {
            userId: user.id,
            clerkId: clerkId,
            email: (payload as any).email,
        } as AuthenticatedContext);

        await next();
    } catch (error) {
        console.error('[Auth] JWT verification failed:', error);
        return c.json({ error: 'Authentication failed' }, 401);
    }
}

/**
 * Find existing user by clerk_id or create new user
 */
async function findOrCreateUserByClerkId(
    db: D1Database,
    clerkId: string,
    email?: string
): Promise<{ id: string; clerkId: string }> {
    // Try to find existing user
    const existing = await db.prepare(
        'SELECT id, clerk_id FROM users WHERE clerk_id = ?'
    ).bind(clerkId).first();

    if (existing) {
        return { id: existing.id as string, clerkId: existing.clerk_id as string };
    }

    // Create new user
    const userId = crypto.randomUUID();
    const now = Math.floor(Date.now() / 1000);
    const name = email ? email.split('@')[0] : `User_${userId.slice(0, 8)}`;

    await db.prepare(
        `INSERT INTO users (id, clerk_id, email, name, timezone, created_at, updated_at) 
        VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).bind(userId, clerkId, email || null, name, 'UTC', now, now).run();

    console.log(`[Auth] Created new user: ${userId} for Clerk ID: ${clerkId}`);

    return { id: userId, clerkId };
}

/**
 * Verify Clerk token for WebSocket connections
 * Returns user info or null if invalid
 */
export async function verifyWebSocketToken(
    token: string,
    secretKey: string,
    db: D1Database
): Promise<AuthenticatedContext | null> {
    try {
        const payload = await verifyToken(token, { secretKey });

        if (!payload || !payload.sub) {
            return null;
        }

        const user = await findOrCreateUserByClerkId(
            db,
            payload.sub,
            (payload as any).email
        );

        return {
            userId: user.id,
            clerkId: payload.sub,
            email: (payload as any).email,
        };
    } catch (error) {
        console.error('[Auth] WebSocket token verification failed:', error);
        return null;
    }
}