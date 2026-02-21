-- 1. Add the column without the UNIQUE constraint
ALTER TABLE users ADD COLUMN clerk_id TEXT;
ALTER TABLE users ADD COLUMN nango_connection_id TEXT;
ALTER TABLE users ADD COLUMN email TEXT;
ALTER TABLE users ADD COLUMN google_calendar_connected INTEGER DEFAULT 0;

-- 2. Create a UNIQUE INDEX to enforce uniqueness (replaces the constraint)
CREATE UNIQUE INDEX idx_users_clerk_id ON users(clerk_id);
