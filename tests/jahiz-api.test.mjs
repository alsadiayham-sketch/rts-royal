import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";

import { onRequest } from "../functions/api/jahiz/[[path]].js";
import { sha256Hex } from "../functions/_lib/crypto.js";

const ROOT = new URL("../", import.meta.url);
const AUTH_SECRET = "test-jahiz-auth-secret-at-least-16";

class D1Statement {
  constructor(database, sql) {
    this.database = database;
    this.sql = sql;
    this.values = [];
  }

  bind(...values) {
    this.values = values;
    return this;
  }

  async first() {
    return this.database.prepare(this.sql).get(...this.values) ?? null;
  }

  async all() {
    return { results: this.database.prepare(this.sql).all(...this.values) };
  }

  async run() {
    const result = this.database.prepare(this.sql).run(...this.values);
    return { meta: { changes: Number(result.changes) } };
  }
}

class D1Database {
  constructor(database) {
    this.database = database;
  }

  prepare(sql) {
    return new D1Statement(this.database, sql);
  }

  async batch(statements) {
    this.database.exec("BEGIN IMMEDIATE");
    try {
      const results = [];
      for (const statement of statements) results.push(await statement.run());
      this.database.exec("COMMIT");
      return results;
    } catch (error) {
      this.database.exec("ROLLBACK");
      throw error;
    }
  }
}

async function fixture() {
  const sqlite = new DatabaseSync(":memory:");
  sqlite.exec("PRAGMA foreign_keys = ON");
  sqlite.exec(`
    CREATE TABLE users (
      username TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      role TEXT NOT NULL,
      need_change INTEGER NOT NULL DEFAULT 0,
      session_version INTEGER NOT NULL DEFAULT 1,
      active INTEGER NOT NULL DEFAULT 1
    );
    CREATE TABLE sessions (
      token_hash TEXT PRIMARY KEY,
      username TEXT NOT NULL,
      session_version INTEGER NOT NULL,
      expires_at INTEGER NOT NULL,
      created_at INTEGER NOT NULL,
      last_seen_at INTEGER NOT NULL
    );
    CREATE TABLE rate_limits (
      scope_key TEXT PRIMARY KEY,
      count INTEGER NOT NULL,
      window_start INTEGER NOT NULL,
      expires_at INTEGER NOT NULL
    );
  `);
  sqlite.exec(readFileSync(new URL("migrations/0005_jahiz.sql", ROOT), "utf8"));
  const now = Math.floor(Date.now() / 1000);
  sqlite.prepare(
    `INSERT INTO users (username, name, role) VALUES (?, ?, ?)`
  ).run("platform", "Platform Admin", "platform_admin");
  sqlite.prepare(
    `INSERT INTO users (username, name, role) VALUES (?, ?, ?)`
  ).run("viewer", "Viewer", "viewer");
  for (const [token, username] of [["platform-token", "platform"], ["viewer-token", "viewer"]]) {
    sqlite.prepare(
      `INSERT INTO sessions
         (token_hash, username, session_version, expires_at, created_at, last_seen_at)
       VALUES (?, ?, 1, ?, ?, ?)`
    ).run(await sha256Hex(token), username, now + 3600, now, now);
  }
  return { sqlite, env: { DB: new D1Database(sqlite), AUTH_SECRET } };
}

