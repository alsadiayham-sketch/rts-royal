import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import {
  MAX_BLOCKS, MAX_CUSTOM_PAGE_BYTES, combineCustomFiles, customFilesError, defaultBranding,
  exportTemplate, imageFileError, importTemplate, normalizeBranding,
} from "../public/jahiz/jahiz-designer.js";
import { ICONS, iconSvg } from "../public/jahiz/jahiz-icons.js";

test("designer normalizes a complete native page and keeps protected tracking enabled", () => {
  const branding = normalizeBranding({
    ...defaultBranding(),
    layout: "split",
    spacing: "airy",
    radius: "round",
    customPageHeight: 5000,
    blocks: [{ id: "intro", type: "text", text: "Welcome", enabled: true }],
  });

  assert.equal(branding.layout, "split");
  assert.equal(branding.spacing, "airy");
  assert.equal(branding.radius, "round");
  assert.equal(branding.customPageHeight, 640);
  assert.equal(branding.blocks.filter(block => block.type === "tracking").length, 1);
  assert.equal(branding.blocks.find(block => block.type === "tracking").enabled, true);
});

test("template exchange round-trips safe styling but rejects foreign and prototype-shaped payloads", () => {
  const source = normalizeBranding({ ...defaultBranding(), backgroundImage: "/uploads/cover.webp", blocks: [
    { id: "hello", type: "icon", icon: "coffee", text: "Fresh today", enabled: true },
    { id: "tracking", type: "tracking", enabled: true },
  ] });
  const restored = importTemplate(exportTemplate(source));
  assert.equal(restored.backgroundImage, "/uploads/cover.webp");
  assert.equal(restored.blocks[0].icon, "coffee");
  assert.throws(() => importTemplate('{"format":"other","version":1,"branding":{}}'), /not a Jahiz page template/);
  assert.throws(() => importTemplate('{"format":"jahiz-page","version":1,"branding":{"__proto__":{}}}'), /unsupported keys/);
});

test("custom HTML is treated as a stored file payload with strict combined-size limits", () => {
  const html = { name: "page.html", size: 100 };
  const css = { name: "page.css", size: 120 };
  assert.equal(customFilesError(html, css), "");
  assert.match(combineCustomFiles("<main>Safe transfer</main>", "h1{color:purple}"), /<style>/);
  assert.match(customFilesError({ name: "page.html", size: MAX_CUSTOM_PAGE_BYTES }, { name: "page.css", size: 1 }), /200 KB/);
  assert.match(customFilesError({ name: "page.txt", size: 1 }), /HTML file/);
});

test("asset and icon constraints only allow curated SVG paths and raster-sized uploads", () => {
  assert.equal(imageFileError({ type: "image/png", size: 200 * 1024 }), "");
  assert.match(imageFileError({ type: "image/svg+xml", size: 10 }), /PNG, JPEG, or WebP/);
  assert.match(imageFileError({ type: "image/webp", size: 200 * 1024 + 1 }), /200 KB/);
  assert.equal(ICONS.length, 10);
  assert.match(iconSvg("coffee"), /<path d="/);
  assert.doesNotMatch(iconSvg("coffee"), /<script|onload=/i);
  assert.ok(MAX_BLOCKS <= 12);
});

test("wide customer pages and desktop previews override legacy narrow containers", async () => {
  const css = await readFile(new URL("../public/jahiz/jahiz.css", import.meta.url), "utf8");
  assert.match(css, /\.j-customer-page\{max-width:1240px\}/);
  assert.match(css, /\.j-device\.desktop\{max-width:none;width:100%/);
  assert.match(css, /\.j-custom-page\{display:block;width:100%;max-width:100%/);
});
