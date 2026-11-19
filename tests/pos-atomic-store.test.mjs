import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import {
  commitPosAtomic,
  listPosAtomicRecords,
  readPosAtomicRecord,
  readPosAtomicRecords,
  replayPosAtomic,
} from "../functions/_lib/pos-atomic-store.js";

function fixture(t) {
  const sqlite = new DatabaseSync(":memory:");
  sqlite.exec(readFileSync(new URL("../migrations/0009_pos_atomic_store.sql", import.meta.url), "utf8"));
  let loseBatchResponse = false;
  let failNextRead = false;

  function prepared(sql) {
    let parameters = [];
    return {
      bind(...values) {
        parameters = values;
        return this;
      },
      async first() {
        if (failNextRead) {
          failNextRead = false;
          throw new Error("simulated primary read loss");
        }
        return sqlite.prepare(sql).get(...parameters) ?? null;
      },
      async all() {
        return { results: sqlite.prepare(sql).all(...parameters) };
      },
      run() {
        return sqlite.prepare(sql).run(...parameters);
      },
    };
  }

  const session = {
    prepare: prepared,
    async batch(statements) {
      sqlite.exec("BEGIN IMMEDIATE");
      try {
        const results = statements.map((statement) => statement.run());
        sqlite.exec("COMMIT");
        if (loseBatchResponse) {
          loseBatchResponse = false;
          failNextRead = true;
          throw new Error("simulated response loss after commit");
        }
        return results;
      } catch (error) {
        if (sqlite.isTransaction) sqlite.exec("ROLLBACK");
        throw error;
      }
    },
  };
  const DB = {
    sessions: [],
    withSession(mode) {
      this.sessions.push(mode);
      return session;
    },
  };
  t.after(() => sqlite.close());
  return {
    env: { DB },
    sqlite,
    loseNextBatchResponse() { loseBatchResponse = true; },
  };
}

const guard = (collection, id, expectedRevision) => ({ collection, id, expectedRevision });
const write = (collection, id, expectedRevision, value) => ({ collection, id, expectedRevision, value });
const base = (overrides = {}) => ({
  storeId: "store-a",
  requestId: "request-1",
  actor: "cashier-a",
  fingerprint: "sha256:intent-1",
  guards: [],
  writes: [],
  result: { ok: true },
  ...overrides,
});

test("read-only replay distinguishes absence and enforces tenant, actor and intent binding", async (t) => {
  const f = fixture(t);
  const input = base({
    guards: [guard("receipts", "sale-1", 0)],
    writes: [write("receipts", "sale-1", 0, { total: 10 })],
    result: null,
  });
  assert.deepEqual(await replayPosAtomic(f.env, input), { found: false });
  await commitPosAtomic(f.env, input);
  assert.deepEqual(await replayPosAtomic(f.env, input), { found: true, result: null });
  assert.deepEqual(await replayPosAtomic(f.env, { ...input, storeId: "store-b" }), { found: false });
  for (const change of [{ actor: "other" }, { fingerprint: "other-intent" }]) {
    await assert.rejects(replayPosAtomic(f.env, { ...input, ...change }), error => error.code === "REQUEST_ID_REUSED");
  }
  assert.equal((await readPosAtomicRecord(f.env, "store-a", "receipts", "sale-1")).revision, 1);
});

test("atomically commits stock, wallet, and receipt-like records", async (t) => {
  const f = fixture(t);
  const result = await commitPosAtomic(f.env, base({
    guards: [guard("stock", "sku-1", 0), guard("wallets", "customer-1", 0), guard("receipts", "sale-1", 0)],
    writes: [
      write("stock", "sku-1", 0, { quantity: 4 }),
      write("wallets", "customer-1", 0, { balance: 15, ledgerTail: "sale-1" }),
      write("receipts", "sale-1", 0, { total: 20, paid: 20 }),
    ],
    result: { receiptId: "sale-1", walletBalance: 15 },
  }));
  assert.deepEqual(result, { receiptId: "sale-1", walletBalance: 15 });
  const records = await readPosAtomicRecords(f.env, "store-a", [
    { collection: "stock", id: "sku-1" },
    { collection: "wallets", id: "customer-1" },
    { collection: "receipts", id: "sale-1" },
  ]);
  assert.deepEqual(records.map((record) => [record.revision, record.value]), [
    [1, { quantity: 4 }],
    [1, { balance: 15, ledgerTail: "sale-1" }],
    [1, { total: 20, paid: 20 }],
  ]);
  assert.ok(f.env.DB.sessions.every((mode) => mode === "first-primary"));
});

