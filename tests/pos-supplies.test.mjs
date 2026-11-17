import test from "node:test";
import assert from "node:assert/strict";

import { onRequestGet, onRequestPost } from "../functions/api/pos-supplies.js";
import { createPosSessionToken, getPosUserAuthVersion } from "../functions/_lib/pos-session.js";
import { quantity } from "../functions/_lib/pos-supplies.js";

const AUTH_SECRET = "test-only-auth-secret-is-long-enough";

function encode(value) {
  if (value?.__firestoreTimestamp) return { timestampValue: value.__firestoreTimestamp };
  if (Array.isArray(value)) return { arrayValue: { values: value.map(encode) } };
  if (value && typeof value === "object") {
    return { mapValue: { fields: Object.fromEntries(Object.entries(value).map(([key, item]) => [key, encode(item)])) } };
  }
  if (typeof value === "boolean") return { booleanValue: value };
  if (typeof value === "number") return Number.isInteger(value) ? { integerValue: String(value) } : { doubleValue: value };
  if (value == null) return { nullValue: null };
  return { stringValue: String(value) };
}

function decode(value = {}) {
  if ("timestampValue" in value) return value.timestampValue;
  if ("stringValue" in value) return value.stringValue;
  if ("integerValue" in value) return Number(value.integerValue);
  if ("doubleValue" in value) return Number(value.doubleValue);
  if ("booleanValue" in value) return value.booleanValue;
  if ("nullValue" in value) return null;
  if (value.arrayValue) return (value.arrayValue.values || []).map(decode);
  if (value.mapValue) return decodeFields(value.mapValue.fields);
  return null;
}

function decodeFields(fields = {}) {
  return Object.fromEntries(Object.entries(fields).map(([key, value]) => [key, decode(value)]));
}

function document(data, update = 1) {
  return {
    updateTime: `2026-11-17T12:00:0${update}.000000Z`,
    fields: Object.fromEntries(Object.entries(data).map(([key, value]) => [key, encode(value)])),
  };
}

function firestoreMock(initial, { barrierPath = "" } = {}) {
  const documents = new Map(Object.entries(initial));
  let update = 10;
  const commits = [];
  let barrierReads = 0;
  let releaseBarrier;
  const barrier = new Promise((resolve) => { releaseBarrier = resolve; });
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input, options = {}) => {
    const url = new URL(input);
    if (url.pathname.endsWith(":commit")) {
      const payload = JSON.parse(options.body);
      commits.push(payload);
      for (const write of payload.writes) {
        const path = decodeURIComponent(write.update.name.split("/documents/")[1]);
        const current = documents.get(path);
        if (write.currentDocument?.exists === false && current) return new Response("{}", { status: 409 });
        if (write.currentDocument?.updateTime && current?.updateTime !== write.currentDocument.updateTime) {
          return new Response("{}", { status: 412 });
        }
      }
      for (const write of payload.writes) {
        const path = decodeURIComponent(write.update.name.split("/documents/")[1]);
        documents.set(path, { fields: write.update.fields, updateTime: `2026-11-17T12:01:${update++}.000000Z` });
      }
      return Response.json({ writeResults: [] });
    }

    const path = decodeURIComponent(url.pathname.split("/documents/")[1] || "");
    if (documents.has(path)) {
      if (path === barrierPath) {
        barrierReads += 1;
        if (barrierReads === 1) await barrier;
        else releaseBarrier();
      }
      return Response.json(documents.get(path));
    }
    const prefix = `${path}/`;
    const listed = [...documents.entries()]
      .filter(([key]) => key.startsWith(prefix) && !key.slice(prefix.length).includes("/"))
      .map(([key, value]) => ({
        name: `projects/test/databases/(default)/documents/${key}`,
        ...value,
      }));
    if (listed.length || path.endsWith("pos_supplies") || path.endsWith("pos_supply_audit")) {
      if (url.searchParams.get("orderBy") === "timestamp desc") {
        listed.sort((a, b) => String(decodeFields(b.fields).timestamp).localeCompare(String(decodeFields(a.fields).timestamp)));
      }
      const pageSize = Number(url.searchParams.get("pageSize") || 100);
      const offset = Number(url.searchParams.get("pageToken") || 0);
      return Response.json({
        documents: listed.slice(offset, offset + pageSize),
        ...(listed.length > offset + pageSize ? { nextPageToken: String(offset + pageSize) } : {}),
      });
    }
    return new Response("", { status: 404 });
  };
  return {
    documents,
    commits,
    restore() { globalThis.fetch = originalFetch; },
    data(path) { return decodeFields(documents.get(path)?.fields); },
  };
}

