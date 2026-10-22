CREATE TABLE IF NOT EXISTS jahiz_applications (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL CHECK (length(name) BETWEEN 2 AND 100),
  business_type TEXT NOT NULL CHECK (business_type IN ('cafe', 'restaurant')),
  owner_name TEXT NOT NULL CHECK (length(owner_name) BETWEEN 2 AND 80),
  email TEXT NOT NULL CHECK (length(email) BETWEEN 5 AND 254),
  phone TEXT NOT NULL CHECK (length(phone) BETWEEN 7 AND 24),
  message TEXT NOT NULL DEFAULT '' CHECK (length(message) <= 1000),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  resolved_at INTEGER,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_jahiz_applications_pending_email
  ON jahiz_applications (lower(email))
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_jahiz_applications_status_created
  ON jahiz_applications (status, created_at DESC);

CREATE TABLE IF NOT EXISTS jahiz_plans (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL CHECK (length(name) BETWEEN 2 AND 80),
  currency TEXT NOT NULL CHECK (currency IN ('JOD', 'ILS', 'USD')),
  amount_minor INTEGER NOT NULL CHECK (amount_minor >= 0),
  months INTEGER NOT NULL CHECK (months BETWEEN 1 AND 60),
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS jahiz_venues (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE CHECK (length(slug) BETWEEN 3 AND 48),
  name TEXT NOT NULL CHECK (length(name) BETWEEN 2 AND 100),
  business_type TEXT NOT NULL CHECK (business_type IN ('cafe', 'restaurant')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended')),
  expires_at INTEGER,
  is_demo INTEGER NOT NULL DEFAULT 0 CHECK (is_demo IN (0, 1)),
  plan_id TEXT,
  branding_json TEXT NOT NULL DEFAULT '{}',
  branding_revision INTEGER NOT NULL DEFAULT 1 CHECK (branding_revision >= 1),
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
  FOREIGN KEY (plan_id) REFERENCES jahiz_plans(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_jahiz_venues_status_expiry
  ON jahiz_venues (status, expires_at);

CREATE TABLE IF NOT EXISTS jahiz_users (
  id TEXT PRIMARY KEY,
  venue_id TEXT NOT NULL,
  username TEXT NOT NULL,
  name TEXT NOT NULL CHECK (length(name) BETWEEN 2 AND 80),
  role TEXT NOT NULL CHECK (role IN ('owner', 'staff')),
  password_salt TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  password_iterations INTEGER NOT NULL CHECK (password_iterations >= 100000),
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
  session_version INTEGER NOT NULL DEFAULT 1 CHECK (session_version >= 1),
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
  FOREIGN KEY (venue_id) REFERENCES jahiz_venues(id) ON DELETE CASCADE,
  UNIQUE (venue_id, username)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_jahiz_one_owner
  ON jahiz_users (venue_id)
  WHERE role = 'owner';

CREATE TABLE IF NOT EXISTS jahiz_sessions (
  token_hash TEXT PRIMARY KEY,
  venue_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  session_version INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  last_seen_at INTEGER NOT NULL DEFAULT (unixepoch()),
  FOREIGN KEY (venue_id) REFERENCES jahiz_venues(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES jahiz_users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_jahiz_sessions_user
  ON jahiz_sessions (user_id, expires_at);

CREATE TABLE IF NOT EXISTS jahiz_payments (
  id TEXT PRIMARY KEY,
  venue_id TEXT NOT NULL,
  amount_minor INTEGER NOT NULL CHECK (amount_minor >= 0),
  currency TEXT NOT NULL CHECK (currency IN ('JOD', 'ILS', 'USD')),
  months INTEGER NOT NULL CHECK (months BETWEEN 1 AND 60),
  note TEXT NOT NULL DEFAULT '' CHECK (length(note) <= 240),
  recorded_by TEXT NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  FOREIGN KEY (venue_id) REFERENCES jahiz_venues(id) ON DELETE CASCADE,
  FOREIGN KEY (recorded_by) REFERENCES users(username) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_jahiz_payments_venue_created
  ON jahiz_payments (venue_id, created_at DESC);

CREATE TABLE IF NOT EXISTS jahiz_orders (
  id TEXT PRIMARY KEY,
  venue_id TEXT NOT NULL,
  number TEXT NOT NULL,
  pickup_code TEXT NOT NULL
    CHECK (
      length(pickup_code) = 12
      AND pickup_code NOT GLOB '*[^ABCDEFGHJKLMNPQRSTUVWXYZ23456789]*'
    ),
  status TEXT NOT NULL DEFAULT 'waiting'
    CHECK (status IN ('waiting', 'ready', 'done', 'cancelled')),
  estimated_ready_at INTEGER,
  revision INTEGER NOT NULL DEFAULT 1 CHECK (revision >= 1),
  created_by TEXT NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
  completed_at INTEGER,
  FOREIGN KEY (venue_id) REFERENCES jahiz_venues(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by) REFERENCES jahiz_users(id) ON DELETE RESTRICT
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_jahiz_pending_number
  ON jahiz_orders (venue_id, number)
  WHERE status IN ('waiting', 'ready');

CREATE UNIQUE INDEX IF NOT EXISTS idx_jahiz_pickup_code
  ON jahiz_orders (venue_id, pickup_code);

CREATE INDEX IF NOT EXISTS idx_jahiz_orders_venue_recent
  ON jahiz_orders (venue_id, created_at DESC);

CREATE TABLE IF NOT EXISTS jahiz_order_capabilities (
  token_hash TEXT PRIMARY KEY,
  order_id TEXT NOT NULL,
  venue_id TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  FOREIGN KEY (order_id) REFERENCES jahiz_orders(id) ON DELETE CASCADE,
  FOREIGN KEY (venue_id) REFERENCES jahiz_venues(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_jahiz_capabilities_expiry
  ON jahiz_order_capabilities (expires_at);
