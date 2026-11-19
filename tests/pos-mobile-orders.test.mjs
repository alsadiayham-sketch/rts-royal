import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { onRequestGet, onRequestPost } from "../functions/api/pos-mobile-orders.js";
import { onRequestGet as getTables, onRequestPost as postTables } from "../functions/api/pos-restaurant-tables.js";
import { createPosSessionToken, getPosUserAuthVersion } from "../functions/_lib/pos-session.js";
import { commitFirestoreWrites } from "../functions/_lib/firestore.js";

const SECRET = "test-only-pos-session-secret";
const root = "projects/restaurant-one";
const user = { username: "worker", role: "worker", active: true, passwordHash: "fixture", passwordSalt: "fixture" };
function encode(value) {
  if (value?.__firestoreTimestamp) return { timestampValue: value.__firestoreTimestamp };
  if (Array.isArray(value)) return { arrayValue: { values: value.map(encode) } };
  if (value && typeof value === "object") return { mapValue: { fields: fields(value) } };
  if (typeof value === "boolean") return { booleanValue: value };
  if (typeof value === "number") return { doubleValue: value };
  return value == null ? { nullValue: null } : { stringValue: String(value) };
}
function fields(data) { return Object.fromEntries(Object.entries(data).map(([key, value]) => [key, encode(value)])); }
function decode(value = {}) {
  for (const key of ["stringValue", "timestampValue", "doubleValue", "booleanValue"]) if (key in value) return value[key];
  if ("integerValue" in value) return Number(value.integerValue);
  if ("nullValue" in value) return null;
  if (value.arrayValue) return (value.arrayValue.values || []).map(decode);
  if (value.mapValue) return decodeFields(value.mapValue.fields);
  return null;
}
function decodeFields(data) { return Object.fromEntries(Object.entries(data || {}).map(([key, value]) => [key, decode(value)])); }
async function fixture({ checkoutEnabled = false, role = "worker", tablesInitialized = true } = {}) {
  const activeUser = { ...user, role };
  const token = await createPosSessionToken(SECRET, {
    storeId: "restaurant-one", username: "worker", role, productType: "business",
    authVersion: await getPosUserAuthVersion(SECRET, activeUser), exp: Math.floor(Date.now() / 1000) + 3600,
  });
  let version = 0, loseCommitResponse = false, transientConflict = false, beforeCommit = null;
  const docs = new Map(), commits = [];
  function put(path, data) { docs.set(path, { fields: fields(data), updateTime: `rev-${++version}` }); }
  function data(path) { return docs.has(path) ? decodeFields(docs.get(path).fields) : null; }
  put("projects/_global/settings/pos_stores", { stores: [{ id: "restaurant-one", type: "firestore" }] });
  put(`${root}/settings/pos`, { warrantyEnd: "2099-01-01", businessType: "restaurant", dataBackend: "firestore" });
  put(`${root}/settings/pos_users`, { users: [activeUser] });
  put(`${root}/products/p1`, { name: "وجبة", createdAt: { __firestoreTimestamp: "2026-01-01T00:00:00Z" }, other: { legacy: "preserve" }, variants: [{ size: "كبير", color: "افتراضي", price: 10, stock: 5, cost: 3 }] });
  const variantFields = docs.get(`${root}/products/p1`).fields.variants.arrayValue.values[0].mapValue.fields;
  variantFields.sourceTime = { timestampValue: "2025-01-01T00:00:00Z" };
  variantFields.sourceReference = { referenceValue: "projects/test/databases/(default)/documents/vendors/private-ref" };
  variantFields.sourceBytes = { bytesValue: "cHJpdmF0ZQ==" };
  put(`${root}/orders/config1`, { recordType: "store-config", features: { tax: true }, taxPercent: 10, taxIncluded: false, createdAtIso: "2026-01-01T00:00:00Z" });
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input, options = {}) => {
    const url = new URL(input);
    if (url.pathname.endsWith(":commit")) {
      const { writes } = JSON.parse(options.body);
      commits.push(writes);
      if (beforeCommit) { const callback = beforeCommit; beforeCommit = null; callback(); }
      if (transientConflict) { transientConflict = false; return new Response("", { status: 409 }); }
      for (const write of writes) {
        const path = (write.update?.name || write.verify).split("/documents/")[1], current = docs.get(path);
        if (write.currentDocument?.exists === false && current) return new Response("", { status: 409 });
        if (write.currentDocument?.updateTime && current?.updateTime !== write.currentDocument.updateTime) return new Response("", { status: 412 });
      }
      for (const write of writes) if (write.update) {
        const path = write.update.name.split("/documents/")[1];
        const fields = write.updateMask
          ? { ...docs.get(path).fields, ...write.update.fields }
          : write.update.fields;
        docs.set(path, { fields, updateTime: `rev-${++version}` });
      }
      if (loseCommitResponse) { loseCommitResponse = false; throw new Error("simulated connection loss after commit"); }
      return Response.json({ writeResults: [] });
    }
    if (url.pathname.endsWith(":runQuery")) {
      const q = JSON.parse(options.body).structuredQuery;
      const name = q.from[0].collectionId;
      const filter = q.where.fieldFilter;
      const wanted = decode(filter.value);
      const rows = [...docs.entries()].filter(([path, value]) => path.startsWith(`${root}/${name}/`)
          && decodeFields(value.fields)[filter.field.fieldPath] === wanted)
        .slice(0, q.limit).map(([path, value]) => ({ document: { name: `projects/test/databases/(default)/documents/${path}`, ...value } }));
      return Response.json(rows);
    }
    const path = decodeURIComponent(url.pathname.split("/documents/")[1] || "");
    if (docs.has(path)) return Response.json(docs.get(path));
    return new Response("", { status: 404 });
  };
  const sqlite = new DatabaseSync(":memory:");
  sqlite.exec(readFileSync(new URL("../migrations/0008_pos_private_snapshots.sql", import.meta.url), "utf8"));
  sqlite.exec("CREATE TABLE rate_limits(scope_key TEXT PRIMARY KEY, count INTEGER, window_start INTEGER, expires_at INTEGER)");
  const config = { features: { tax: true }, taxPercent: 10, taxIncluded: false };
  sqlite.prepare("INSERT INTO pos_private_snapshots VALUES (?, ?, ?, ?, ?, ?, ?)")
    .run("restaurant-one", "fixture-config", "fixture-config-ref", "worker", "fixture-hash", JSON.stringify({ revision: 1, config }), "2026-01-01");
  put(`${root}/settings/shared_config`, { revision: 1, privateRef: "fixture-config-ref", ...config });
  if (tablesInitialized) {
    const tables = [1, 2].map((id) => ({ id, name: `Table ${id}`, archived: false, createdAtIso: "", archivedAtIso: "" }));
    sqlite.prepare("INSERT INTO pos_private_snapshots VALUES (?, ?, ?, ?, ?, ?, ?)")
      .run("restaurant-one", "fixture-tables", "fixture-private-ref", "worker", "fixture-hash", JSON.stringify({ revision: 1, tables }), "2026-01-01");
    put(`${root}/settings/pos_shared_tables`, { revision: 1, privateRef: "fixture-private-ref" });
  }
  const db = { prepare(sql) { return { bind(...args) { return {
    async first() { return sqlite.prepare(sql).get(...args) || null; },
    async run() { return sqlite.prepare(sql).run(...args); },
  }; } }; } };
  const env = { AUTH_SECRET: SECRET, DB: db, ...(checkoutEnabled ? { POS_SHARED_CHECKOUT_STATE: "writers-retired" } : {}) };
  function request(method, body, query = "") {
    return { env, request: new Request(`https://rts.example/api/pos-mobile-orders${query}`, {
      method, headers: { Authorization: `Bearer ${token}`, Origin: "https://rts.example", "Content-Type": "application/json" },
      ...(body ? { body: JSON.stringify(body) } : {}),
    }) };
  }
  async function post(body) { const result = await onRequestPost(request("POST", body)); return { status: result.status, body: await result.json() }; }
  return { put, data, docs, commits, request, post, sqlite,
    loseNextCommitResponse() { loseCommitResponse = true; },
    conflictNextCommit() { transientConflict = true; },
    beforeNextCommit(callback) { beforeCommit = callback; },
    restore: () => { globalThis.fetch = originalFetch; sqlite.close(); } };
}
const item = { productId: "p1", color: "افتراضي", size: "كبير", qty: 1, note: "" };
const service = { type: "dinein", table: 1, customerName: "", phone: "", address: "", deliveryFee: 0 };
const hold = (id = "hold-000001", req = "hold-request-0001", revision = 0) => ({
  action: "hold", requestId: req, holdId: id, revision, items: [item], service, note: "",
});
const quote = (id, revision) => ({ action: "quote", requestId: "quote-request-0001", holdId: id, revision });
const checkout = (id, revision, quoteHash, requestId = "checkout-request-1") => ({
  action: "checkout", requestId, holdId: id, revision, quoteHash, paymentMethod: "cash",
});
const restaurantOffer = {
  recordType: "restaurant-offer", name: "Fixture private receipt offer", discountType: "percent",
  discountValue: 50, maxDiscount: 3, minQty: 2, enabled: true, expiresOn: "",
};

