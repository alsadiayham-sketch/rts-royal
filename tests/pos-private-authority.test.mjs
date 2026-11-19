import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { commitPosAtomic, readPosAtomicRecord } from "../functions/_lib/pos-atomic-store.js";
import { requirePrivateRestaurantAuthority } from "../functions/_lib/pos-private-authority.js";

const session = {
  storeId: "restaurant-one", username: "cashier", role: "worker", productType: "business", authVersion: "a".repeat(64),
};
const authority = {
  schemaVersion: 1, state: "active", storeId: session.storeId, businessType: "restaurant",
  licenceEndsAt: "2099-01-01T00:00:00Z", migrationId: "explicit-fixture-cutover",
};
const user = { schemaVersion: 1, state: "active", username: session.username, role: session.role, authVersion: session.authVersion };

async function fixture(t) {
  const sqlite = new DatabaseSync(":memory:");
  sqlite.exec(readFileSync(new URL("../migrations/0009_pos_atomic_store.sql", import.meta.url), "utf8"));
  t.after(() => sqlite.close());
  function prepare(sql) {
    let args = [];
    return {
      bind(...values) { args = values; return this; },
      async first() { return sqlite.prepare(sql).get(...args) || null; },
      async all() { return { results: sqlite.prepare(sql).all(...args) }; },
      run() { return sqlite.prepare(sql).run(...args); },
    };
  }
  const db = {
    prepare,
    async batch(statements) {
      sqlite.exec("BEGIN IMMEDIATE");
      try {
        const results = statements.map(statement => statement.run());
        sqlite.exec("COMMIT");
        return results;
      } catch (error) {
        sqlite.exec("ROLLBACK");
        throw error;
      }
    },
  };
  const env = { POS_PRIVATE_RESTAURANT_STATE: "enabled", DB: { withSession(mode) { assert.equal(mode, "first-primary"); return db; } } };
  let sequence = 0;
  async function put(id, value) {
    const record = await readPosAtomicRecord(env, session.storeId, "authority", id);
    const expectedRevision = record?.revision || 0;
    await commitPosAtomic(env, {
      storeId: session.storeId, requestId: `fixture-${++sequence}`, actor: "fixture", fingerprint: `fixture-${sequence}`,
      guards: [{ collection: "authority", id, expectedRevision }],
      writes: [{ collection: "authority", id, expectedRevision, value }], result: { ok: true },
    });
  }
  await put("store", authority);
  await put(`user:${session.username}`, user);
  return { env, put };
}

test("private restaurant access remains disabled without explicit activation", async () => {
  await assert.rejects(requirePrivateRestaurantAuthority({}, session), error => error.code === "PRIVATE_RESTAURANT_DISABLED");
});

test("private authority returns current tenant and account guards and enforces administrator access", async t => {
  const { env, put } = await fixture(t);
  const access = await requirePrivateRestaurantAuthority(env, session);
  assert.deepEqual(access.guards, [
    { collection: "authority", id: "store", expectedRevision: 1 },
    { collection: "authority", id: "user:cashier", expectedRevision: 1 },
  ]);
  await assert.rejects(requirePrivateRestaurantAuthority(env, session, { admin: true }), error => error.code === "POS_ADMIN_REQUIRED");
  await put("user:cashier", { ...user, role: "admin" });
  assert.equal((await requirePrivateRestaurantAuthority(env, { ...session, role: "admin" }, { admin: true })).role, "admin");
});

test("private sessions cannot cross tenants, use stale grants or bypass an account revocation", async t => {
  const { env, put } = await fixture(t);
  for (const change of [{ storeId: "../other" }, { username: "CASHIER" }, { productType: "clinic" }, { authVersion: "b".repeat(64) }, { role: "admin" }]) {
    await assert.rejects(requirePrivateRestaurantAuthority(env, { ...session, ...change }), error => error.code === "POS_AUTH_REQUIRED");
  }
  await assert.rejects(requirePrivateRestaurantAuthority(env, { ...session, storeId: "other" }), error => error.code === "PRIVATE_RESTAURANT_NOT_READY");
  await put("user:cashier", { ...user, state: "blocked" });
  await assert.rejects(requirePrivateRestaurantAuthority(env, session), error => error.code === "POS_AUTH_REQUIRED");
});

test("unfinalized, expired or malformed private licence state always fails closed", async t => {
  const { env, put } = await fixture(t);
  for (const [change, code] of [
    [{ state: "blocked" }, "PRIVATE_AUTHORITY_BLOCKED"],
    [{ licenceEndsAt: "2000-01-01T00:00:00Z" }, "LICENCE_EXPIRED"],
    [{ licenceEndsAt: "not-a-date" }, "PRIVATE_RESTAURANT_NOT_READY"],
    [{ businessType: "shop" }, "PRIVATE_RESTAURANT_NOT_READY"],
    [{ migrationId: "" }, "PRIVATE_RESTAURANT_NOT_READY"],
  ]) {
    await put("store", { ...authority, ...change });
    await assert.rejects(requirePrivateRestaurantAuthority(env, session), error => error.code === code);
  }
});

test("revocation between authorization and commit rolls back every financial write", async t => {
  const { env, put } = await fixture(t);
  for (const [id, value] of [["user:cashier", { ...user, state: "blocked" }], ["store", { ...authority, state: "blocked" }]]) {
    await put("store", authority);
    await put("user:cashier", user);
    const access = await requirePrivateRestaurantAuthority(env, session);
    await put(id, value);
    await assert.rejects(commitPosAtomic(env, {
      storeId: session.storeId, requestId: `sale-after-${id}`, actor: session.username, fingerprint: session.authVersion,
      guards: [...access.guards, { collection: "wallets", id: "customer-one", expectedRevision: 0 }],
      writes: [{ collection: "wallets", id: "customer-one", expectedRevision: 0, value: { creditCents: 0 } }],
      result: { paid: true },
    }), error => error.code === "ATOMIC_REVISION_CONFLICT");
    assert.equal(await readPosAtomicRecord(env, session.storeId, "wallets", "customer-one"), null);
  }
});
