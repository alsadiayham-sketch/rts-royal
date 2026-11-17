import { requirePlatformAdmin, requirePlatformReader } from "./auth.js";
import { commitFirestoreWrites, getFirestoreDocument, getFirestoreDocumentSnapshot, patchFirestoreDocumentAtUpdateTime } from "./firestore.js";
import { ApiError, jsonResponse, parseJsonBody, requireJsonContentType, requireTrustedMutationRequest, withApiGuard } from "./http.js";
import { createStoredPosPassword } from "./pos-password.js";
import { getPosUserAuthVersion, requirePosSession } from "./pos-session.js";
import { normalizeStoreId, normalizeStoreName } from "./pos-store-validation.js";
import { normalizeUsername, validateNewPassword } from "./validation.js";
import { enforceRateLimit } from "./rate-limit.js";

const REGISTRY_PATH = "projects/_global/settings/pos_stores";
const usersPath = (storeId) => `projects/${storeId}/settings/pos_users`;

function findUser(users, username) {
  const matches = users.filter((user) => normalizeUsername(user.username) === username);
  if (matches.length > 1) throw new ApiError(409, "DUPLICATE_POS_USERNAME", "Resolve duplicate POS usernames before editing this account.");
  return matches[0];
}

function restrictions(user, users, store, actor) {
  const owner = normalizeUsername(store.ownerUsername) === normalizeUsername(user.username) || user.isOwner === true;
  const self = actor.desktop && actor.username === normalizeUsername(user.username);
  const lastAdmin = user.role === "admin" && user.active !== false
    && users.filter((candidate) => candidate.role === "admin" && candidate.active !== false).length <= 1;
  return { owner, self, lastAdmin };
}

function publicUser(user, users, store, actor) {
  const { owner, self, lastAdmin } = restrictions(user, users, store, actor);
  return {
    username: user.username,
    name: user.displayName || user.name || user.username,
    role: user.role === "admin" ? "admin" : "worker",
    active: user.active !== false,
    canDelete: !owner && !self && !lastAdmin,
    canDeactivate: !owner && !self && !lastAdmin,
    canChangeRole: !owner && !self && !lastAdmin,
  };
}

function protectAccount(user, users, store, actor, action) {
  const { owner, self, lastAdmin } = restrictions(user, users, store, actor);
  if (owner) throw new ApiError(409, "OWNER_ACCOUNT_REQUIRED", "The linked owner must remain an active administrator.");
  if (self) throw new ApiError(409, "SELF_CHANGE_FORBIDDEN", `You cannot ${action} your own POS administrator account.`);
  if (lastAdmin) throw new ApiError(409, "LAST_POS_ADMIN_FORBIDDEN", "The last active POS administrator must be retained.");
}

async function writeUsers(storeId, users, snapshot) {
  if (snapshot) return patchFirestoreDocumentAtUpdateTime(usersPath(storeId), { users }, snapshot.updateTime);
  return commitFirestoreWrites([{ path: usersPath(storeId), data: { users }, create: true }]);
}