async function fixture({ storeId = "restaurant-one", role = "worker", businessType = "restaurant" } = {}) {
  const user = { username: role, role, active: true, passwordHash: "hash", passwordSalt: "salt", passwordVersion: 1 };
  const token = await createPosSessionToken(AUTH_SECRET, {
    storeId,
    username: user.username,
    role,
    productType: "business",
    authVersion: await getPosUserAuthVersion(AUTH_SECRET, user),
    exp: Math.floor(Date.now() / 1000) + 3600,
  });
  const mock = firestoreMock({
    "projects/_global/settings/pos_stores": document({ stores: [{ id: storeId, productType: "business" }] }),
    [`projects/${storeId}/settings/pos`]: document({ warrantyEnd: "2099-01-01T00:00:00Z", businessType }),
    [`projects/${storeId}/settings/pos_users`]: document({ users: [user] }),
  });
  const env = {
    AUTH_SECRET,
    DB: {
      prepare() {
        return {
          bind() { return this; },
          async first() { return { count: 1 }; },
        };
      },
    },
  };
  function request(method, payload, query = "") {
    return {
      env,
      request: new Request(`https://rts.example/api/pos-supplies${query}`, {
        method,
        headers: {
          Authorization: `Bearer ${token}`,
          Origin: "https://rts.example",
          "Content-Type": "application/json",
        },
        ...(payload ? { body: JSON.stringify(payload) } : {}),
      }),
    };
  }
  return { mock, request };
}

test("quantities use bounded exact milli-units", () => {
  assert.equal(quantity.parse("999999.999"), 999999999);
  assert.equal(quantity.format(quantity.parse("12.340")), "12.34");
  assert.throws(() => quantity.parse("1.0001"), /3 decimal/);
  assert.throws(() => quantity.parse("-1"), /3 decimal/);
});

test("restaurant worker creates, consumes, receives low-stock state and idempotent audit identity", async () => {
  const { mock, request } = await fixture();
  try {
    let response = await onRequestPost(request("POST", {
      action: "create",
      requestId: "create-ketchup-001",
      name: "كاتشب",
      category: "صلصات",
      unit: "زجاجة",
      quantity: "5",
      lowStockThreshold: "2",
    }));
    assert.equal(response.status, 201);
    const created = await response.json();
    assert.equal(created.item.quantity, "5");
    assert.equal(created.item.lowStock, false);
    assert.equal(created.audit.actor, "worker");
    assert.equal(created.audit.actorRole, "worker");
    assert.match(created.audit.timestamp, /^\d{4}-/);

    response = await onRequestPost(request("POST", {
      action: "use",
      requestId: "use-ketchup-0001",
      itemId: created.item.id,
      quantity: "3",
    }));
    assert.equal(response.status, 200);
    const used = await response.json();
    assert.equal(used.item.quantity, "2");
    assert.equal(used.item.lowStock, true, "threshold is inclusive");
    assert.equal(used.audit.beforeQuantity, "5");
    assert.equal(used.audit.afterQuantity, "2");
    assert.equal(used.audit.quantity, "3");

    const commitCount = mock.commits.length;
    response = await onRequestPost(request("POST", {
      action: "use",
      requestId: "use-ketchup-0001",
      itemId: created.item.id,
      quantity: "3",
    }));
    const replay = await response.json();
    assert.equal(replay.replayed, true);
    assert.equal(replay.item.quantity, "2");
    assert.equal(mock.commits.length, commitCount, "retry must not decrement or append audit twice");

    response = await onRequestGet(request("GET", null, "?auditLimit=1"));
    const listed = await response.json();
    assert.equal(listed.items.length, 1);
    assert.equal(listed.items[0].quantity, "2");
    assert.equal(listed.audit.length, 1);
    assert.ok(listed.auditCursor, "bounded audit listing exposes an opaque cursor");
    const next = await onRequestGet(request("GET", null, `?auditLimit=1&auditCursor=${listed.auditCursor}`));
    assert.equal((await next.json()).audit.length, 1);
  } finally {
    mock.restore();
  }
});