test("shared offers use current server definitions, preserve older edits, and never stack a manual discount", async () => {
  for (const discountType of ["percent", "amount"]) {
    const f = await fixture({ checkoutEnabled: true });
    try {
      f.put(`${root}/orders/offer-one`, { ...restaurantOffer, discountType });
      assert.equal((await f.post({
        ...hold(), items: [{ ...item, qty: 2 }], offerId: "offer-one", discount: { type: "fixed", value: 9 },
      })).status, 200);
      const edited = await f.post({ ...hold("hold-000001", "hold-request-edit", 1), items: [{ ...item, qty: 2 }] });
      assert.equal(edited.body.hold.offerId, "offer-one", "Older clients must not silently erase the offer.");
      const quoted = await f.post(quote("hold-000001", 2));
      assert.equal(quoted.body.quote.discount, 3);
      assert.equal(quoted.body.quote.total, 18.7);
      assert.deepEqual(quoted.body.quote.restaurantOffer, { id: "offer-one", name: restaurantOffer.name, discount: 3 });
      const paid = await f.post(checkout("hold-000001", 2, quoted.body.quoteHash));
      assert.equal(paid.status, 200);
      assert.equal(paid.body.bill.discount, 3);
      assert.equal(paid.body.bill.restaurantOffer.name, restaurantOffer.name);
      assert.equal(f.data(`${root}/products/p1`).variants[0].stock, 3);
      assert.equal(JSON.stringify(f.commits).includes(restaurantOffer.name), false);
      f.put(`${root}/orders/offer-one`, { ...restaurantOffer, name: "Changed after payment" });
      const receipt = await onRequestGet(f.request("GET", null, "?receiptId=hold-000001"));
      assert.equal((await receipt.json()).bill.restaurantOffer.name, restaurantOffer.name);
    } finally { f.restore(); }
  }
});

