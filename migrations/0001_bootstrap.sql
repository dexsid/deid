-- Application settings are stored as JSON text and validated at the application boundary.
CREATE TABLE site_settings (
  key TEXT PRIMARY KEY NOT NULL,
  value TEXT NOT NULL CHECK (json_valid(value))
);
