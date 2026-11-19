import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

const source = await readFile(new URL("../public/business-mobile/mobile.js", import.meta.url), "utf8");
const html = await readFile(new URL("../public/business-mobile/index.html", import.meta.url), "utf8");
const downloadPage = await readFile(new URL("../public/download-business/index.html", import.meta.url), "utf8");
const updateManifest = JSON.parse(await readFile(new URL("../public/business-mobile/android-version.json", import.meta.url), "utf8"));

test("Android download surface exposes a validated update manifest", () => {
  assert.equal(updateManifest.versionCode, 1);
  assert.match(updateManifest.versionName, /^\d+\.\d+\.\d+$/);
  assert.equal(updateManifest.apkUrl, "/download/rts-business-android");
  assert.match(html, /id="check-update"/);
  assert.match(downloadPage, /href="\/download\/rts-business-android"/);
});

function fixture(fetch, { failStorage = false } = {}) {
  const makeElement = () => ({
    value: "", hidden: false, disabled: false, textContent: "", children: [], dataset: {},
    addEventListener() {}, setAttribute() {}, removeAttribute() {}, reset() {},
    append(...children) { this.children.push(...children); },
    replaceChildren(...children) { this.children = children; },
    querySelectorAll() { return []; }, querySelector() { return makeElement(); },
  });
  const elements = new Map([...html.matchAll(/\bid="([^"]+)"/g)].map(([, id]) => [id, makeElement()]));
  const formFields = Object.fromEntries(["type", "table", "customerName", "phone", "address", "deliveryFee", "note"].map((name) => [name, makeElement()]));
  formFields.type.value = "takeaway";
  elements.get("order-form").elements = formFields;
  const values = new Map();
  const storage = {
    getItem(key) { return values.get(key) ?? null; },
    setItem(key, value) { if (failStorage) throw new Error("storage unavailable"); values.set(key, String(value)); },
    removeItem(key) { values.delete(key); },
  };
  const context = vm.createContext({
    fetch, Response, console, crypto, structuredClone,
    localStorage: storage, navigator: { onLine: true },
    setInterval() {}, FormData: class {},
    window: { addEventListener() {}, confirm() { return true; }, prompt() { return null; } },
    document: {
      hidden: false, getElementById(id) { return elements.get(id) || null; },
      querySelectorAll() { return []; }, createElement() { return makeElement(); },
    },
  });
  const patched = source.replace(/\}\)\(\);\s*$/, "globalThis.__mobileTest = { state, api, reset, restorePending, sendCheckout, sendHold, sendSetup, previewConfig, previewTables, checkoutReady, submitSupply };})();");
  assert.notEqual(patched, source);
  vm.runInContext(patched, context);
  return { app: context.__mobileTest, elements, values };
}
function signIn(f) {
  Object.assign(f.app.state, {
    token: "fixture-token", user: { username: "worker", role: "worker" },
    storeId: "restaurant-one", restaurant: true, generation: 1, configConfigured: true, tablesConfigured: true,
  });
}
const command = {
  action: "checkout", requestId: "checkout-request-1", holdId: "hold-000001",
  revision: 1, quoteHash: "fixture-hash", paymentMethod: "cash",
};
const bill = {
  billNumber: "POS-M-hold-000001", items: [{ name: "وجبة", qty: 1, total: 10 }],
  subtotal: 10, deliveryFee: 0, taxRate: 0, taxAmount: 0, total: 10, paymentMethod: "cash",
};

test("mobile checkout retains identical pending request after lost response and restores it on replay", async () => {
  const requests = [];
  let first = true;
  const f = fixture(async (path, options = {}) => {
    if (path === "/api/pos-mobile-orders" && options.method === "POST") {
      requests.push(options.body);
      if (first) { first = false; throw new Error("response lost"); }
      return Response.json({ ok: true, replayed: true, bill });
    }
    if (path === "/api/pos-mobile-orders") return Response.json({ holds: [] });
    if (path === "/api/pos-mobile") return Response.json({ products: [], cursor: null, businessType: "shop" });
    throw new Error(`unexpected ${path}`);
  });
  signIn(f);
  await f.app.sendCheckout(command);
  assert.equal(f.app.state.pendingCheckout.requestId, command.requestId);
  assert.ok(f.values.has("rts-pending-checkout:restaurant-one:worker"));
  await f.app.sendCheckout(f.app.state.pendingCheckout);
  assert.equal(requests.length, 2);
  assert.equal(requests[0], requests[1]);
  assert.equal(f.app.state.pendingCheckout, null);
  assert.equal(f.values.size, 0);
  assert.match(f.elements.get("receipt").textContent, /POS-M-hold-000001/);
});

