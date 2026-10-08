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
  'https://github.com/alsadiayham-sketch/rts-business-releases/releases/latest/download/RTS-Business-Setup.exe'
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

CREATE TABLE IF NOT EXISTS requests (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL CHECK (length(name) BETWEEN 2 AND 80),
  service TEXT NOT NULL CHECK (length(service) BETWEEN 1 AND 80),
  business TEXT NOT NULL CHECK (length(business) BETWEEN 2 AND 100),
  message TEXT NOT NULL CHECK (length(message) BETWEEN 2 AND 1000),
  language TEXT NOT NULL DEFAULT 'en' CHECK (language IN ('en', 'ar')),
  status TEXT NOT NULL DEFAULT 'new'
    CHECK (status IN ('new', 'in_progress', 'resolved', 'archived')),
  assigned_to TEXT,
  read_at INTEGER,
  resolved_at INTEGER,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
  FOREIGN KEY (assigned_to) REFERENCES users(username) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_requests_status_created
  ON requests (status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_requests_created
  ON requests (created_at DESC);

CREATE TABLE IF NOT EXISTS credit_settings (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  default_message_balance INTEGER NOT NULL DEFAULT 500 CHECK (default_message_balance >= 0),
  customer_price_agorot INTEGER NOT NULL DEFAULT 20 CHECK (customer_price_agorot >= 0),
  platform_cost_agorot INTEGER NOT NULL DEFAULT 10 CHECK (platform_cost_agorot >= 0),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_by TEXT
);

INSERT OR IGNORE INTO credit_settings (
  id,
  default_message_balance,
  customer_price_agorot,
  platform_cost_agorot
) VALUES (1, 500, 20, 10);

CREATE TABLE IF NOT EXISTS credit_accounts (
  organization_type TEXT NOT NULL CHECK (organization_type IN ('business', 'clinic')),
  organization_id TEXT NOT NULL,
  display_name TEXT NOT NULL CHECK (length(display_name) BETWEEN 2 AND 100),
  message_balance INTEGER NOT NULL DEFAULT 500 CHECK (message_balance >= 0),
  money_balance_agorot INTEGER NOT NULL DEFAULT 0 CHECK (money_balance_agorot >= 0),
  customer_price_agorot INTEGER NOT NULL DEFAULT 20 CHECK (customer_price_agorot >= 0),
  platform_cost_agorot INTEGER NOT NULL DEFAULT 10 CHECK (platform_cost_agorot >= 0),
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
  PRIMARY KEY (organization_type, organization_id)
);

CREATE INDEX IF NOT EXISTS idx_credit_accounts_type_name
  ON credit_accounts (organization_type, display_name);

CREATE TABLE IF NOT EXISTS credit_ledger (
  id TEXT PRIMARY KEY,
  organization_type TEXT NOT NULL CHECK (organization_type IN ('business', 'clinic')),
  organization_id TEXT NOT NULL,
  display_name TEXT NOT NULL CHECK (length(display_name) BETWEEN 2 AND 100),
  entry_type TEXT NOT NULL CHECK (entry_type IN ('allocation', 'usage')),
  money_delta_agorot INTEGER NOT NULL DEFAULT 0,
  message_delta INTEGER NOT NULL DEFAULT 0,
  customer_price_agorot INTEGER NOT NULL DEFAULT 20 CHECK (customer_price_agorot >= 0),
  platform_cost_agorot INTEGER NOT NULL DEFAULT 10 CHECK (platform_cost_agorot >= 0),
  delivery_status TEXT CHECK (delivery_status IN ('requested', 'queued', 'delivered', 'failed', 'cancelled')),
  note TEXT NOT NULL DEFAULT '' CHECK (length(note) <= 240),
  created_by TEXT NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  FOREIGN KEY (created_by) REFERENCES users(username) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_credit_ledger_org_created
  ON credit_ledger (organization_type, organization_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_credit_ledger_created
  ON credit_ledger (created_at DESC);