test("shared offers reject unavailable definitions and cannot be injected into checkout", async () => {
  const f = await fixture({ checkoutEnabled: true });
  try {
    assert.equal((await f.post({ ...hold(), offerId: "../other-tenant" })).status, 400);
    assert.equal((await f.post({ ...hold(), items: [{ ...item, qty: 2 }], offerId: "offer-one" })).status, 200);
    for (const change of [
      { enabled: false }, { expiresOn: "2000-01-01" }, { expiresOn: "not-a-date" },
      { minQty: 3 }, { recordType: "customer" }, { discountValue: 101 }, { maxDiscount: -1 },
    ]) {
      f.put(`${root}/orders/offer-one`, { ...restaurantOffer, ...change });
      const quoted = await f.post(quote("hold-000001", 1));
      assert.equal(quoted.status, 409);
      assert.equal(quoted.body.error.code, "OFFER_UNAVAILABLE");
    }
    f.put(`${root}/orders/offer-one`, restaurantOffer);
    const quoted = await f.post(quote("hold-000001", 1));
    assert.equal((await f.post({ ...checkout("hold-000001", 1, quoted.body.quoteHash), offerId: null })).status, 400);
    const cleared = await f.post({ ...hold("hold-000001", "hold-request-clear", 1), offerId: null });
    assert.equal(cleared.body.hold.offerId, null);
    assert.equal((await f.post(quote("hold-000001", 2))).body.quote.discount, 0);
    assert.equal(f.data(`${root}/products/p1`).variants[0].stock, 5);
  } finally { f.restore(); }
});

test("offer changes invalidate quotes and concurrent offer edits cannot partially charge or consume stock", async () => {
  const f = await fixture({ checkoutEnabled: true });
  try {
    f.put(`${root}/orders/offer-one`, restaurantOffer);
    await f.post({ ...hold(), items: [{ ...item, qty: 2 }], offerId: "offer-one" });
    const original = await f.post(quote("hold-000001", 1));
    f.put(`${root}/orders/offer-one`, { ...restaurantOffer, maxDiscount: 2 });
    assert.equal((await f.post(checkout("hold-000001", 1, original.body.quoteHash))).body.error.code, "QUOTE_CHANGED");
    const updated = await f.post(quote("hold-000001", 1));
    f.beforeNextCommit(() => f.put(`${root}/orders/offer-one`, { ...restaurantOffer, enabled: false }));
    const request = checkout("hold-000001", 1, updated.body.quoteHash, "checkout-offer-race");
    assert.equal((await f.post(request)).status, 409);
    assert.equal((await f.post(request)).status, 409);
    assert.equal(f.data(`${root}/products/p1`).variants[0].stock, 5);
    assert.equal(f.data(`${root}/pos_mobile_holds/hold-000001`).status, "open");
    assert.equal(f.data(`${root}/orders/POS-M-hold-000001`), null);
  } finally { f.restore(); }
});

