PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS site_settings (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  whatsapp_number TEXT NOT NULL CHECK (length(whatsapp_number) BETWEEN 8 AND 15),
  download_url TEXT NOT NULL,
  content_json TEXT NOT NULL DEFAULT '{}',
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

INSERT OR IGNORE INTO site_settings (id, whatsapp_number, download_url)
VALUES (
  1,
  '972569236758',
  'https://github.com/alsadiayham-sketch/rts-pos-releases/releases/latest/download/RTS-POS-Setup.exe'
);

CREATE TABLE IF NOT EXISTS users (
  username TEXT PRIMARY KEY COLLATE NOCASE,
  name TEXT NOT NULL CHECK (length(name) BETWEEN 2 AND 80),
  password_salt TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  password_iterations INTEGER NOT NULL DEFAULT 100000 CHECK (password_iterations >= 100000),
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
  need_change INTEGER NOT NULL DEFAULT 1 CHECK (need_change IN (0, 1)),
  session_version INTEGER NOT NULL DEFAULT 1 CHECK (session_version >= 1),
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,
  username TEXT NOT NULL,
  session_version INTEGER NOT NULL CHECK (session_version >= 1),
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  last_seen_at INTEGER NOT NULL DEFAULT (unixepoch()),
  FOREIGN KEY (username) REFERENCES users(username) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_sessions_user_expires ON sessions (username, expires_at);
CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions (expires_at);

CREATE TABLE IF NOT EXISTS rate_limits (
  scope_key TEXT PRIMARY KEY,
  count INTEGER NOT NULL CHECK (count >= 0),
  window_start INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_rate_limits_expires ON rate_limits (expires_at);