test("adjustment and threshold updates are audited while overspend and invalid precision are rejected", async () => {
  const { mock, request } = await fixture({ role: "admin" });
  try {
    const created = await (await onRequestPost(request("POST", {
      action: "create", requestId: "create-flour-001", name: "طحين", category: "مخبوزات",
      unit: "كغ", quantity: "1.25", lowStockThreshold: "0.5",
    }))).json();
    let response = await onRequestPost(request("POST", {
      action: "adjust", requestId: "adjust-flour-01", itemId: created.item.id, quantity: "2.125",
    }));
    assert.equal((await response.json()).item.quantity, "2.125");
    response = await onRequestPost(request("POST", {
      action: "threshold", requestId: "threshold-flour", itemId: created.item.id, lowStockThreshold: "2.125",
    }));
    assert.equal((await response.json()).item.lowStock, true);
    response = await onRequestPost(request("POST", {
      action: "use", requestId: "overspend-flour1", itemId: created.item.id, quantity: "2.126",
    }));
    assert.equal(response.status, 409);
    assert.equal((await response.json()).error.code, "INSUFFICIENT_SUPPLY_STOCK");
    response = await onRequestPost(request("POST", {
      action: "use", requestId: "precision-flour1", itemId: created.item.id, quantity: "0.0001",
    }));
    assert.equal(response.status, 400);
    assert.equal(mock.commits.length, 3);
  } finally {
    mock.restore();
  }
});

test("authorization enforces restaurant mode, current account version, and token tenant scope", async () => {
  const shop = await fixture({ businessType: "shop" });
  try {
    const response = await onRequestGet(shop.request("GET"));
    assert.equal(response.status, 403);
    assert.equal((await response.json()).error.code, "RESTAURANT_SUPPLIES_FORBIDDEN");
  } finally {
    shop.mock.restore();
  }

  const restaurant = await fixture({ storeId: "tenant-a" });
  try {
    restaurant.mock.documents.set("projects/tenant-b/pos_supplies/private", document({
      name: "Private", category: "Secret", unit: "unit", quantityMilli: 1000, lowStockMilli: 0,
    }));
    let response = await onRequestGet(restaurant.request("GET"));
    assert.equal((await response.json()).items.length, 0, "another tenant's items must never be listed");
    const users = restaurant.mock.data("projects/tenant-a/settings/pos_users").users;
    users[0].passwordVersion = 2;
    restaurant.mock.documents.set("projects/tenant-a/settings/pos_users", document({ users }, 2));
    response = await onRequestGet(restaurant.request("GET"));
    assert.equal(response.status, 401);
  } finally {
    restaurant.mock.restore();
  }
});

test("concurrent consumption uses conditional atomic writes instead of overspending stock", async () => {
  const storeId = "concurrent-store";
  const user = { username: "worker", role: "worker", active: true, passwordHash: "hash", passwordSalt: "salt", passwordVersion: 1 };
  const itemId = "supply_item_01";
  const itemDocumentPath = `projects/${storeId}/pos_supplies/${itemId}`;
  const token = await createPosSessionToken(AUTH_SECRET, {
    storeId, username: user.username, role: user.role, productType: "business",
    authVersion: await getPosUserAuthVersion(AUTH_SECRET, user),
    exp: Math.floor(Date.now() / 1000) + 3600,
  });
  const mock = firestoreMock({
    "projects/_global/settings/pos_stores": document({ stores: [{ id: storeId, productType: "business" }] }),
    [`projects/${storeId}/settings/pos`]: document({ warrantyEnd: "2099-01-01T00:00:00Z", businessType: "restaurant" }),
    [`projects/${storeId}/settings/pos_users`]: document({ users: [user] }),
    [itemDocumentPath]: document({
      name: "Milk", category: "Dairy", unit: "bottle", quantityMilli: 2000, lowStockMilli: 0,
      createdAt: "2026-11-17T10:00:00.000Z", createdBy: "worker", updatedAt: "2026-11-17T10:00:00.000Z", updatedBy: "worker",
    }),
  }, { barrierPath: itemDocumentPath });
  const env = {
    AUTH_SECRET,
    DB: { prepare() { return { bind() { return this; }, async first() { return { count: 1 }; } }; } },
  };
  function consume(requestId) {
    return onRequestPost({
      env,
      request: new Request("https://rts.example/api/pos-supplies", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, Origin: "https://rts.example", "Content-Type": "application/json" },
        body: JSON.stringify({ action: "use", requestId, itemId, quantity: "1" }),
      }),
    });
  }
  try {
    const responses = await Promise.all([consume("concurrent-use-01"), consume("concurrent-use-02")]);
    assert.deepEqual(responses.map((response) => response.status).sort(), [200, 409]);
    assert.equal(mock.data(itemDocumentPath).quantityMilli, 1000);
    const errors = await Promise.all(responses.filter((response) => response.status === 409).map((response) => response.json()));
    assert.equal(errors[0].error.code, "SUPPLY_CONFLICT");
  } finally {
    mock.restore();
  }
});

