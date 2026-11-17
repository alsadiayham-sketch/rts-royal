import { getFirestoreDocument, queryFirestoreDocuments } from "../_lib/firestore.js";
import { ApiError, jsonResponse, withApiGuard } from "../_lib/http.js";
import { normalizeStoreId } from "../_lib/pos-store-validation.js";
import { dispatchSupplyAlert } from "../_lib/pos-mobile-push.js";

async function matchesSecret(actual, expected) {
  const encoder = new TextEncoder();
  const [left, right] = await Promise.all([
    crypto.subtle.digest("SHA-256", encoder.encode(actual)),
    crypto.subtle.digest("SHA-256", encoder.encode(expected)),
  ]);
  let difference = 0;
  for (let i = 0; i < 32; i++) difference |= new Uint8Array(left)[i] ^ new Uint8Array(right)[i];
  return difference === 0;
}

export async function onRequestPost(context) {
  return withApiGuard(context, async ({ request, env }) => {
    if (typeof env.FCM_DISPATCH_SECRET !== "string" || env.FCM_DISPATCH_SECRET.length < 32) {
      throw new ApiError(503, "DISPATCH_UNAVAILABLE", "Notification dispatcher is not configured.");
    }
    const bearer = (request.headers.get("Authorization") || "").match(/^Bearer ([^\s]+)$/);
    if (!bearer || !(await matchesSecret(bearer[1], env.FCM_DISPATCH_SECRET))) {
      throw new ApiError(401, "DISPATCH_UNAUTHORIZED", "Unauthorized.");
    }
    const registry = await getFirestoreDocument("projects/_global/settings/pos_stores");
    const stores = [...new Set((Array.isArray(registry?.stores) ? registry.stores : [])
      .map((store) => normalizeStoreId(store?.id)).filter(Boolean))];
    let attempted = 0;
    let failed = 0;
    for (const storeId of stores) {
      if (attempted >= 100) break;
      for (const status of ["pending", "processing"]) {
        const page = await queryFirestoreDocuments({
          parentPath: `projects/${storeId}`,
          collectionId: "pos_supply_alerts",
          fieldFilters: [{ field: "status", op: "EQUAL", value: status }],
          limit: Math.min(20, 100 - attempted),
        });
        const alerts = page.documents.filter((doc) =>
          /^[A-Za-z0-9_-]{1,100}$/.test(doc.id)
          && (status === "pending" || !(Date.parse(doc.data.leaseUntil) > Date.now())));
        const results = await Promise.all(alerts.map((doc) => dispatchSupplyAlert(context, storeId, doc.id)));
        failed += results.filter((result) => result === "failed").length;
        attempted += alerts.length;
        if (attempted >= 100) break;
      }
    }
    return jsonResponse({ ok: failed === 0, attempted, failed }, failed ? 503 : 200);
  });
}