export function createPosUserHandlers({ desktop = false } = {}) {
  async function authorize(context, payload, mutation) {
    if (mutation && !desktop) requireTrustedMutationRequest(context.request);
    const actor = desktop
      ? { ...(await requirePosSession(context.request, context.env.AUTH_SECRET)), desktop: true }
      : { ...(await (mutation ? requirePlatformAdmin(context, false) : requirePlatformReader(context))), desktop: false };
    const requestedStore = payload?.storeId ?? new URL(context.request.url).searchParams.get("storeId");
    const storeId = desktop ? actor.storeId : normalizeStoreId(requestedStore);
    if (!storeId) throw new ApiError(400, "INVALID_STORE_ID", "Store ID is invalid.");
    if (desktop && requestedStore != null && normalizeStoreId(requestedStore) !== storeId) {
      throw new ApiError(403, "STORE_SCOPE_FORBIDDEN", "Employee management is limited to the signed-in store.");
    }
    const registry = await getFirestoreDocument(REGISTRY_PATH);
    const store = registry?.stores?.find((item) => item.id === storeId);
    if (!store) throw new ApiError(404, "STORE_NOT_FOUND", "Store not found.");
    const snapshot = await getFirestoreDocumentSnapshot(usersPath(storeId));
    const users = Array.isArray(snapshot?.data?.users) ? snapshot.data.users : [];
    if (desktop) {
      const current = findUser(users, actor.username);
      if (!current || current.active === false || !actor.authVersion
          || actor.authVersion !== await getPosUserAuthVersion(context.env.AUTH_SECRET, current)) {
        throw new ApiError(401, "POS_AUTH_REQUIRED", "Your account changed. Sign in again.");
      }
      if (actor.role !== "admin" || current.role !== "admin" || actor.productType !== "business") {
        throw new ApiError(403, "POS_ADMIN_REQUIRED", "Only a POS administrator can manage employees.");
      }
      const licence = await getFirestoreDocument(`projects/${storeId}/settings/pos`);
      if (!(new Date(licence?.warrantyEnd).getTime() > Date.now())) {
        throw new ApiError(403, "LICENCE_EXPIRED", "This tenant licence is inactive.");
      }
    }
    if (mutation) await enforceRateLimit(context, {
      scope: desktop ? "pos_employees_manage" : "pos_store_users_manage",
      accountPart: `${storeId}:${actor.username}`, maxRequests: 60, windowSeconds: 600,
    });
    return { actor, storeId, store, snapshot, users };
  }

  return {
    onRequestGet: (context) => withApiGuard(context, async () => {
      const { actor, store, users } = await authorize(context);
      return jsonResponse({ users: users.map((user) => publicUser(user, users, store, actor)) });
    }),
    onRequestPost: (context) => withApiGuard(context, async ({ request }) => {
      requireJsonContentType(request);
      const payload = await parseJsonBody(request, ["storeId", "username", "name", "password", "role"]);
      const { actor, storeId, store, snapshot, users } = await authorize(context, payload, true);
      const username = normalizeUsername(payload.username);
      const name = normalizeStoreName(payload.name);
      const role = payload.role;
      const password = typeof payload.password === "string" ? payload.password : "";
      if (!username || !name || !["admin", "worker"].includes(role)) {
        throw new ApiError(400, "INVALID_POS_USER", "POS user details are invalid.");
      }
      const existing = findUser(users, username);
      const legacyClinicPassword = storeId === "rts-testing" && password.length >= 8 && password.length <= 128;
      if ((!existing || password) && !validateNewPassword(password) && !legacyClinicPassword) {
        throw new ApiError(400, "INVALID_POS_PASSWORD", "Use a password of 12–128 characters; leave blank only when keeping an existing password.");
      }
      if (existing && role !== "admin" && (existing.role === "admin" || existing.isOwner || store.ownerUsername === username)) {
        protectAccount(existing, users, store, actor, "demote");
      }
      const next = { ...existing, username, name, displayName: name, role, active: existing?.active !== false };
      if (existing && role !== existing.role) next.passwordVersion = (Number(existing.passwordVersion) || 1) + 1;
      if (password) {
        Object.assign(next, await createStoredPosPassword(password));
        delete next.password;
        next.passwordVersion = (Number(existing?.passwordVersion) || 0) + 1;
      }
      if (existing) users[users.indexOf(existing)] = next;
      else users.push(next);
      await writeUsers(storeId, users, snapshot);
      return jsonResponse({ ok: true, user: publicUser(next, users, store, actor) }, existing ? 200 : 201);
    }),
    onRequestPatch: (context) => withApiGuard(context, async ({ request }) => {
      requireJsonContentType(request);
      const payload = await parseJsonBody(request, ["storeId", "username", "active"]);
      const { actor, storeId, store, snapshot, users } = await authorize(context, payload, true);
      const username = normalizeUsername(payload.username);
      if (!username || typeof payload.active !== "boolean") throw new ApiError(400, "INVALID_POS_USER", "POS user details are invalid.");
      const user = findUser(users, username);
      if (!user) throw new ApiError(404, "POS_USER_NOT_FOUND", "POS user not found.");
      if (!payload.active) protectAccount(user, users, store, actor, "deactivate");
      if ((user.active !== false) !== payload.active) user.passwordVersion = (Number(user.passwordVersion) || 1) + 1;
      user.active = payload.active;
      await writeUsers(storeId, users, snapshot);
      return jsonResponse({ ok: true, user: publicUser(user, users, store, actor) });
    }),
    onRequestDelete: (context) => withApiGuard(context, async ({ request }) => {
      requireJsonContentType(request);
      const payload = await parseJsonBody(request, ["storeId", "username"]);
      const { actor, storeId, store, snapshot, users } = await authorize(context, payload, true);
      const username = normalizeUsername(payload.username);
      if (!username) throw new ApiError(400, "INVALID_POS_USER", "POS user details are invalid.");
      const user = findUser(users, username);
      if (!user) return jsonResponse({ ok: true });
      protectAccount(user, users, store, actor, "delete");
      await writeUsers(storeId, users.filter((item) => item !== user), snapshot);
      return jsonResponse({ ok: true });
    }),
  };
}
