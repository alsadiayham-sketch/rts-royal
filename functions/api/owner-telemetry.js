import { MAX_TELEMETRY_JSON_BYTES } from "../_lib/constants.js";
import {
  getFirestoreDocument,
  getFirestoreDocumentSnapshot,
  patchFirestoreDocumentAtUpdateTime,
} from "../_lib/firestore.js";
import {
  ApiError,
  jsonResponse,
  parseJsonBody,
  requireJsonContentType,
  withApiGuard,
} from "../_lib/http.js";
import { requirePosSession } from "../_lib/pos-session.js";
import { getPosStoreMode } from "../_lib/pos-store-mode.js";
import { enforceRateLimit } from "../_lib/rate-limit.js";
import { normalizeTelemetryPayload } from "../_lib/telemetry.js";

const REGISTRY_PATH = "projects/_global/settings/pos_stores";
const MAX_PATCH_ATTEMPTS = 3;

function licencePath(storeId) {
  return `projects/${storeId}/settings/pos`;
}

function usersPath(storeId) {
  return `projects/${storeId}/settings/pos_users`;
}

function requireCurrentLicence(snapshot, productType) {
  if (!snapshot?.data || !snapshot.updateTime) {
    throw new ApiError(403, "POS_SESSION_REVOKED", "POS session is no longer authorized.");
  }
  if (snapshot.data.productType && snapshot.data.productType !== productType) {
    throw new ApiError(403, "POS_PRODUCT_MISMATCH", "POS session is not authorized for this product.");
  }
  const warrantyEnd = snapshot.data.warrantyEnd ? new Date(snapshot.data.warrantyEnd) : null;
  if (!warrantyEnd || Number.isNaN(warrantyEnd.getTime()) || warrantyEnd.getTime() <= Date.now()) {
    throw new ApiError(403, "LICENCE_EXPIRED", "This tenant licence is inactive.");
  }
}

function rejectOlderSnapshot(currentTelemetry, generatedAt) {
  const currentGeneratedAt = currentTelemetry?.generatedAt;
  if (typeof currentGeneratedAt !== "string") return;
  const currentTime = new Date(currentGeneratedAt).getTime();
  const nextTime = new Date(generatedAt).getTime();
  if (Number.isFinite(currentTime) && currentTime >= nextTime) {
    throw new ApiError(409, "STALE_TELEMETRY", "A newer telemetry snapshot already exists.");
  }
}

async function persistLatestTelemetry(path, initialSnapshot, productType, normalized) {
  let snapshot = initialSnapshot;
  for (let attempt = 0; attempt < MAX_PATCH_ATTEMPTS; attempt += 1) {
    requireCurrentLicence(snapshot, productType);
    rejectOlderSnapshot(snapshot.data.telemetry, normalized.generatedAt);

    const receivedAt = new Date().toISOString();
    const telemetry = {
      schemaVersion: 1,
      productType,
      source: `rts-${productType}-pos`,
      generatedAt: normalized.generatedAt,
      receivedAt,
      lastHeartbeatAt: normalized.generatedAt,
      appVersion: normalized.appVersion,
      metrics: normalized.metrics,
      eventCounters: normalized.eventCounters,
    };

    try {
      await patchFirestoreDocumentAtUpdateTime(path, { telemetry }, snapshot.updateTime);
      return telemetry;
    } catch (error) {
      if (!(error instanceof ApiError) || error.code !== "POS_REGISTRY_CONFLICT" || attempt === MAX_PATCH_ATTEMPTS - 1) {
        throw error;
      }
      snapshot = await getFirestoreDocumentSnapshot(path);
    }
  }
  throw new ApiError(409, "POS_REGISTRY_CONFLICT", "POS telemetry changed. Please retry.");
}

export async function onRequestPost(context) {
  return withApiGuard(context, async ({ request, env }) => {
    const session = await requirePosSession(request, env.AUTH_SECRET);
    await enforceRateLimit(context, {
      scope: "owner_telemetry",
      accountPart: `${session.storeId}:${session.productType}`,
      maxRequests: 120,
      windowSeconds: 300,
    });

    requireJsonContentType(request);
    const payload = await parseJsonBody(
      request,
      ["generatedAt", "appVersion", "metrics", "eventCounters"],
      MAX_TELEMETRY_JSON_BYTES,
      { discloseUnknownFields: false }
    );
    const normalized = normalizeTelemetryPayload(payload, session.productType);
    const path = licencePath(session.storeId);
    const [registry, licenceSnapshot, usersDocument] = await Promise.all([
      getFirestoreDocument(REGISTRY_PATH),
      getFirestoreDocumentSnapshot(path),
      getFirestoreDocument(usersPath(session.storeId)),
    ]);

    const store = (Array.isArray(registry?.stores) ? registry.stores : []).find(
      (candidate) => candidate?.id === session.storeId
    );
    if (!store) {
      throw new ApiError(403, "POS_SESSION_REVOKED", "POS session is no longer authorized.");
    }
    if (getPosStoreMode(store) !== session.productType) {
      throw new ApiError(403, "POS_PRODUCT_MISMATCH", "POS session is not authorized for this product.");
    }

    const user = (Array.isArray(usersDocument?.users) ? usersDocument.users : []).find(
      (candidate) => candidate?.username === session.username
    );
    if (!user || user.active === false || (user.role === "admin" ? "admin" : "worker") !== session.role) {
      throw new ApiError(403, "POS_SESSION_REVOKED", "POS session is no longer authorized.");
    }

    requireCurrentLicence(licenceSnapshot, session.productType);
    const telemetry = await persistLatestTelemetry(path, licenceSnapshot, session.productType, normalized);
    return jsonResponse({
      ok: true,
      generatedAt: telemetry.generatedAt,
      lastHeartbeatAt: telemetry.lastHeartbeatAt,
      source: telemetry.source,
    });
  });
}
