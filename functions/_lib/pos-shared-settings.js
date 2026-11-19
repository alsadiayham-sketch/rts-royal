import { getFirestoreDocumentSnapshot } from "./firestore.js";
import { ApiError } from "./http.js";
import { getPrivateSnapshot } from "./pos-private-snapshots.js";

export function validateSharedConfig(config) {
  const allowed = ["features", "taxPercent", "taxIncluded", "restaurantMenuSections"];
  if (!config || typeof config !== "object" || Array.isArray(config)
      || Object.keys(config).some(key => !allowed.includes(key))
      || !config.features || typeof config.features !== "object" || Array.isArray(config.features)
      || typeof config.features.tax !== "boolean"
      || Object.values(config.features).some(value => typeof value !== "boolean")
      || typeof config.taxPercent !== "number" || !Number.isFinite(config.taxPercent)
      || config.taxPercent < 0 || config.taxPercent > 100 || typeof config.taxIncluded !== "boolean"
      || (config.restaurantMenuSections !== undefined && !Array.isArray(config.restaurantMenuSections))) {
    throw new ApiError(400, "INVALID_SHARED_CONFIG", "Provide explicit valid tax settings and restaurant sections.");
  }
  function inspect(value, depth = 0) {
    if (depth > 12) throw new ApiError(400, "INVALID_SHARED_CONFIG", "Configuration nesting is too deep.");
    if (!value || typeof value !== "object") return;
    for (const [key, nested] of Object.entries(value)) {
      if (["__proto__", "prototype", "constructor"].includes(key)) {
        throw new ApiError(400, "INVALID_SHARED_CONFIG", "Invalid configuration property.");
      }
      inspect(nested, depth + 1);
    }
  }
  inspect(config);
  if (new TextEncoder().encode(JSON.stringify(config)).length > 512 * 1024) {
    throw new ApiError(413, "PAYLOAD_TOO_LARGE", "Restaurant configuration is too large.");
  }
  return structuredClone(config);
}

export async function loadSharedRestaurantConfig(context, storeId) {
  const path = `projects/${storeId}/settings/shared_config`;
  const snapshot = await getFirestoreDocumentSnapshot(path);
  if (!snapshot) return { path, snapshot: null, configured: false, revision: 0, config: null };
  if (!snapshot.updateTime || !Number.isInteger(snapshot.data.revision) || snapshot.data.revision < 1
      || typeof snapshot.data.privateRef !== "string") {
    throw new ApiError(503, "CONFIG_UNAVAILABLE", "Shared configuration requires an administrator cutover.");
  }
  const saved = await getPrivateSnapshot(context.env, storeId, snapshot.data.privateRef);
  let config;
  try {
    config = validateSharedConfig(saved.config);
  } catch (error) {
    if (!(error instanceof ApiError)) throw error;
    throw new ApiError(503, "CONFIG_UNAVAILABLE", "The shared configuration snapshot is invalid.");
  }
  if (saved.revision !== snapshot.data.revision
      || config.features.tax !== snapshot.data.features?.tax
      || config.taxPercent !== snapshot.data.taxPercent || config.taxIncluded !== snapshot.data.taxIncluded) {
    throw new ApiError(503, "CONFIG_UNAVAILABLE", "Shared configuration does not match its protected snapshot.");
  }
  return { path, snapshot, configured: true, revision: saved.revision, config };
}
