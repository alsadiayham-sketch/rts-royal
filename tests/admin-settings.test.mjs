import test from "node:test";
import assert from "node:assert/strict";
import { onRequestPut } from "../functions/api/settings.js";
import { DEFAULT_DOWNLOAD_URL, SESSION_COOKIE_NAME } from "../functions/_lib/constants.js";

function settingsContext(content, authenticated = true) {
  const writes = [];
  const DB = {
    prepare(sql) {
      let values = [];
      return {
        bind(...args) { values = args; return this; },
        async first() {
          if (sql.includes("JOIN users")) {
            return { username: "test-admin", name: "Test admin", need_change: 0, session_version: 1 };
          }
          if (sql.includes("RETURNING count")) return { count: 1 };
          if (sql.includes("FROM site_settings")) {
            return { whatsapp_number: "972500000000", download_url: DEFAULT_DOWNLOAD_URL, content_json: "{}" };
          }
          throw new Error(`Unexpected query: ${sql}`);
        },
        async run() {
          if (sql.includes("INSERT INTO site_settings")) writes.push(values);
          else if (!/UPDATE sessions|DELETE FROM sessions|DELETE FROM rate_limits/.test(sql)) {
            throw new Error(`Unexpected mutation: ${sql}`);
          }
          return { success: true };
        },
      };
    },
  };
  return {
    writes,
    env: { DB, AUTH_SECRET: "test-only-auth-secret-not-a-production-secret" },
    request: new Request("https://admin.example/api/settings", {
      method: "PUT",
      headers: {
        Origin: "https://admin.example",
        "Content-Type": "application/json",
        ...(authenticated ? { Cookie: `${SESSION_COOKIE_NAME}=test-only-session` } : {}),
      },
      body: JSON.stringify({ content }),
    }),
  };
}

test("admin content saves persist media and background without scope errors", async () => {
  const content = {
    ceoName: "RTS",
    heroBackground: " https://example.com/background.png ",
    heroSlides: [{ type: "image", url: "/assets/logo.svg", alt: "RTS" }],
    showcases: { clinic: [{ url: "/assets/logo.svg", alt: "Clinic" }] },
  };
  const context = settingsContext(content);
  const response = await onRequestPut(context);
  assert.equal(response.status, 200);
  const saved = (await response.json()).content;
  assert.equal(saved.heroBackground, "https://example.com/background.png");
  assert.deepEqual(saved.heroSlides, content.heroSlides);
  assert.deepEqual(saved.showcases, content.showcases);
  assert.equal(context.writes.length, 1);
  assert.deepEqual(JSON.parse(context.writes[0][2]), saved);
});

test("background-only content updates validate and persist independently of slides", async () => {
  for (const background of ["https://example.com/hero.png", "", null]) {
    const context = settingsContext({ heroBackground: background });
    const response = await onRequestPut(context);
    assert.equal(response.status, 200);
    assert.equal((await response.json()).content.heroBackground, background || "");
    assert.equal(context.writes.length, 1);
  }
});

test("unsafe backgrounds never write settings, with or without slides", async () => {
  for (const extra of [{}, { heroSlides: [] }]) {
    const context = settingsContext({ ...extra, heroBackground: "javascript:alert(1)" });
    const response = await onRequestPut(context);
    assert.equal(response.status, 400);
    assert.equal((await response.json()).error.code, "INVALID_HERO_BACKGROUND");
    assert.equal(context.writes.length, 0);
  }
});

test("admin settings still require authentication", async () => {
  const context = settingsContext({ ceoName: "Unauthorized" }, false);
  const response = await onRequestPut(context);
  assert.equal(response.status, 401);
  assert.equal(context.writes.length, 0);
});
