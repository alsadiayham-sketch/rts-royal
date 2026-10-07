import { getFirestoreDocument } from "../_lib/firestore.js";
import { hmacSha256Hex } from "../_lib/crypto.js";
import {
  ApiError,
  jsonResponse,
  parseJsonBody,
  requireJsonContentType,
  withApiGuard,
} from "../_lib/http.js";
import { enforceRateLimit } from "../_lib/rate-limit.js";
import { normalizeStoreId } from "../_lib/pos-store-validation.js";
import { normalizeUsername } from "../_lib/validation.js";

const REGISTRY_PATH = "projects/_global/settings/pos_stores";

function usersPath(storeId) {
  return `projects/${storeId}/settings/pos_users`;
}

function licencePath(storeId) {
  return `projects/${storeId}/settings/pos`;
}

function toBase64Url(value) {
  return btoa(value).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

async function createPosSessionToken(env, claims) {
  const encodedClaims = toBase64Url(JSON.stringify(claims));
  const signature = await hmacSha256Hex(env.AUTH_SECRET, encodedClaims);
  return `${encodedClaims}.${signature}`;
}

export async function onRequestPost(context) {
  return withApiGuard(context, async ({ request, env }) => {
    requireJsonContentType(request);
    const payload = await parseJsonBody(request, ["storeId", "username", "password"]);
    const storeId = normalizeStoreId(payload.storeId);
    const username = normalizeUsername(payload.username);
    const password = typeof payload.password === "string" ? payload.password : "";
    if (!storeId || !username || !password) {
      throw new ApiError(401, "AUTH_FAILED", "Invalid tenant, username, or password.");
    }

    await enforceRateLimit(context, {
      scope: "pos_login",
      accountPart: `${storeId}:${username}`,
      maxRequests: 10,
      windowSeconds: 900,
    });

    const registry = await getFirestoreDocument(REGISTRY_PATH);
    const store = (Array.isArray(registry?.stores) ? registry.stores : []).find((item) => item.id === storeId);
    if (!store) throw new ApiError(401, "AUTH_FAILED", "Invalid tenant, username, or password.");

    const licence = await getFirestoreDocument(licencePath(storeId));
    const warrantyEnd = licence?.warrantyEnd ? new Date(licence.warrantyEnd) : null;
    if (!warrantyEnd || Number.isNaN(warrantyEnd.getTime()) || warrantyEnd.getTime() <= Date.now()) {
      throw new ApiError(403, "LICENCE_EXPIRED", "This tenant licence is inactive.");
    }

    const usersDocument = await getFirestoreDocument(usersPath(storeId));
    const user = (Array.isArray(usersDocument?.users) ? usersDocument.users : []).find(
      (candidate) => candidate.username === username
    );
    if (!user || user.active === false || user.password !== password) {
      throw new ApiError(401, "AUTH_FAILED", "Invalid tenant, username, or password.");
    }

    const role = user.role === "admin" ? "admin" : "worker";
    const sessionToken = await createPosSessionToken(env, {
      storeId,
      username,
      role,
      exp: Math.floor(Date.now() / 1000) + 60 * 60 * 8,
    });

    return jsonResponse({
      ok: true,
      sessionToken,
      store: {
        id: storeId,
        name: store.name || licence.storeName || storeId,
        warrantyEnd: warrantyEnd.toISOString(),
      },
      user: {
        username,
        name: user.displayName || user.name || username,
        role,
      },
    });
  });
}
