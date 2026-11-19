import { getFirestoreDocumentSnapshot } from "./firestore.js";
import { ApiError, jsonResponse, parseJsonBody, requireJsonContentType, requireTrustedMutationRequest, withApiGuard } from "./http.js";
import { requireMobileSession } from "./pos-mobile.js";
import { enforceRateLimit } from "./rate-limit.js";
import { authPreconditions, fingerprint, guardedCommit, loadSharedTables, replay, writeSnapshot } from "./pos-mobile-orders.js";
import { stagePrivateSnapshot } from "./pos-private-snapshots.js";

const ID = /^[A-Za-z0-9_-]{8,80}$/;
const MAX_ID = 2147483647;
const root = (storeId) => `projects/${storeId}`;
function fail(code, message) { throw new ApiError(400, code, message); }
function tableId(value) {
  if (!Number.isInteger(value) || value < 1 || value > MAX_ID) fail("INVALID_TABLE", "Invalid table identifier.");
  return value;
}
function tableName(value) {
  if (typeof value !== "string" || !value.trim() || value.trim().length > 100) fail("INVALID_TABLE", "Invalid table name.");
  return value.trim();
}
function key(name) { return name.normalize("NFKC").toLocaleLowerCase("ar"); }
function validateTables(tables) {
  if (!Array.isArray(tables) || tables.length > 500) fail("INVALID_TABLES", "Invalid table list.");
  const ids = new Set(), names = new Set();
  let active = 0;
  return tables.map((table) => {
    if (!table || typeof table !== "object" || Array.isArray(table)
        || Object.keys(table).some((k) => !["id", "name", "archived", "createdAtIso", "archivedAtIso"].includes(k))
        || typeof table.archived !== "boolean") fail("INVALID_TABLES", "Invalid table definition.");
    const id = tableId(table.id), name = tableName(table.name);
    if (ids.has(id)) fail("INVALID_TABLES", "Duplicate table identifier.");
    ids.add(id);
    if (!table.archived) {
      if (names.has(key(name))) fail("INVALID_TABLES", "Duplicate active table name.");
      names.add(key(name));
      if (++active > 60) fail("INVALID_TABLES", "At most 60 tables may be active.");
    }
    const createdAtIso = table.createdAtIso || "";
    const archivedAtIso = table.archivedAtIso || "";
    if (typeof createdAtIso !== "string" || createdAtIso.length > 40
        || typeof archivedAtIso !== "string" || archivedAtIso.length > 40) fail("INVALID_TABLES", "Invalid table date.");
    return { id, name, archived: table.archived, createdAtIso, archivedAtIso };
  }).sort((a, b) => a.id - b.id);
}
async function restaurant(context) {
  const result = await requireMobileSession(context);
  if (result.licence.businessType !== "restaurant") throw new ApiError(403, "RESTAURANT_REQUIRED", "Shared tables require a restaurant.");
  return result.session;
}

export async function onRequestGet(context) {
  return withApiGuard(context, async () => {
    const actor = await restaurant(context);
    const state = await loadSharedTables(context, actor.storeId);
    return jsonResponse({ configured: !!state.snapshot, revision: state.revision, tables: state.tables });
  });
}

