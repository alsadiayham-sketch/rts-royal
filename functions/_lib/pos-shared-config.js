import { getFirestoreDocumentSnapshot, queryFirestoreDocuments } from "./firestore.js";
import { ApiError, jsonResponse, parseJsonBody, requireJsonContentType, requireTrustedMutationRequest, withApiGuard } from "./http.js";
import { requireMobileSession } from "./pos-mobile.js";
import { enforceRateLimit } from "./rate-limit.js";
import { authPreconditions, fingerprint, guardedCommit, replay, writeSnapshot } from "./pos-mobile-orders.js";
import { stagePrivateSnapshot } from "./pos-private-snapshots.js";
import { loadSharedRestaurantConfig, validateSharedConfig } from "./pos-shared-settings.js";

async function restaurant(context) {
  const { session, licence } = await requireMobileSession(context);
  if (licence.businessType !== "restaurant") throw new ApiError(403, "RESTAURANT_REQUIRED", "Shared settings require a restaurant.");
  return session;
}

function sourceConfig(data) {
  if (data?.recordType !== "store-config") throw new ApiError(409, "INVALID_CONFIG_SOURCE", "Select an existing restaurant configuration.");
  return validateSharedConfig({
    features: data.features, taxPercent: data.taxPercent, taxIncluded: data.taxIncluded,
    ...(data.restaurantMenuSections === undefined ? {} : { restaurantMenuSections: data.restaurantMenuSections }),
  });
}

function validSourceId(value) {
  return typeof value === "string" && /^[^/]{1,150}$/.test(value) && ![".", ".."].includes(value);
}

export async function onRequestGet(context) {
  return withApiGuard(context, async () => {
    const actor = await restaurant(context);
    const parameters = new URL(context.request.url).searchParams;
    const preview = parameters.get("preview") === "1";
    if (!preview) {
      const state = await loadSharedRestaurantConfig(context, actor.storeId);
      return jsonResponse({ configured: state.configured, revision: state.revision, config: state.config });
    }
    if (actor.role !== "admin") throw new ApiError(403, "ADMIN_REQUIRED", "Only administrators can select a legacy configuration.");
    const sourceId = parameters.get("sourceId");
    if (sourceId !== null) {
      if (!validSourceId(sourceId)) throw new ApiError(400, "INVALID_CONFIG_SOURCE", "Select a valid configuration source.");
      const source = await getFirestoreDocumentSnapshot(`projects/${actor.storeId}/orders/${sourceId}`);
      if (!source?.updateTime) throw new ApiError(404, "CONFIG_SOURCE_NOT_FOUND", "Configuration source not found.");
      return jsonResponse({ sourceId, sourceRevision: source.updateTime, config: sourceConfig(source.data), candidates: [] });
    }
    const result = await queryFirestoreDocuments({
      parentPath: `projects/${actor.storeId}`, collectionId: "orders",
      fieldFilters: [{ field: "recordType", op: "EQUAL", value: "store-config" }], limit: 20,
    });
    if (result.documents.length >= 20) throw new ApiError(409, "CONFIG_PREVIEW_LIMIT", "Preview a specific sourceId before cutover; no configuration was selected.");
    const candidates = result.documents.map(doc => ({
      sourceId: doc.id, sourceRevision: doc.updateTime,
      createdAtIso: doc.data.createdAtIso || doc.data.createdAt || "",
    })).sort((a, b) => {
      const left = Date.parse(a.createdAtIso), right = Date.parse(b.createdAtIso);
      if (!Number.isFinite(left) || !Number.isFinite(right)) {
        throw new ApiError(409, "INVALID_CONFIG_SOURCE", "Legacy configuration dates need administrator review.");
      }
      return right - left || a.sourceId.localeCompare(b.sourceId);
    });
    const selected = candidates[0];
    if (selected && !selected.sourceRevision) throw new ApiError(503, "CONFIG_UNAVAILABLE", "Cannot verify the source configuration.");
    return jsonResponse({
      sourceId: selected?.sourceId || null, sourceRevision: selected?.sourceRevision || null,
      config: selected ? sourceConfig(result.documents.find(doc => doc.id === selected.sourceId).data) : null, candidates,
    });
  });
}

