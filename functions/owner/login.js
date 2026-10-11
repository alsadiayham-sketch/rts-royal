import { getFirestoreDocument } from "../_lib/firestore.js";
import { hasStoredPosPassword, verifyStoredPosPassword } from "../_lib/pos-password.js";
import { createOwnerSessionToken } from "../_lib/owner-session.js";
import {
  ApiError,
  jsonResponse,
  parseJsonBody,
  requireJsonContentType,
  withApiGuard,
} from "../_lib/http.js";
import { enforceRateLimit } from "../_lib/rate-limit.js";
import { normalizeUsername } from "../_lib/validation.js";

const REGISTRY_PATH = "projects/_global/settings/pos_stores";

function usersPath(organizationId) {
  return `projects/${organizationId}/settings/pos_users`;
}

function normalizeOrganizationName(value) {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ") : "";
}

export async function onRequestPost(context) {
  return withApiGuard(context, async ({ request, env }) => {
    requireJsonContentType(request);
    const payload = await parseJsonBody(request, ["organizationName", "username", "password"]);
    const organizationName = normalizeOrganizationName(payload.organizationName);
    const username = normalizeUsername(payload.username);
    const password = typeof payload.password === "string" ? payload.password : "";
    if (!organizationName || !username || !password) {
      throw new ApiError(401, "OWNER_AUTH_FAILED", "Invalid owner credentials.");
    }
    await enforceRateLimit(context, {
      scope: "owner_login",
      accountPart: username,
      maxRequests: 10,
      windowSeconds: 900,
    });

    const registry = await getFirestoreDocument(REGISTRY_PATH);
    const store = (Array.isArray(registry?.stores) ? registry.stores : []).find(
      (candidate) =>
        typeof candidate?.name === "string" &&
        candidate.name.trim().localeCompare(organizationName, undefined, { sensitivity: "accent" }) === 0 &&
        candidate.ownerUsername === username
    );
    if (!store) throw new ApiError(401, "OWNER_AUTH_FAILED", "Invalid owner credentials.");

    const usersDocument = await getFirestoreDocument(usersPath(store.id));
    const user = (Array.isArray(usersDocument?.users) ? usersDocument.users : []).find(
      (candidate) => candidate?.username === username
    );
    const verification = user && hasStoredPosPassword(user)
      ? await verifyStoredPosPassword(user, password)
      : { verified: false };
    if (!user || user.active === false || !verification.verified) {
      throw new ApiError(401, "OWNER_AUTH_FAILED", "Invalid owner credentials.");
    }
    const mode = store.productType === "clinic" || store.type === "clinic" ? "clinic" : "business";
    const passwordVersion = Number.isInteger(Number(user.passwordVersion))
      ? Math.max(1, Number(user.passwordVersion))
      : 1;
    const now = Math.floor(Date.now() / 1000);
    const token = await createOwnerSessionToken(env.AUTH_SECRET, {
      organizationId: store.id,
      ownerUsername: username,
      mode,
      passwordVersion,
      exp: now + 60 * 60 * 8,
    });
    return jsonResponse({
      token,
      mode,
      organizationName: store.name,
      ownerName: store.ownerName || user.displayName || user.name || username,
      displayName: user.displayName || user.name || username,
    });
  });
}