export async function onRequestPost(context) {
  return withApiGuard(context, async ({ request }) => {
    requireTrustedMutationRequest(request);
    requireJsonContentType(request);
    const actor = await restaurant(context);
    if (actor.role !== "admin") throw new ApiError(403, "ADMIN_REQUIRED", "Only administrators can change tables.");
    const payload = await parseJsonBody(request, ["action", "requestId", "revision", "tables", "id", "name", "archived"], 131072);
    if (!ID.test(payload.requestId || "")) fail("INVALID_ID", "Invalid request identifier.");
    if (!["initialize", "create", "update", "archive", "delete"].includes(payload.action)) fail("INVALID_ACTION", "Invalid table action.");
    if (!Number.isInteger(payload.revision) || payload.revision < 0) fail("INVALID_REVISION", "Invalid table revision.");
    const fields = {
      initialize: ["tables"], create: ["name"], update: ["id", "name"],
      archive: ["id", "archived"], delete: ["id"],
    }[payload.action];
    if (Object.keys(payload).some((k) => !["action", "requestId", "revision", ...fields].includes(k))) fail("INVALID_ACTION", "Unexpected table field.");
    await enforceRateLimit(context, { scope: "pos_shared_tables", accountPart: `${actor.storeId}:${actor.username}`, maxRequests: 180, windowSeconds: 600 });
    const guards = await authPreconditions(context, actor);
    const hash = await fingerprint({ payload, authVersion: actor.authVersion });
    const completed = await replay(context, actor.storeId, payload.requestId, actor.username, hash);
    if (completed) return jsonResponse(completed);
    const state = await loadSharedTables(context, actor.storeId);
    if (state.revision !== payload.revision || (!!state.snapshot === (payload.action === "initialize"))) {
      throw new ApiError(409, "TABLES_CONFLICT", "Shared tables changed. Refresh and retry.");
    }
    let tables = state.tables.map((table) => ({ ...table }));
    let nextTableId = state.nextTableId;
    let occupancyGuard = null;
    const now = new Date().toISOString();
    if (payload.action === "initialize") {
      tables = validateTables(payload.tables);
      nextTableId = tables.reduce((max, table) => Math.max(max, table.id), 0) + 1;
    } else if (payload.action === "create") {
      const id = nextTableId;
      if (id > MAX_ID) fail("INVALID_TABLE", "No table identifiers remain.");
      nextTableId = id + 1;
      tables.push({ id, name: tableName(payload.name), archived: false, createdAtIso: now, archivedAtIso: "" });
    } else {
      const id = tableId(payload.id), index = tables.findIndex((table) => table.id === id);
      if (index < 0) throw new ApiError(404, "TABLE_NOT_FOUND", "Table not found.");
      if (payload.action === "update") tables[index].name = tableName(payload.name);
      if (payload.action === "archive" || payload.action === "delete") {
        if (payload.action === "archive" && typeof payload.archived !== "boolean") fail("INVALID_TABLE", "Invalid archive state.");
        if (payload.action === "delete" || payload.archived) {
          const path = `${root(actor.storeId)}/pos_mobile_tables/${id}`;
          const lock = await getFirestoreDocumentSnapshot(path);
          if (lock?.data?.holdId) throw new ApiError(409, "TABLE_OCCUPIED", "A shared order occupies this table.");
          if (lock && !lock.updateTime) throw new ApiError(503, "TABLES_UNAVAILABLE", "Cannot safely verify table occupancy.");
          occupancyGuard = lock
            ? { path, verify: true, updateTime: lock.updateTime }
            : { path, data: { table: id, holdId: "" }, create: true };
        }
        if (payload.action === "delete") tables.splice(index, 1);
        else {
          tables[index].archived = payload.archived;
          tables[index].archivedAtIso = payload.archived ? now : "";
        }
      }
    }
    tables = validateTables(tables);
    const response = { ok: true, replayed: false, revision: state.revision + 1, tables, nextTableId };
    const staged = await stagePrivateSnapshot(context.env, actor.storeId, payload.requestId, actor.username, hash, response);
    if (staged.response.revision !== state.revision + 1 || !Array.isArray(staged.response.tables)) {
      throw new ApiError(503, "PRIVATE_SNAPSHOT_UNAVAILABLE", "Private table data is unavailable.");
    }
    const writes = [
      writeSnapshot(state.path, state.snapshot, { revision: staged.response.revision, privateRef: staged.ref }),
      ...guards, ...(occupancyGuard ? [occupancyGuard] : []),
      { path: `${root(actor.storeId)}/pos_mobile_requests/${staged.ref}`, data: { privateRef: staged.ref }, create: true },
    ];
    const result = await guardedCommit(context, actor.storeId, payload.requestId, actor.username, hash, writes);
    return jsonResponse(result || staged.response);
  });
}
