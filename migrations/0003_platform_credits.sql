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
