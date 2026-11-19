import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { onRequestGet, onRequestPost } from "../functions/api/pos-shared-config.js";
import { createPosSessionToken, getPosUserAuthVersion } from "../functions/_lib/pos-session.js";

const SECRET = "shared-config-fixture-secret";
const root = "projects/config-restaurant";
const config = {
  features: { tax: true, stocktake: true }, taxPercent: 17, taxIncluded: false,
  restaurantMenuSections: [{ id: "food", name: "Food", image: "private-menu-image" }],
};
function encode(value) {
  if (Array.isArray(value)) return { arrayValue: { values: value.map(encode) } };
  if (value && typeof value === "object") return { mapValue: { fields: fields(value) } };
  if (typeof value === "boolean") return { booleanValue: value };
  if (typeof value === "number") return { doubleValue: value };
  return value == null ? { nullValue: null } : { stringValue: value };
}
function fields(value) { return Object.fromEntries(Object.entries(value).map(([key, data]) => [key, encode(data)])); }
function decode(value) {
  for (const key of ["stringValue", "doubleValue", "booleanValue"]) if (key in value) return value[key];
  if ("integerValue" in value) return Number(value.integerValue);
  if ("nullValue" in value) return null;
  if (value.arrayValue) return (value.arrayValue.values || []).map(decode);
  return unfields(value.mapValue.fields);
}
function unfields(value) { return Object.fromEntries(Object.entries(value || {}).map(([key, data]) => [key, decode(data)])); }

