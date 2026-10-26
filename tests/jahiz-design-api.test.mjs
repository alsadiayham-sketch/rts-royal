import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";

import { onRequest } from "../functions/api/jahiz/[[path]].js";
import { sha256Hex } from "../functions/_lib/crypto.js";

const ROOT = new URL("../", import.meta.url);
const AUTH_SECRET = "test-jahiz-design-auth-secret";

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
  sqlite.prepare("INSERT INTO users (username, name, role) VALUES (?, ?, ?)")
    .run("platform", "Platform Admin", "platform_admin");
  sqlite.prepare(
    `INSERT INTO sessions
       (token_hash, username, session_version, expires_at, created_at, last_seen_at)
     VALUES (?, 'platform', 1, ?, ?, ?)`
  ).run(await sha256Hex("platform-token"), now + 3600, now, now);
  return { sqlite, env: { DB: new D1Database(sqlite), AUTH_SECRET } };
}

async function request(fx, path, {
  method = "GET",
  body,
  jahizCookie,
  platformToken,
} = {}) {
  const origin = "https://example.test";
  const headers = {};
  if (body !== undefined) {
    headers.Origin = origin;
    headers["Sec-Fetch-Site"] = "same-origin";
    headers["Content-Type"] = "application/json";
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
  const contentType = response.headers.get("Content-Type") || "";
  const data = contentType.startsWith("application/json") ? await response.json() : await response.text();
  return { response, data, cookie: response.headers.get("Set-Cookie") };
}

async function createVenue(fx, slug, password = "strong-owner-password") {
  const result = await request(fx, "admin", {
    method: "POST",
    platformToken: "platform-token",
    body: {
      action: "create",
      name: `${slug} Cafe`,
      slug,
      businessType: "cafe",
      ownerName: `${slug} Owner`,
      username: "owner",
      password,
      isDemo: true,
    },
  });
  assert.equal(result.response.status, 201, JSON.stringify(result.data));
  return result.data.venueId;
}

async function login(fx, slug, username = "owner", password = "strong-owner-password") {
  return request(fx, "login", { method: "POST", body: { slug, username, password } });
}

function baseBranding(overrides = {}) {
  return {
    logoUrl: "",
    primaryColor: "#4b1d69",
    backgroundColor: "#ffffff",
    textColor: "#21172b",
    welcomeText: "",
    readyText: "",
    reviewUrl: "",
    blocks: [{ id: "tracking", type: "tracking", enabled: true }],
    ...overrides,
  };
}

test("old branding remains valid and new design defaults follow the existing surface", async () => {
  const fx = await fixture();
  const venueId = await createVenue(fx, "dark-cafe");
  const legacyBranding = baseBranding({
    primaryColor: "#f5c542",
    backgroundColor: "#111111",
    textColor: "#ffffff",
  });
  fx.sqlite.prepare("UPDATE jahiz_venues SET branding_json = ? WHERE id = ?")
    .run(JSON.stringify(legacyBranding), venueId);
  const owner = await login(fx, "dark-cafe");
  assert.equal(owner.response.status, 200);
  assert.equal(owner.data.venue.branding.surfaceColor, "#111111");
  assert.equal(owner.data.venue.branding.customPageHeight, 640);

  const saved = await request(fx, "settings", {
    method: "PATCH",
    jahizCookie: owner.cookie,
    body: { branding: legacyBranding },
  });
  assert.equal(saved.response.status, 200, JSON.stringify(saved.data));
  assert.equal(saved.data.branding.surfaceColor, "#111111");
  assert.equal(saved.data.branding.backgroundMode, "cover");
  assert.equal(saved.data.branding.layout, "centered");
  assert.equal(saved.data.branding.spacing, "comfortable");
  assert.equal(saved.data.branding.radius, "soft");
  assert.equal(saved.data.branding.align, "start");
  assert.equal(saved.data.branding.font, "sans");
  assert.equal(saved.data.branding.customHtml, "");
  assert.equal(saved.data.branding.customPageHeight, 640);
  fx.sqlite.close();
});

test("design options, raster uploads, icons, and the exact tracking invariant are strict", async () => {
  const fx = await fixture();
  await createVenue(fx, "design-cafe");
  const owner = await login(fx, "design-cafe");
  const raster = "data:image/png;base64,iVBORw0KGgo=";
  const saved = await request(fx, "settings", {
    method: "PATCH",
    jahizCookie: owner.cookie,
    body: {
      branding: baseBranding({
        logoUrl: raster,
        backgroundImage: "/jahiz/assets/background.webp",
        backgroundMode: "tile",
        surfaceColor: "#ffffff",
        layout: "split",
        spacing: "airy",
        radius: "round",
        align: "center",
        font: "serif",
        customPageHeight: 1000,
        blocks: [
          { id: "hero", type: "icon", enabled: true, icon: "coffee", url: raster, caption: "Fresh coffee" },
          { id: "welcome", type: "welcome", enabled: true, icon: "sparkles", text: "Welcome" },
          { id: "tracking", type: "tracking", enabled: false },
        ],
      }),
    },
  });
  assert.equal(saved.response.status, 200, JSON.stringify(saved.data));
  assert.equal(saved.data.branding.blocks[0].caption, "Fresh coffee");
  assert.equal(saved.data.branding.blocks[1].icon, "sparkles");
  assert.equal(saved.data.branding.blocks[2].enabled, true);

  for (const blocks of [
    [{ id: "welcome", type: "welcome", enabled: true, text: "Hello" }],
    [
      { id: "tracking-a", type: "tracking", enabled: true },
      { id: "tracking-b", type: "tracking", enabled: true },
    ],
  ]) {
    const rejected = await request(fx, "settings", {
      method: "PATCH",
      jahizCookie: owner.cookie,
      body: { branding: baseBranding({ blocks }) },
    });
    assert.equal(rejected.response.status, 400);
    assert.equal(rejected.data.error.code, "TRACKING_BLOCK_REQUIRED");
  }

  const unknown = await request(fx, "settings", {
    method: "PATCH",
    jahizCookie: owner.cookie,
    body: {
      branding: baseBranding({
        blocks: [{ id: "tracking", type: "tracking", enabled: true, executable: "no" }],
      }),
    },
  });
  assert.equal(unknown.response.status, 400);
  fx.sqlite.close();
});

test("settings remain owner-only and tenant-isolated", async () => {
  const fx = await fixture();
  const firstId = await createVenue(fx, "first-cafe");
  const secondId = await createVenue(fx, "second-cafe", "second-owner-password");
  const firstOwner = await login(fx, "first-cafe");
  const staff = await request(fx, "staff", {
    method: "POST",
    jahizCookie: firstOwner.cookie,
    body: { username: "staff", name: "Cafe Staff", password: "staff-password-123" },
  });
  assert.equal(staff.response.status, 201);
  const staffLogin = await login(fx, "first-cafe", "staff", "staff-password-123");
  const denied = await request(fx, "settings", {
    method: "PATCH",
    jahizCookie: staffLogin.cookie,
    body: { branding: baseBranding() },
  });
  assert.equal(denied.response.status, 403);

  const saved = await request(fx, "settings", {
    method: "PATCH",
    jahizCookie: firstOwner.cookie,
    body: { branding: baseBranding({ welcomeText: "First only" }) },
  });
  assert.equal(saved.response.status, 200);
  const firstBranding = JSON.parse(fx.sqlite.prepare("SELECT branding_json FROM jahiz_venues WHERE id = ?").get(firstId).branding_json);
  const secondBranding = JSON.parse(fx.sqlite.prepare("SELECT branding_json FROM jahiz_venues WHERE id = ?").get(secondId).branding_json);
  assert.equal(firstBranding.welcomeText, "First only");
  assert.equal(secondBranding.welcomeText, "");
  fx.sqlite.close();
});

test("owner sessions include editable HTML while staff sessions receive redacted branding", async () => {
  const fx = await fixture();
  await createVenue(fx, "session-cafe");
  const owner = await login(fx, "session-cafe");
  const saved = await request(fx, "settings", {
    method: "PATCH",
    jahizCookie: owner.cookie,
    body: {
      branding: baseBranding({
        welcomeText: "Native welcome",
        customHtml: "<style>.hero{color:#fff}</style><h1 class=\"hero\">Owner design</h1>",
      }),
    },
  });
  assert.equal(saved.response.status, 200);
  const staff = await request(fx, "staff", {
    method: "POST",
    jahizCookie: owner.cookie,
    body: { username: "designer-viewer", name: "Staff Viewer", password: "staff-password-123" },
  });
  assert.equal(staff.response.status, 201);
  const staffLogin = await login(fx, "session-cafe", "designer-viewer", "staff-password-123");

  const ownerSession = await request(fx, "session", { jahizCookie: owner.cookie });
  assert.match(ownerSession.data.venue.branding.customHtml, /Owner design/);
  assert.equal(ownerSession.data.venue.branding.hasCustomPage, undefined);

  const staffSession = await request(fx, "session", { jahizCookie: staffLogin.cookie });
  assert.equal(staffSession.data.venue.branding.customHtml, undefined);
  assert.equal(staffSession.data.venue.branding.hasCustomPage, true);
  assert.equal(staffSession.data.venue.branding.welcomeText, "Native welcome");
  assert.equal(staffSession.data.venue.branding.layout, "centered");
  fx.sqlite.close();
});

test("uploaded HTML is allowlist-sanitized and served only from the sandboxed active page endpoint", async () => {
  const fx = await fixture();
  const venueId = await createVenue(fx, "html-cafe");
  await createVenue(fx, "empty-cafe", "empty-owner-password");
  const owner = await login(fx, "html-cafe");
  const customHtml = `<!doctype html><html><head>
    <meta http-equiv="refresh" content="0;url=https://evil.example">
    <base href="https://evil.example/"><link rel="stylesheet" href="https://evil.example/a.css">
    <style>.hero{display:grid;background-image:url(https://images.example/hero.png)}</style>
    </head><body><main class="hero" onclick="alert(1)">
    <script>alert(1)</script><form action="https://evil.example"><input name="secret"></form>
    <a href="https://evil.example" target="_top">Read more</a>
    <img src="javascript:alert(1)"><img src="data:image/svg+xml;base64,PHN2Zz4=">
    <img src="https://images.example/photo.webp" onerror="alert(1)">
    <h1 style="color:#123456">Welcome</h1></main></body></html>`;
  const saved = await request(fx, "settings", {
    method: "PATCH",
    jahizCookie: owner.cookie,
    body: { branding: baseBranding({ customHtml }) },
  });
  assert.equal(saved.response.status, 200, JSON.stringify(saved.data));
  assert.match(saved.data.branding.customHtml, /<style>/);
  assert.match(saved.data.branding.customHtml, /https:\/\/images\.example\/photo\.webp/);
  assert.doesNotMatch(saved.data.branding.customHtml, /script|onclick|onerror|<form|<input|href=|javascript:|svg\+xml|<meta|<base|<link/i);

  const ownerSession = await request(fx, "session", { jahizCookie: owner.cookie });
  assert.equal(typeof ownerSession.data.venue.branding.customHtml, "string");
  assert.equal(ownerSession.data.venue.branding.hasCustomPage, undefined);

  const publicVenue = await request(fx, "public/venue?slug=html-cafe");
  assert.equal(publicVenue.response.status, 200);
  assert.equal(publicVenue.data.venue.branding.customHtml, undefined);
  assert.equal(publicVenue.data.venue.branding.hasCustomPage, true);

  const created = await request(fx, "orders", {
    method: "POST",
    jahizCookie: owner.cookie,
    body: { number: "123", minutes: null },
  });
  const joined = await request(fx, "public/join", {
    method: "POST",
    body: {
      slug: "html-cafe",
      number: "123",
      pickupCode: created.data.order.pickupCode,
    },
  });
  const publicOrder = await request(fx, `public/order?token=${encodeURIComponent(joined.data.token)}`);
  assert.equal(publicOrder.data.venue.branding.customHtml, undefined);
  assert.equal(publicOrder.data.venue.branding.hasCustomPage, true);

  const page = await request(fx, "public/page?slug=html-cafe");
  assert.equal(page.response.status, 200);
  assert.match(page.data, /^<!doctype html>/);
  assert.match(page.data, /jahiz-custom-page/);
  assert.doesNotMatch(page.data, /script|onclick|<form|<input|href=|javascript:/i);
  assert.equal(page.response.headers.get("X-Frame-Options"), "SAMEORIGIN");
  assert.equal(page.response.headers.get("Referrer-Policy"), "no-referrer");
  assert.equal(page.response.headers.get("X-Content-Type-Options"), "nosniff");
  assert.equal(page.response.headers.get("Cache-Control"), "no-store, max-age=0");
  assert.equal(
    page.response.headers.get("Content-Security-Policy"),
    "sandbox; default-src 'none'; script-src 'none'; style-src 'unsafe-inline'; img-src https: data:; connect-src 'none'; font-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'; frame-src 'none'; frame-ancestors 'self'"
  );

  assert.equal((await request(fx, "public/page?slug=empty-cafe")).response.status, 404);
  fx.sqlite.prepare("UPDATE jahiz_venues SET status = 'suspended' WHERE id = ?").run(venueId);
  assert.equal((await request(fx, "public/page?slug=html-cafe")).response.status, 404);
  fx.sqlite.prepare("UPDATE jahiz_venues SET status = 'active', expires_at = ? WHERE id = ?")
    .run(Math.floor(Date.now() / 1000) - 1, venueId);
  assert.equal((await request(fx, "public/page?slug=html-cafe")).response.status, 404);
  fx.sqlite.close();
});

test("settings enforce the 200KiB HTML and 1MiB request limits before writing", async () => {
  const fx = await fixture();
  await createVenue(fx, "limits-cafe");
  const owner = await login(fx, "limits-cafe");
  const htmlTooLarge = await request(fx, "settings", {
    method: "PATCH",
    jahizCookie: owner.cookie,
    body: { branding: baseBranding({ customHtml: "a".repeat(200 * 1024 + 1) }) },
  });
  assert.equal(htmlTooLarge.response.status, 400);
  assert.equal(htmlTooLarge.data.error.code, "CUSTOM_HTML_TOO_LARGE");

  const requestTooLarge = await request(fx, "settings", {
    method: "PATCH",
    jahizCookie: owner.cookie,
    body: {
      branding: baseBranding({
        customHtml: "",
        unsupportedPadding: "a".repeat(1024 * 1024),
      }),
    },
  });
  assert.equal(requestTooLarge.response.status, 413);
  assert.equal(requestTooLarge.data.error.code, "PAYLOAD_TOO_LARGE");
  fx.sqlite.close();
});
