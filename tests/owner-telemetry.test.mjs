import test from "node:test";
import assert from "node:assert/strict";

import { onRequestPost as ingestTelemetry } from "../functions/api/owner-telemetry.js";
import { createPosSessionToken } from "../functions/_lib/pos-session.js";

const SECRET = "test-only-auth-secret-is-long-enough";

function firestoreValue(value) {
  if (Array.isArray(value)) return { arrayValue: { values: value.map(firestoreValue) } };
  if (value && typeof value === "object") {
    return {
      mapValue: {
        fields: Object.fromEntries(Object.entries(value).map(([key, item]) => [key, firestoreValue(item)])),
      },
    };
  }
  if (typeof value === "boolean") return { booleanValue: value };
  if (typeof value === "number") {
    return Number.isInteger(value) ? { integerValue: String(value) } : { doubleValue: value };
  }
  return { stringValue: String(value) };
}

function firestoreDocument(data, updateTime = "2026-10-11T00:00:00.000000Z") {
  return {
    updateTime,
    fields: Object.fromEntries(Object.entries(data).map(([key, value]) => [key, firestoreValue(value)])),
  };
}

function database() {
  return {
    prepare(sql) {
      return {
        bind() {
          return this;
        },
        async first() {
          assert.match(sql, /RETURNING count/);
          return { count: 1 };
        },
      };
    },
  };
}

function useFirestoreMock(documents, { conflictOnce = false } = {}) {
  const originalFetch = globalThis.fetch;
  const patches = [];
  let conflicted = false;
  globalThis.fetch = async (input, options = {}) => {
    const url = new URL(input);
    const path = decodeURIComponent(url.pathname.split("/documents/")[1] || "");
    if (options.method === "PATCH") {
      const body = JSON.parse(options.body);
      patches.push({
        path,
        body,
        updateTime: url.searchParams.get("currentDocument.updateTime"),
        updateMask: url.searchParams.getAll("updateMask.fieldPaths"),
      });
      if (conflictOnce && !conflicted) {
        conflicted = true;
        documents[path] = {
          ...documents[path],
          updateTime: "2026-10-11T00:00:01.000000Z",
        };
        return new Response("", { status: 412 });
      }
      const next = {
        updateTime: "2026-10-11T00:00:02.000000Z",
        fields: {
          ...(documents[path]?.fields || {}),
          ...body.fields,
        },
      };
      documents[path] = next;
      return new Response(JSON.stringify(next), { status: 200 });
    }
    const document = documents[path];
    return document
      ? new Response(JSON.stringify(document), { status: 200 })
      : new Response("", { status: 404 });
  };
  return {
    patches,
    restore() {
      globalThis.fetch = originalFetch;
    },
  };
}

async function tokenFor(overrides = {}) {
  return createPosSessionToken(SECRET, {
    storeId: "store-a",
    username: "operator",
    role: "admin",
    productType: "business",
    exp: Math.floor(Date.now() / 1000) + 3600,
    ...overrides,
  });
}

function payload(overrides = {}) {
  return {
    generatedAt: new Date().toISOString(),
    appVersion: "4.2.1",
    metrics: {
      salesToday: 1250.5,
      ordersToday: 12,
      databaseHealthy: true,
    },
    eventCounters: {
      auditEvents: 8,
      salesCompleted: 12,
    },
    ...overrides,
  };
}

