CREATE TABLE IF NOT EXISTS mobile_devices (
  id TEXT PRIMARY KEY,
  store_id TEXT NOT NULL,
  username TEXT NOT NULL,
  token TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  auth_version INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_mobile_devices_store_expiry
  ON mobile_devices (store_id, expires_at);
