import { requirePlatformAdmin } from "../_lib/auth.js";
import {
  commitFirestoreWrites,
  firestoreTimestamp,
  getFirestoreDocument,
  getFirestoreDocumentSnapshot,
  patchFirestoreDocument,
} from "../_lib/firestore.js";
import {
  ApiError,
  jsonResponse,
  parseJsonBody,
  requireJsonContentType,
  requireTrustedMutationRequest,
  withApiGuard,
} from "../_lib/http.js";
import {
  normalizeApiBaseUrl,
  normalizeBackend,
  normalizeStoreId,
  normalizeStoreName,
  normalizeWarrantyMonths,
} from "../_lib/pos-store-validation.js";
import { enforceRateLimit } from "../_lib/rate-limit.js";
import { normalizeUsername, validateNewPassword } from "../_lib/validation.js";
import { createStoredPosPassword } from "../_lib/pos-password.js";
import { createCreditAccount, deleteNewCreditAccount } from "../_lib/credit-provisioning.js";

const REGISTRY_PATH = "projects/_global/settings/pos_stores";

function licencePath(storeId) {
  return `projects/${storeId}/settings/pos`;
}

function usersPath(storeId) {
  return `projects/${storeId}/settings/pos_users`;
}

async function loadStores() {
  const registry = await getFirestoreDocument(REGISTRY_PATH);
  const stores = (Array.isArray(registry?.stores) ? registry.stores : []).filter(
    (store) => store.type !== "clinic"
  );
  return Promise.all(
    stores.map(async (store) => {
      const licence = await getFirestoreDocument(licencePath(store.id));
      return {
        id: store.id,
        name: store.name || store.id,
        backend: store.type || licence?.dataBackend || "firestore",
        linkedProject: store.linkedProject || licence?.linkedProject || "",
        apiBaseUrl: store.apiBaseUrl || licence?.apiBaseUrl || "",
        warrantyEnd: licence?.warrantyEnd || null,
        messagingEnabled: licence?.messaging?.enabled === true,
        createdAt: store.createdAt || null,
      };
    })
  );
}

async function authorizeMutation(context, scope) {
  const user = await requirePlatformAdmin(context, false);
  await enforceRateLimit(context, {
    scope,
    accountPart: user.username,
    maxRequests: 20,
    windowSeconds: 600,
  });
  return user;
}

export async function onRequestGet(context) {
  return withApiGuard(context, async () => {
    await requirePlatformAdmin(context, false);
    return jsonResponse({ stores: await loadStores() });
  });
}

