import { getFirestoreDocument, setFirestoreDocument } from "../_lib/firestore.js";
import { verifyStoredPosPassword } from "../_lib/pos-password.js";
import { getPosStoreMode } from "../_lib/pos-store-mode.js";
import {
  ApiError,
  jsonResponse,
  parseJsonBody,
  requireJsonContentType,
  withApiGuard,
} from "../_lib/http.js";
import { enforceRateLimit } from "../_lib/rate-limit.js";
import { createPosSessionToken } from "../_lib/pos-session.js";
import { normalizeBusinessType, normalizeStoreId } from "../_lib/pos-store-validation.js";
import { normalizeUsername } from "../_lib/validation.js";

const REGISTRY_PATH = "projects/_global/settings/pos_stores";

function usersPath(storeId) {
  return `projects/${storeId}/settings/pos_users`;
}

function licencePath(storeId) {
  return `projects/${storeId}/settings/pos`;
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
    const verification = user
      ? await verifyStoredPosPassword(user, password)
      : { verified: false, migratedUser: null };
    if (!user || user.active === false || !verification.verified) {
      throw new ApiError(401, "AUTH_FAILED", "Invalid tenant, username, or password.");
    }
    if (verification.migratedUser) {
      const users = Array.isArray(usersDocument?.users) ? usersDocument.users : [];
      const index = users.findIndex((candidate) => candidate.username === username);
      if (index >= 0) {
        users[index] = verification.migratedUser;
        await setFirestoreDocument(usersPath(storeId), { users });
      }
    }

    const role = user.role === "admin" ? "admin" : "worker";
    const productType = getPosStoreMode(store);
    const sessionToken = await createPosSessionToken(env.AUTH_SECRET, {
      storeId,
      username,
      role,
      productType,
      exp: Math.floor(Date.now() / 1000) + 60 * 60 * 8,
    });

    return jsonResponse({
      ok: true,
      sessionToken,
      token: sessionToken,
      productType,
      store: {
        id: storeId,
        name: store.name || licence.storeName || storeId,
        warrantyEnd: warrantyEnd.toISOString(),
        productType,
        ...(normalizeBusinessType(licence.businessType) ? { businessType: licence.businessType } : {}),
      },
      user: {
        username,
        name: user.displayName || user.name || username,
        role,
      },
    });
  });
}
