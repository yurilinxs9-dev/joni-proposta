-- Add google_email column to google_integrations table
-- This stores which Google account is connected, shown in the UI
ALTER TABLE google_integrations
ADD COLUMN IF NOT EXISTS google_email TEXT;