export async function onRequestPost(context) {
  return withApiGuard(context, async ({ request, env }) => {
    requireTrustedMutationRequest(request);
    requireJsonContentType(request);
    await authorizeMutation(context, "pos_stores_create");
    const payload = await parseJsonBody(request, [
      "id",
      "name",
      "backend",
      "warrantyMonths",
      "linkedProject",
      "apiBaseUrl",
      "adminUsername",
      "adminName",
      "adminPassword",
      "messagingEnabled",
    ]);

    const id = normalizeStoreId(payload.id);
    const name = normalizeStoreName(payload.name);
    const backend = normalizeBackend(payload.backend);
    const warrantyMonths = normalizeWarrantyMonths(payload.warrantyMonths);
    if (!id) throw new ApiError(400, "INVALID_STORE_ID", "Store ID is invalid.");
    if (!name) throw new ApiError(400, "INVALID_STORE_NAME", "Store name is invalid.");
    if (!backend) throw new ApiError(400, "INVALID_STORE_BACKEND", "Store backend is invalid.");
    if (!warrantyMonths) throw new ApiError(400, "INVALID_WARRANTY", "Warranty period is invalid.");

    let apiBaseUrl = "";
    let linkedProject = "";
    if (backend === "d1") {
      apiBaseUrl = normalizeApiBaseUrl(payload.apiBaseUrl);
      linkedProject = normalizeStoreId(payload.linkedProject);
      if (!apiBaseUrl || !linkedProject) {
        throw new ApiError(400, "INVALID_D1_LINK", "D1 project link is invalid.");
      }
    }

    const adminUsername = normalizeUsername(payload.adminUsername);
    const adminName = normalizeStoreName(payload.adminName);
    const adminPassword = typeof payload.adminPassword === "string" ? payload.adminPassword : "";
    if (!adminUsername || !adminName || !validateNewPassword(adminPassword)) {
      throw new ApiError(400, "INVALID_STORE_ADMIN", "Initial store owner is invalid.");
    }
    const users = [{
      username: adminUsername,
      ...(await createStoredPosPassword(adminPassword)),
      name: adminName,
      displayName: adminName,
      role: "admin",
      isOwner: true,
      passwordVersion: 1,
      active: true,
    }];

    const warrantyEnd = new Date();
    warrantyEnd.setUTCMonth(warrantyEnd.getUTCMonth() + warrantyMonths);
    const licence = {
      warrantyEnd: firestoreTimestamp(warrantyEnd.toISOString()),
      createdAt: firestoreTimestamp(new Date().toISOString()),
      storeName: name,
      dataBackend: backend,
      ...(backend === "firestore" ? {
        authBackend: "rts",
        authContractVersion: 1,
        authApiBaseUrl: "https://rts-royal.pages.dev",
      } : {}),
      productType: "business",
      ownerUsername: adminUsername,
      ownerName: adminName,
      messaging: {
        enabled: backend === "d1" && payload.messagingEnabled !== false,
        contractVersion: 1,
      },
      ...(backend === "d1" ? { apiBaseUrl, linkedProject } : {}),
    };
    const registry = await getFirestoreDocumentSnapshot(REGISTRY_PATH);
    const registryStores = Array.isArray(registry?.data?.stores) ? registry.data.stores : [];
    if (registryStores.some((store) => store?.id === id)) {
      throw new ApiError(409, "STORE_EXISTS", "Store ID already exists.");
    }
    const registryStore = {
      id,
      name,
      type: backend,
      productType: "business",
      linkedProject,
      apiBaseUrl,
      ownerUsername: adminUsername,
      ownerName: adminName,
      createdAt: Date.now(),
    };

    let creditAccountCreated = false;
    try {
      creditAccountCreated = await createCreditAccount(env.DB, "business", id, name);
      await commitFirestoreWrites([
        { path: licencePath(id), data: licence, create: true },
        { path: usersPath(id), data: { users }, create: true },
        {
          path: REGISTRY_PATH,
          data: { stores: [...registryStores, registryStore] },
          ...(registry?.updateTime ? { updateTime: registry.updateTime } : { create: true }),
        },
      ]);
    } catch (error) {
      if (creditAccountCreated) {
        try {
          await deleteNewCreditAccount(env.DB, "business", id);
        } catch {
          throw new ApiError(502, "PROVISIONING_ROLLBACK_FAILED", "Store provisioning could not be completed safely.");
        }
      }
      throw error;
    }

    return jsonResponse(
      {
        ok: true,
        store: {
          id,
          name,
          backend,
          linkedProject,
          apiBaseUrl,
          warrantyEnd: warrantyEnd.toISOString(),
          adminUsername,
          messagingEnabled: licence.messaging.enabled,
          productType: "business",
        },
      },
      201
    );
  });
}

export async function onRequestPatch(context) {
  return withApiGuard(context, async ({ request }) => {
    requireTrustedMutationRequest(request);
    requireJsonContentType(request);
    await authorizeMutation(context, "pos_stores_licence");
    const payload = await parseJsonBody(request, ["id", "action", "warrantyMonths"]);
    const id = normalizeStoreId(payload.id);
    if (!id) throw new ApiError(400, "INVALID_STORE_ID", "Store ID is invalid.");
    if (payload.action !== "extend" && payload.action !== "disable") {
      throw new ApiError(400, "INVALID_STORE_ACTION", "Store action is invalid.");
    }

    const registry = await getFirestoreDocument(REGISTRY_PATH);
    const stores = Array.isArray(registry?.stores) ? registry.stores : [];
    if (!stores.some((store) => store?.id === id && store.type !== "clinic")) {
      throw new ApiError(404, "STORE_NOT_FOUND", "Store not found.");
    }
    const current = await getFirestoreDocument(licencePath(id));
    if (!current) throw new ApiError(404, "STORE_NOT_FOUND", "Store not found.");
    const warrantyEnd = new Date();
    if (payload.action === "extend") {
      const months = normalizeWarrantyMonths(payload.warrantyMonths);
      if (!months) throw new ApiError(400, "INVALID_WARRANTY", "Warranty period is invalid.");
      warrantyEnd.setUTCMonth(warrantyEnd.getUTCMonth() + months);
    } else {
      warrantyEnd.setUTCDate(warrantyEnd.getUTCDate() - 1);
    }

    await patchFirestoreDocument(licencePath(id), {
      warrantyEnd: firestoreTimestamp(warrantyEnd.toISOString()),
    });
    return jsonResponse({ ok: true, id, warrantyEnd: warrantyEnd.toISOString() });
  });
}