test("shared fixed and percentage discounts survive edits and use server prices and tax", async () => {
  for (const [discount, amount, total] of [
    [{ type: "fixed", value: 2 }, 2, 8.8],
    [{ type: "percent", value: 12.5 }, 1.25, 9.63],
  ]) {
    const f = await fixture({ checkoutEnabled: true });
    try {
      const saved = await f.post({ ...hold(), discount });
      assert.equal(saved.status, 200);
      assert.deepEqual(saved.body.hold.discount, discount);
      const edited = await f.post(hold("hold-000001", "hold-request-edit", 1));
      assert.deepEqual(edited.body.hold.discount, discount, "An older client must not silently erase the saved discount.");
      const quoted = await f.post(quote("hold-000001", 2));
      assert.equal(quoted.body.quote.discount, amount);
      assert.equal(quoted.body.quote.total, total);
      const paid = await f.post(checkout("hold-000001", 2, quoted.body.quoteHash));
      assert.equal(paid.status, 200);
      assert.equal(paid.body.bill.discount, amount);
      assert.equal(paid.body.bill.discountValue, discount.value);
      assert.equal(paid.body.bill.total, total);
      assert.equal(f.data(`${root}/products/p1`).variants[0].stock, 4);
    } finally { f.restore(); }
  }
});

test("shared discounts reject invalid intent and cannot bypass a stored quote or discount delivery fees", async () => {
  const f = await fixture({ checkoutEnabled: true });
  try {
    for (const discount of [null, { type: "other", value: 1 }, { type: "fixed", value: -1 }, { type: "percent", value: 100.01 }]) {
      assert.equal((await f.post({ ...hold(), discount })).status, 400);
    }
    assert.equal((await f.post({ ...hold(), discount: { type: "fixed", value: 11 } })).status, 200);
    assert.equal((await f.post(quote("hold-000001", 1))).body.error.code, "INVALID_DISCOUNT");
    const delivery = { type: "delivery", customerName: "Fixture", phone: "fixture-phone", address: "fixture-address", deliveryFee: 3 };
    const updated = await f.post({ ...hold("hold-000001", "hold-request-edit", 1), service: delivery, discount: { type: "percent", value: 100 } });
    assert.equal(updated.status, 200);
    const quoted = await f.post(quote("hold-000001", 2));
    assert.equal(quoted.body.quote.discount, 10);
    assert.equal(quoted.body.quote.total, 3.3);
    assert.equal((await f.post({ ...checkout("hold-000001", 2, quoted.body.quoteHash), discount: { type: "fixed", value: 0 } })).status, 400);
    assert.equal(f.data(`${root}/products/p1`).variants[0].stock, 5);
  } finally { f.restore(); }
});

test("holds enforce table occupancy while private notes are stored only in D1", async () => {
  const f = await fixture();
  try {
    let response = await f.post(hold());
    assert.equal(response.status, 200);
    assert.equal(response.body.hold.revision, 1);
    assert.equal(f.data(`${root}/pos_mobile_tables/1`).holdId, "hold-000001");
    response = await f.post(hold("hold-000002", "hold-request-0002"));
    assert.equal(response.status, 409);
    assert.equal(response.body.error.code, "TABLE_OCCUPIED");
    response = await f.post({ ...hold("hold-000001", "hold-request-0003", 1), items: [{ ...item, qty: 2, note: "بدون ملح" }] });
    assert.equal(response.body.hold.revision, 2);
    const list = await onRequestGet(f.request("GET"));
    assert.equal((await list.json()).holds.length, 1);
    assert.equal((await f.post(quote("hold-000001", 2))).body.error.code, "CHECKOUT_UNAVAILABLE");
    const publicWrites = JSON.stringify(f.commits);
    assert.equal(publicWrites.includes("بدون ملح"), false);
    assert.ok(f.sqlite.prepare("SELECT response_json FROM pos_private_snapshots WHERE request_id = ?").get("hold-request-0003").response_json.includes("بدون ملح"));
  } finally { f.restore(); }
});

test("shared table import is explicit, private, idempotent and supports safe CRUD", async () => {
  const f = await fixture({ role: "admin", tablesInitialized: false });
  const post = async (payload) => {
    const result = await postTables(f.request("POST", payload));
    return { status: result.status, body: await result.json() };
  };
  try {
    assert.equal((await (await getTables(f.request("GET"))).json()).configured, false);
    assert.equal((await f.post(hold())).body.error.code, "TABLES_UNAVAILABLE");
    const init = { action: "initialize", requestId: "table-init-0001", revision: 0,
      tables: [{ id: 70, name: "VIP غرفة", archived: false, createdAtIso: "", archivedAtIso: "" }] };
    const saved = await post(init);
    assert.equal(saved.status, 200);
    assert.equal(saved.body.revision, 1);
    assert.equal((await post(init)).body.replayed, true);
    assert.equal(JSON.stringify(f.data(`${root}/settings/pos_shared_tables`)).includes("VIP غرفة"), false);
    assert.equal((await f.post({ ...hold(), service: { ...service, table: 70 } })).status, 200);
    assert.equal((await post({ action: "archive", requestId: "table-archive-1", revision: 1, id: 70, archived: true })).body.error.code, "TABLE_OCCUPIED");
    const cancel = { action: "cancel", requestId: "cancel-request-01", holdId: "hold-000001", revision: 1 };
    assert.equal((await f.post(cancel)).status, 200);
    const archived = await post({ action: "archive", requestId: "table-archive-2", revision: 1, id: 70, archived: true });
    assert.equal(archived.body.tables[0].archived, true);
    assert.equal((await f.post({ ...hold("hold-000002", "hold-request-0002"), service: { ...service, table: 70 } })).body.error.code, "TABLE_UNAVAILABLE");
    const created = await post({ action: "create", requestId: "table-create-01", revision: 2, name: "Second" });
    assert.equal(created.body.tables[1].id, 71);
    const renamed = await post({ action: "update", requestId: "table-update-01", revision: 3, id: 71, name: "Third" });
    assert.equal(renamed.body.tables[1].name, "Third");
    const removed = await post({ action: "delete", requestId: "table-delete-01", revision: 4, id: 71 });
    assert.equal(removed.body.tables.length, 1);
    assert.equal((await post({ action: "create", requestId: "table-stale-001", revision: 4, name: "Stale" })).status, 409);
    const newTable = await post({ action: "create", requestId: "table-create-02", revision: 5, name: "Fourth" });
    assert.equal(newTable.body.tables[1].id, 72);
  } finally { f.restore(); }
});

