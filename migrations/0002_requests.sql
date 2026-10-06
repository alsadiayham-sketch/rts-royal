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
