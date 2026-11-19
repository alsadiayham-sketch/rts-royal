import { ApiError } from "./http.js";

const MAX_GUARDS = 100;
const MAX_WRITES = 100;
const MAX_READS = 100;
const MAX_LIST = 100;
const MAX_DEPTH = 12;
const MAX_RECORD_BYTES = 32 * 1024;
const MAX_RESULT_BYTES = 64 * 1024;
const MAX_REQUEST_BYTES = 256 * 1024;
const COLLECTION_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]*$/;
const ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:@-]*$/;
const FORBIDDEN_KEYS = new Set(["__proto__", "constructor", "prototype"]);

function invalid(message) {
  throw new ApiError(400, "INVALID_ATOMIC_REQUEST", message);
}

function boundedString(value, name, max, pattern) {
  if (typeof value !== "string" || value.length < 1 || value.length > max || /[\u0000-\u001f\u007f]/.test(value)) {
    invalid(`${name} is invalid.`);
  }
  if (pattern && !pattern.test(value)) invalid(`${name} is invalid.`);
  return value;
}

function keyOf(value) {
  return `${value.collection}\u0000${value.id}`;
}

function allowedKeys(value, allowed, name) {
  for (const key of Object.keys(value)) {
    if (FORBIDDEN_KEYS.has(key) || !allowed.has(key)) invalid(`${name} contains an invalid field.`);
  }
}

function validateKey(value, name = "record") {
  if (!value || typeof value !== "object" || Array.isArray(value)) invalid(`${name} is invalid.`);
  return {
    collection: boundedString(value.collection, `${name} collection`, 64, COLLECTION_PATTERN),
    id: boundedString(value.id, `${name} ID`, 128, ID_PATTERN),
  };
}

function validateRevision(value, name) {
  if (!Number.isSafeInteger(value) || value < 0 || value >= Number.MAX_SAFE_INTEGER) {
    invalid(`${name} must be a non-negative safe integer with room for the next revision.`);
  }
  return value;
}

function jsonText(value, name, maxBytes) {
  const seen = new WeakSet();
  function visit(current, depth) {
    if (depth > MAX_DEPTH) invalid(`${name} is too deeply nested.`);
    if (current === null || typeof current === "string" || typeof current === "boolean") return;
    if (typeof current === "number") {
      if (!Number.isFinite(current)) invalid(`${name} contains a non-finite number.`);
      return;
    }
    if (typeof current !== "object") invalid(`${name} contains a non-JSON value.`);
    if (seen.has(current)) invalid(`${name} contains a cycle.`);
    seen.add(current);
    if (!Array.isArray(current)) {
      const prototype = Object.getPrototypeOf(current);
      if (prototype !== Object.prototype && prototype !== null) invalid(`${name} contains a non-JSON object.`);
      for (const key of Object.keys(current)) {
        if (FORBIDDEN_KEYS.has(key)) invalid(`${name} contains a forbidden key.`);
      }
    }
    for (const item of Array.isArray(current) ? current : Object.values(current)) visit(item, depth + 1);
    seen.delete(current);
  }
  visit(value, 0);
  const text = JSON.stringify(value);
  if (text === undefined || new TextEncoder().encode(text).byteLength > maxBytes) invalid(`${name} is too large.`);
  return text;
}

function primaryDatabase(env) {
  if (!env?.DB) throw new ApiError(503, "ATOMIC_STORE_UNAVAILABLE", "Private atomic storage is unavailable.");
  return typeof env.DB.withSession === "function" ? env.DB.withSession("first-primary") : env.DB;
}

function rowsOf(result) {
  return Array.isArray(result?.results) ? result.results : [];
}

function parseJson(text, code = "ATOMIC_STORE_UNAVAILABLE") {
  try {
    return JSON.parse(text);
  } catch {
    throw new ApiError(503, code, "Private atomic storage is unavailable.");
  }
}

function recordFromRow(row) {
  const record = {
    storeId: row.store_id,
    collection: row.collection,
    id: row.record_id,
    revision: Number(row.revision),
    deleted: Number(row.tombstone) === 1,
  };
  if (!record.deleted) record.value = parseJson(row.value_json);
  return record;
}

async function findRequest(db, storeId, requestId) {
  return db.prepare(
    `SELECT actor, fingerprint, result_json
       FROM pos_atomic_requests
      WHERE store_id = ? AND request_id = ?`
  ).bind(storeId, requestId).first();
}

function replayRequest(row, actor, fingerprint) {
  if (row.actor !== actor || row.fingerprint !== fingerprint) {
    throw new ApiError(409, "REQUEST_ID_REUSED", "Request ID was already used for a different operation.");
  }
  return parseJson(row.result_json);
}