test("lost table update retries the same request and cannot change its intent", async () => {
  const f = await fixture({ role: "admin" });
  const post = async (payload) => {
    const result = await postTables(f.request("POST", payload));
    return { status: result.status, body: await result.json() };
  };
  try {
    const command = { action: "create", requestId: "table-create-01", revision: 1, name: "Private room" };
    f.loseNextCommitResponse();
    assert.equal((await post(command)).status, 502);
    const replayed = await post(command);
    assert.equal(replayed.body.replayed, true);
    assert.equal(replayed.body.tables.length, 3);
    assert.equal((await post({ ...command, name: "Different" })).body.error.code, "REQUEST_ID_REUSED");
    assert.equal(JSON.stringify(f.data(`${root}/settings/pos_shared_tables`)).includes("Private room"), false);
  } finally { f.restore(); }
});

test("table changes and order saves conflict rather than racing an archive", async () => {
  const f = await fixture({ role: "admin" });
  try {
    f.beforeNextCommit(() => f.put(`${root}/pos_mobile_tables/1`, { table: 1, holdId: "another-hold" }));
    const archive = await postTables(f.request("POST", {
      action: "archive", requestId: "table-archive-1", revision: 1, id: 1, archived: true,
    }));
    assert.equal(archive.status, 409);
    f.put(`${root}/pos_mobile_tables/1`, { table: 1, holdId: "" });
    f.beforeNextCommit(() => f.put(`${root}/settings/pos_shared_tables`, { revision: 1, privateRef: "fixture-private-ref" }));
    assert.equal((await f.post(hold())).status, 409);
    assert.equal(f.data(`${root}/pos_mobile_holds/hold-000001`), null);
  } finally { f.restore(); }
});

test("workers cannot edit shared table definitions", async () => {
  const f = await fixture();
  try {
    const result = await postTables(f.request("POST", { action: "create", requestId: "table-create-01", revision: 1, name: "Forbidden" }));
    assert.equal(result.status, 403);
  } finally { f.restore(); }
});

test("changed price invalidates the quote before any payment or stock write", async () => {
  const f = await fixture({ checkoutEnabled: true });
  try {
    await f.post(hold());
    const priced = await f.post(quote("hold-000001", 1));
    f.put(`${root}/products/p1`, { name: "وجبة", variants: [{ size: "كبير", color: "افتراضي", price: 20, stock: 5 }] });
    const response = await f.post(checkout("hold-000001", 1, priced.body.quoteHash));
    assert.equal(response.status, 409);
    assert.equal(response.body.error.code, "QUOTE_CHANGED");
    assert.equal(f.data(`${root}/products/p1`).variants[0].stock, 5);
    assert.equal(f.data(`${root}/orders/POS-M-hold-000001`), null);
  } finally { f.restore(); }
});

test("concurrent checkout cannot charge one held order twice", async () => {
  const f = await fixture({ checkoutEnabled: true });
  try {
    await f.post(hold());
    const priced = await f.post(quote("hold-000001", 1));
    const [a, b] = await Promise.all([
      f.post(checkout("hold-000001", 1, priced.body.quoteHash, "checkout-request-1")),
      f.post(checkout("hold-000001", 1, priced.body.quoteHash, "checkout-request-2")),
    ]);
    assert.deepEqual([a.status, b.status].sort(), [200, 409]);
    assert.equal(f.data(`${root}/products/p1`).variants[0].stock, 4);
    assert.deepEqual(f.docs.get(`${root}/products/p1`).fields.createdAt, { timestampValue: "2026-01-01T00:00:00Z" });
    assert.equal(f.data(`${root}/products/p1`).other.legacy, "preserve");
    const fields = f.docs.get(`${root}/products/p1`).fields.variants.arrayValue.values[0].mapValue.fields;
    assert.deepEqual(fields.sourceTime, { timestampValue: "2025-01-01T00:00:00Z" });
    assert.deepEqual(fields.sourceReference, { referenceValue: "projects/test/databases/(default)/documents/vendors/private-ref" });
    assert.deepEqual(fields.sourceBytes, { bytesValue: "cHJpdmF0ZQ==" });
    const staged = f.sqlite.prepare("SELECT response_json FROM pos_private_snapshots WHERE request_id LIKE 'checkout-request-%' LIMIT 1").get().response_json;
    for (const rawValue of ["2025-01-01T00:00:00Z", "vendors/private-ref", "cHJpdmF0ZQ=="]) assert.equal(staged.includes(rawValue), false);
  } finally { f.restore(); }
});

