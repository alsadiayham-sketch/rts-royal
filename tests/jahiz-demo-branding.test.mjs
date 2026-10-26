import test from "node:test";
import assert from "node:assert/strict";

import { getJahizDemoBranding, jahizDemoBranding } from "../scripts/jahiz-demo-branding.mjs";
import { validateBranding } from "../functions/_lib/jahiz-validation.js";

const expected = {
  cafe: "demo-cafe.jpg",
  kitchen: "demo-kitchen.jpg",
  bakery: "demo-bakery.jpg",
};

test("fictional Jahiz demos are complete, bilingual, native, and validator-safe", () => {
  assert.deepEqual(Object.keys(jahizDemoBranding), Object.keys(expected));

  for (const [name, image] of Object.entries(expected)) {
    const branding = getJahizDemoBranding(name);
    const validated = validateBranding(branding);
    assert.equal(validated.customHtml, "");
    assert.equal(validated.backgroundImage, `/jahiz/assets/${image}`);
    assert.equal(validated.blocks[0].type, "image");
    assert.equal(validated.blocks[0].url, `/jahiz/assets/${image}`);
    assert.equal(validated.blocks.filter(block => block.type === "tracking").length, 1);
    assert.equal(validated.blocks.find(block => block.type === "tracking").enabled, true);
    assert.match(validated.welcomeText, /[ء-ي]/);
    assert.match(validated.welcomeText, /[A-Za-z]/);
  }
});

test("fictional Jahiz demo branding returns independent patch copies", () => {
  const first = getJahizDemoBranding("cafe");
  first.blocks[0].url = "/untrusted.jpg";
  assert.equal(getJahizDemoBranding("cafe").blocks[0].url, "/jahiz/assets/demo-cafe.jpg");
  assert.throws(() => getJahizDemoBranding("unknown"), /Unknown Jahiz demo branding/);
});
