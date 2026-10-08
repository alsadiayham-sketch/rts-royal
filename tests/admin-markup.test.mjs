import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const html = await readFile(new URL("../public/admin/index.html", import.meta.url), "utf8");
const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]);

test("admin controls have unique IDs and all label targets exist", () => {
  assert.equal(new Set(ids).size, ids.length, "duplicate IDs break form bindings");
  for (const [, target] of html.matchAll(/<label\b[^>]*\bfor="([^"]+)"/g)) {
    assert.ok(ids.includes(target), `label target does not exist: ${target}`);
  }
});

test("every admin navigation destination has a matching panel", () => {
  const tabs = [...html.matchAll(/\bdata-tab="([^"]+)"/g)].map(match => match[1]);
  assert.ok(tabs.length >= 7, "existing admin workflows must remain accessible");
  for (const tab of tabs) assert.ok(ids.includes(`tab-${tab}`), `missing panel: ${tab}`);
  for (const id of ids.filter(id => id.startsWith("tab-"))) {
    assert.ok(tabs.includes(id.slice(4)), `unreachable panel: ${id}`);
  }
});

test("admin forms preserve authentication and core management entry points", () => {
  for (const id of [
    "login-form", "settings-form", "store-form", "clinic-form", "store-user-form",
    "credit-settings-form", "credit-allocation-form", "credit-usage-form",
    "add-user-form", "password-form", "logout-btn",
  ]) assert.ok(ids.includes(id), `missing workflow entry point: ${id}`);
  assert.match(html, /id="global-status"[^>]*role="status"/);
  assert.match(html, /id="global-alert"[^>]*role="alert"/);
});