test("lost checkout response retries the same request without a second sale", async () => {
  const f = await fixture({ checkoutEnabled: true });
  try {
    await f.post(hold());
    const priced = await f.post(quote("hold-000001", 1));
    const command = checkout("hold-000001", 1, priced.body.quoteHash);
    f.loseNextCommitResponse();
    assert.equal((await f.post(command)).status, 502);
    assert.equal(f.data(`${root}/products/p1`).variants[0].stock, 4);
    f.docs.delete(`${root}/settings/pos_shared_tables`);
    f.docs.delete(`${root}/settings/shared_config`);
    const recovered = await f.post(command);
    assert.equal(recovered.status, 200);
    assert.equal(recovered.body.replayed, true);
    assert.equal(f.data(`${root}/products/p1`).variants[0].stock, 4);
  } finally { f.restore(); }
});

test("transient commit conflicts remain uncertain and retry the identical staged plan", async () => {
  const f = await fixture({ checkoutEnabled: true });
  try {
    await f.post(hold());
    const priced = await f.post(quote("hold-000001", 1));
    const command = checkout("hold-000001", 1, priced.body.quoteHash);
    f.conflictNextCommit();
    const pending = await f.post(command);
    assert.equal(pending.status, 503);
    assert.equal(pending.body.error.code, "COMMIT_UNCERTAIN");
    const originalPlan = JSON.stringify(f.commits.at(-1));
    assert.equal(f.data(`${root}/products/p1`).variants[0].stock, 5);
    const completed = await f.post(command);
    assert.equal(completed.status, 200);
    assert.equal(JSON.stringify(f.commits.at(-1)), originalPlan);
    assert.equal(f.data(`${root}/products/p1`).variants[0].stock, 4);
    assert.equal((await f.post(command)).body.replayed, true);
  } finally { f.restore(); }
});

test("two tables cannot oversell the same last item", async () => {
  const f = await fixture({ checkoutEnabled: true });
  try {
    f.put(`${root}/products/p1`, { name: "وجبة", variants: [{ size: "كبير", color: "افتراضي", price: 10, stock: 1 }] });
    await f.post(hold());
    await f.post({ ...hold("hold-000002", "hold-request-0002"), service: { ...service, table: 2 } });
    const [qa, qb] = await Promise.all([f.post(quote("hold-000001", 1)), f.post(quote("hold-000002", 1))]);
    const [a, b] = await Promise.all([
      f.post(checkout("hold-000001", 1, qa.body.quoteHash, "checkout-request-1")),
      f.post(checkout("hold-000002", 1, qb.body.quoteHash, "checkout-request-2")),
    ]);
    assert.deepEqual([a.status, b.status].sort(), [200, 409]);
    assert.equal(f.data(`${root}/products/p1`).variants[0].stock, 0);
    assert.equal([f.data(`${root}/orders/POS-M-hold-000001`), f.data(`${root}/orders/POS-M-hold-000002`)].filter(Boolean).length, 1);
  } finally { f.restore(); }
});

test("moving an open order releases its prior table atomically", async () => {
  const f = await fixture();
  try {
    await f.post(hold());
    const moved = await f.post({ ...hold("hold-000001", "hold-request-0003", 1), service: { ...service, table: 2 } });
    assert.equal(moved.status, 200);
    assert.equal(moved.body.hold.id, "hold-000001");
    assert.equal(f.data(`${root}/pos_mobile_tables/1`).holdId, "");
    assert.equal(f.data(`${root}/pos_mobile_tables/2`).holdId, "hold-000001");
    assert.equal((await f.post(hold("hold-000002", "hold-request-0002"))).status, 200);
  } finally { f.restore(); }
});

test("delivery validates recipient and stores no customer details in Firestore", async () => {
  const f = await fixture();
  try {
    const delivery = { type: "delivery", customerName: "عميل", phone: "55512345678", address: "شارع", deliveryFee: "3.50" };
    const bad = await f.post({ ...hold(), items: [{ ...item, price: 0 }] });
    assert.equal(bad.status, 400);
    assert.equal((await f.post({ ...hold(), service: { ...delivery, address: "" } })).status, 400);
    assert.equal((await f.post({ ...hold(), service: delivery })).status, 200);
    const publicWrites = JSON.stringify(f.commits);
    for (const secret of ["عميل", "55512345678", "شارع"]) assert.equal(publicWrites.includes(secret), false);
    const list = await onRequestGet(f.request("GET"));
    const result = await list.json();
    assert.equal(result.holds[0].service.address, "شارع");
  } finally { f.restore(); }
});

