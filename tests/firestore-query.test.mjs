import test from "node:test";
import assert from "node:assert/strict";

import { ApiError } from "../functions/_lib/http.js";
import { queryFirestoreDocuments } from "../functions/_lib/firestore.js";

test("bounded Firestore query encodes filters and decodes document paths and values", async () => {
  const originalFetch = globalThis.fetch;
  let captured;
  globalThis.fetch = async (input, options) => {
    captured = { url: new URL(input), options, body: JSON.parse(options.body) };
    return Response.json([
      {
        document: {
          name: "projects/dimaboutique-b4f16/databases/(default)/documents/projects/store-one/pos_supply_alerts/event-1",
          updateTime: "2026-11-17T13:00:00.000000Z",
          fields: {
            status: { stringValue: "pending" },
            attempts: { integerValue: "2" },
            active: { booleanValue: true },
            metadata: { mapValue: { fields: { type: { stringValue: "supply.low_stock" } } } },
          },
        },
      },
      { readTime: "2026-11-17T13:00:01.000000Z" },
    ]);
  };
  try {
    const result = await queryFirestoreDocuments({
      parentPath: "projects/store-one",
      collectionId: "pos_supply_alerts",
      fieldFilters: [{ field: "status", op: "EQUAL", value: "pending" }],
      limit: 100,
    });
    assert.equal(captured.url.pathname.endsWith("/documents/projects/store-one:runQuery"), true);
    assert.equal(captured.options.method, "POST");
    assert.deepEqual(captured.body, {
      structuredQuery: {
        from: [{ collectionId: "pos_supply_alerts" }],
        where: {
          fieldFilter: {
            field: { fieldPath: "status" },
            op: "EQUAL",
            value: { stringValue: "pending" },
          },
        },
        limit: 100,
      },
    });
    assert.deepEqual(result, {
      documents: [{
        path: "projects/store-one/pos_supply_alerts/event-1",
        id: "event-1",
        data: {
          status: "pending",
          attempts: 2,
          active: true,
          metadata: { type: "supply.low_stock" },
        },
        updateTime: "2026-11-17T13:00:00.000000Z",
      }],
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("Firestore query maps transport and service failures without leaking response details", async () => {
  const originalFetch = globalThis.fetch;
  try {
    globalThis.fetch = async () => { throw new Error("network detail"); };
    await assert.rejects(
      () => queryFirestoreDocuments({
        parentPath: "projects/store-one",
        collectionId: "pos_supply_alerts",
        fieldFilters: [{ field: "status", op: "EQUAL", value: "processing" }],
        limit: 50,
      }),
      (error) => error instanceof ApiError
        && error.status === 502
        && error.code === "POS_REGISTRY_UNAVAILABLE"
        && !error.message.includes("network detail")
    );

    globalThis.fetch = async () => new Response('{"private":"detail"}', { status: 500 });
    await assert.rejects(
      () => queryFirestoreDocuments({
        parentPath: "projects/store-one",
        collectionId: "pos_supply_alerts",
        fieldFilters: [{ field: "status", op: "EQUAL", value: "processing" }],
        limit: 50,
      }),
      (error) => error instanceof ApiError
        && error.status === 502
        && error.code === "POS_REGISTRY_UNAVAILABLE"
        && !error.message.includes("private")
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("Firestore query rejects unbounded or malformed requests before fetch", async () => {
  await assert.rejects(
    () => queryFirestoreDocuments({ parentPath: "projects/store-one", collectionId: "pos_supply_alerts", limit: 501 }),
    /between 1 and 500/
  );
  await assert.rejects(
    () => queryFirestoreDocuments({
      parentPath: "projects/store-one",
      collectionId: "pos_supply_alerts",
      fieldFilters: [{ field: "status", op: "UNSUPPORTED", value: "pending" }],
    }),
    /filter is invalid/
  );
});