test("a stale guard rolls back every write and request row", async (t) => {
  const f = fixture(t);
  await commitPosAtomic(f.env, base({
    guards: [guard("stock", "sku-1", 0)],
    writes: [write("stock", "sku-1", 0, { quantity: 5 })],
  }));
  await assert.rejects(commitPosAtomic(f.env, base({
    requestId: "request-stale",
    fingerprint: "sha256:stale",
    guards: [guard("stock", "sku-1", 0), guard("wallets", "customer-1", 0)],
    writes: [
      write("stock", "sku-1", 0, { quantity: 3 }),
      write("wallets", "customer-1", 0, { balance: 2 }),
    ],
  })), (error) => error.status === 409 && error.code === "ATOMIC_REVISION_CONFLICT");
  assert.deepEqual((await readPosAtomicRecord(f.env, "store-a", "stock", "sku-1")).value, { quantity: 5 });
  assert.equal(await readPosAtomicRecord(f.env, "store-a", "wallets", "customer-1"), null);
  assert.equal(f.sqlite.prepare("SELECT COUNT(*) AS count FROM pos_atomic_requests WHERE request_id='request-stale'").get().count, 0);
});

test("lost response retry replays the exact result and applies once", async (t) => {
  const f = fixture(t);
  const input = base({
    requestId: "request-lost",
    fingerprint: "sha256:lost",
    guards: [guard("wallets", "customer-1", 0)],
    writes: [write("wallets", "customer-1", 0, { balance: 7 })],
    result: { balance: 7, token: "stable-result" },
  });
  f.loseNextBatchResponse();
  await assert.rejects(commitPosAtomic(f.env, input), (error) => error.status === 503 && error.code === "ATOMIC_COMMIT_UNCERTAIN");
  assert.deepEqual(await commitPosAtomic(f.env, input), input.result);
  assert.equal((await readPosAtomicRecord(f.env, "store-a", "wallets", "customer-1")).revision, 1);
  assert.equal(f.sqlite.prepare("SELECT COUNT(*) AS count FROM pos_atomic_requests WHERE request_id='request-lost'").get().count, 1);
});

test("request IDs are bound to actor and fingerprint", async (t) => {
  const f = fixture(t);
  const input = base({
    guards: [guard("stock", "sku-1", 0)],
    writes: [write("stock", "sku-1", 0, { quantity: 2 })],
    result: { stable: true },
  });
  assert.deepEqual(await commitPosAtomic(f.env, input), { stable: true });
  await assert.rejects(commitPosAtomic(f.env, { ...input, actor: "cashier-b" }), (error) => error.status === 409 && error.code === "REQUEST_ID_REUSED");
  await assert.rejects(commitPosAtomic(f.env, { ...input, fingerprint: "sha256:other" }), (error) => error.status === 409 && error.code === "REQUEST_ID_REUSED");
  assert.deepEqual(await commitPosAtomic(f.env, input), { stable: true });
});

test("tenants have independent records and request namespaces", async (t) => {
  const f = fixture(t);
  const operation = {
    requestId: "same-request",
    actor: "owner",
    fingerprint: "sha256:same",
    guards: [guard("wallets", "customer-1", 0)],
    writes: [write("wallets", "customer-1", 0, { balance: 1 })],
    result: { ok: true },
  };
  await commitPosAtomic(f.env, { ...operation, storeId: "store-a" });
  await commitPosAtomic(f.env, { ...operation, storeId: "store-b" });
  assert.deepEqual((await readPosAtomicRecord(f.env, "store-a", "wallets", "customer-1")).value, { balance: 1 });
  assert.deepEqual((await readPosAtomicRecord(f.env, "store-b", "wallets", "customer-1")).value, { balance: 1 });
  assert.equal(f.sqlite.prepare("SELECT COUNT(*) AS count FROM pos_atomic_requests WHERE request_id='same-request'").get().count, 2);
});

