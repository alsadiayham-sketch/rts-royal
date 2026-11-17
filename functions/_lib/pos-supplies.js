import {
  commitFirestoreWrites,
  firestoreTimestamp,
  getFirestoreDocument,
  getFirestoreDocumentSnapshot,
  listFirestoreDocuments,
} from "./firestore.js";
import {
  ApiError,
  jsonResponse,
  parseJsonBody,
  requireJsonContentType,
  requireTrustedMutationRequest,
  withApiGuard,
} from "./http.js";
import { enforceRateLimit } from "./rate-limit.js";
import { dispatchSupplyAlert } from "./pos-mobile-push.js";
import { getPosUserAuthVersion, requirePosSession } from "./pos-session.js";
import { normalizeBusinessType } from "./pos-store-validation.js";
import { normalizeUsername } from "./validation.js";

const REGISTRY_PATH = "projects/_global/settings/pos_stores";
const QUANTITY_PATTERN = /^(0|[1-9]\d{0,5})(?:\.(\d{1,3}))?$/;
const REQUEST_ID_PATTERN = /^[A-Za-z0-9_-]{8,80}$/;
const ITEM_ID_PATTERN = /^[A-Za-z0-9_-]{8,80}$/;
const MAX_MILLI = 999_999_999;
const AUDIT_LIMIT_DEFAULT = 50;
const AUDIT_LIMIT_MAX = 100;

const usersPath = (storeId) => `projects/${storeId}/settings/pos_users`;
const licencePath = (storeId) => `projects/${storeId}/settings/pos`;
const itemPath = (storeId, itemId) => `projects/${storeId}/pos_supplies/${itemId}`;
const auditPath = (storeId, auditId) => `projects/${storeId}/pos_supply_audit/${auditId}`;
const alertPath = (storeId, eventId) => `projects/${storeId}/pos_supply_alerts/${eventId}`;
const requestPath = (storeId, requestId) => `projects/${storeId}/pos_supply_requests/${requestId}`;

function normalizeText(value, maxLength) {
  if (typeof value !== "string") return "";
  const normalized = value.trim().normalize("NFKC").replace(/\s+/g, " ");
  return normalized && normalized.length <= maxLength ? normalized : "";
}

function parseQuantity(value, { positive = false } = {}) {
  const raw = typeof value === "number" ? String(value) : value;
  if (typeof raw !== "string" || !QUANTITY_PATTERN.test(raw)) {
    throw new ApiError(400, "INVALID_SUPPLY_QUANTITY", "Use a quantity from 0 to 999999.999 with up to 3 decimal places.");
  }
  const [whole, fraction = ""] = raw.split(".");
  const milli = Number(whole) * 1000 + Number(fraction.padEnd(3, "0"));
  if (!Number.isSafeInteger(milli) || milli > MAX_MILLI || (positive && milli === 0)) {
    throw new ApiError(400, "INVALID_SUPPLY_QUANTITY", "Supply quantity is outside the supported range.");
  }
  return milli;
}

function formatQuantity(milli) {
  const whole = Math.floor(milli / 1000);
  const fraction = String(milli % 1000).padStart(3, "0").replace(/0+$/, "");
  return fraction ? `${whole}.${fraction}` : String(whole);
}

function publicItem(id, data) {
  const quantityMilli = Number(data.quantityMilli) || 0;
  const lowStockMilli = Number(data.lowStockMilli) || 0;
  return {
    id,
    name: data.name || "",
    category: data.category || "",
    unit: data.unit || "",
    quantity: formatQuantity(quantityMilli),
    lowStockThreshold: formatQuantity(lowStockMilli),
    lowStock: quantityMilli <= lowStockMilli,
    createdAt: data.createdAt || null,
    createdBy: data.createdBy || "",
    updatedAt: data.updatedAt || null,
    updatedBy: data.updatedBy || "",
  };
}