test("stale tenant response is rejected after logout and account switch", async () => {
  let finish;
  const f = fixture(() => new Promise((resolve) => { finish = resolve; }));
  signIn(f);
  const pending = f.app.api("/api/pos-mobile");
  f.app.reset();
  Object.assign(f.app.state, { token: "new-token", user: { username: "other" }, storeId: "store-two" });
  finish(Response.json({ products: [{ name: "tenant-one-private" }] }));
  await assert.rejects(pending, (error) => error.code === "STALE_SESSION");
  assert.equal(f.app.state.storeId, "store-two");
  assert.equal(f.elements.get("products").children.length, 0);
});

test("successful supply mutation with failed refresh is not presented as an uncertain retry", async () => {
  const f = fixture(async (path, options = {}) => {
    if (path === "/api/pos-supplies" && options.method === "POST") return Response.json({ ok: true });
    throw new Error("refresh unavailable");
  });
  signIn(f);
  await f.app.submitSupply({ action: "use", itemId: "item-one", quantity: "1", requestId: "request-0001" });
  assert.equal(f.app.state.pending, null);
  assert.match(f.elements.get("notice").textContent, /تم حفظ العملية/);
  assert.doesNotMatch(f.elements.get("notice").textContent, /تعذر تأكيد الحفظ/);
});

test("configuration requires an exact preview and never initializes after preview limit", async () => {
  const f = fixture(async (path) => {
    if (path === "/api/pos-shared-config?preview=1") {
      return Response.json({ error: { code: "CONFIG_PREVIEW_LIMIT", message: "Too many" } }, { status: 409 });
    }
    assert.equal(path, "/api/pos-shared-config?preview=1&sourceId=legacy-one");
    return Response.json({ sourceId: "legacy-one", sourceRevision: "revision-1", config: { taxPercent: 17 } });
  });
  signIn(f); f.app.state.user.role = "admin";
  await assert.rejects(f.app.previewConfig(), (error) => error.code === "CONFIG_PREVIEW_LIMIT");
  assert.equal(f.app.state.noLegacyConfig, false);
  assert.equal(f.elements.get("cutover-config").disabled, true);
  await f.app.previewConfig("legacy-one");
  assert.equal(f.app.state.configPreview.sourceId, "legacy-one");
  assert.equal(f.app.state.configPreview.sourceRevision, "revision-1");
  assert.equal(f.elements.get("cutover-config").disabled, false);
});

test("table import is explicit and takes an independent preview snapshot", () => {
  const f = fixture(async () => { throw new Error("unexpected network"); });
  signIn(f); f.app.state.user.role = "admin";
  const tables = [{ id: 1, name: "Inside", archived: false }];
  f.app.previewTables(tables);
  tables[0].name = "Modified later";
  assert.equal(f.app.state.tablesPreview[0].name, "Inside");
  assert.match(f.elements.get("tables-preview").textContent, /Inside/);
  assert.throws(() => f.app.previewTables([{ id: -1, name: "Invalid", archived: false }]));
});

test("uncertain setup is retried with the identical payload after logout", async () => {
  let first = true;
  const requests = [];
  const f = fixture(async (path, options = {}) => {
    if (options.method === "POST") {
      requests.push(options.body);
      if (first) { first = false; throw new Error("response lost"); }
      return Response.json({ ok: true, replayed: true });
    }
    if (path === "/api/pos-shared-config") return Response.json({ configured: true });
    if (path === "/api/pos-restaurant-tables") return Response.json({ configured: true, tables: [] });
    throw new Error(`unexpected ${path}`);
  });
  signIn(f); f.app.state.user.role = "admin";
  const payload = { action: "cutover", requestId: "setup-request-1", sourceId: "legacy-one", sourceRevision: "revision-1" };
  await assert.rejects(f.app.sendSetup("/api/pos-shared-config", payload));
  f.app.reset(); signIn(f); f.app.state.user.role = "admin"; f.app.restorePending();
  assert.equal(f.app.state.pendingSetup.payload.requestId, payload.requestId);
  await f.app.sendSetup(f.app.state.pendingSetup.path, f.app.state.pendingSetup.payload);
  assert.deepEqual(requests, [requests[0], requests[0]]);
  assert.equal(f.app.state.pendingSetup, null);
  assert.equal(f.values.size, 0);
});

