import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { commitPosAtomic, readPosAtomicRecord } from "../functions/_lib/pos-atomic-store.js";
import { requirePrivateRestaurantAuthority } from "../functions/_lib/pos-private-authority.js";
import {
  beginPrivateAuthorityTransition, completePrivateAuthorityTransition, cancelPrivateAuthorityTransition,
} from "../functions/_lib/pos-private-authority-transitions.js";
import { patchFirestoreDocumentAtUpdateTime } from "../functions/_lib/firestore.js";
import { getPosUserAuthVersion } from "../functions/_lib/pos-session.js";

const storeId = "restaurant-one", username = "cashier";
const usersPath = `projects/${storeId}/settings/pos_users`, licencePath = `projects/${storeId}/settings/pos`;
const platform = { username: "platform-admin", role: "admin", productType: "platform" };
function encode(value) {
  if (value === null) return { nullValue: null };
  if (Array.isArray(value)) return { arrayValue: { values: value.map(encode) } };
  if (typeof value === "object") return { mapValue: { fields: Object.fromEntries(Object.entries(value).map(([key, item]) => [key, encode(item)])) } };
  if (typeof value === "number") return { doubleValue: value };
  return typeof value === "boolean" ? { booleanValue: value } : { stringValue: value };
}
async function fixture(t) {
  const sqlite = new DatabaseSync(":memory:");
  sqlite.exec(readFileSync(new URL("../migrations/0009_pos_atomic_store.sql", import.meta.url), "utf8"));
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
        const result = statements.map(statement => statement.run());
        sqlite.exec("COMMIT");
        return result;
      } catch (error) {
        sqlite.exec("ROLLBACK");
        throw error;
      }
    },
  };
  const env = { AUTH_SECRET: "fixture-private-authority-secret", POS_PRIVATE_RESTAURANT_STATE: "enabled", DB: db };
  const oldUser = { username, role: "admin", active: true, passwordHash: "fixture-old-hash", passwordSalt: "fixture-old-salt", passwordVersion: 1 };
  const nextUser = { ...oldUser, passwordHash: "fixture-new-hash", passwordVersion: 2 };
  const oldVersion = await getPosUserAuthVersion(env.AUTH_SECRET, oldUser);
  const nextVersion = await getPosUserAuthVersion(env.AUTH_SECRET, nextUser);
  const session = { storeId, username, role: "admin", productType: "business", authVersion: oldVersion };
  const documents = new Map();
  let sourceSequence = 0, privateSequence = 0, beforePatch = null;
  function putSource(path, value) {
    documents.set(path, { fields: encode(value).mapValue.fields, updateTime: `source-${++sourceSequence}` });
  }
  putSource(usersPath, { users: [oldUser], unknownMetadata: "preserved" });
  putSource(licencePath, { warrantyEnd: "2099-01-01", businessType: "restaurant", unknownMetadata: "preserved" });
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input, options) => {
    const url = new URL(input), path = decodeURIComponent(url.pathname.split("/documents/")[1] || "");
    if (options?.method === "PATCH" && beforePatch) {
      const callback = beforePatch; beforePatch = null; callback();
    }
    const current = documents.get(path);
    if (!current) return new Response("", { status: 404 });
    if (options?.method === "PATCH") {
      if (url.searchParams.get("currentDocument.updateTime") !== current.updateTime) return new Response("", { status: 412 });
      documents.set(path, {
        fields: { ...current.fields, ...JSON.parse(options.body).fields },
        updateTime: `source-${++sourceSequence}`,
      });
    }
    return Response.json(documents.get(path));
  };
  t.after(() => { globalThis.fetch = originalFetch; sqlite.close(); });
  async function putPrivate(id, value) {
    const previous = await readPosAtomicRecord(env, storeId, "authority", id);
    const expectedRevision = previous?.revision || 0;
    await commitPosAtomic(env, {
      storeId, requestId: `seed-${++privateSequence}`, actor: "fixture", fingerprint: `seed-${privateSequence}`,
      guards: [{ collection: "authority", id, expectedRevision }],
      writes: [{ collection: "authority", id, expectedRevision, value }], result: {},
    });
  }
  await putPrivate("store", {
    schemaVersion: 1, storeId, state: "active", businessType: "restaurant",
    licenceEndsAt: "2099-01-01T00:00:00.000Z", migrationId: "explicit-fixture-cutover",
  });
  await putPrivate(`user:${username}`, { schemaVersion: 1, state: "active", username, role: "admin", authVersion: oldVersion });
  return {
    env, session, oldUser, nextUser, oldVersion, nextVersion, documents, putSource,
    beforeNextPatch(callback) { beforePatch = callback; },
    command: { storeId, requestId: "change-password-1", target: "user", username, next: { role: "admin", active: true, authVersion: nextVersion } },
  };
}

