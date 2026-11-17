import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { sha256Hex } from "../functions/_lib/crypto.js";
import { requirePlatformAdmin, requirePlatformReader } from "../functions/_lib/auth.js";
import * as users from "../functions/api/users.js";
import * as settings from "../functions/api/settings.js";
import * as requests from "../functions/api/requests.js";
import * as clinics from "../functions/api/clinics.js";
import * as stores from "../functions/api/pos-stores.js";
import * as storeUsers from "../functions/api/pos-store-users.js";
import * as credits from "../functions/api/credits.js";
import { onRequestGet as session } from "../functions/api/session.js";
import { onRequest as jahiz } from "../functions/api/jahiz/[[path]].js";

async function fixture(t) {
  const sqlite = new DatabaseSync(":memory:");
  t.after(() => sqlite.close());
  sqlite.exec(readFileSync(new URL("../schema.sql", import.meta.url), "utf8"));
  const insert = sqlite.prepare(
    `INSERT INTO users(username,name,password_salt,password_hash,role,portal_access)
     VALUES (?,?, 'fixture-salt','fixture-hash','platform_admin',?)`
  );
  insert.run("owner", "Owner", "admin");
  insert.run("second", "Second", "admin");
  insert.run("reader", "Reader", "reader");
  for (const username of ["owner", "second", "reader"]) {
    sqlite.prepare(`INSERT INTO sessions VALUES (?,?,1,unixepoch()+3600,unixepoch(),unixepoch())`)
      .run(await sha256Hex(`fixture-${username}`), username);
  }
  const DB = {
    prepare(sql) {
      const statement = sqlite.prepare(sql);
      let parameters = [];
      return {
        bind(...values) { parameters = values; return this; },
        async first() { return statement.get(...parameters) ?? null; },
        async all() { return { results: statement.all(...parameters) }; },
        async run() { return { meta: { changes: Number(statement.run(...parameters).changes) } }; },
      };
    },
  };
  const context = (username, path = "/api/users", method = "GET", payload) => ({
    env: { DB, AUTH_SECRET: "fixture-secret-not-a-credential" },
    request: new Request(`https://fixture.example${path}`, {
      method,
      headers: {
        Cookie: `__Host-rts_session=fixture-${username}`, Origin: "https://fixture.example",
        "Content-Type": "application/json",
      },
      ...(payload ? { body: JSON.stringify(payload) } : {}),
    }),
  });
  return { sqlite, context };
}

test("portal reader can sign in to a read session and list users but cannot pass administrator authorization", async (t) => {
  const { context } = await fixture(t);
  assert.equal((await requirePlatformReader(context("reader"))).role, "platform_reader");
  await assert.rejects(requirePlatformAdmin(context("reader")), (error) => error.status === 403);
  assert.equal((await requirePlatformAdmin(context("owner"))).role, "platform_admin");
  const response = await session(context("reader", "/api/session"));
  assert.equal((await response.json()).user.role, "platform_reader");
  const list = await users.onRequestGet(context("reader"));
  assert.equal(list.status, 200);
  const data = await list.json();
  assert.equal(data.users.find((user) => user.username === "reader").role, "reader");
  assert.doesNotMatch(JSON.stringify(data), /fixture-hash|fixture-salt/);
});

test("reader mutation rejection is server-side across all portal management APIs", async (t) => {
  const { context, sqlite } = await fixture(t);
  const endpoints = [
    [users.onRequestPost, "/api/users", "POST"],
    [users.onRequestPatch, "/api/users", "PATCH"],
    [settings.onRequestPut, "/api/settings", "PUT"],
    [requests.onRequestPatch, "/api/requests", "PATCH"],
    [clinics.onRequestPost, "/api/clinics", "POST"],
    [stores.onRequestPost, "/api/pos-stores", "POST"],
    [stores.onRequestPatch, "/api/pos-stores", "PATCH"],
    [storeUsers.onRequestPost, "/api/pos-store-users", "POST"],
    [storeUsers.onRequestPatch, "/api/pos-store-users", "PATCH"],
    [storeUsers.onRequestDelete, "/api/pos-store-users", "DELETE"],
    [credits.onRequestPost, "/api/credits", "POST"],
    [credits.onRequestPatch, "/api/credits", "PATCH"],
    [jahiz, "/api/jahiz/admin", "POST"],
  ];
  for (const [handler, path, method] of endpoints) {
    const response = await handler(context("reader", path, method, {}));
    assert.equal(response.status, 403, `${method} ${path}`);
  }
  assert.equal(sqlite.prepare("SELECT COUNT(*) AS count FROM users").get().count, 3);
});

test("admin can create readers and change portal roles; demotion invalidates existing sessions", async (t) => {
  const { context, sqlite } = await fixture(t);
  const created = await users.onRequestPost(context("owner", "/api/users", "POST", {
    username: "new-reader", name: "New Reader", role: "reader", password: "fixture-only-long-password",
  }));
  assert.equal(created.status, 201);
  assert.equal((await created.json()).user.role, "reader");
  const changed = await users.onRequestPatch(context("owner", "/api/users", "PATCH", {
    username: "second", role: "reader",
  }));
  assert.equal(changed.status, 200);
  assert.equal(sqlite.prepare("SELECT portal_access FROM users WHERE username='second'").get().portal_access, "reader");
  assert.equal((await session(context("second", "/api/session"))).status, 401);
  const invalid = await users.onRequestPost(context("owner", "/api/users", "POST", {
    username: "invalid-role", name: "Invalid Role", role: "superadmin", password: "fixture-only-long-password",
  }));
  assert.equal(invalid.status, 400);
});

test("last administrator and own-role protections preserve access, without counting readers as admins", async (t) => {
  const { context, sqlite } = await fixture(t);
  const own = await users.onRequestPatch(context("owner", "/api/users", "PATCH", {
    username: "owner", role: "reader",
  }));
  assert.equal(own.status, 400);
  sqlite.prepare("UPDATE users SET portal_access='reader' WHERE username='second'").run();
  const response = await users.onRequestPatch(context("second", "/api/users", "PATCH", {
    username: "owner", active: false,
  }));
  assert.equal(response.status, 403);
  assert.equal(sqlite.prepare("SELECT active FROM users WHERE username='owner'").get().active, 1);
  const deactivateReader = await users.onRequestPatch(context("owner", "/api/users", "PATCH", {
    username: "reader", active: false,
  }));
  assert.equal(deactivateReader.status, 200, "last admin may deactivate a reader");
});
