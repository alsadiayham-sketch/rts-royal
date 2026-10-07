import { requireAuthenticatedUser } from "../_lib/auth.js";
import { getFirestoreDocument, setFirestoreDocument } from "../_lib/firestore.js";
import {
  ApiError,
  jsonResponse,
  parseJsonBody,
  requireJsonContentType,
  requireTrustedMutationRequest,
  withApiGuard,
} from "../_lib/http.js";
import { normalizeStoreId, normalizeStoreName } from "../_lib/pos-store-validation.js";
import { enforceRateLimit } from "../_lib/rate-limit.js";
import { normalizeUsername, validateNewPassword } from "../_lib/validation.js";
import { assertUserStatusChangeAllowed } from "../_lib/user-rules.js";
import { createStoredPosPassword } from "../_lib/pos-password.js";

const REGISTRY_PATH = "projects/_global/settings/pos_stores";

function usersPath(storeId) {
  return `projects/${storeId}/settings/pos_users`;
}

async function requireStandaloneStore(storeId) {
  const registry = await getFirestoreDocument(REGISTRY_PATH);
  const stores = Array.isArray(registry?.stores) ? registry.stores : [];
  const store = stores.find((item) => item.id === storeId);
  if (!store) throw new ApiError(404, "STORE_NOT_FOUND", "Store not found.");
  if (store.type !== "firestore" && store.type !== "clinic" && store.id !== "rts-testing") {
    throw new ApiError(409, "LINKED_STORE_USERS", "Linked-store users are managed by the website project.");
  }
  return store;
}

async function requireStoreAdmin(context, scope) {
  const user = await requireAuthenticatedUser(context, false);
  await enforceRateLimit(context, {
    scope,
    accountPart: user.username,
    maxRequests: 30,
    windowSeconds: 600,
  });
}

async function getUsers(storeId) {
  const document = await getFirestoreDocument(usersPath(storeId));
  return Array.isArray(document?.users) ? document.users : [];
}

function publicUser(user) {
  return {
    username: user.username,
    name: user.displayName || user.name || user.username,
    role: user.role === "admin" ? "admin" : "worker",
    active: user.active !== false,
  };
}

function validateRole(role) {
  return role === "admin" || role === "worker" ? role : null;
}

export async function onRequestGet(context) {
  return withApiGuard(context, async ({ request }) => {
    await requireAuthenticatedUser(context, false);
    const storeId = normalizeStoreId(new URL(request.url).searchParams.get("storeId"));
    if (!storeId) throw new ApiError(400, "INVALID_STORE_ID", "Store ID is invalid.");
    await requireStandaloneStore(storeId);
    const users = await getUsers(storeId);
    return jsonResponse({ users: users.map(publicUser) });
  });
}

export async function onRequestPost(context) {
  return withApiGuard(context, async ({ request }) => {
    requireTrustedMutationRequest(request);
    requireJsonContentType(request);
    await requireStoreAdmin(context, "pos_store_users_upsert");
    const payload = await parseJsonBody(request, [
      "storeId",
      "username",
      "name",
      "password",
      "role",
    ]);
    const storeId = normalizeStoreId(payload.storeId);
    const username = normalizeUsername(payload.username);
    const name = normalizeStoreName(payload.name);
    const password = typeof payload.password === "string" ? payload.password : "";
    const role = validateRole(payload.role);
    if (!storeId) throw new ApiError(400, "INVALID_STORE_ID", "Store ID is invalid.");
    await requireStandaloneStore(storeId);
    const legacyClinicPassword = storeId === "rts-testing" && password.length >= 8 && password.length <= 128;
    if (!username || !name || !role) {
      throw new ApiError(400, "INVALID_POS_USER", "POS user details are invalid.");
    }

    const users = await getUsers(storeId);
    const index = users.findIndex((user) => user.username === username);
    if (index < 0 && (!validateNewPassword(password) && !legacyClinicPassword)) {
      throw new ApiError(400, "INVALID_POS_USER", "A password is required for a new user.");
    }
    if (index >= 0 && password && !validateNewPassword(password) && !legacyClinicPassword) {
      throw new ApiError(400, "INVALID_POS_USER", "The password is invalid.");
    }
    const existing = index >= 0 ? users[index] : null;
    const nextUser = {
      username,
      name,
      displayName: name,
      role,
      active: existing?.active !== false,
    };
    if (password) {
      Object.assign(nextUser, await createStoredPosPassword(password));
    } else if (existing) {
      Object.assign(nextUser, existing);
      nextUser.username = username;
      nextUser.name = name;
      nextUser.displayName = name;
      nextUser.role = role;
      nextUser.active = existing.active !== false;
    }
    if (index >= 0) users[index] = nextUser;
    else users.push(nextUser);
    await setFirestoreDocument(usersPath(storeId), { users });
    return jsonResponse({ ok: true, user: publicUser(nextUser) }, index >= 0 ? 200 : 201);
  });
}

export async function onRequestPatch(context) {
  return withApiGuard(context, async ({ request }) => {
    requireTrustedMutationRequest(request);
    requireJsonContentType(request);
    const actor = await requireStoreAdmin(context, "pos_store_users_status");
    const payload = await parseJsonBody(request, ["storeId", "username", "active"]);
    const storeId = normalizeStoreId(payload.storeId);
    const username = normalizeUsername(payload.username);
    if (!storeId || !username || typeof payload.active !== "boolean") {
      throw new ApiError(400, "INVALID_POS_USER", "POS user details are invalid.");
    }
    await requireStandaloneStore(storeId);

    const users = await getUsers(storeId);
    const target = users.find((user) => user.username === username);
    if (!target) throw new ApiError(404, "POS_USER_NOT_FOUND", "POS user not found.");
    assertUserStatusChangeAllowed({
      actorUsername: actor.username,
      targetUsername: username,
      nextActive: payload.active,
      targetCurrentlyActive: target.active !== false,
      activeAdminCount: users.filter((user) => user.role === "admin" && user.active !== false).length,
    });
    target.active = payload.active;
    await setFirestoreDocument(usersPath(storeId), { users });
    return jsonResponse({ ok: true, user: publicUser(target) });
  });
}

export async function onRequestDelete(context) {
  return withApiGuard(context, async ({ request }) => {
    requireTrustedMutationRequest(request);
    requireJsonContentType(request);
    const actor = await requireStoreAdmin(context, "pos_store_users_delete");
    const payload = await parseJsonBody(request, ["storeId", "username"]);
    const storeId = normalizeStoreId(payload.storeId);
    const username = normalizeUsername(payload.username);
    if (!storeId || !username) {
      throw new ApiError(400, "INVALID_POS_USER", "POS user details are invalid.");
    }
    await requireStandaloneStore(storeId);

    const users = await getUsers(storeId);
    const index = users.findIndex((user) => user.username === username);
    if (index < 0) return jsonResponse({ ok: true });
    const target = users[index];
    if (actor.username === username) {
      throw new ApiError(400, "SELF_DELETE_FORBIDDEN", "You cannot delete your own account.");
    }
    if (target.role === "admin" && target.active !== false &&
        users.filter((user) => user.role === "admin" && user.active !== false).length <= 1) {
      throw new ApiError(409, "LAST_POS_ADMIN_FORBIDDEN", "The last active POS admin cannot be deleted.");
    }
    users.splice(index, 1);
    await setFirestoreDocument(usersPath(storeId), { users });
    return jsonResponse({ ok: true });
  });
}