test("user authority is revoked first and enabled only after the exact source version is confirmed", async t => {
  const f = await fixture(t);
  const prepared = await beginPrivateAuthorityTransition(f.env, platform, f.command);
  assert.equal(prepared.sourceRevision, f.documents.get(usersPath).updateTime);
  const pending = await readPosAtomicRecord(f.env, storeId, "authority_transitions", f.command.requestId);
  assert.equal(JSON.stringify(pending).includes(f.oldUser.passwordHash), false);
  assert.equal(JSON.stringify(pending).includes(f.nextUser.passwordHash), false);
  await assert.rejects(requirePrivateRestaurantAuthority(f.env, f.session), error => error.code === "POS_AUTH_REQUIRED");
  await assert.rejects(completePrivateAuthorityTransition(f.env, platform, f.command), error => error.code === "AUTHORITY_CHANGE_CONFLICT");
  f.putSource(usersPath, { users: [f.nextUser] });
  assert.equal((await completePrivateAuthorityTransition(f.env, platform, f.command)).phase, "completed");
  assert.equal((await completePrivateAuthorityTransition(f.env, platform, f.command)).phase, "completed");
  await assert.rejects(requirePrivateRestaurantAuthority(f.env, f.session), error => error.code === "POS_AUTH_REQUIRED");
  assert.equal((await requirePrivateRestaurantAuthority(f.env, { ...f.session, authVersion: f.nextVersion })).role, "admin");
  await assert.rejects(beginPrivateAuthorityTransition(f.env, platform, { ...f.command, next: { ...f.command.next, role: "worker" } }), error => error.code === "AUTHORITY_CHANGE_CONFLICT");
});

test("cancellation fences a delayed source write before restoring the old private grant", async t => {
  const f = await fixture(t);
  const prepared = await beginPrivateAuthorityTransition(f.env, platform, f.command);
  assert.equal((await cancelPrivateAuthorityTransition(f.env, platform, f.command)).phase, "cancelled");
  assert.notEqual(f.documents.get(usersPath).updateTime, prepared.sourceRevision);
  await assert.rejects(patchFirestoreDocumentAtUpdateTime(usersPath, { users: [f.nextUser] }, prepared.sourceRevision), error => error.code === "POS_REGISTRY_CONFLICT");
  assert.equal((await requirePrivateRestaurantAuthority(f.env, f.session)).role, "admin");
  assert.equal(f.documents.get(usersPath).fields.unknownMetadata.stringValue, "preserved");
  assert.equal((await cancelPrivateAuthorityTransition(f.env, platform, f.command)).phase, "cancelled");
});

test("a committed source change cannot be cancelled back to a revoked account version", async t => {
  const f = await fixture(t);
  await beginPrivateAuthorityTransition(f.env, platform, f.command);
  f.putSource(usersPath, { users: [f.nextUser] });
  await assert.rejects(cancelPrivateAuthorityTransition(f.env, platform, f.command), error => error.code === "AUTHORITY_CHANGE_CONFLICT");
  await assert.rejects(requirePrivateRestaurantAuthority(f.env, f.session), error => error.code === "POS_AUTH_REQUIRED");
  await completePrivateAuthorityTransition(f.env, platform, f.command);
});

test("a source write racing cancellation cannot reopen access with the old private version", async t => {
  const f = await fixture(t);
  await beginPrivateAuthorityTransition(f.env, platform, f.command);
  f.beforeNextPatch(() => f.putSource(usersPath, { users: [f.nextUser] }));
  await assert.rejects(cancelPrivateAuthorityTransition(f.env, platform, f.command), error => error.code === "POS_REGISTRY_CONFLICT");
  await assert.rejects(requirePrivateRestaurantAuthority(f.env, f.session), error => error.code === "POS_AUTH_REQUIRED");
  await completePrivateAuthorityTransition(f.env, platform, f.command);
  assert.equal((await requirePrivateRestaurantAuthority(f.env, { ...f.session, authVersion: f.nextVersion })).role, "admin");
});

test("licence transitions block every cashier until the exact new licence is finalized", async t => {
  const f = await fixture(t);
  const command = { storeId, requestId: "licence-change-1", target: "licence", next: { licenceEndsAt: "2098-01-01", businessType: "restaurant" } };
  await assert.rejects(beginPrivateAuthorityTransition(f.env, f.session, command), error => error.code === "ADMIN_REQUIRED");
  await beginPrivateAuthorityTransition(f.env, platform, command);
  await assert.rejects(requirePrivateRestaurantAuthority(f.env, f.session), error => error.code === "PRIVATE_AUTHORITY_BLOCKED");
  f.putSource(licencePath, { warrantyEnd: "2098-01-01", businessType: "restaurant" });
  await completePrivateAuthorityTransition(f.env, platform, command);
  assert.equal((await requirePrivateRestaurantAuthority(f.env, f.session)).authority.licenceEndsAt, "2098-01-01T00:00:00.000Z");
});

test("an already verified self-password request can finalize itself without granting access to the old token", async t => {
  const f = await fixture(t);
  await beginPrivateAuthorityTransition(f.env, f.session, f.command);
  f.putSource(usersPath, { users: [f.nextUser] });
  await completePrivateAuthorityTransition(f.env, f.session, f.command);
  await assert.rejects(completePrivateAuthorityTransition(f.env, f.session, f.command), error => error.code === "POS_AUTH_REQUIRED");
  assert.equal((await requirePrivateRestaurantAuthority(f.env, { ...f.session, authVersion: f.nextVersion })).role, "admin");
});