export async function replayPosAtomic(env, input) {
  const storeId = boundedString(input?.storeId, "Store ID", 128, ID_PATTERN);
  const requestId = boundedString(input?.requestId, "Request ID", 128, ID_PATTERN);
  const actor = boundedString(input?.actor, "Actor", 128);
  const fingerprint = boundedString(input?.fingerprint, "Fingerprint", 256);
  const row = await findRequest(primaryDatabase(env), storeId, requestId);
  return row ? { found: true, result: replayRequest(row, actor, fingerprint) } : { found: false };
}

function validateCommit(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) invalid("Atomic commit is invalid.");
  allowedKeys(input, new Set(["storeId", "requestId", "actor", "fingerprint", "guards", "writes", "result"]), "Atomic commit");
  const storeId = boundedString(input.storeId, "Store ID", 128, ID_PATTERN);
  const requestId = boundedString(input.requestId, "Request ID", 128, ID_PATTERN);
  const actor = boundedString(input.actor, "Actor", 128);
  const fingerprint = boundedString(input.fingerprint, "Fingerprint", 256);
  if (!Array.isArray(input.guards) || input.guards.length < 1 || input.guards.length > MAX_GUARDS) {
    invalid(`Guards must contain 1 to ${MAX_GUARDS} records.`);
  }
  if (!Array.isArray(input.writes) || input.writes.length < 1 || input.writes.length > MAX_WRITES) {
    invalid(`Writes must contain 1 to ${MAX_WRITES} records.`);
  }

  const guardKeys = new Map();
  const guards = input.guards.map((guard, index) => {
    if (!guard || typeof guard !== "object" || Array.isArray(guard)) invalid(`Guard ${index + 1} is invalid.`);
    allowedKeys(guard, new Set(["collection", "id", "expectedRevision"]), `Guard ${index + 1}`);
    const key = validateKey(guard, `Guard ${index + 1}`);
    const expectedRevision = validateRevision(guard.expectedRevision, `Guard ${index + 1} revision`);
    const normalized = { ...key, expectedRevision };
    const compound = keyOf(normalized);
    if (guardKeys.has(compound)) invalid("Duplicate guards are not allowed.");
    guardKeys.set(compound, expectedRevision);
    return normalized;
  });

  const writeKeys = new Set();
  const sqlWrites = [];
  const writes = input.writes.map((write, index) => {
    if (!write || typeof write !== "object" || Array.isArray(write)) invalid(`Write ${index + 1} is invalid.`);
    allowedKeys(write, new Set(["collection", "id", "expectedRevision", "value", "deleted"]), `Write ${index + 1}`);
    const key = validateKey(write, `Write ${index + 1}`);
    const expectedRevision = validateRevision(write.expectedRevision, `Write ${index + 1} revision`);
    const compound = keyOf(key);
    if (writeKeys.has(compound)) invalid("Duplicate writes are not allowed.");
    writeKeys.add(compound);
    if (!guardKeys.has(compound)) invalid("Every write requires a matching guard.");
    if (guardKeys.get(compound) !== expectedRevision) invalid("Write and guard revisions must match.");

    const deleted = write.deleted === true;
    if (deleted) {
      if (Object.hasOwn(write, "value")) invalid("Deleted writes cannot include a value.");
      sqlWrites.push({ ...key, expectedRevision, deleted: 1, valueJson: null });
      return { ...key, expectedRevision, deleted: true };
    }
    if (Object.hasOwn(write, "deleted") && write.deleted !== false) invalid("Write deletion flag is invalid.");
    if (!Object.hasOwn(write, "value")) invalid("Non-deleted writes require a value.");
    const valueJson = jsonText(write.value, `Write ${index + 1} value`, MAX_RECORD_BYTES);
    sqlWrites.push({ ...key, expectedRevision, deleted: 0, valueJson });
    return { ...key, expectedRevision, value: write.value };
  });

  const resultJson = jsonText(input.result, "Result", MAX_RESULT_BYTES);
  const requestJson = jsonText({ guards, writes }, "Request", MAX_REQUEST_BYTES);
  return {
    storeId, requestId, actor, fingerprint, guards, sqlWrites,
    guardsJson: JSON.stringify(guards),
    writesJson: JSON.stringify(sqlWrites),
    requestJson,
    resultJson,
  };
}

export async function readPosAtomicRecord(env, storeId, collection, id) {
  const [record] = await readPosAtomicRecords(env, storeId, [{ collection, id }]);
  return record;
}

export async function readPosAtomicRecords(env, storeId, keys) {
  const tenant = boundedString(storeId, "Store ID", 128, ID_PATTERN);
  if (!Array.isArray(keys) || keys.length < 1 || keys.length > MAX_READS) {
    invalid(`Record keys must contain 1 to ${MAX_READS} records.`);
  }
  const seen = new Set();
  const normalized = keys.map((key, index) => {
    const value = validateKey(key, `Record ${index + 1}`);
    const compound = keyOf(value);
    if (seen.has(compound)) invalid("Duplicate record keys are not allowed.");
    seen.add(compound);
    return value;
  });
  const db = primaryDatabase(env);
  const result = await db.prepare(
    `SELECT r.store_id, r.collection, r.record_id, r.revision, r.tombstone, r.value_json
       FROM json_each(?) AS k
       LEFT JOIN pos_atomic_records AS r
         ON r.store_id = ?
        AND r.collection = json_extract(k.value, '$.collection')
        AND r.record_id = json_extract(k.value, '$.id')`
  ).bind(JSON.stringify(normalized), tenant).all();
  const found = new Map(rowsOf(result).filter((row) => row.store_id != null).map((row) => [
    `${row.collection}\u0000${row.record_id}`, recordFromRow(row),
  ]));
  return normalized.map((key) => found.get(keyOf(key)) ?? null);
}