async function fixture({ role = "admin", enabled = true } = {}) {
  const account = { username: "manager", role, active: true, passwordHash: "fixture", passwordSalt: "fixture" };
  const token = await createPosSessionToken(SECRET, {
    storeId: "config-restaurant", username: account.username, role, productType: "business",
    authVersion: await getPosUserAuthVersion(SECRET, account), exp: Math.floor(Date.now() / 1000) + 3600,
  });
  let version = 0, loseResponse = false, beforeCommit;
  const docs = new Map(), commits = [];
  function put(path, data) { docs.set(path, { fields: fields(data), updateTime: `version-${++version}` }); }
  function data(path) { return docs.has(path) ? unfields(docs.get(path).fields) : null; }
  put("projects/_global/settings/pos_stores", { stores: [{ id: "config-restaurant", type: "firestore" }] });
  put(`${root}/settings/pos`, { warrantyEnd: "2099-01-01", businessType: "restaurant", dataBackend: "firestore" });
  put(`${root}/settings/pos_users`, { users: [account] });
  put(`${root}/orders/source-config`, { recordType: "store-config", ...config, createdAtIso: "2026-01-01T00:00:00Z" });
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input, options = {}) => {
    const url = new URL(input);
    if (url.pathname.endsWith(":commit")) {
      const { writes } = JSON.parse(options.body);
      commits.push(writes);
      if (beforeCommit) { const callback = beforeCommit; beforeCommit = null; callback(); }
      for (const write of writes) {
        const path = (write.update?.name || write.verify).split("/documents/")[1], existing = docs.get(path);
        if (write.currentDocument?.exists === false && existing) return new Response("", { status: 409 });
        if (write.currentDocument?.updateTime && existing?.updateTime !== write.currentDocument.updateTime) return new Response("", { status: 412 });
      }
      for (const write of writes) if (write.update) {
        docs.set(write.update.name.split("/documents/")[1], { fields: write.update.fields, updateTime: `version-${++version}` });
      }
      if (loseResponse) { loseResponse = false; throw new Error("Fixture lost committed response"); }
      return Response.json({ writeResults: [] });
    }
    if (url.pathname.endsWith(":runQuery")) {
      const query = JSON.parse(options.body).structuredQuery;
      const filter = query.where.fieldFilter;
      return Response.json([...docs.entries()].filter(([path, value]) =>
        path.startsWith(`${root}/${query.from[0].collectionId}/`)
          && unfields(value.fields)[filter.field.fieldPath] === decode(filter.value))
        .slice(0, query.limit)
        .map(([path, value]) => ({ document: { name: `projects/test/databases/(default)/documents/${path}`, ...value } })));
    }
    const path = decodeURIComponent(url.pathname.split("/documents/")[1] || "");
    return docs.has(path) ? Response.json(docs.get(path)) : new Response("", { status: 404 });
  };
  const sqlite = new DatabaseSync(":memory:");
  sqlite.exec(readFileSync(new URL("../migrations/0008_pos_private_snapshots.sql", import.meta.url), "utf8"));
  sqlite.exec("CREATE TABLE rate_limits(scope_key TEXT PRIMARY KEY, count INTEGER, window_start INTEGER, expires_at INTEGER)");
  const env = {
    AUTH_SECRET: SECRET, ...(enabled ? { POS_SHARED_CHECKOUT_STATE: "writers-retired" } : {}),
    DB: { prepare(sql) { return { bind(...args) { return {
      async first() { return sqlite.prepare(sql).get(...args) || null; },
      async run() { return sqlite.prepare(sql).run(...args); },
    }; } }; } },
  };
  async function call(method, body, query = "") {
    const request = new Request(`https://rts.example/api/pos-shared-config${query}`, {
      method, headers: { Authorization: `Bearer ${token}`, Origin: "https://rts.example", "Content-Type": "application/json" },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    const result = await (method === "GET" ? onRequestGet : onRequestPost)({ request, env });
    return { status: result.status, body: await result.json() };
  }
  return {
    put, data, docs, commits, sqlite, call,
    loseNextResponse() { loseResponse = true; },
    beforeNextCommit(callback) { beforeCommit = callback; },
    close() { globalThis.fetch = originalFetch; sqlite.close(); },
  };
}

test("explicit configuration cutover preserves source and private sections, then ignores legacy phantom records", async () => {
  const f = await fixture();
  try {
    assert.equal((await f.call("GET")).body.configured, false);
    const preview = (await f.call("GET", null, "?preview=1")).body;
    const response = await f.call("POST", {
      action: "cutover", requestId: "config-cutover-1", sourceId: preview.sourceId, sourceRevision: preview.sourceRevision,
    });
    assert.equal(response.status, 200);
    assert.equal(response.body.revision, 1);
    assert.deepEqual(response.body.config, config);
    assert.equal(f.data(`${root}/orders/source-config`).taxPercent, 17);
    assert.equal(JSON.stringify(f.commits).includes("private-menu-image"), false);
    f.put(`${root}/orders/new-legacy-phantom`, { recordType: "store-config", ...config, taxPercent: 99, createdAtIso: "2090-01-01" });
    assert.equal((await f.call("GET")).body.config.taxPercent, 17);
    const saved = f.data(`${root}/settings/shared_config`);
    f.put(`${root}/settings/shared_config`, { ...saved, taxPercent: 99 });
    assert.equal((await f.call("GET")).status, 503);
  } finally { f.close(); }
});

test("configuration mutations enforce current role, cutover gate and explicit tax values", async () => {
  let f = await fixture({ role: "worker" });
  try {
    assert.equal((await f.call("GET", null, "?preview=1")).status, 403);
    assert.equal((await f.call("POST", { action: "initialize", requestId: "config-init-01", config })).status, 403);
  } finally { f.close(); }
  f = await fixture({ enabled: false });
  try {
    assert.equal((await f.call("POST", { action: "initialize", requestId: "config-init-01", config })).status, 503);
  } finally { f.close(); }
  f = await fixture();
  try {
    for (const invalid of [{ ...config, taxPercent: null }, { ...config, taxPercent: 101 }, { ...config, features: {} }, { ...config, taxIncluded: undefined }]) {
      assert.equal((await f.call("POST", { action: "initialize", requestId: "config-invalid", config: invalid })).status, 400);
    }
    assert.equal(f.data(`${root}/settings/shared_config`), null);
  } finally { f.close(); }
});

test("configuration retry confirms one committed revision and rejects reused intent and stale writes", async () => {
  const f = await fixture();
  try {
    const payload = { action: "initialize", requestId: "config-init-01", config };
    f.loseNextResponse();
    assert.ok((await f.call("POST", payload)).status >= 500);
    const retried = await f.call("POST", payload);
    assert.equal(retried.status, 200);
    assert.equal(retried.body.replayed, true);
    assert.equal(retried.body.revision, 1);
    assert.equal(f.commits.length, 1);
    assert.equal((await f.call("POST", { ...payload, config: { ...config, taxPercent: 18 } })).status, 409);
    const update = { action: "update", requestId: "config-update-1", revision: 1, config: { ...config, taxPercent: 18 } };
    assert.equal((await f.call("POST", update)).body.revision, 2);
    assert.equal((await f.call("POST", { ...update, requestId: "config-update-2" })).status, 409);
    assert.equal((await f.call("GET")).body.config.taxPercent, 18);
  } finally { f.close(); }
});

test("configuration cutover verifies its selected source atomically", async () => {
  const f = await fixture();
  try {
    const preview = (await f.call("GET", null, "?preview=1")).body;
    f.beforeNextCommit(() => f.put(`${root}/orders/source-config`, { recordType: "store-config", ...config, taxPercent: 19 }));
    const response = await f.call("POST", {
      action: "cutover", requestId: "config-cutover-1", sourceId: preview.sourceId, sourceRevision: preview.sourceRevision,
    });
    assert.equal(response.status, 409);
    assert.equal(f.data(`${root}/settings/shared_config`), null);
    assert.equal(f.data(`${root}/orders/source-config`).taxPercent, 19);
  } finally { f.close(); }
});

test("large legacy histories require an explicit bounded source preview", async () => {
  const f = await fixture();
  try {
    for (let i = 0; i < 19; i++) {
      f.put(`${root}/orders/legacy-${i}`, { recordType: "store-config", ...config, createdAtIso: "2026-01-02T00:00:00Z" });
    }
    assert.equal((await f.call("GET", null, "?preview=1")).body.error.code, "CONFIG_PREVIEW_LIMIT");
    const selected = await f.call("GET", null, "?preview=1&sourceId=source-config");
    assert.equal(selected.status, 200);
    assert.equal(selected.body.sourceId, "source-config");
    assert.deepEqual(selected.body.config, config);
    assert.equal((await f.call("GET", null, "?preview=1&sourceId=..%2Fother")).status, 400);
    assert.equal(f.commits.length, 0);
  } finally { f.close(); }
});
