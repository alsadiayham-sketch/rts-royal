CREATE TABLE IF NOT EXISTS pos_private_snapshots (
  store_id TEXT NOT NULL,
  request_id TEXT NOT NULL,
  ref TEXT NOT NULL,
  actor TEXT NOT NULL,
  fingerprint TEXT NOT NULL,
  response_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY (store_id, request_id),
  UNIQUE (store_id, ref)
);
