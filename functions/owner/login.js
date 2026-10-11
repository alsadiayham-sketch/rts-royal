import {
  commitFirestoreWrites,
  getFirestoreDocument,
  getFirestoreDocumentSnapshot,
} from "../_lib/firestore.js";
import { verifyStoredPosPassword } from "../_lib/pos-password.js";
import { getPosStoreMode } from "../_lib/pos-store-mode.js";
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

function matchesOrganization(store, suppliedName) {
  const normalizedId = typeof store?.id === "string" ? store.id.trim() : "";
  const normalizedName = typeof store?.name === "string" ? store.name.trim() : "";
  return (
    normalizedId.localeCompare(suppliedName, undefined, { sensitivity: "accent" }) === 0 ||
    normalizedName.localeCompare(suppliedName, undefined, { sensitivity: "accent" }) === 0
  );
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
        matchesOrganization(candidate, organizationName) &&
        (!candidate.ownerUsername || candidate.ownerUsername === username)
    );
    if (!store) throw new ApiError(401, "OWNER_AUTH_FAILED", "Invalid owner credentials.");

    const usersSnapshot = await getFirestoreDocumentSnapshot(usersPath(store.id));
    const usersDocument = usersSnapshot?.data;
    const user = (Array.isArray(usersDocument?.users) ? usersDocument.users : []).find(
      (candidate) => candidate?.username === username
    );
    const legacyOwner = !store.ownerUsername;
    const verification = user && (!legacyOwner || user.role === "admin" || user.isOwner === true)
      ? await verifyStoredPosPassword(user, password)
      : { verified: false, migratedUser: null };
    if (!user || user.active === false || !verification.verified) {
      throw new ApiError(401, "OWNER_AUTH_FAILED", "Invalid owner credentials.");
    }
    const authenticatedUser = verification.migratedUser
      ? { ...verification.migratedUser, passwordVersion: 1 }
      : user;
    if (verification.migratedUser) {
      const users = Array.isArray(usersDocument?.users) ? [...usersDocument.users] : [];
      const index = users.findIndex((candidate) => candidate?.username === username);
      users[index] = authenticatedUser;
      await commitFirestoreWrites([{
        path: usersPath(store.id),
        data: { users },
        updateTime: usersSnapshot?.updateTime,
      }]);
    }

    const mode = getPosStoreMode(store);
    const passwordVersion = Number.isInteger(Number(authenticatedUser.passwordVersion))
      ? Math.max(1, Number(authenticatedUser.passwordVersion))
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
      ownerName: store.ownerName || authenticatedUser.displayName || authenticatedUser.name || username,
      displayName: authenticatedUser.displayName || authenticatedUser.name || username,
    });
  });
}
