import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const root = new URL("../public/jahiz/", import.meta.url);
const read = path => readFile(new URL(path, root), "utf8");

test("Jahiz routes load only local assets and their required API contracts", async () => {
  const [home, signup, login, owner, join, order, poster, app] = await Promise.all([
    read("index.html"), read("signup/index.html"), read("login/index.html"), read("owner/index.html"), read("s/index.html"),
    read("order/index.html"), read("poster/index.html"), read("jahiz.js")
  ]);
  for (const page of [home, signup, login, owner, join, order, poster]) {
    assert.match(page, /\/jahiz\/jahiz\.css/);
    assert.doesNotMatch(page, /https?:\/\//);
  }
  for (const route of ["/session", "/login", "/logout", "/password", "/applications", "/orders", "/settings", "/staff", "/public/venue", "/public/join", "/public/order"]) {
    assert.match(app, new RegExp(route.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
  assert.match(owner, /\/jahiz\/vendor\/qrcode\.js/);
  assert.match(poster, /\/jahiz\/vendor\/qrcode\.js/);
  assert.match(app, /QRCode\.toDataURL/);
  assert.match(app, /QRCode\.toString/);
  assert.match(app, /page === "home" \|\| page === "signup"/);
  assert.match(app, /get\("shop"\)/);
  assert.match(app, /pickupCode/);
  assert.match(app, /normalizePickupCode/);
  assert.match(app, /history\.replaceState/);
  assert.match(app, /new URLSearchParams\(\{ number: order\.number, code: normalizePickupCode/);
});

test("Jahiz protects customer rendering and exposes safe builder contracts", async () => {
  const app = await read("jahiz.js");
  assert.doesNotMatch(app, /\.innerHTML\s*=/);
  assert.doesNotMatch(app, /srcdoc\s*=/);
  assert.match(app, /safeUrl/);
  assert.match(app, /imageFileError/);
  assert.match(app, /MAX_BLOCKS/);
  assert.match(app, /hasCustomPage/);
  assert.match(app, /sandbox:\s*""/);
  assert.match(app, /public\/page\?slug=/);
  assert.match(app, /dragstart/);
  assert.match(app, /moveBlock/);
  assert.match(app, /visibilityState === "visible"/);
  assert.match(app, /navigator\.wakeLock/);
  assert.match(app, /autocomplete: "one-time-code"/);
  assert.match(app, /pickupCode: code/);
  assert.match(app, /copyTrackingLink/);
  assert.doesNotMatch(app, /console\.(?:log|info|debug).*pickupCode/);
});
