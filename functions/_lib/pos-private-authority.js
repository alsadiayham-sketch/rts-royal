import { ApiError } from "./http.js";
import { readPosAtomicRecords } from "./pos-atomic-store.js";
import { normalizeStoreId } from "./pos-store-validation.js";
import { normalizeUsername } from "./validation.js";

function object(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

// The caller verifies the signed session; mutations must commit these private guards.
export async function requirePrivateRestaurantAuthority(env, session, { admin = false } = {}) {
  if (env?.POS_PRIVATE_RESTAURANT_STATE !== "enabled") {
    throw new ApiError(503, "PRIVATE_RESTAURANT_DISABLED", "Private restaurant operations have not been activated.");
  }
  if (!session || normalizeStoreId(session.storeId) !== session.storeId
      || !session.storeId || normalizeUsername(session.username) !== session.username || !session.username
      || session.productType !== "business" || !["admin", "worker"].includes(session.role)
      || typeof session.authVersion !== "string" || !/^[a-f0-9]{64}$/.test(session.authVersion)) {
    throw new ApiError(401, "POS_AUTH_REQUIRED", "Sign in again before accessing this restaurant.");
  }
  const [storeRecord, userRecord] = await readPosAtomicRecords(env, session.storeId, [
    { collection: "authority", id: "store" },
    { collection: "authority", id: `user:${session.username}` },
  ]);
  const authority = storeRecord?.value, user = userRecord?.value;
  if (!storeRecord || storeRecord.deleted || !object(authority) || authority.schemaVersion !== 1
      || authority.storeId !== session.storeId || authority.businessType !== "restaurant"
      || typeof authority.migrationId !== "string" || !authority.migrationId.trim()) {
    throw new ApiError(503, "PRIVATE_RESTAURANT_NOT_READY", "This restaurant has not completed its private data cutover.");
  }
  if (authority.state !== "active") {
    throw new ApiError(503, "PRIVATE_AUTHORITY_BLOCKED", "Restaurant access is blocked until its pending administrative change is completed.");
  }
  if (typeof authority.licenceEndsAt !== "string" || !Number.isFinite(Date.parse(authority.licenceEndsAt))) {
    throw new ApiError(503, "PRIVATE_RESTAURANT_NOT_READY", "Private restaurant licence state is unavailable.");
  }
  if (Date.parse(authority.licenceEndsAt) <= Date.now()) {
    throw new ApiError(403, "LICENCE_EXPIRED", "This restaurant licence is inactive.");
  }
  if (!userRecord || userRecord.deleted || !object(user) || user.schemaVersion !== 1
      || user.state !== "active" || user.username !== session.username
      || user.role !== session.role || user.authVersion !== session.authVersion) {
    throw new ApiError(401, "POS_AUTH_REQUIRED", "Your restaurant account changed. Sign in again.");
  }
  if (admin && user.role !== "admin") {
    throw new ApiError(403, "POS_ADMIN_REQUIRED", "Only a restaurant administrator can perform this operation.");
  }
  return {
    storeId: session.storeId, username: session.username, role: user.role, authority, user,
    guards: [storeRecord, userRecord].map(record => ({
      collection: record.collection, id: record.id, expectedRevision: record.revision,
    })),
  };
}
