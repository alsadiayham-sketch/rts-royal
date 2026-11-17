ALTER TABLE users
ADD COLUMN portal_access TEXT NOT NULL DEFAULT 'admin'
CHECK (portal_access IN ('admin', 'reader'));
