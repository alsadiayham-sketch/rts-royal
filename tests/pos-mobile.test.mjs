import test from "node:test";
import assert from "node:assert/strict";
import { onRequestGet } from "../functions/api/pos-mobile.js";
import { onRequestPost } from "../functions/api/pos-mobile-devices.js";
import { onRequestPost as dispatchRequest } from "../functions/api/pos-mobile-dispatch.js";
import { dispatchSupplyAlert } from "../functions/_lib/pos-mobile-push.js";
import { createPosSessionToken, getPosUserAuthVersion } from "../functions/_lib/pos-session.js";

const SECRET = "test-only-pos-session-secret";
const root = "projects/restaurant-one";
const user = { username: "worker", role: "worker", active: true, passwordHash: "fixture", passwordSalt: "fixture" };

function encode(value) {
  if (Array.isArray(value)) return { arrayValue: { values: value.map(encode) } };
  if (value && typeof value === "object") return { mapValue: { fields: fields(value) } };
  if (typeof value === "boolean") return { booleanValue: value };
  if (typeof value === "number") return { doubleValue: value };
  return value == null ? { nullValue: null } : { stringValue: String(value) };
}
function fields(data) { return Object.fromEntries(Object.entries(data).map(([key, value]) => [key, encode(value)])); }
function decode(value) {
  if ("stringValue" in value) return value.stringValue;
  if ("doubleValue" in value) return value.doubleValue;
  if ("booleanValue" in value) return value.booleanValue;
  if ("nullValue" in value) return null;
  if (value.arrayValue) return (value.arrayValue.values || []).map(decode);
  if (value.mapValue) return decodeFields(value.mapValue.fields);
  return null;
}
function decodeFields(data) { return Object.fromEntries(Object.entries(data || {}).map(([key, value]) => [key, decode(value)])); }

async function setup() {
  const authVersion = await getPosUserAuthVersion(SECRET, user);
  const token = await createPosSessionToken(SECRET, {
    storeId: "restaurant-one", username: "worker", role: "worker", productType: "business",
    authVersion, exp: Math.floor(Date.now() / 1000) + 3600,
  });
  let version = 0;
  const docs = new Map();
  function put(path, data) { docs.set(path, { fields: fields(data), updateTime: `rev-${++version}` }); }
  put("projects/_global/settings/pos_stores", { stores: [{ id: "restaurant-one", type: "firestore" }] });
  put(`${root}/settings/pos`, { warrantyEnd: "2099-01-01", businessType: "restaurant", dataBackend: "firestore" });
  put(`${root}/settings/pos_users`, { users: [user] });
  put(`${root}/products/p1`, { name: "وجبة", category: "طعام", privateCost: 999, variants: [{ size: "كبير", color: "افتراضي", price: 10, stock: 5, cost: 8 }] });
  const devices = new Map();
  const db = { prepare(sql) {
    return { bind(...args) { return {
      async first() { return { count: 1 }; },
      async all() { return { results: [...devices.values()].filter((item) => item.store_id === args[0] && item.expires_at > args[1]) }; },
      async run() {
        if (sql.includes("INSERT INTO mobile_devices")) {
          const [id, store_id, username, deviceToken, created_at, updated_at, expires_at, auth_version] = args;
          devices.set(id, { id, store_id, username, token: deviceToken, created_at, updated_at, expires_at, auth_version });
        } else if (sql.includes("DELETE FROM mobile_devices")) devices.delete(args[0]);
        return { success: true };
      },
    }; } };
  } };
  const calls = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input, options = {}) => {
    const url = new URL(input);
    if (url.hostname === "oauth2.googleapis.com") return Response.json({ access_token: "mock-access", expires_in: 3600 });
    if (url.hostname === "fcm.googleapis.com") { calls.push(JSON.parse(options.body)); return Response.json({ name: "mock-message" }); }
    if (url.pathname.endsWith(":runQuery")) {
      const wanted = JSON.parse(options.body).structuredQuery.where.fieldFilter.value.stringValue;
      const rows = [...docs.entries()].filter(([path, value]) => path.startsWith(`${root}/pos_supply_alerts/`)
        && decodeFields(value.fields).status === wanted)
        .map(([path, value]) => ({ document: { name: `projects/test/databases/(default)/documents/${path}`, ...value } }));
      return Response.json(rows);
    }
    const path = decodeURIComponent(url.pathname.split("/documents/")[1] || "");
    if (options.method === "PATCH") {
      const current = docs.get(path);
      if (!current || current.updateTime !== url.searchParams.get("currentDocument.updateTime")) return new Response("", { status: 412 });
      put(path, { ...decodeFields(current.fields), ...decodeFields(JSON.parse(options.body).fields) });
      return Response.json(docs.get(path));
    }
    if (docs.has(path)) return Response.json(docs.get(path));
    if (path === `${root}/products`) return Response.json({ documents: [{ name: `${url.origin}/documents/${root}/products/p1`, ...docs.get(`${root}/products/p1`) }] });
    return new Response("", { status: 404 });
  };
  const env = { AUTH_SECRET: SECRET, DB: db };
  function request(method, body) {
    return { env, request: new Request("https://rts.example/api/pos-mobile", {
      method, headers: { Authorization: `Bearer ${token}`, Origin: "https://rts.example", "Content-Type": "application/json" },
      ...(body ? { body: JSON.stringify(body) } : {}),
    }) };
  }
  return { env, request, put, docs, devices, calls, authVersion, restore: () => { globalThis.fetch = originalFetch; } };
}