test("stale hold response leaves original tenant retry intact and cannot update a new session", async () => {
  let finish;
  const requests = [];
  const payload = { action: "hold", requestId: "hold-request-1", holdId: "hold-000001", revision: 0,
    items: [{ productId: "p1", qty: 1 }], service: { type: "takeaway", customerName: "Private" } };
  const hold = { id: payload.holdId, revision: 1, items: payload.items, service: payload.service };
  const f = fixture(async (path, options = {}) => {
    if (options.method === "POST") {
      requests.push(options.body);
      if (requests.length === 1) return new Promise((resolve) => { finish = resolve; });
      return Response.json({ ok: true, replayed: true, hold });
    }
    if (path === "/api/pos-mobile-orders") return Response.json({ holds: [] });
    throw new Error(`unexpected ${path}`);
  });
  signIn(f);
  const pending = f.app.sendHold(payload);
  f.app.reset();
  Object.assign(f.app.state, { token: "other-token", user: { username: "other", role: "worker" }, storeId: "other-store", restaurant: true });
  finish(Response.json({ ok: true, hold }));
  await assert.rejects(pending, (error) => error.code === "STALE_SESSION");
  assert.equal(f.app.state.pendingHold, null);
  assert.ok(f.values.has("rts-pending-hold:restaurant-one:worker"));
  f.app.reset(); signIn(f); f.app.restorePending();
  await f.app.sendHold(f.app.state.pendingHold);
  assert.equal(requests[0], requests[1]);
  assert.equal(f.app.state.pendingHold, null);
  assert.equal(f.values.size, 0);
});

test("new checkout is blocked without shared setup but an existing pending request can retry", async () => {
  let requests = 0;
  const f = fixture(async (path, options = {}) => {
    if (options.method === "POST") { requests++; return Response.json({ ok: true, replayed: true, bill }); }
    if (path === "/api/pos-mobile-orders") return Response.json({ holds: [] });
    if (path === "/api/pos-mobile") return Response.json({ products: [], cursor: null, businessType: "shop" });
    throw new Error(`unexpected ${path}`);
  });
  signIn(f); f.app.state.tablesConfigured = false;
  assert.equal(f.app.checkoutReady(), false);
  await f.app.sendCheckout(command);
  assert.equal(requests, 0);
  f.app.state.pendingCheckout = command;
  await f.app.sendCheckout(command);
  assert.equal(requests, 1);
});

test("mutations are never sent when a retry intent cannot be persisted", async () => {
  let requests = 0;
  const f = fixture(async () => { requests++; throw new Error("unexpected network"); }, { failStorage: true });
  signIn(f); f.app.state.user.role = "admin";
  await f.app.sendCheckout(command);
  assert.match(f.elements.get("notice").textContent, /لم يُرسل الدفع/);
  await assert.rejects(f.app.sendHold({ action: "hold", requestId: "hold-request-1", holdId: "hold-000001" }));
  await assert.rejects(f.app.sendSetup("/api/pos-shared-config", { action: "cutover", requestId: "setup-request-1" }));
  assert.equal(requests, 0);
});

test("confirmed hold with failed refresh is not kept as an uncertain retry", async () => {
  const f = fixture(async (path, options = {}) => {
    if (options.method === "POST") return Response.json({ ok: true, hold: {
      id: "hold-000001", revision: 1, items: [], service: { type: "takeaway" },
    } });
    throw new Error("refresh unavailable");
  });
  signIn(f);
  await f.app.sendHold({ action: "hold", requestId: "hold-request-1", holdId: "hold-000001" });
  assert.equal(f.app.state.pendingHold, null);
  assert.match(f.elements.get("notice").textContent, /تم حفظ العملية/);
});
