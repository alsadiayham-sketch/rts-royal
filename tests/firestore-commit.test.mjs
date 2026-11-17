import test from "node:test";
import assert from "node:assert/strict";

import { commitFirestoreWrites } from "../functions/_lib/firestore.js";

test("Firestore commit supports verify-only update-time preconditions without rewriting the document", async () => {
  const originalFetch = globalThis.fetch;
  let payload;
  globalThis.fetch = async (_input, options) => {
    payload = JSON.parse(options.body);
    return Response.json({ writeResults: [] });
  };
  try {
    await commitFirestoreWrites([
      {
        path: "projects/store/settings/pos",
        verify: true,
        updateTime: "2026-11-17T13:00:00.000000Z",
      },
      {
        path: "projects/store/orders/order-1",
        data: { status: "paid", total: 12.5 },
        create: true,
      },
    ]);
    assert.deepEqual(payload.writes[0], {
      verify: "projects/dimaboutique-b4f16/databases/(default)/documents/projects/store/settings/pos",
      currentDocument: { updateTime: "2026-11-17T13:00:00.000000Z" },
    });
    assert.equal(Object.hasOwn(payload.writes[0], "update"), false);
    assert.deepEqual(payload.writes[1], {
      update: {
        name: "projects/dimaboutique-b4f16/databases/(default)/documents/projects/store/orders/order-1",
        fields: {
          status: { stringValue: "paid" },
          total: { doubleValue: 12.5 },
        },
      },
      currentDocument: { exists: false },
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("Firestore verify-only writes require an update time before making a request", async () => {
  const originalFetch = globalThis.fetch;
  let called = false;
  globalThis.fetch = async () => {
    called = true;
    return Response.json({});
  };
  try {
    await assert.rejects(
      () => commitFirestoreWrites([{ path: "projects/store/settings/pos", verify: true }]),
      /requires an update time/
    );
    assert.equal(called, false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