test("tombstone revisions prevent stale ABA recreation", async (t) => {
  const f = fixture(t);
  await commitPosAtomic(f.env, base({
    guards: [guard("wallets", "customer-1", 0)],
    writes: [write("wallets", "customer-1", 0, { balance: 4 })],
  }));
  await commitPosAtomic(f.env, base({
    requestId: "delete-1",
    fingerprint: "sha256:delete",
    guards: [guard("wallets", "customer-1", 1)],
    writes: [{ collection: "wallets", id: "customer-1", expectedRevision: 1, deleted: true }],
  }));
  assert.deepEqual(await readPosAtomicRecord(f.env, "store-a", "wallets", "customer-1"), {
    storeId: "store-a", collection: "wallets", id: "customer-1", revision: 2, deleted: true,
  });
  await assert.rejects(commitPosAtomic(f.env, base({
    requestId: "recreate-stale",
    fingerprint: "sha256:recreate-stale",
    guards: [guard("wallets", "customer-1", 0)],
    writes: [write("wallets", "customer-1", 0, { balance: 9 })],
  })), (error) => error.status === 409);
  await commitPosAtomic(f.env, base({
    requestId: "recreate-current",
    fingerprint: "sha256:recreate-current",
    guards: [guard("wallets", "customer-1", 2)],
    writes: [write("wallets", "customer-1", 2, { balance: 9 })],
  }));
  assert.equal((await readPosAtomicRecord(f.env, "store-a", "wallets", "customer-1")).revision, 3);
});

test("rejects invalid, missing, and duplicate guard/write input", async (t) => {
  const f = fixture(t);
  const validWrite = write("wallets", "customer-1", 0, { balance: 1 });
  let deep = {};
  for (let index = 0; index < 14; index += 1) deep = { child: deep };
  const invalidCases = [
    base({ guards: [], writes: [validWrite] }),
    base({ guards: [guard("wallets", "customer-1", 0), guard("wallets", "customer-1", 0)], writes: [validWrite] }),
    base({ guards: [guard("wallets", "customer-1", 0)], writes: [validWrite, validWrite] }),
    base({ guards: [guard("stock", "sku-1", 0)], writes: [validWrite] }),
    base({ guards: [guard("wallets", "customer-1", 1)], writes: [validWrite] }),
    base({ guards: [guard("bad/name", "customer-1", 0)], writes: [validWrite] }),
    base({ storeId: "s".repeat(129), guards: [guard("wallets", "customer-1", 0)], writes: [validWrite] }),
    base({ guards: [guard("wallets", "customer-1", 0)], writes: [write("wallets", "customer-1", 0, { amount: Number.NaN })] }),
    base({ guards: [guard("wallets", "customer-1", 0)], writes: [write("wallets", "customer-1", 0, JSON.parse('{"__proto__":{"polluted":true}}'))] }),
    base({ guards: [guard("wallets", "customer-1", 0)], writes: [write("wallets", "customer-1", 0, deep)] }),
    base({ guards: [guard("wallets", "customer-1", 0)], writes: [write("wallets", "customer-1", 0, { data: "x".repeat(33 * 1024) })] }),
    { ...base({ guards: [guard("wallets", "customer-1", 0)], writes: [validWrite] }), unexpected: true },
  ];
  for (const input of invalidCases) {
    await assert.rejects(commitPosAtomic(f.env, input), (error) => error.status === 400 && error.code === "INVALID_ATOMIC_REQUEST");
  }
  assert.equal(f.sqlite.prepare("SELECT COUNT(*) AS count FROM pos_atomic_requests").get().count, 0);
});

