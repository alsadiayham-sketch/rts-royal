import { getFirestoreDocument, getFirestoreDocumentSnapshot, patchFirestoreDocumentAtUpdateTime } from "./firestore.js";
import { normalizeUsername } from "./validation.js";
import { getPosUserAuthVersion } from "./pos-session.js";
import { getPosStoreMode } from "./pos-store-mode.js";

let cachedAccessToken = "";
let cachedUntil = 0;
const encoder = new TextEncoder();

function base64url(bytes) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

async function accessToken(serviceAccount) {
  if (cachedAccessToken && Date.now() < cachedUntil) return cachedAccessToken;
  const account = JSON.parse(serviceAccount);
  if (account.project_id !== "rts-business-mobile" || !account.client_email || !account.private_key) {
    throw new Error("FCM service account is not configured for RTS Business.");
  }
  const now = Math.floor(Date.now() / 1000);
  const header = base64url(encoder.encode(JSON.stringify({ alg: "RS256", typ: "JWT" })));
  const claims = base64url(encoder.encode(JSON.stringify({
    iss: account.client_email, scope: "https://www.googleapis.com/auth/firebase.messaging",
    aud: "https://oauth2.googleapis.com/token", iat: now, exp: now + 3600,
  })));
  const keyBytes = Uint8Array.from(atob(account.private_key.replace(/-----[^-]+-----|\s/g, "")), (c) => c.charCodeAt(0));
  const key = await crypto.subtle.importKey("pkcs8", keyBytes, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"]);
  const content = `${header}.${claims}`;
  const signature = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, encoder.encode(content));
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: `${content}.${base64url(new Uint8Array(signature))}` }),
  });
  if (!response.ok) throw new Error("FCM authorization failed.");
  const result = await response.json();
  if (!result.access_token) throw new Error("FCM authorization failed.");
  cachedAccessToken = result.access_token;
  cachedUntil = Date.now() + Math.max(0, Math.min(Number(result.expires_in) || 0, 3600) - 60) * 1000;
  return cachedAccessToken;
}

async function sendToDevice(token, access) {
  const response = await fetch("https://fcm.googleapis.com/v1/projects/rts-business-mobile/messages:send", {
    method: "POST",
    headers: { Authorization: `Bearer ${access}`, "Content-Type": "application/json" },
    body: JSON.stringify({ message: { token, data: { type: "low-stock" }, android: { priority: "HIGH" } } }),
  });
  if (response.ok) return "sent";
  const body = await response.json().catch(() => ({}));
  const code = body.error?.details?.find((detail) => detail.errorCode)?.errorCode;
  if (code === "UNREGISTERED") return "unregistered";
  throw new Error("FCM delivery failed.");
}

export async function dispatchSupplyAlert(context, storeId, alertId) {
  const path = `projects/${storeId}/pos_supply_alerts/${alertId}`;
  let claimed;
  try {
    const snapshot = await getFirestoreDocumentSnapshot(path);
    if (!snapshot) return "missing";
    if (snapshot.data.status === "sent") return "sent";
    if (snapshot.data.status === "processing" && Date.parse(snapshot.data.leaseUntil) > Date.now()) return "deferred";
    const leaseUntil = new Date(Date.now() + 120000).toISOString();
    await patchFirestoreDocumentAtUpdateTime(path, {
      status: "processing", leaseUntil, attempts: (Number(snapshot.data.attempts) || 0) + 1,
    }, snapshot.updateTime);
    claimed = await getFirestoreDocumentSnapshot(path);
    if (!claimed || claimed.data.leaseUntil !== leaseUntil) return "deferred";
    const [registry, licence, users, devices] = await Promise.all([
      getFirestoreDocument("projects/_global/settings/pos_stores"),
      getFirestoreDocument(`projects/${storeId}/settings/pos`),
      getFirestoreDocument(`projects/${storeId}/settings/pos_users`),
      context.env.DB.prepare("SELECT id, username, token, auth_version FROM mobile_devices WHERE store_id = ? AND expires_at > ?")
        .bind(storeId, new Date().toISOString()).all(),
    ]);
    const store = registry?.stores?.find((item) => item?.id === storeId);
    if (!store || getPosStoreMode(store) !== "business"
        || !(new Date(licence?.warrantyEnd).getTime() > Date.now()) || licence?.businessType !== "restaurant") {
      await patchFirestoreDocumentAtUpdateTime(path, { status: "sent", leaseUntil: "" }, claimed.updateTime);
      return "sent";
    }
    const active = new Map();
    for (const user of (Array.isArray(users?.users) ? users.users : [])) {
      const username = normalizeUsername(user.username);
      if (user.active !== false && username && !active.has(username)) {
        active.set(username, await getPosUserAuthVersion(context.env.AUTH_SECRET, user));
      } else if (active.has(username)) active.set(username, null);
    }
    const eligible = (devices.results || []).filter((device) =>
      typeof device.auth_version === "string" && active.has(device.username)
      && active.get(device.username) === device.auth_version);
    if (eligible.length) {
      const access = await accessToken(context.env.FCM_SERVICE_ACCOUNT);
      for (const device of eligible) {
        const status = await sendToDevice(device.token, access);
        if (status === "unregistered") {
          await context.env.DB.prepare("DELETE FROM mobile_devices WHERE id = ? AND token = ?")
            .bind(device.id, device.token).run();
        }
      }
    }
    await patchFirestoreDocumentAtUpdateTime(path, { status: "sent", leaseUntil: "" }, claimed.updateTime);
    return "sent";
  } catch {
    if (claimed?.updateTime) {
      try { await patchFirestoreDocumentAtUpdateTime(path, { status: "pending", leaseUntil: "" }, claimed.updateTime); }
      catch { /* Lease expires and a later dispatcher can retry. */ }
    }
    return "failed";
  }
}
