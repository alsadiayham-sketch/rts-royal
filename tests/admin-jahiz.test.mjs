import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

const html = await readFile(new URL("../public/admin/index.html", import.meta.url), "utf8");
const source = await readFile(new URL("../public/admin/admin.js", import.meta.url), "utf8");

test("Jahiz tab markup is wired into navigation and panels", () => {
  assert.match(html, /\bdata-tab="jahiz"/);
  assert.match(html, /\bid="tab-jahiz"/);
  assert.match(html, /\bid="jahiz-create-form"/);
  assert.match(html, /\bid="jahiz-approve-dialog"/);
  assert.match(html, /\bid="jahiz-subscription-dialog"/);
  assert.match(html, /\bid="jahiz-reset-dialog"/);
});

test("Jahiz translations exist in Arabic and English dictionaries", () => {
  const context = vm.createContext({
    localStorage: { getItem() { return null; }, setItem() {} },
    document: { documentElement: {}, getElementById() { return null; }, querySelectorAll() { return []; } },
    crypto: { getRandomValues(arr) { return arr.fill(1); } },
  });
  const declarations = source.replace(/^initAdmin\(\);\s*$/m, "");
  vm.runInContext(declarations, context);
  const required = [
    "tabJahiz",
    "jahizIntro",
    "jahizCreateVenueTitle",
    "jahizPlanManagerTitle",
    "jahizRecordPaymentTitle",
    "jahizApplicationsTitle",
    "jahizVenuesTitle",
  ];
  const dictionaries = vm.runInContext("I18N", context);
  for (const key of required) {
    assert.ok(dictionaries.ar[key], `missing ar key: ${key}`);
    assert.ok(dictionaries.en[key], `missing en key: ${key}`);
  }
});

test("currency minor unit conversion supports JOD 3 decimals and ILS/USD 2", () => {
  const context = vm.createContext({
    localStorage: { getItem() { return null; }, setItem() {} },
    document: { documentElement: {}, getElementById() { return null; }, querySelectorAll() { return []; } },
    crypto: { getRandomValues(arr) { return arr.fill(2); } },
  });
  const declarations = source.replace(/^initAdmin\(\);\s*$/m, "");
  vm.runInContext(declarations, context);
  assert.equal(vm.runInContext("toAmountMinor('10.125','JOD')", context), 10125);
  assert.equal(vm.runInContext("toAmountMinor('10.12','USD')", context), 1012);
  assert.equal(vm.runInContext("toAmountMinor('10.12','ILS')", context), 1012);
});
