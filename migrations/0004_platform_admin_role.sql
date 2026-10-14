ALTER TABLE users
ADD COLUMN role TEXT NOT NULL DEFAULT 'platform_admin'
CHECK (role IN ('platform_admin'));