test("checkout persists private delivery and exact historical cost only in D1", async () => {
  const f = await fixture({ checkoutEnabled: true, role: "admin" });
  try {
    const delivery = { type: "delivery", customerName: "عميل", phone: "55512345678", address: "شارع", deliveryFee: "3.50" };
    const command = { ...hold(), items: [{ ...item, note: "حساسية" }], service: delivery, note: "ملاحظة خاصة" };
    assert.equal((await f.post(command)).status, 200);
    const priced = await f.post(quote("hold-000001", 1));
    assert.equal(priced.body.quote.total, 14.85);
    const paid = await f.post(checkout("hold-000001", 1, priced.body.quoteHash));
    assert.equal(paid.status, 200);
    assert.equal(paid.body.bill.restaurantOrder.address, "شارع");
    const publicBill = f.data(`${root}/orders/POS-M-hold-000001`);
    const publicText = JSON.stringify(publicBill);
    for (const secret of ["عميل", "55512345678", "شارع", "حساسية", "ملاحظة خاصة"]) {
      assert.equal(publicText.includes(secret), false);
    }
    assert.equal("cost" in publicBill.items[0], false);
    const result = await onRequestGet(f.request("GET", null, "?receiptId=hold-000001&includeCost=1"));
    const details = await result.json();
    assert.equal(result.status, 200);
    assert.equal(details.bill.restaurantOrder.phone, "55512345678");
    assert.equal(details.costs[0].cost, 3);
    assert.equal(JSON.stringify(f.data(`${root}/pos_mobile_holds/hold-000001`)).includes("شارع"), false);
    for (const [path, doc] of f.docs) {
      if (path.includes("/pos_mobile_requests/")) {
        assert.deepEqual(Object.keys(decodeFields(doc.fields)), ["privateRef"]);
      }
    }
  } finally { f.restore(); }
});

test("workers can retrieve their tenant receipt but cannot retrieve private historical costs", async () => {
  const f = await fixture({ checkoutEnabled: true });
  try {
    await f.post(hold());
    const priced = await f.post(quote("hold-000001", 1));
    assert.equal((await f.post(checkout("hold-000001", 1, priced.body.quoteHash))).status, 200);
    const receipt = await onRequestGet(f.request("GET", null, "?receiptId=hold-000001"));
    assert.equal(receipt.status, 200);
    assert.equal("costs" in await receipt.json(), false);
    const denied = await onRequestGet(f.request("GET", null, "?receiptId=hold-000001&includeCost=1"));
    assert.equal(denied.status, 403);
  } finally { f.restore(); }
});

test("missing canonical config fails closed and concurrent config updates prevent payment", async () => {
  const f = await fixture({ checkoutEnabled: true });
  try {
    await f.post(hold());
    f.docs.delete(`${root}/settings/shared_config`);
    assert.equal((await f.post(quote("hold-000001", 1))).body.error.code, "CONFIG_UNAVAILABLE");
    f.put(`${root}/settings/shared_config`, { revision: 1, privateRef: "fixture-config-ref", features: { tax: true }, taxPercent: 10, taxIncluded: false });
    const priced = await f.post(quote("hold-000001", 1));
    f.beforeNextCommit(() => f.put(`${root}/settings/shared_config`, { features: { tax: true }, taxPercent: 20, taxIncluded: false }));
    const result = await f.post(checkout("hold-000001", 1, priced.body.quoteHash));
    assert.equal(result.status, 409);
    assert.equal(f.data(`${root}/products/p1`).variants[0].stock, 5);
    assert.equal(f.data(`${root}/orders/POS-M-hold-000001`), null);
  } finally { f.restore(); }
});

test("takeaway checkout cannot begin until shared tables are explicitly initialized", async () => {
  const f = await fixture({ checkoutEnabled: true, tablesInitialized: false });
  try {
    const takeaway = { ...service, type: "takeaway", table: null };
    assert.equal((await f.post({ ...hold(), service: takeaway })).status, 200);
    const priced = await f.post(quote("hold-000001", 1));
    assert.equal(priced.status, 503);
    assert.equal(priced.body.error.code, "TABLES_UNAVAILABLE");
    assert.equal((await f.post(checkout("hold-000001", 1, "not-a-quote"))).body.error.code, "TABLES_UNAVAILABLE");
    assert.equal(f.data(`${root}/products/p1`).variants[0].stock, 5);
  } finally { f.restore(); }
});