export async function onRequestPost(context) {
  return withApiGuard(context, async ({ request }) => {
    requireTrustedMutationRequest(request);
    requireJsonContentType(request);
    const actor = await restaurant(context);
    if (actor.role !== "admin") throw new ApiError(403, "ADMIN_REQUIRED", "Only administrators can change restaurant settings.");
    if (context.env.POS_SHARED_CHECKOUT_STATE !== "writers-retired") {
      throw new ApiError(503, "CHECKOUT_UNAVAILABLE", "Upgrade every restaurant terminal before administrator cutover.");
    }
    const payload = await parseJsonBody(request, ["action", "requestId", "revision", "sourceId", "sourceRevision", "config"], 550 * 1024);
    if (!/^[A-Za-z0-9_-]{8,80}$/.test(payload.requestId || "")
        || !["cutover", "initialize", "update"].includes(payload.action)) {
      throw new ApiError(400, "INVALID_ACTION", "Invalid configuration action or request identifier.");
    }
    const fields = {
      cutover: ["sourceId", "sourceRevision"],
      initialize: ["config"], update: ["revision", "config"],
    }[payload.action];
    if (Object.keys(payload).some(key => !["action", "requestId", ...fields].includes(key))) {
      throw new ApiError(400, "INVALID_ACTION", "Unexpected configuration field.");
    }
    if (payload.action === "update" && (!Number.isInteger(payload.revision) || payload.revision < 1)) {
      throw new ApiError(400, "INVALID_REVISION", "Provide a valid shared configuration revision.");
    }
    await enforceRateLimit(context, {
      scope: "pos_shared_config", accountPart: `${actor.storeId}:${actor.username}`, maxRequests: 60, windowSeconds: 600,
    });
    const guards = await authPreconditions(context, actor);
    const hash = await fingerprint({ payload, authVersion: actor.authVersion });
    const completed = await replay(context, actor.storeId, payload.requestId, actor.username, hash);
    if (completed) return jsonResponse(completed);
    const state = await loadSharedRestaurantConfig(context, actor.storeId);
    if ((payload.action === "update" && (!state.configured || payload.revision !== state.revision))
        || (payload.action !== "update" && state.configured)) {
      throw new ApiError(409, "CONFIG_CONFLICT", "Shared configuration changed. Refresh before retrying.");
    }
    let config, sourceGuard;
    if (payload.action === "cutover") {
      if (!validSourceId(payload.sourceId) || typeof payload.sourceRevision !== "string") {
        throw new ApiError(400, "INVALID_CONFIG_SOURCE", "Select a valid configuration source.");
      }
      const path = `projects/${actor.storeId}/orders/${payload.sourceId}`;
      const source = await getFirestoreDocumentSnapshot(path);
      if (!source?.updateTime || source.updateTime !== payload.sourceRevision) {
        throw new ApiError(409, "CONFIG_SOURCE_CHANGED", "The selected source changed. Preview it again.");
      }
      config = sourceConfig(source.data);
      sourceGuard = { path, verify: true, updateTime: source.updateTime };
    } else config = validateSharedConfig(payload.config);
    const response = { ok: true, replayed: false, configured: true, revision: state.revision + 1, config };
    const staged = await stagePrivateSnapshot(context.env, actor.storeId, payload.requestId, actor.username, hash, response);
    if (staged.response.revision !== state.revision + 1) {
      throw new ApiError(409, "CONFIG_CONFLICT", "The request was prepared against an older configuration.");
    }
    const saved = validateSharedConfig(staged.response.config);
    const writes = [
      writeSnapshot(state.path, state.snapshot, {
        revision: staged.response.revision, privateRef: staged.ref,
        features: { tax: saved.features.tax }, taxPercent: saved.taxPercent, taxIncluded: saved.taxIncluded,
      }),
      ...guards, ...(sourceGuard ? [sourceGuard] : []),
      { path: `projects/${actor.storeId}/pos_mobile_requests/${staged.ref}`, data: { privateRef: staged.ref }, create: true },
    ];
    const result = await guardedCommit(context, actor.storeId, payload.requestId, actor.username, hash, writes);
    return jsonResponse(result || staged.response);
  });
}