test("catalog requires a current tenant session and removes private fields", async () => {
  const f = await setup();
  try {
    let response = await onRequestGet(f.request("GET"));
    assert.equal(response.status, 200);
    const data = await response.json();
    assert.equal(data.products[0].name, "وجبة");
    assert.equal(data.products[0].variants[0].price, 10);
    assert.equal(data.products[0].privateCost, undefined);
    assert.equal(data.products[0].variants[0].cost, undefined);
    assert.equal(data.capabilities.checkout, false);
    f.put(`${root}/settings/pos_users`, { users: [{ ...user, active: false }] });
    response = await onRequestGet(f.request("GET"));
    assert.equal(response.status, 401);
    f.put(`${root}/settings/pos_users`, { users: [user] });
    f.put("projects/_global/settings/pos_stores", { stores: [{ id: "restaurant-one", productType: "clinic" }] });
    response = await onRequestGet(f.request("GET"));
    assert.equal(response.status, 401);
  } finally { f.restore(); }
});

test("device registration is tenant scoped and logout revokes it", async () => {
  const f = await setup();
  try {
    const deviceToken = "fixture-device-token-0123456789";
    let response = await onRequestPost(f.request("POST", { action: "register", token: deviceToken }));
    assert.equal(response.status, 200);
    const device = [...f.devices.values()][0];
    assert.equal(device.store_id, "restaurant-one");
    assert.equal(device.username, "worker");
    assert.equal(device.auth_version, f.authVersion);
    assert.ok(Date.parse(device.expires_at) > Date.now() + 29 * 86400000);
    response = await onRequestPost(f.request("POST", { action: "unregister", token: deviceToken }));
    assert.equal(response.status, 200);
    assert.equal(f.devices.size, 0);
    response = await onRequestPost(f.request("POST", { action: "register", token: deviceToken, storeId: "other" }));
    assert.equal(response.status, 400);
  } finally { f.restore(); }
});

test("delivery failures leave alerts pending for retry", async () => {
  const f = await setup();
  try {
    f.devices.set("d1", { id: "d1", store_id: "restaurant-one", username: "worker", token: "fixture-device-token", auth_version: f.authVersion, expires_at: "2099-01-01" });
    f.put(`${root}/pos_supply_alerts/a1`, { status: "pending", attempts: 0 });
    await dispatchSupplyAlert({ env: f.env }, "restaurant-one", "a1");
    assert.equal(decodeFields(f.docs.get(`${root}/pos_supply_alerts/a1`).fields).status, "pending");
    assert.equal(f.calls.length, 0);
    f.env.FCM_DISPATCH_SECRET = "test-dispatch-secret-that-is-long-enough";
    const response = await dispatchRequest({ env: f.env, request: new Request("https://rts.example/api/pos-mobile-dispatch", {
      method: "POST", headers: { Authorization: `Bearer ${f.env.FCM_DISPATCH_SECRET}` },
    }) });
    assert.equal(response.status, 503);
  } finally { f.restore(); }
});

test("scheduled retry requires its secret and processes pending alerts", async () => {
  const f = await setup();
  try {
    f.env.FCM_DISPATCH_SECRET = "test-dispatch-secret-that-is-long-enough";
    f.put(`${root}/pos_supply_alerts/a1`, { status: "pending", attempts: 0 });
    const makeRequest = (secret) => ({ env: f.env, request: new Request("https://rts.example/api/pos-mobile-dispatch", {
      method: "POST", headers: { Authorization: `Bearer ${secret}` },
    }) });
    let response = await dispatchRequest(makeRequest("incorrect"));
    assert.equal(response.status, 401);
    assert.equal(decodeFields(f.docs.get(`${root}/pos_supply_alerts/a1`).fields).status, "pending");
    response = await dispatchRequest(makeRequest(f.env.FCM_DISPATCH_SECRET));
    assert.equal(response.status, 200);
    assert.equal((await response.json()).attempted, 1);
    assert.equal(decodeFields(f.docs.get(`${root}/pos_supply_alerts/a1`).fields).status, "sent");
  } finally { f.restore(); }
});

test("successful dispatch sends only generic data and honors account revocation", async () => {
  const f = await setup();
  try {
    const keys = await crypto.subtle.generateKey({ name: "RSASSA-PKCS1-v1_5", modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" }, true, ["sign", "verify"]);
    const privateBytes = new Uint8Array(await crypto.subtle.exportKey("pkcs8", keys.privateKey));
    const pem = `-----BEGIN PRIVATE KEY-----\n${btoa(String.fromCharCode(...privateBytes))}\n-----END PRIVATE KEY-----`;
    f.env.FCM_SERVICE_ACCOUNT = JSON.stringify({ project_id: "rts-business-mobile", client_email: "fixture@example.test", private_key: pem });
    f.devices.set("d1", { id: "d1", store_id: "restaurant-one", username: "worker", token: "fixture-device-token", auth_version: f.authVersion, expires_at: "2099-01-01" });
    f.devices.set("d2", { id: "d2", store_id: "restaurant-one", username: "worker", token: "revoked-device-token", auth_version: "old", expires_at: "2099-01-01" });
    f.put(`${root}/pos_supply_alerts/a1`, { status: "pending", attempts: 0 });
    await dispatchSupplyAlert({ env: f.env }, "restaurant-one", "a1");
    assert.equal(f.calls.length, 1);
    assert.deepEqual(f.calls[0].message.data, { type: "low-stock" });
    assert.equal(f.calls[0].message.token, "fixture-device-token");
    assert.equal(decodeFields(f.docs.get(`${root}/pos_supply_alerts/a1`).fields).status, "sent");
    await dispatchSupplyAlert({ env: f.env }, "restaurant-one", "a1");
    assert.equal(f.calls.length, 1);
  } finally { f.restore(); }
});
