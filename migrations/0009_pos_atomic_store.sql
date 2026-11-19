CREATE TABLE IF NOT EXISTS pos_atomic_records (
  store_id TEXT NOT NULL CHECK (length(store_id) BETWEEN 1 AND 128),
  collection TEXT NOT NULL CHECK (length(collection) BETWEEN 1 AND 64),
  record_id TEXT NOT NULL CHECK (length(record_id) BETWEEN 1 AND 128),
  revision INTEGER NOT NULL CHECK (typeof(revision) = 'integer' AND revision > 0),
  tombstone INTEGER NOT NULL CHECK (tombstone IN (0, 1)),
  value_json TEXT,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (store_id, collection, record_id),
  CHECK (
    (tombstone = 1 AND value_json IS NULL) OR
    (tombstone = 0 AND value_json IS NOT NULL AND json_valid(value_json))
  )
);

CREATE INDEX IF NOT EXISTS pos_atomic_records_list
  ON pos_atomic_records(store_id, collection, record_id);

CREATE TABLE IF NOT EXISTS pos_atomic_requests (
  store_id TEXT NOT NULL CHECK (length(store_id) BETWEEN 1 AND 128),
  request_id TEXT NOT NULL CHECK (length(request_id) BETWEEN 1 AND 128),
  actor TEXT NOT NULL CHECK (length(actor) BETWEEN 1 AND 128),
  fingerprint TEXT NOT NULL CHECK (length(fingerprint) BETWEEN 1 AND 256),
  request_json TEXT NOT NULL CHECK (json_valid(request_json)),
  result_json TEXT NOT NULL CHECK (json_valid(result_json)),
  created_at TEXT NOT NULL,
  guard_valid INTEGER NOT NULL,
  PRIMARY KEY (store_id, request_id),
  CONSTRAINT pos_atomic_guards_match CHECK (guard_valid = 1)
);

CREATE TRIGGER IF NOT EXISTS pos_atomic_requests_no_update
BEFORE UPDATE ON pos_atomic_requests
BEGIN
  SELECT RAISE(ABORT, 'pos_atomic_requests is immutable');
END;

CREATE TRIGGER IF NOT EXISTS pos_atomic_requests_no_delete
BEFORE DELETE ON pos_atomic_requests
BEGIN
  SELECT RAISE(ABORT, 'pos_atomic_requests is immutable');
END;