function publicAudit(id, data) {
  return {
    id,
    action: data.action,
    itemId: data.itemId,
    itemName: data.itemName,
    unit: data.unit,
    beforeQuantity: formatQuantity(Number(data.beforeQuantityMilli) || 0),
    quantity: formatQuantity(Number(data.quantityMilli) || 0),
    afterQuantity: formatQuantity(Number(data.afterQuantityMilli) || 0),
    beforeLowStockThreshold: formatQuantity(Number(data.beforeLowStockMilli) || 0),
    lowStockThreshold: formatQuantity(Number(data.lowStockMilli) || 0),
    lowStock: data.lowStock === true,
    actor: data.actor,
    actorRole: data.actorRole,
    timestamp: data.timestamp,
  };
}

function findCurrentUser(users, username) {
  const matches = users.filter((user) => normalizeUsername(user.username) === username);
  return matches.length === 1 ? matches[0] : null;
}

async function authorize(context, mutation) {
  if (mutation) requireTrustedMutationRequest(context.request);
  const actor = await requirePosSession(context.request, context.env.AUTH_SECRET);
  if (actor.productType !== "business") {
    throw new ApiError(403, "RESTAURANT_SUPPLIES_FORBIDDEN", "Supplies are available only to RTS Business restaurant tenants.");
  }
  const [registry, licence, usersSnapshot] = await Promise.all([
    getFirestoreDocument(REGISTRY_PATH),
    getFirestoreDocument(licencePath(actor.storeId)),
    getFirestoreDocumentSnapshot(usersPath(actor.storeId)),
  ]);
  const store = registry?.stores?.find((candidate) => candidate?.id === actor.storeId && candidate?.productType !== "clinic");
  const users = Array.isArray(usersSnapshot?.data?.users) ? usersSnapshot.data.users : [];
  const current = findCurrentUser(users, actor.username);
  if (!store || !current || current.active === false || !actor.authVersion
      || actor.authVersion !== await getPosUserAuthVersion(context.env.AUTH_SECRET, current)) {
    throw new ApiError(401, "POS_AUTH_REQUIRED", "Your account changed. Sign in again.");
  }
  if (current.role !== actor.role || !["admin", "worker"].includes(actor.role)) {
    throw new ApiError(403, "RESTAURANT_SUPPLIES_FORBIDDEN", "This POS account cannot manage restaurant supplies.");
  }
  if (!(new Date(licence?.warrantyEnd).getTime() > Date.now())) {
    throw new ApiError(403, "LICENCE_EXPIRED", "This tenant licence is inactive.");
  }
  if (normalizeBusinessType(licence?.businessType) !== "restaurant") {
    throw new ApiError(403, "RESTAURANT_SUPPLIES_FORBIDDEN", "Supplies are available only in restaurant mode.");
  }
  if (mutation) {
    await enforceRateLimit(context, {
      scope: "pos_supplies_write",
      accountPart: `${actor.storeId}:${actor.username}`,
      maxRequests: 120,
      windowSeconds: 600,
    });
  }
  return actor;
}

function validateRequestId(value) {
  if (typeof value !== "string" || !REQUEST_ID_PATTERN.test(value)) {
    throw new ApiError(400, "INVALID_REQUEST_ID", "A valid requestId is required.");
  }
  return value;
}

function validateItemId(value) {
  if (typeof value !== "string" || !ITEM_ID_PATTERN.test(value)) {
    throw new ApiError(400, "INVALID_SUPPLY_ITEM", "Supply item is invalid.");
  }
  return value;
}

function replayResponse(snapshot) {
  if (!snapshot?.data?.response) return null;
  return jsonResponse({ ...snapshot.data.response, replayed: true });
}

async function replayAfterConflict(storeId, requestId, error) {
  if (!(error instanceof ApiError) || error.code !== "POS_REGISTRY_CONFLICT") throw error;
  const completed = await getFirestoreDocumentSnapshot(requestPath(storeId, requestId));
  const replay = replayResponse(completed);
  if (replay) return replay;
  throw new ApiError(409, "SUPPLY_CONFLICT", "Supply stock changed. Refresh and retry.");
}

function operationResult(itemId, item, auditId, audit) {
  return {
    ok: true,
    replayed: false,
    item: publicItem(itemId, item),
    audit: publicAudit(auditId, audit),
  };
}