test("low-stock outbox is atomic, transition-only, correlated to audit, and idempotent", async () => {
  const { mock, request } = await fixture();
  const alerts = () => [...mock.documents.entries()]
    .filter(([path]) => path.includes("/pos_supply_alerts/"))
    .map(([, value]) => decodeFields(value.fields));
  try {
    const created = await (await onRequestPost(request("POST", {
      action: "create", requestId: "alert-create-item", name: "Oil", category: "Kitchen",
      unit: "bottle", quantity: "5", lowStockThreshold: "2",
    }))).json();
    assert.equal(alerts().length, 0);

    const low = await (await onRequestPost(request("POST", {
      action: "use", requestId: "alert-first-cross", itemId: created.item.id, quantity: "3",
    }))).json();
    assert.equal(alerts().length, 1);
    assert.deepEqual(alerts()[0], {
      eventId: low.audit.id,
      type: "supply.low_stock",
      itemId: created.item.id,
      itemName: "Oil",
      unit: "bottle",
      quantity: "2",
      lowStockThreshold: "2",
      actor: "worker",
      actorRole: "worker",
      timestamp: low.audit.timestamp,
      status: "pending",
      attempts: 0,
    });
    const crossingCommit = mock.commits.find((commit) =>
      commit.writes.some((write) => write.update.name.endsWith(`/pos_supply_alerts/${low.audit.id}`))
    );
    assert.ok(crossingCommit);
    assert.equal(crossingCommit.writes.length, 4, "item, audit, idempotency, and alert must share one commit");

    await onRequestPost(request("POST", {
      action: "threshold", requestId: "alert-still-low-01", itemId: created.item.id, lowStockThreshold: "3",
    }));
    assert.equal(alerts().length, 1, "mutations while already low must not spam the outbox");

    await onRequestPost(request("POST", {
      action: "adjust", requestId: "alert-restock-001", itemId: created.item.id, quantity: "6",
    }));
    assert.equal(alerts().length, 1);
    const second = await (await onRequestPost(request("POST", {
      action: "use", requestId: "alert-second-cross", itemId: created.item.id, quantity: "3",
    }))).json();
    assert.equal(second.item.quantity, "3");
    assert.equal(alerts().length, 2, "restock above threshold permits a later transition event");

    await onRequestPost(request("POST", {
      action: "use", requestId: "alert-second-cross", itemId: created.item.id, quantity: "3",
    }));
    assert.equal(alerts().length, 2, "idempotent replay must not create another event");
  } finally {
    mock.restore();
  }
});

test("creating an item already at or below threshold emits one outbox event", async () => {
  const { mock, request } = await fixture({ role: "admin" });
  try {
    const response = await onRequestPost(request("POST", {
      action: "create", requestId: "alert-create-low1", name: "Salt", category: "Kitchen",
      unit: "kg", quantity: "1", lowStockThreshold: "1",
    }));
    assert.equal(response.status, 201);
    const body = await response.json();
    const alert = [...mock.documents.entries()].find(([path]) => path.includes("/pos_supply_alerts/"));
    assert.ok(alert);
    assert.equal(decodeFields(alert[1].fields).eventId, body.audit.id);
  } finally {
    mock.restore();
  }
});

test("successful non-replayed mutations schedule dispatch once and replay does not reschedule", async () => {
  const { mock, request } = await fixture();
  const scheduled = [];
  try {
    const context = request("POST", {
      action: "create", requestId: "push-hook-create", name: "Napkins", category: "Dining",
      unit: "pack", quantity: "0", lowStockThreshold: "1",
    });
    context.waitUntil = (promise) => scheduled.push(promise);
    let response = await onRequestPost(context);
    assert.equal(response.status, 201);
    assert.equal(scheduled.length, 1);
    await Promise.all(scheduled);

    const replayContext = request("POST", {
      action: "create", requestId: "push-hook-create", name: "Napkins", category: "Dining",
      unit: "pack", quantity: "0", lowStockThreshold: "1",
    });
    replayContext.waitUntil = (promise) => scheduled.push(promise);
    response = await onRequestPost(replayContext);
    assert.equal((await response.json()).replayed, true);
    assert.equal(scheduled.length, 1);
  } finally {
    mock.restore();
  }
});
