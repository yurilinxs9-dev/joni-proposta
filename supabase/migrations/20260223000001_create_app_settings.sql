-- App-level settings table (configurable from inside the app)
CREATE TABLE IF NOT EXISTS app_settings (
  key     TEXT PRIMARY KEY,
  value   TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;

-- All authenticated users (invite-only app) can read settings
CREATE POLICY "authenticated_read_settings"
  ON app_settings FOR SELECT TO authenticated USING (true);

-- All authenticated users can upsert settings
CREATE POLICY "authenticated_write_settings"
  ON app_settings FOR ALL TO authenticated USING (true);