async function request(fx, path, {
  method = "GET",
  body,
  jahizCookie,
  platformToken,
  origin = "https://example.test",
} = {}) {
  const headers = {};
  if (body !== undefined) {
    headers.Origin = origin;
    headers["Sec-Fetch-Site"] = "same-origin";
    headers["Content-Type"] = "application/json";
  } else if (!["GET", "HEAD"].includes(method)) {
    headers.Origin = origin;
    headers["Sec-Fetch-Site"] = "same-origin";
  }
  const cookies = [];
  if (jahizCookie) cookies.push(jahizCookie.split(";")[0]);
  if (platformToken) cookies.push(`__Host-rts_session=${platformToken}`);
  if (cookies.length) headers.Cookie = cookies.join("; ");
  const response = await onRequest({
    request: new Request(`${origin}/api/jahiz/${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    }),
    env: fx.env,
    params: { path: path.split("/") },
  });
  const data = await response.json();
  return { response, data, cookie: response.headers.get("Set-Cookie") };
}

async function createVenue(fx, overrides = {}) {
  const body = {
    action: "create",
    name: "Demo Cafe",
    slug: "demo-cafe",
    businessType: "cafe",
    ownerName: "Demo Owner",
    username: "owner",
    password: "strong-owner-password",
    isDemo: true,
    ...overrides,
  };
  const result = await request(fx, "admin", {
    method: "POST",
    body,
    platformToken: "platform-token",
  });
  assert.equal(result.response.status, 201, JSON.stringify(result.data));
  return result.data.venueId;
}

async function login(fx, slug, username = "owner", password = "strong-owner-password") {
  return request(fx, "login", { method: "POST", body: { slug, username, password } });
}

test("Jahiz admin is platform-only and returns ownerUsername with disabled checkout", async () => {
  const fx = await fixture();
  assert.equal((await request(fx, "admin")).response.status, 401);
  assert.equal((await request(fx, "admin", { platformToken: "viewer-token" })).response.status, 403);

  await createVenue(fx);
  const admin = await request(fx, "admin", { platformToken: "platform-token" });
  assert.equal(admin.response.status, 200);
  assert.equal(admin.data.venues[0].ownerUsername, "owner");
  assert.equal(admin.data.venues[0].customerUrl, "/jahiz/s/?shop=demo-cafe");
  assert.equal(admin.data.venues[0].ownerUrl, "/jahiz/login/?shop=demo-cafe");
  assert.equal(admin.data.paymentsEnabled, false);

  const checkout = await request(fx, "checkout", { method: "POST" });
  assert.equal(checkout.response.status, 503);
  assert.equal(checkout.data.error.code, "PAYMENTS_DISABLED");
  fx.sqlite.close();
});

test("public application approval is transactional and no public password is accepted", async () => {
  const fx = await fixture();
  const application = await request(fx, "applications", {
    method: "POST",
    body: {
      name: "Ready Restaurant",
      businessType: "restaurant",
      ownerName: "Ready Owner",
      email: "owner@example.com",
      phone: "+962 79 123 4567",
      message: "Please contact me",
    },
  });
  assert.equal(application.response.status, 201);
  const duplicate = await request(fx, "applications", {
    method: "POST",
    body: {
      name: "Ready Restaurant",
      businessType: "restaurant",
      ownerName: "Ready Owner",
      email: "OWNER@example.com",
      phone: "+962 79 123 4567",
      message: "",
    },
  });
  assert.equal(duplicate.response.status, 409);

  const adminBefore = await request(fx, "admin", { platformToken: "platform-token" });
  const applicationId = adminBefore.data.applications[0].id;
  const approved = await request(fx, "admin", {
    method: "POST",
    platformToken: "platform-token",
    body: {
      action: "approve",
      applicationId,
      slug: "ready-restaurant",
      username: "ready-owner",
      password: "approved-owner-password",
      isDemo: false,
    },
  });
  assert.equal(approved.response.status, 200, JSON.stringify(approved.data));
  assert.equal(fx.sqlite.prepare("SELECT status FROM jahiz_applications WHERE id = ?").get(applicationId).status, "approved");
  assert.equal((await login(fx, "ready-restaurant", "ready-owner", "approved-owner-password")).response.status, 200);
  assert.equal(fx.sqlite.prepare("SELECT COUNT(*) AS count FROM jahiz_users WHERE password_hash = ?").get("approved-owner-password").count, 0);
  fx.sqlite.close();
});

test("tenant isolation and owner-only staff management are enforced", async () => {
  const fx = await fixture();
  const firstId = await createVenue(fx);
  const secondId = await createVenue(fx, {
    name: "Other Cafe",
    slug: "other-cafe",
    ownerName: "Other Owner",
    password: "other-owner-password",
  });
  const ownerLogin = await login(fx, "demo-cafe");
  const staffCreate = await request(fx, "staff", {
    method: "POST",
    jahizCookie: ownerLogin.cookie,
    body: { username: "cashier", name: "Cafe Cashier", password: "cashier-password-123" },
  });
  assert.equal(staffCreate.response.status, 201, JSON.stringify(staffCreate.data));
  const staffLogin = await login(fx, "demo-cafe", "cashier", "cashier-password-123");
  assert.equal(staffLogin.response.status, 200);
  assert.equal((await request(fx, "staff", {
    method: "POST",
    jahizCookie: staffLogin.cookie,
    body: { username: "hacker", name: "Bad Actor", password: "another-password-123" },
  })).response.status, 403);

  const order = await request(fx, "orders", {
    method: "POST",
    jahizCookie: staffLogin.cookie,
    body: { number: "12345", minutes: 10 },
  });
  assert.equal(order.response.status, 201);
  assert.equal(fx.sqlite.prepare("SELECT venue_id FROM jahiz_orders WHERE id = ?").get(order.data.order.id).venue_id, firstId);
  assert.notEqual(firstId, secondId);

  const otherLogin = await login(fx, "other-cafe", "owner", "other-owner-password");
  const otherOrders = await request(fx, "orders", { jahizCookie: otherLogin.cookie });
  assert.deepEqual(otherOrders.data.orders, []);
  const crossTenantUpdate = await request(fx, "orders", {
    method: "PATCH",
    jahizCookie: otherLogin.cookie,
    body: { id: order.data.order.id, action: "ready", revision: 1 },
  });
  assert.equal(crossTenantUpdate.response.status, 404);
  fx.sqlite.close();
});

test("suspended and expired venues fail live authentication checks", async () => {
  const fx = await fixture();
  const venueId = await createVenue(fx);
  const activeLogin = await login(fx, "demo-cafe");
  assert.equal((await request(fx, "session", { jahizCookie: activeLogin.cookie })).response.status, 200);

  await request(fx, "admin", {
    method: "POST",
    platformToken: "platform-token",
    body: { action: "update", venueId, status: "suspended", expiresAt: null },
  });
  assert.equal((await request(fx, "session", { jahizCookie: activeLogin.cookie })).response.status, 401);
  assert.equal((await login(fx, "demo-cafe")).response.status, 401);

  await request(fx, "admin", {
    method: "POST",
    platformToken: "platform-token",
    body: { action: "update", venueId, status: "active", expiresAt: "2020-01-01T00:00:00.000Z" },
  });
  assert.equal((await login(fx, "demo-cafe")).response.status, 401);
  fx.sqlite.close();
});

test("branding rejects unsafe content and accepts one enabled tracking block", async () => {
  const fx = await fixture();
  await createVenue(fx);
  const signedIn = await login(fx, "demo-cafe");
  const unsafe = await request(fx, "settings", {
    method: "PATCH",
    jahizCookie: signedIn.cookie,
    body: {
      branding: {
        logoUrl: "data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=",
        primaryColor: "#4b1d69",
        backgroundColor: "#ffffff",
        textColor: "#21172b",
        welcomeText: "<script>alert(1)</script>",
        readyText: "",
        reviewUrl: "javascript:alert(1)",
        blocks: [{ id: "tracking", type: "tracking", enabled: true }],
      },
    },
  });
  assert.equal(unsafe.response.status, 400);

  const markup = await request(fx, "settings", {
    method: "PATCH",
    jahizCookie: signedIn.cookie,
    body: {
      branding: {
        logoUrl: "",
        primaryColor: "#4b1d69",
        backgroundColor: "#ffffff",
        textColor: "#21172b",
        welcomeText: "<b>Welcome</b>",
        readyText: "",
        reviewUrl: "",
        blocks: [{ id: "tracking", type: "tracking", enabled: true }],
      },
    },
  });
  assert.equal(markup.response.status, 400);

  const safe = await request(fx, "settings", {
    method: "PATCH",
    jahizCookie: signedIn.cookie,
    body: {
      branding: {
        logoUrl: "/jahiz/assets/logo.webp",
        primaryColor: "#4b1d69",
        backgroundColor: "#ffffff",
        textColor: "#21172b",
        welcomeText: "Welcome",
        readyText: "Ready",
        reviewUrl: "https://example.com/review",
        blocks: [
          { id: "welcome", type: "welcome", enabled: true, text: "Welcome" },
          { id: "tracking", type: "tracking", enabled: false },
        ],
      },
    },
  });
  assert.equal(safe.response.status, 200, JSON.stringify(safe.data));
  assert.equal(safe.data.branding.blocks[1].enabled, true);
  fx.sqlite.close();
});

test("order capabilities, CAS, duplicate numbers, and tenant-safe public tracking work", async () => {
  const fx = await fixture();
  await createVenue(fx);
  await createVenue(fx, {
    name: "Other Cafe",
    slug: "other-cafe",
    ownerName: "Other Owner",
    password: "other-owner-password",
  });
  const signedIn = await login(fx, "demo-cafe");
  const created = await request(fx, "orders", {
    method: "POST",
    jahizCookie: signedIn.cookie,
    body: { number: "777", minutes: null },
  });
  assert.equal(created.response.status, 201);
  assert.match(created.data.order.pickupCode, /^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{12}$/);
  const chosenCode = await request(fx, "orders", {
    method: "POST",
    jahizCookie: signedIn.cookie,
    body: { number: "778", minutes: null, pickupCode: "AAAAAAAAAAAA" },
  });
  assert.equal(chosenCode.response.status, 400);
  assert.equal(chosenCode.data.error.code, "UNKNOWN_FIELDS");
  const duplicate = await request(fx, "orders", {
    method: "POST",
    jahizCookie: signedIn.cookie,
    body: { number: "777", minutes: 5 },
  });
  assert.equal(duplicate.response.status, 409);

  const missingCode = await request(fx, "public/join", {
    method: "POST",
    body: { slug: "demo-cafe", number: "777" },
  });
  assert.equal(missingCode.response.status, 404);
  const guessedCode = await request(fx, "public/join", {
    method: "POST",
    body: { slug: "demo-cafe", number: "777", pickupCode: "AAAAAAAAAAAA" },
  });
  assert.equal(guessedCode.response.status, 404);

  const otherLogin = await login(fx, "other-cafe", "owner", "other-owner-password");
  const otherOrder = await request(fx, "orders", {
    method: "POST",
    jahizCookie: otherLogin.cookie,
    body: { number: "777", minutes: null },
  });
  assert.equal(otherOrder.response.status, 201);
  const crossVenueCode = await request(fx, "public/join", {
    method: "POST",
    body: {
      slug: "other-cafe",
      number: "777",
      pickupCode: created.data.order.pickupCode,
    },
  });
  assert.equal(crossVenueCode.response.status, 404);

  const joined = await request(fx, "public/join", {
    method: "POST",
    body: {
      slug: "demo-cafe",
      number: "777",
      pickupCode: created.data.order.pickupCode,
    },
  });
  assert.equal(joined.response.status, 200);
  assert.equal(typeof joined.data.token, "string");
  assert.equal(created.data.order.token, undefined);
  const tracked = await request(fx, `public/order?token=${encodeURIComponent(joined.data.token)}`);
  assert.equal(tracked.response.status, 200);
  assert.equal(tracked.data.order.number, "777");
  assert.equal(tracked.data.order.pickupCode, undefined);
  assert.deepEqual(
    Object.keys(tracked.data.order).sort(),
    ["createdAt", "estimatedReadyAt", "id", "number", "revision", "status", "watching"].sort()
  );
  const staffOrders = await request(fx, "orders", { jahizCookie: signedIn.cookie });
  assert.equal(staffOrders.data.orders[0].pickupCode, created.data.order.pickupCode);

  const ready = await request(fx, "orders", {
    method: "PATCH",
    jahizCookie: signedIn.cookie,
    body: { id: created.data.order.id, action: "ready", revision: 1 },
  });
  assert.equal(ready.response.status, 200);
  const stale = await request(fx, "orders", {
    method: "PATCH",
    jahizCookie: signedIn.cookie,
    body: { id: created.data.order.id, action: "done", revision: 1 },
  });
  assert.equal(stale.response.status, 409);
  assert.equal(stale.data.error.code, "REVISION_CONFLICT");
  fx.sqlite.close();
});

test("pickup codes are server-generated with a 60-bit unambiguous alphabet", async () => {
  const fx = await fixture();
  await createVenue(fx);
  const signedIn = await login(fx, "demo-cafe");
  const codes = new Set();
  for (let index = 1; index <= 32; index += 1) {
    const created = await request(fx, "orders", {
      method: "POST",
      jahizCookie: signedIn.cookie,
      body: { number: String(9000 + index), minutes: null },
    });
    assert.equal(created.response.status, 201);
    assert.match(created.data.order.pickupCode, /^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{12}$/);
    codes.add(created.data.order.pickupCode);
  }
  assert.equal(codes.size, 32);
  fx.sqlite.close();
});

test("plans use allowed ISO minor units, payments extend expiry atomically, and password reset revokes sessions", async () => {
  const fx = await fixture();
  const plan = await request(fx, "admin", {
    method: "POST",
    platformToken: "platform-token",
    body: {
      action: "save-plan",
      name: "Demo Plan",
      currency: "JOD",
      amountMinor: 0,
      months: 1,
      active: true,
    },
  });
  assert.equal(plan.response.status, 200);
  assert.equal(fx.sqlite.prepare("SELECT amount_minor FROM jahiz_plans WHERE id = ?").get(plan.data.planId).amount_minor, 0);
  const invalidCurrency = await request(fx, "admin", {
    method: "POST",
    platformToken: "platform-token",
    body: {
      action: "save-plan",
      name: "Bad Plan",
      currency: "EUR",
      amountMinor: 100,
      months: 1,
      active: true,
    },
  });
  assert.equal(invalidCurrency.response.status, 400);
  const fractionalAmount = await request(fx, "admin", {
    method: "POST",
    platformToken: "platform-token",
    body: {
      action: "save-plan",
      name: "Fractional Plan",
      currency: "USD",
      amountMinor: 100.5,
      months: 1,
      active: true,
    },
  });
  assert.equal(fractionalAmount.response.status, 400);

  const venueId = await createVenue(fx, { planId: plan.data.planId });
  const before = Math.floor(Date.now() / 1000);
  const payment = await request(fx, "admin", {
    method: "POST",
    platformToken: "platform-token",
    body: {
      action: "record-payment",
      venueId,
      amountMinor: 15000,
      currency: "ILS",
      months: 2,
      note: "Manual transfer",
    },
  });
  assert.equal(payment.response.status, 200, JSON.stringify(payment.data));
  const expiry = fx.sqlite.prepare("SELECT expires_at FROM jahiz_venues WHERE id = ?").get(venueId).expires_at;
  assert.ok(expiry >= before + 60 * 86400);
  assert.equal(fx.sqlite.prepare("SELECT amount_minor FROM jahiz_payments WHERE venue_id = ?").get(venueId).amount_minor, 15000);

  const signedIn = await login(fx, "demo-cafe");
  const changed = await request(fx, "password", {
    method: "POST",
    jahizCookie: signedIn.cookie,
    body: {
      currentPassword: "strong-owner-password",
      newPassword: "self-service-password-123",
    },
  });
  assert.equal(changed.response.status, 200);
  assert.equal((await request(fx, "session", { jahizCookie: signedIn.cookie })).response.status, 200);
  assert.equal((await login(fx, "demo-cafe", "owner", "strong-owner-password")).response.status, 401);
  assert.equal((await login(fx, "demo-cafe", "owner", "self-service-password-123")).response.status, 200);
  await request(fx, "admin", {
    method: "POST",
    platformToken: "platform-token",
    body: {
      action: "reset-password",
      venueId,
      username: "owner",
      password: "replacement-password-123",
    },
  });
  assert.equal((await request(fx, "session", { jahizCookie: signedIn.cookie })).response.status, 401);
  assert.equal((await login(fx, "demo-cafe", "owner", "self-service-password-123")).response.status, 401);
  assert.equal((await login(fx, "demo-cafe", "owner", "replacement-password-123")).response.status, 200);
  fx.sqlite.close();
});