export async function listPosAtomicRecords(env, storeId, collection, options = {}) {
  const tenant = boundedString(storeId, "Store ID", 128, ID_PATTERN);
  const group = boundedString(collection, "Collection", 64, COLLECTION_PATTERN);
  const limit = options.limit ?? 50;
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > MAX_LIST) invalid(`List limit must be 1 to ${MAX_LIST}.`);
  const cursor = options.cursor == null ? "" : boundedString(options.cursor, "List cursor", 128, ID_PATTERN);
  if (options.includeDeleted != null && typeof options.includeDeleted !== "boolean") invalid("includeDeleted must be boolean.");
  const db = primaryDatabase(env);
  const result = await db.prepare(
    `SELECT store_id, collection, record_id, revision, tombstone, value_json
       FROM pos_atomic_records
      WHERE store_id = ? AND collection = ? AND record_id > ?
        AND (? = 1 OR tombstone = 0)
      ORDER BY record_id
      LIMIT ?`
  ).bind(tenant, group, cursor, options.includeDeleted ? 1 : 0, limit + 1).all();
  const records = rowsOf(result).map(recordFromRow);
  const hasMore = records.length > limit;
  if (hasMore) records.pop();
  return { records, nextCursor: hasMore ? records.at(-1).id : null };
}

export async function commitPosAtomic(env, input) {
  const commit = validateCommit(input);
  const db = primaryDatabase(env);
  const existing = await findRequest(db, commit.storeId, commit.requestId);
  if (existing) return replayRequest(existing, commit.actor, commit.fingerprint);

  const now = new Date().toISOString();
  const insertRequest = db.prepare(
    `INSERT INTO pos_atomic_requests
       (store_id, request_id, actor, fingerprint, request_json, result_json, created_at, guard_valid)
     SELECT ?, ?, ?, ?, ?, ?, ?, CASE WHEN (
       SELECT COUNT(*)
         FROM json_each(?) AS g
         LEFT JOIN pos_atomic_records AS r
           ON r.store_id = ?
          AND r.collection = json_extract(g.value, '$.collection')
          AND r.record_id = json_extract(g.value, '$.id')
        WHERE (
          json_extract(g.value, '$.expectedRevision') = 0 AND r.revision IS NULL
        ) OR (
          json_extract(g.value, '$.expectedRevision') > 0
          AND r.revision = json_extract(g.value, '$.expectedRevision')
        )
     ) = ? THEN 1 ELSE 0 END`
  ).bind(
    commit.storeId, commit.requestId, commit.actor, commit.fingerprint,
    commit.requestJson, commit.resultJson, now, commit.guardsJson, commit.storeId, commit.guards.length
  );
  const writeRecords = db.prepare(
    `INSERT INTO pos_atomic_records
       (store_id, collection, record_id, revision, tombstone, value_json, updated_at)
     SELECT ?, json_extract(w.value, '$.collection'), json_extract(w.value, '$.id'),
            json_extract(w.value, '$.expectedRevision') + 1,
            json_extract(w.value, '$.deleted'), json_extract(w.value, '$.valueJson'), ?
       FROM json_each(?) AS w
      WHERE 1
     ON CONFLICT(store_id, collection, record_id) DO UPDATE SET
       revision = excluded.revision,
       tombstone = excluded.tombstone,
       value_json = excluded.value_json,
       updated_at = excluded.updated_at`
  ).bind(commit.storeId, now, commit.writesJson);

  try {
    await db.batch([insertRequest, writeRecords]);
    return parseJson(commit.resultJson);
  } catch (error) {
    let replay = null;
    try {
      replay = await findRequest(db, commit.storeId, commit.requestId);
    } catch {
      throw new ApiError(503, "ATOMIC_COMMIT_UNCERTAIN", "Atomic commit outcome is uncertain; retry the same request.");
    }
    if (replay) return replayRequest(replay, commit.actor, commit.fingerprint);
    if (String(error?.message ?? error).includes("pos_atomic_guards_match")) {
      throw new ApiError(409, "ATOMIC_REVISION_CONFLICT", "One or more guarded records changed.");
    }
    throw new ApiError(503, "ATOMIC_COMMIT_UNCERTAIN", "Atomic commit outcome is uncertain; retry the same request.");
  }
}