function lowStockAlert(eventId, itemId, item, audit) {
  return {
    eventId,
    type: "supply.low_stock",
    itemId,
    itemName: item.name,
    unit: item.unit,
    quantity: formatQuantity(item.quantityMilli),
    lowStockThreshold: formatQuantity(item.lowStockMilli),
    actor: audit.actor,
    actorRole: audit.actorRole,
    timestamp: audit.timestamp,
    status: "pending",
    attempts: 0,
  };
}

async function createItem(actor, payload, requestId, now) {
  const name = normalizeText(payload.name, 80);
  const category = normalizeText(payload.category, 50);
  const unit = normalizeText(payload.unit, 24);
  if (!name || !category || !unit) {
    throw new ApiError(400, "INVALID_SUPPLY_ITEM", "Name, type, and unit are required.");
  }
  const quantityMilli = parseQuantity(payload.quantity);
  const lowStockMilli = parseQuantity(payload.lowStockThreshold);
  const itemId = crypto.randomUUID();
  const auditId = crypto.randomUUID();
  const item = {
    name, category, unit, quantityMilli, lowStockMilli,
    createdAt: now, createdBy: actor.username, updatedAt: now, updatedBy: actor.username,
  };
  const audit = {
    action: "create", itemId, itemName: name, unit,
    beforeQuantityMilli: 0, quantityMilli, afterQuantityMilli: quantityMilli,
    beforeLowStockMilli: 0, lowStockMilli, lowStock: quantityMilli <= lowStockMilli,
    actor: actor.username, actorRole: actor.role, timestamp: now,
  };
  const response = operationResult(itemId, item, auditId, audit);
  const writes = [
    { path: itemPath(actor.storeId, itemId), data: item, create: true },
    { path: auditPath(actor.storeId, auditId), data: audit, create: true },
    { path: requestPath(actor.storeId, requestId), data: { response, createdAt: firestoreTimestamp(now) }, create: true },
  ];
  if (quantityMilli <= lowStockMilli) {
    writes.push({
      path: alertPath(actor.storeId, auditId),
      data: lowStockAlert(auditId, itemId, item, audit),
      create: true,
    });
  }
  await commitFirestoreWrites(writes);
  return { response, status: 201 };
}

async function mutateItem(actor, payload, requestId, now) {
  const itemId = validateItemId(payload.itemId);
  const snapshot = await getFirestoreDocumentSnapshot(itemPath(actor.storeId, itemId));
  if (!snapshot) throw new ApiError(404, "SUPPLY_ITEM_NOT_FOUND", "Supply item not found.");
  const current = snapshot.data;
  const beforeQuantityMilli = Number(current.quantityMilli) || 0;
  const beforeLowStockMilli = Number(current.lowStockMilli) || 0;
  const wasLowStock = beforeQuantityMilli <= beforeLowStockMilli;
  let quantityMilli = beforeQuantityMilli;
  let lowStockMilli = beforeLowStockMilli;
  let operationQuantityMilli = 0;

  if (payload.action === "adjust") {
    quantityMilli = parseQuantity(payload.quantity);
    operationQuantityMilli = quantityMilli;
  } else if (payload.action === "use") {
    operationQuantityMilli = parseQuantity(payload.quantity, { positive: true });
    if (operationQuantityMilli > beforeQuantityMilli) {
      throw new ApiError(409, "INSUFFICIENT_SUPPLY_STOCK", "Consumption exceeds the available stock.");
    }
    quantityMilli = beforeQuantityMilli - operationQuantityMilli;
  } else if (payload.action === "threshold") {
    lowStockMilli = parseQuantity(payload.lowStockThreshold);
    operationQuantityMilli = quantityMilli;
  } else {
    throw new ApiError(400, "INVALID_SUPPLY_ACTION", "Supply action is invalid.");
  }

  const item = {
    ...current,
    quantityMilli,
    lowStockMilli,
    updatedAt: now,
    updatedBy: actor.username,
  };
  const auditId = crypto.randomUUID();
  const audit = {
    action: payload.action,
    itemId,
    itemName: current.name,
    unit: current.unit,
    beforeQuantityMilli,
    quantityMilli: operationQuantityMilli,
    afterQuantityMilli: quantityMilli,
    beforeLowStockMilli,
    lowStockMilli,
    lowStock: quantityMilli <= lowStockMilli,
    actor: actor.username,
    actorRole: actor.role,
    timestamp: now,
  };
  const response = operationResult(itemId, item, auditId, audit);
  const writes = [
    { path: itemPath(actor.storeId, itemId), data: item, updateTime: snapshot.updateTime },
    { path: auditPath(actor.storeId, auditId), data: audit, create: true },
    { path: requestPath(actor.storeId, requestId), data: { response, createdAt: firestoreTimestamp(now) }, create: true },
  ];
  if (!wasLowStock && quantityMilli <= lowStockMilli) {
    writes.push({
      path: alertPath(actor.storeId, auditId),
      data: lowStockAlert(auditId, itemId, item, audit),
      create: true,
    });
  }
  await commitFirestoreWrites(writes);
  return { response, status: 200 };
}