function request(token, body) {
  return new Request("https://rts.example.com/api/owner-telemetry", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

function authorizedDocuments(store = {
  id: "store-a",
  productType: "business",
  type: "firestore",
}) {
  return {
    "projects/_global/settings/pos_stores": firestoreDocument({ stores: [store] }),
    [`projects/${store.id}/settings/pos`]: firestoreDocument({
      warrantyEnd: "2030-01-01T00:00:00.000Z",
      productType: store.productType,
      unrelatedSetting: true,
    }),
    [`projects/${store.id}/settings/pos_users`]: firestoreDocument({
      users: [{ username: "operator", role: "admin", active: true }],
    }),
  };
}

test("telemetry uses only token tenant claims and conditionally patches that licence", async () => {
  const documents = authorizedDocuments();
  const mock = useFirestoreMock(documents, { conflictOnce: true });
  try {
    const token = await tokenFor();
    const response = await ingestTelemetry({
      request: request(token, payload()),
      env: { AUTH_SECRET: SECRET, DB: database() },
    });
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("X-Content-Type-Options"), "nosniff");
    assert.equal(response.headers.get("Cache-Control"), "no-store, max-age=0");
    assert.equal(mock.patches.length, 2);
    assert.deepEqual(mock.patches.map((item) => item.path), [
      "projects/store-a/settings/pos",
      "projects/store-a/settings/pos",
    ]);
    assert.deepEqual(mock.patches.map((item) => item.updateTime), [
      "2026-10-11T00:00:00.000000Z",
      "2026-10-11T00:00:01.000000Z",
    ]);
    assert.deepEqual(mock.patches[1].updateMask, ["telemetry"]);
    const telemetry = mock.patches[1].body.fields.telemetry.mapValue.fields;
    assert.equal(telemetry.productType.stringValue, "business");
    assert.equal(telemetry.source.stringValue, "rts-business-pos");
    assert.equal(telemetry.metrics.mapValue.fields.salesToday.doubleValue, 1250.5);
    assert.equal(telemetry.eventCounters.mapValue.fields.auditEvents.integerValue, "8");

    const isolationResponse = await ingestTelemetry({
      request: request(token, { ...payload(), storeId: "store-b" }),
      env: { AUTH_SECRET: SECRET, DB: database() },
    });
    assert.equal(isolationResponse.status, 400);
    assert.equal((await isolationResponse.json()).error.code, "UNKNOWN_FIELDS");
    assert.equal(mock.patches.some((item) => item.path.includes("store-b")), false);
  } finally {
    mock.restore();
  }
});

test("telemetry rejects a signed token whose product no longer matches the store", async () => {
  const store = { id: "clinic-a", productType: "clinic", type: "clinic" };
  const documents = authorizedDocuments(store);
  const mock = useFirestoreMock(documents);
  try {
    const token = await tokenFor({ storeId: "clinic-a", productType: "business" });
    const response = await ingestTelemetry({
      request: request(token, payload()),
      env: { AUTH_SECRET: SECRET, DB: database() },
    });
    assert.equal(response.status, 403);
    assert.equal((await response.json()).error.code, "POS_PRODUCT_MISMATCH");
    assert.equal(mock.patches.length, 0);
  } finally {
    mock.restore();
  }
});

test("telemetry rejects PHI, free text, product names, bill IDs, notes, and raw audit data", async () => {
  const documents = authorizedDocuments();
  const mock = useFirestoreMock(documents);
  try {
    const token = await tokenFor();
    const unsafePayloads = [
      { ...payload(), patientName: "Sensitive Patient" },
      { ...payload(), productName: "Private Product" },
      { ...payload(), billId: "BILL-123" },
      { ...payload(), notes: "Customer asked for a callback" },
      { ...payload(), rawAuditEntries: [{ action: "sale", actor: "private.user" }] },
      payload({ metrics: { salesToday: "Sensitive free text" } }),
      payload({ eventCounters: { auditEvents: "Sensitive free text" } }),
      payload({ metrics: { appointmentsToday: 3 } }),
    ];
    for (const unsafe of unsafePayloads) {
      const response = await ingestTelemetry({
        request: request(token, unsafe),
        env: { AUTH_SECRET: SECRET, DB: database() },
      });
      assert.equal(response.status, 400);
    }
    assert.equal(mock.patches.length, 0);
  } finally {
    mock.restore();
  }
});

test("telemetry enforces timestamp freshness and payload size limits", async () => {
  const documents = authorizedDocuments();
  const mock = useFirestoreMock(documents);
  try {
    const token = await tokenFor();
    const stale = await ingestTelemetry({
      request: request(token, payload({
        generatedAt: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
      })),
      env: { AUTH_SECRET: SECRET, DB: database() },
    });
    assert.equal(stale.status, 409);
    assert.equal((await stale.json()).error.code, "STALE_TELEMETRY");

    const oversized = await ingestTelemetry({
      request: request(token, JSON.stringify({
        ...payload(),
        unsupported: "x".repeat(5000),
      })),
      env: { AUTH_SECRET: SECRET, DB: database() },
    });
    assert.equal(oversized.status, 413);
    assert.equal((await oversized.json()).error.code, "PAYLOAD_TOO_LARGE");
    assert.equal(mock.patches.length, 0);
  } finally {
    mock.restore();
  }
});
