import { getFirestoreDocument } from "../_lib/firestore.js";
import { requireOwnerSession } from "../_lib/owner-session.js";
import { getPosStoreMode } from "../_lib/pos-store-mode.js";
import { ApiError, jsonResponse, withApiGuard } from "../_lib/http.js";
import { buildOwnerDashboard } from "../_lib/owner-dashboard.js";

const REGISTRY_PATH = "projects/_global/settings/pos_stores";

function licencePath(organizationId) {
  return `projects/${organizationId}/settings/pos`;
}

function usersPath(organizationId) {
  return `projects/${organizationId}/settings/pos_users`;
}

function isValidMode(value) {
  return value === "business" || value === "clinic";
}

export async function onRequestGet(context) {
  return withApiGuard(context, async ({ request, env }) => {
    const owner = await requireOwnerSession(request, env.AUTH_SECRET);
    const mode = new URL(request.url).searchParams.get("mode");
    if (!isValidMode(mode) || mode !== owner.mode) {
      throw new ApiError(403, "OWNER_MODE_FORBIDDEN", "Owner session is not authorized for this product.");
    }

    const registry = await getFirestoreDocument(REGISTRY_PATH);
    const store = (Array.isArray(registry?.stores) ? registry.stores : []).find(
      (candidate) =>
        candidate?.id === owner.organizationId &&
        (!candidate.ownerUsername || candidate.ownerUsername === owner.ownerUsername) &&
        getPosStoreMode(candidate) === mode
    );
    if (!store) throw new ApiError(403, "OWNER_MODE_FORBIDDEN", "Owner session is no longer authorized.");

    const [licence, usersDocument] = await Promise.all([
      getFirestoreDocument(licencePath(store.id)),
      getFirestoreDocument(usersPath(store.id)),
    ]);
    const ownerUser = (Array.isArray(usersDocument?.users) ? usersDocument.users : []).find(
      (candidate) => candidate?.username === owner.ownerUsername
    );
    if (!ownerUser || ownerUser.active === false) {
      throw new ApiError(403, "OWNER_MODE_FORBIDDEN", "Owner session is no longer authorized.");
    }
    if (!store.ownerUsername && ownerUser.role !== "admin" && ownerUser.isOwner !== true) {
      throw new ApiError(403, "OWNER_MODE_FORBIDDEN", "Owner session is no longer authorized.");
    }
    const passwordVersion = Number.isInteger(Number(ownerUser.passwordVersion))
      ? Math.max(1, Number(ownerUser.passwordVersion))
      : 1;
    if (passwordVersion !== owner.passwordVersion) {
      throw new ApiError(401, "OWNER_SESSION_REVOKED", "Owner credentials changed. Sign in again.");
    }
    return jsonResponse(await buildOwnerDashboard({
      db: env.DB,
      store,
      licence,
      usersDocument,
      mode,
    }));
  });
}