test("bounded list is tenant-scoped, ordered, paged, and hides tombstones by default", async (t) => {
  const f = fixture(t);
  for (const id of ["c", "a", "b"]) {
    await commitPosAtomic(f.env, base({
      requestId: `create-${id}`,
      fingerprint: `sha256:${id}`,
      guards: [guard("receipts", id, 0)],
      writes: [write("receipts", id, 0, { id })],
    }));
  }
  await commitPosAtomic(f.env, base({
    requestId: "delete-b",
    fingerprint: "sha256:delete-b",
    guards: [guard("receipts", "b", 1)],
    writes: [{ collection: "receipts", id: "b", expectedRevision: 1, deleted: true }],
  }));
  const visible = await listPosAtomicRecords(f.env, "store-a", "receipts", { limit: 1 });
  assert.deepEqual(visible.records.map((record) => record.id), ["a"]);
  assert.equal(visible.nextCursor, "a");
  const next = await listPosAtomicRecords(f.env, "store-a", "receipts", { limit: 2, cursor: visible.nextCursor });
  assert.deepEqual(next.records.map((record) => record.id), ["c"]);
  assert.equal(next.nextCursor, null);
  const all = await listPosAtomicRecords(f.env, "store-a", "receipts", { limit: 3, includeDeleted: true });
  assert.deepEqual(all.records.map((record) => [record.id, record.deleted]), [["a", false], ["b", true], ["c", false]]);
  await assert.rejects(listPosAtomicRecords(f.env, "store-a", "receipts", { limit: 101 }), (error) => error.status === 400);
});

test("supports 60 product lines plus financial guards without partial stale commits", async (t) => {
  const f = fixture(t);
  await commitPosAtomic(f.env, base({
    requestId: "seed-auth",
    fingerprint: "sha256:seed-auth",
    guards: [guard("auth", "cashier-a", 0)],
    writes: [write("auth", "cashier-a", 0, { active: true, version: 7 })],
  }));

  const products = Array.from({ length: 60 }, (_, index) => `sku-${String(index + 1).padStart(2, "0")}`);
  const financialKeys = [
    ["accounts", "customer-1"],
    ["wallets", "customer-1"],
    ["receipts", "sale-60"],
    ["tables", "table-4"],
  ];
  const guards = [
    ...products.map((id) => guard("stock", id, 0)),
    ...financialKeys.map(([collection, id]) => guard(collection, id, 0)),
    guard("auth", "cashier-a", 1),
  ];
  const writes = [
    ...products.map((id) => write("stock", id, 0, { quantity: 9 })),
    write("accounts", "customer-1", 0, { debt: 3 }),
    write("wallets", "customer-1", 0, { balance: 27 }),
    write("receipts", "sale-60", 0, { lines: 60, total: 600 }),
    write("tables", "table-4", 0, { occupied: false }),
  ];
  await commitPosAtomic(f.env, base({
    requestId: "sale-60-create",
    fingerprint: "sha256:sale-60-create",
    guards,
    writes,
    result: { receiptId: "sale-60", lines: 60 },
  }));

  const productRecords = await readPosAtomicRecords(
    f.env,
    "store-a",
    products.map((id) => ({ collection: "stock", id }))
  );
  assert.equal(productRecords.length, 60);
  assert.ok(productRecords.every((record) => record.revision === 1 && record.value.quantity === 9));

  const staleGuards = [
    ...products.map((id, index) => guard("stock", id, index === 37 ? 0 : 1)),
    ...financialKeys.map(([collection, id]) => guard(collection, id, 1)),
    guard("auth", "cashier-a", 1),
  ];
  const staleWrites = [
    ...products.map((id) => write("stock", id, 1, { quantity: 8 })),
    write("accounts", "customer-1", 1, { debt: 4 }),
    write("wallets", "customer-1", 1, { balance: 26 }),
    write("receipts", "sale-60", 1, { lines: 60, total: 601 }),
    write("tables", "table-4", 1, { occupied: true }),
  ];
  staleWrites[37] = write("stock", products[37], 0, { quantity: 8 });
  await assert.rejects(commitPosAtomic(f.env, base({
    requestId: "sale-60-stale",
    fingerprint: "sha256:sale-60-stale",
    guards: staleGuards,
    writes: staleWrites,
  })), (error) => error.status === 409 && error.code === "ATOMIC_REVISION_CONFLICT");

  assert.ok((await readPosAtomicRecords(
    f.env,
    "store-a",
    products.map((id) => ({ collection: "stock", id }))
  )).every((record) => record.revision === 1 && record.value.quantity === 9));
  assert.deepEqual((await readPosAtomicRecord(f.env, "store-a", "wallets", "customer-1")).value, { balance: 27 });
  assert.deepEqual((await readPosAtomicRecord(f.env, "store-a", "receipts", "sale-60")).value, { lines: 60, total: 600 });
  assert.equal(f.sqlite.prepare("SELECT COUNT(*) AS count FROM pos_atomic_requests WHERE request_id='sale-60-stale'").get().count, 0);
});
