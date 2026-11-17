import { ApiError, jsonResponse, parseJsonBody, requireJsonContentType, requireTrustedMutationRequest, withApiGuard } from "../_lib/http.js";
import { requireMobileSession } from "../_lib/pos-mobile.js";
import { enforceRateLimit } from "../_lib/rate-limit.js";

async function tokenId(token) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function onRequestPost(context) {
  return withApiGuard(context, async ({ request, env }) => {
    requireTrustedMutationRequest(request);
    requireJsonContentType(request);
    const { session, licence } = await requireMobileSession(context);
    if (licence.businessType !== "restaurant") throw new ApiError(403, "NOTIFICATION_UNAVAILABLE", "Notifications require a restaurant account.");
    await enforceRateLimit(context, {
      scope: "pos_mobile_device",
      accountPart: `${session.storeId}:${session.username}`,
      maxRequests: 60,
      windowSeconds: 600,
    });
    const payload = await parseJsonBody(request, ["action", "token"]);
    if (!["register", "unregister"].includes(payload.action)
        || typeof payload.token !== "string" || payload.token.length < 20 || payload.token.length > 4096
        || !/^[A-Za-z0-9_:\-]+$/.test(payload.token)) {
      throw new ApiError(400, "INVALID_DEVICE", "Invalid notification registration.");
    }
    const id = await tokenId(payload.token);
    if (payload.action === "register") {
      const now = new Date().toISOString();
      const expiry = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
      await env.DB.prepare(`INSERT INTO mobile_devices
        (id, store_id, username, token, created_at, updated_at, expires_at, auth_version) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET store_id=excluded.store_id, username=excluded.username,
          token=excluded.token, updated_at=excluded.updated_at, expires_at=excluded.expires_at,
          auth_version=excluded.auth_version`)
        .bind(id, session.storeId, session.username, payload.token, now, now, expiry, session.authVersion).run();
    } else {
      await env.DB.prepare("DELETE FROM mobile_devices WHERE id = ? AND store_id = ? AND username = ?")
        .bind(id, session.storeId, session.username).run();
    }
    return jsonResponse({ ok: true });
  });
}