test("tampered public tax projection or missing private snapshot fails closed", async () => {
  const f = await fixture({ checkoutEnabled: true });
  try {
    await f.post(hold());
    f.put(`${root}/settings/shared_config`, {
      revision: 1, privateRef: "fixture-config-ref", features: { tax: false }, taxPercent: 10, taxIncluded: false,
    });
    const tampered = await f.post(quote("hold-000001", 1));
    assert.equal(tampered.status, 503);
    assert.equal(tampered.body.error.code, "CONFIG_UNAVAILABLE");
    f.put(`${root}/settings/shared_config`, {
      revision: 1, privateRef: "missing-private-ref", features: { tax: true }, taxPercent: 10, taxIncluded: false,
    });
    const missing = await f.post(quote("hold-000001", 1));
    assert.equal(missing.status, 503);
    assert.equal(missing.body.error.code, "PRIVATE_SNAPSHOT_UNAVAILABLE");
    assert.equal(f.data(`${root}/products/p1`).variants[0].stock, 5);
    assert.equal(f.data(`${root}/orders/POS-M-hold-000001`), null);
  } finally { f.restore(); }
});

test("lost hold response replays private data without another commit and rejects changed intent", async () => {
  const f = await fixture();
  try {
    const command = { ...hold(), note: "private order note" };
    f.loseNextCommitResponse();
    assert.equal((await f.post(command)).status, 502);
    const recovered = await f.post(command);
    assert.equal(recovered.status, 200);
    assert.equal(recovered.body.replayed, true);
    assert.equal(recovered.body.hold.note, command.note);
    assert.equal(f.commits.length, 1);
    assert.equal(JSON.stringify(f.commits).includes(command.note), false);
    assert.equal((await f.post({ ...command, note: "changed" })).body.error.code, "REQUEST_ID_REUSED");
  } finally { f.restore(); }
});

test("missing or cross-tenant private snapshots fail closed", async () => {
  const f = await fixture();
  try {
    assert.equal((await f.post(hold())).status, 200);
    f.sqlite.prepare("UPDATE pos_private_snapshots SET store_id = ? WHERE store_id = ?").run("other-tenant", "restaurant-one");
    const list = await onRequestGet(f.request("GET"));
    assert.equal(list.status, 503);
    assert.equal((await list.json()).error.code, "PRIVATE_SNAPSHOT_UNAVAILABLE");
    const replay = await f.post(hold());
    assert.equal(replay.status, 503);
    assert.equal(replay.body.error.code, "PRIVATE_SNAPSHOT_UNAVAILABLE");
  } finally { f.restore(); }
});

test("legacy config insertion is a phantom despite verifying the old config document", async () => {
  const f = await fixture();
  try {
    const configPath = `${root}/orders/config1`;
    const updateTime = f.docs.get(configPath).updateTime;
    f.beforeNextCommit(() => f.put(`${root}/orders/config2`, {
      recordType: "store-config", features: { tax: true }, taxPercent: 99,
      createdAtIso: "2026-02-01T00:00:00Z",
    }));
    await commitFirestoreWrites([
      { path: configPath, verify: true, updateTime },
      { path: `${root}/pos_test_markers/phantom`, data: { marker: true }, create: true },
    ]);
    assert.equal(f.data(`${root}/orders/config2`).taxPercent, 99);
    assert.equal(f.data(`${root}/pos_test_markers/phantom`).marker, true);
    assert.equal((await f.post(quote("hold-000001", 1))).body.error.code, "CHECKOUT_UNAVAILABLE");
  } finally { f.restore(); }
});

test("revoked account during payment invalidates the atomic write", async () => {
  const f = await fixture({ checkoutEnabled: true });
  try {
    await f.post(hold());
    const priced = await f.post(quote("hold-000001", 1));
    f.beforeNextCommit(() => f.put(`${root}/settings/pos_users`, { users: [{ ...user, active: false }] }));
    const result = await f.post(checkout("hold-000001", 1, priced.body.quoteHash));
    assert.equal(result.status, 409);
    assert.equal(f.data(`${root}/products/p1`).variants[0].stock, 5);
    assert.equal(f.data(`${root}/orders/POS-M-hold-000001`), null);
  } finally { f.restore(); }
});

test("cancelling an open order releases its table and is idempotent", async () => {
  const f = await fixture();
  try {
    await f.post(hold());
    const command = { action: "cancel", requestId: "cancel-request-01", holdId: "hold-000001", revision: 1 };
    const result = await f.post(command);
    assert.equal(result.status, 200);
    assert.equal(f.data(`${root}/pos_mobile_tables/1`).holdId, "");
    assert.equal(f.data(`${root}/pos_mobile_holds/hold-000001`).status, "cancelled");
    assert.equal((await f.post(command)).body.replayed, true);
    assert.equal((await f.post(hold("hold-000002", "hold-request-0002"))).status, 200);
  } finally { f.restore(); }
});
