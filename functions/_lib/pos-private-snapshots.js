import { hmacSha256Hex } from "./crypto.js";
import { ApiError } from "./http.js";

export async function privateRef(env, storeId, requestId) {
  return hmacSha256Hex(env.AUTH_SECRET, `pos-private:${JSON.stringify([storeId, requestId])}`);
}

function parseSnapshot(row) {
  try {
    const response = JSON.parse(row.response_json);
    if (!response || typeof response !== "object" || Array.isArray(response)) throw new Error();
    return response;
  } catch {
    throw new ApiError(503, "PRIVATE_SNAPSHOT_UNAVAILABLE", "Private order data is unavailable.");
  }
}

export async function getPrivateSnapshot(env, storeId, ref) {
  const row = await env.DB.prepare(
    "SELECT response_json FROM pos_private_snapshots WHERE store_id = ? AND ref = ?"
  ).bind(storeId, ref).first();
  if (!row) throw new ApiError(503, "PRIVATE_SNAPSHOT_UNAVAILABLE", "Private order data is unavailable.");
  return parseSnapshot(row);
}

export async function getPrivateRequest(env, storeId, requestId, actor, fingerprint) {
  const ref = await privateRef(env, storeId, requestId);
  const row = await env.DB.prepare(
    "SELECT ref, actor, fingerprint, response_json FROM pos_private_snapshots WHERE store_id = ? AND request_id = ?"
  ).bind(storeId, requestId).first();
  if (!row || row.ref !== ref) throw new ApiError(503, "PRIVATE_SNAPSHOT_UNAVAILABLE", "Private order data is unavailable.");
  if (row.actor !== actor || row.fingerprint !== fingerprint) {
    throw new ApiError(409, "REQUEST_ID_REUSED", "Request ID was already used for a different operation.");
  }
  return { ref, response: parseSnapshot(row) };
}

export async function findPrivateRequest(env, storeId, requestId, actor, fingerprint) {
  const row = await env.DB.prepare(
    "SELECT 1 AS present FROM pos_private_snapshots WHERE store_id = ? AND request_id = ?"
  ).bind(storeId, requestId).first();
  return row ? getPrivateRequest(env, storeId, requestId, actor, fingerprint) : null;
}

export async function stagePrivateSnapshot(env, storeId, requestId, actor, fingerprint, response) {
  const ref = await privateRef(env, storeId, requestId);
  await env.DB.prepare(
    `INSERT INTO pos_private_snapshots
      (store_id, request_id, ref, actor, fingerprint, response_json, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(store_id, request_id) DO NOTHING`
  ).bind(storeId, requestId, ref, actor, fingerprint, JSON.stringify(response), new Date().toISOString()).run();
  return getPrivateRequest(env, storeId, requestId, actor, fingerprint);
}