async function dispatchCommittedAlert(context, storeId, auditId) {
  const dispatch = Promise.resolve()
    .then(() => dispatchSupplyAlert(context, storeId, auditId))
    .catch((error) => {
      console.error("SUPPLY_ALERT_DISPATCH_FAILED", {
        storeId,
        auditId,
        message: error?.message || "Unhandled",
      });
    });
  if (typeof context.waitUntil === "function") {
    try {
      context.waitUntil(dispatch);
      return;
    } catch {
      // Fall through to the safe awaited path when the runtime rejects waitUntil.
    }
  }
  await dispatch;
}

export function createPosSuppliesHandlers() {
  return {
    onRequestGet: (context) => withApiGuard(context, async ({ request }) => {
      const actor = await authorize(context, false);
      const url = new URL(request.url);
      const auditCursor = url.searchParams.get("auditCursor") || "";
      const requestedLimit = Number(url.searchParams.get("auditLimit") || AUDIT_LIMIT_DEFAULT);
      const auditLimit = Number.isInteger(requestedLimit)
        ? Math.min(AUDIT_LIMIT_MAX, Math.max(1, requestedLimit))
        : AUDIT_LIMIT_DEFAULT;
      const [itemsPage, auditPage] = await Promise.all([
        listFirestoreDocuments(`projects/${actor.storeId}/pos_supplies`, { pageSize: 500 }),
        listFirestoreDocuments(`projects/${actor.storeId}/pos_supply_audit`, {
          pageSize: auditLimit,
          pageToken: auditCursor,
          orderBy: "timestamp desc",
        }),
      ]);
      return jsonResponse({
        items: itemsPage.documents.map((document) => publicItem(document.id, document.data))
          .sort((left, right) => left.name.localeCompare(right.name, "ar")),
        itemsTruncated: Boolean(itemsPage.nextPageToken),
        audit: auditPage.documents.map((document) => publicAudit(document.id, document.data)),
        auditCursor: auditPage.nextPageToken || null,
      });
    }),
    onRequestPost: (context) => withApiGuard(context, async ({ request }) => {
      requireJsonContentType(request);
      const payload = await parseJsonBody(request, [
        "action", "requestId", "itemId", "name", "category", "unit", "quantity", "lowStockThreshold",
      ]);
      const actor = await authorize(context, true);
      const requestId = validateRequestId(payload.requestId);
      const completed = await getFirestoreDocumentSnapshot(requestPath(actor.storeId, requestId));
      const replay = replayResponse(completed);
      if (replay) return replay;
      const now = new Date().toISOString();
      try {
        const result = payload.action === "create"
          ? await createItem(actor, payload, requestId, now)
          : await mutateItem(actor, payload, requestId, now);
        await dispatchCommittedAlert(context, actor.storeId, result.response.audit.id);
        return jsonResponse(result.response, result.status);
      } catch (error) {
        return replayAfterConflict(actor.storeId, requestId, error);
      }
    }),
  };
}

export const quantity = { parse: parseQuantity, format: formatQuantity };
