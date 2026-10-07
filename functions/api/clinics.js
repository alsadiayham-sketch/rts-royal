import { requireAuthenticatedUser } from "../_lib/auth.js";
import {
  firestoreTimestamp,
  getFirestoreDocument,
  setFirestoreDocument,
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
import { enforceRateLimit } from "../_lib/rate-limit.js";
import {
  normalizeStoreId,
  normalizeStoreName,
  normalizeWarrantyMonths,
} from "../_lib/pos-store-validation.js";
import { normalizeUsername, validateNewPassword } from "../_lib/validation.js";

const REGISTRY_PATH = "projects/_global/settings/pos_stores";

function licencePath(clinicId) {
  return `projects/${clinicId}/settings/pos`;
}

function usersPath(clinicId) {
  return `projects/${clinicId}/settings/pos_users`;
}

function isClinic(store) {
  return store?.type === "clinic" || store?.id === "rts-testing";
}

async function loadClinics() {
  const registry = await getFirestoreDocument(REGISTRY_PATH);
  const stores = (Array.isArray(registry?.stores) ? registry.stores : []).filter(isClinic);
  return Promise.all(
    stores.map(async (store) => {
      const licence = await getFirestoreDocument(licencePath(store.id));
      return {
        id: store.id,
        name: store.name || licence?.storeName || store.id,
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
}

function validateClinicUser(username, name, password) {
  return Boolean(
    normalizeUsername(username) &&
      normalizeStoreName(name) &&
      validateNewPassword(password)
  );
}

export async function onRequestGet(context) {
  return withApiGuard(context, async () => {
    await requireAuthenticatedUser(context, false);
    return jsonResponse({ clinics: await loadClinics() });
  });
}

export async function onRequestPost(context) {
  return withApiGuard(context, async ({ request }) => {
    requireTrustedMutationRequest(request);
    requireJsonContentType(request);
    await authorizeMutation(context, "clinics_create");
    const payload = await parseJsonBody(request, [
      "id",
      "name",
      "warrantyMonths",
      "adminUsername",
      "adminName",
      "adminPassword",
      "initialUsers",
      "employeeUsername",
      "employeeName",
      "employeePassword",
    ]);

    const id = normalizeStoreId(payload.id);
    const name = normalizeStoreName(payload.name);
    const warrantyMonths = normalizeWarrantyMonths(payload.warrantyMonths);
    const adminUsername = normalizeUsername(payload.adminUsername);
    const adminName = normalizeStoreName(payload.adminName);
    const adminPassword = typeof payload.adminPassword === "string" ? payload.adminPassword : "";
    if (!id || !name || !warrantyMonths || !validateClinicUser(adminUsername, adminName, adminPassword)) {
      throw new ApiError(400, "INVALID_CLINIC", "Clinic details or initial users are invalid.");
    }

    const suppliedUsers = Array.isArray(payload.initialUsers)
      ? payload.initialUsers
      : payload.employeeUsername || payload.employeeName || payload.employeePassword
        ? [{
            username: payload.employeeUsername,
            name: payload.employeeName,
            password: payload.employeePassword,
            role: "worker",
          }]
        : [];
    if (suppliedUsers.length > 20) {
      throw new ApiError(400, "INVALID_CLINIC_USERS", "A clinic can start with at most 20 users.");
    }

    const users = [{
      username: adminUsername,
      password: adminPassword,
      name: adminName,
      displayName: adminName,
      role: "admin",
      active: true,
    }];
    const usernames = new Set([adminUsername]);
    for (const candidate of suppliedUsers) {
      const username = normalizeUsername(candidate?.username);
      const userName = normalizeStoreName(candidate?.name);
      const password = typeof candidate?.password === "string" ? candidate.password : "";
      const role = candidate?.role === "admin" || candidate?.role === "worker" ? candidate.role : "worker";
      if (!validateClinicUser(username, userName, password) || usernames.has(username)) {
        throw new ApiError(400, "INVALID_CLINIC_USERS", "Initial clinic users are invalid or duplicated.");
      }
      usernames.add(username);
      users.push({
        username,
        password,
        name: userName,
        displayName: userName,
        role,
        active: true,
      });
    }

    const registry = await getFirestoreDocument(REGISTRY_PATH);
    const stores = Array.isArray(registry?.stores) ? registry.stores : [];
    if (stores.some((store) => store.id === id)) {
      throw new ApiError(409, "CLINIC_EXISTS", "Clinic ID already exists.");
    }

    const warrantyEnd = new Date();
    warrantyEnd.setUTCMonth(warrantyEnd.getUTCMonth() + warrantyMonths);
    await setFirestoreDocument(licencePath(id), {
      warrantyEnd: firestoreTimestamp(warrantyEnd.toISOString()),
      createdAt: firestoreTimestamp(new Date().toISOString()),
      storeName: name,
      dataBackend: "firestore",
    });
    await setFirestoreDocument(usersPath(id), {
      users,
    });

    stores.push({
      id,
      name,
      type: "clinic",
      createdAt: Date.now(),
    });
    await setFirestoreDocument(REGISTRY_PATH, { stores });
    return jsonResponse({ ok: true, clinic: { id, name, warrantyEnd: warrantyEnd.toISOString() } }, 201);
  });
}

export async function onRequestPatch(context) {
  return withApiGuard(context, async ({ request }) => {
    requireTrustedMutationRequest(request);
    requireJsonContentType(request);
    await authorizeMutation(context, "clinics_licence");
    const payload = await parseJsonBody(request, ["id", "action", "warrantyMonths"]);
    const id = normalizeStoreId(payload.id);
    if (!id || (payload.action !== "extend" && payload.action !== "disable")) {
      throw new ApiError(400, "INVALID_CLINIC_ACTION", "Clinic action is invalid.");
    }

    const registry = await getFirestoreDocument(REGISTRY_PATH);
    const stores = Array.isArray(registry?.stores) ? registry.stores : [];
    if (!stores.some((store) => store.id === id && isClinic(store))) {
      throw new ApiError(404, "CLINIC_NOT_FOUND", "Clinic not found.");
    }

    const current = await getFirestoreDocument(licencePath(id));
    if (!current) throw new ApiError(404, "CLINIC_NOT_FOUND", "Clinic not found.");
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
