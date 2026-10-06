import { requireAuthenticatedUser } from "../_lib/auth.js";
import {
  ApiError,
  jsonResponse,
  parseJsonBody,
  requireJsonContentType,
  requireTrustedMutationRequest,
  withApiGuard,
} from "../_lib/http.js";
import { enforceRateLimit, opportunisticCleanup } from "../_lib/rate-limit.js";

const STATUSES = new Set(["new", "in_progress", "resolved", "archived"]);
const SERVICE_LABELS = new Set(["digital-products", "rts-business", "rts-clinic", "other"]);

function cleanText(value, min, max) {
  if (typeof value !== "string") return "";
  const text = value.trim();
  return text.length >= min && text.length <= max ? text : "";
}

function serialize(row) {
  return {
    id: row.id,
    name: row.name,
    service: row.service,
    business: row.business,
    message: row.message,
    language: row.language,
    status: row.status,
    assignedTo: row.assigned_to,
    readAt: row.read_at ? Number(row.read_at) : null,
    resolvedAt: row.resolved_at ? Number(row.resolved_at) : null,
    createdAt: Number(row.created_at),
    updatedAt: Number(row.updated_at),
  };
}

async function listRequests(db) {
  const { results } = await db.prepare(
    `SELECT id, name, service, business, message, language, status, assigned_to,
            read_at, resolved_at, created_at, updated_at
     FROM requests
     ORDER BY created_at DESC
     LIMIT 200`
  ).all();
  const counts = await db.prepare(
    `SELECT
       SUM(CASE WHEN status = 'new' THEN 1 ELSE 0 END) AS new_count,
       SUM(CASE WHEN status IN ('new', 'in_progress') THEN 1 ELSE 0 END) AS actionable_count
     FROM requests`
  ).first();
  return {
    requests: (results || []).map(serialize),
    counts: {
      new: Number(counts?.new_count || 0),
      actionable: Number(counts?.actionable_count || 0),
    },
  };
}

export async function onRequestPost(context) {
  return withApiGuard(context, async ({ request, env }) => {
    requireTrustedMutationRequest(request);
    requireJsonContentType(request);
    await enforceRateLimit(context, {
      scope: "public_request",
      maxRequests: 5,
      windowSeconds: 900,
    });
    const payload = await parseJsonBody(request, ["name", "service", "business", "message", "language"]);
    const name = cleanText(payload.name, 2, 80);
    const service = cleanText(payload.service, 1, 80);
    const business = cleanText(payload.business, 2, 100);
    const message = cleanText(payload.message, 2, 1000);
    const language = payload.language === "ar" ? "ar" : "en";
    if (!name || !SERVICE_LABELS.has(service) || !business || !message) {
      throw new ApiError(400, "INVALID_REQUEST", "Please complete all request fields.");
    }
    const id = crypto.randomUUID();
    await env.DB.prepare(
      `INSERT INTO requests (id, name, service, business, message, language)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).bind(id, name, service, business, message, language).run();
    await opportunisticCleanup(env.DB, Math.floor(Date.now() / 1000));
    return jsonResponse({ ok: true, id }, 201);
  });
}

export async function onRequestGet(context) {
  return withApiGuard(context, async ({ env }) => {
    await requireAuthenticatedUser(context, false);
    return jsonResponse(await listRequests(env.DB));
  });
}

export async function onRequestPatch(context) {
  return withApiGuard(context, async ({ request, env }) => {
    requireTrustedMutationRequest(request);
    requireJsonContentType(request);
    const authUser = await requireAuthenticatedUser(context, false);
    await enforceRateLimit(context, {
      scope: "request_patch",
      accountPart: authUser.username,
      maxRequests: 120,
      windowSeconds: 300,
    });
    const payload = await parseJsonBody(request, ["id", "status", "read", "assignedTo"]);
    const id = cleanText(payload.id, 10, 100);
    if (!id) throw new ApiError(400, "INVALID_REQUEST_ID", "Request id is required.");
    if (payload.status !== undefined && !STATUSES.has(payload.status)) {
      throw new ApiError(400, "INVALID_STATUS", "Request status is invalid.");
    }
    const existing = await env.DB.prepare("SELECT id FROM requests WHERE id = ?").bind(id).first();
    if (!existing) throw new ApiError(404, "REQUEST_NOT_FOUND", "Request not found.");
    const status = payload.status || null;
    const read = payload.read === undefined ? null : payload.read ? 1 : 0;
    const assignedTo = payload.assignedTo === "" ? null : cleanText(payload.assignedTo, 1, 64) || null;
    await env.DB.prepare(
      `UPDATE requests
       SET status = COALESCE(?, status),
           read_at = CASE WHEN ? IS NULL THEN read_at WHEN ? = 1 THEN unixepoch() ELSE NULL END,
           assigned_to = CASE WHEN ? IS NULL THEN assigned_to ELSE ? END,
           resolved_at = CASE WHEN ? = 'resolved' THEN unixepoch() WHEN ? IS NOT NULL AND ? != 'resolved' THEN NULL ELSE resolved_at END,
           updated_at = unixepoch()
       WHERE id = ?`
    ).bind(status, read, read, assignedTo, assignedTo, status, status, status, id).run();
    return jsonResponse({ ok: true, ...(await listRequests(env.DB)) });
  });
}
