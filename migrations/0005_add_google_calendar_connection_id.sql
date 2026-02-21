-- Add google_calendar_connection_id column to store Nango's connection ID
ALTER TABLE users ADD COLUMN google_calendar_connection_id TEXT;

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_users_google_calendar_connection_id ON users(google_calendar_connection_id);
