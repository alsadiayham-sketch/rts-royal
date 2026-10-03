import { requireAuthenticatedUser } from "../_lib/auth.js";
import {
  firestoreTimestamp,
  getFirestoreDocument,
  patchFirestoreDocument,
  setFirestoreDocument,
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

const REGISTRY_PATH = "projects/_global/settings/pos_stores";

function licencePath(storeId) {
  return `projects/${storeId}/settings/pos`;
}

function usersPath(storeId) {
  return `projects/${storeId}/settings/pos_users`;
}

async function loadStores() {
  const registry = await getFirestoreDocument(REGISTRY_PATH);
  const stores = Array.isArray(registry?.stores) ? registry.stores : [];
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
        createdAt: store.createdAt || null,
      };
    })
  );
}

async function authorizeMutation(context, scope) {
  const user = await requireAuthenticatedUser(context, false);
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
    await requireAuthenticatedUser(context, false);
    return jsonResponse({ stores: await loadStores() });
  });
}

export async function onRequestPost(context) {
  return withApiGuard(context, async ({ request }) => {
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
    ]);

    const id = normalizeStoreId(payload.id);
    const name = normalizeStoreName(payload.name);
    const backend = normalizeBackend(payload.backend);
    const warrantyMonths = normalizeWarrantyMonths(payload.warrantyMonths);
    if (!id) throw new ApiError(400, "INVALID_STORE_ID", "Store ID is invalid.");
    if (!name) throw new ApiError(400, "INVALID_STORE_NAME", "Store name is invalid.");
    if (!backend) throw new ApiError(400, "INVALID_STORE_BACKEND", "Store backend is invalid.");
    if (!warrantyMonths) throw new ApiError(400, "INVALID_WARRANTY", "Warranty period is invalid.");

    const stores = await loadStores();
    if (stores.some((store) => store.id === id)) {
      throw new ApiError(409, "STORE_EXISTS", "Store ID already exists.");
    }

    let apiBaseUrl = "";
    let linkedProject = "";
    if (backend === "d1") {
      apiBaseUrl = normalizeApiBaseUrl(payload.apiBaseUrl);
      linkedProject = normalizeStoreId(payload.linkedProject);
      if (!apiBaseUrl || !linkedProject) {
        throw new ApiError(400, "INVALID_D1_LINK", "D1 project link is invalid.");
      }
    }

    let adminUsername = "";
    if (backend === "firestore") {
      adminUsername = normalizeUsername(payload.adminUsername);
      const adminName = normalizeStoreName(payload.adminName);
      const adminPassword = typeof payload.adminPassword === "string" ? payload.adminPassword : "";
      if (!adminUsername || !adminName || !validateNewPassword(adminPassword)) {
        throw new ApiError(400, "INVALID_STORE_ADMIN", "Initial store administrator is invalid.");
      }
      await setFirestoreDocument(usersPath(id), {
        users: [
          {
            username: adminUsername,
            password: adminPassword,
            name: adminName,
            displayName: adminName,
            role: "admin",
            active: true,
          },
        ],
      });
    }

    const warrantyEnd = new Date();
    warrantyEnd.setUTCMonth(warrantyEnd.getUTCMonth() + warrantyMonths);
    await setFirestoreDocument(licencePath(id), {
      warrantyEnd: firestoreTimestamp(warrantyEnd.toISOString()),
      createdAt: firestoreTimestamp(new Date().toISOString()),
      storeName: name,
      dataBackend: backend,
      ...(backend === "d1" ? { apiBaseUrl, linkedProject } : {}),
    });

    const registry = await getFirestoreDocument(REGISTRY_PATH);
    const registryStores = Array.isArray(registry?.stores) ? registry.stores : [];
    registryStores.push({
      id,
      name,
      type: backend,
      linkedProject,
      apiBaseUrl,
      createdAt: Date.now(),
    });
    await setFirestoreDocument(REGISTRY_PATH, { stores: registryStores });

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
