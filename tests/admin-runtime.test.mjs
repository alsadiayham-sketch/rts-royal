import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

const source = await readFile(new URL("../public/admin/admin.js", import.meta.url), "utf8");
const html = await readFile(new URL("../public/admin/index.html", import.meta.url), "utf8");

function adminContext() {
  const listeners = [];
  const makeElement = (id = "") => ({
    id,
    value: "",
    textContent: "",
    dataset: {},
    classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } },
    setAttribute() {},
    append() {},
    addEventListener(event, handler) {
      assert.equal(typeof handler, "function", `${id}:${event} must reference an accessible handler`);
      listeners.push(`${id}:${event}`);
    },
  });
  const elements = new Map([...html.matchAll(/\bid="([^"]+)"/g)]
    .map(([, id]) => [id, makeElement(id)]));
  const context = vm.createContext({
    console,
    localStorage: { getItem() { return null; }, setItem() {} },
    document: {
      documentElement: makeElement(),
      getElementById(id) { return elements.get(id) || null; },
      querySelectorAll() { return []; },
      createElement() { return makeElement(); },
    },
  });
  // Evaluate declarations separately so these checks do not need a browser or network.
  const declarations = source.replace(/^initAdmin\(\);\s*$/m, "");
  assert.notEqual(declarations, source, "keep the single startup call explicit");
  vm.runInContext(declarations, context);
  return { context, listeners };
}

test("admin startup dependencies and form handlers remain in callable scope", () => {
  const { context, listeners } = adminContext();
  for (const name of [
    "initAdmin", "initForms", "initTabs", "initMobileNavigation",
    "renderOverview", "bootstrapSession", "handleCreditUsage", "deleteStoreUser",
  ]) {
    assert.equal(vm.runInContext(`typeof ${name}`, context), "function", `${name} was moved out of startup scope`);
  }
  vm.runInContext("initForms(); renderOverview();", context);
  for (const event of ["login-form:submit", "credit-usage-form:submit", "logout-btn:click"]) {
    assert.ok(listeners.includes(event), `missing binding: ${event}`);
  }
});

test("Arabic and English cover every static translation key", () => {
  const { context } = adminContext();
  const dictionaries = vm.runInContext("I18N", context);
  for (const [, key] of html.matchAll(/\bdata-i18n(?:-placeholder)?="([^"]+)"/g)) {
    for (const language of ["ar", "en"]) {
      assert.ok(dictionaries[language][key], `missing ${language} translation: ${key}`);
    }
  }
});

test("D1 Business creation keeps owner credentials and normalizes messaging entitlement", () => {
  assert.doesNotMatch(source, /payload\.backend === "d1"[\s\S]{0,180}delete payload\.adminUsername/);
  assert.match(source, /payload\.messagingEnabled = payload\.messagingEnabled === "on"/);
  assert.match(source, /users\.addEventListener\("click", \(\) => openStoreUsers\(store\)\)/);
});

test("central mode control saves the selected mode and permits retry after PATCH or refresh failure", async () => {
  for (const fails of [false, "patch", "refresh"]) {
    const { context } = adminContext();
    Object.assign(context, {
      calls: [], store: { id: "restaurant-test", businessType: "shop" },
      select: { value: "restaurant", disabled: false },
      button: { disabled: false }, fails,
    });
    vm.runInContext(`
      clearMessages = () => {};
      showAlert = message => calls.push({ error: message });
      showStatus = message => calls.push({ success: message });
      loadStores = async () => {
        if (fails === "refresh") throw new Error("refresh failed");
        calls.push({ refreshed: true });
      };
      apiFetch = async (url, options) => {
        calls.push({ url, method: options.method, payload: JSON.parse(options.body) });
        if (fails === "patch") throw new Error("save failed");
        return { ok: true };
      };
    `, context);
    await vm.runInContext("updateStoreBusinessType(store, select, button)", context);
    const request = context.calls[0];
    assert.equal(request.url, "/api/pos-stores");
    assert.equal(request.method, "PATCH");
    assert.equal(request.payload.action, "set-business-type");
    assert.equal(request.payload.businessType, "restaurant");
    assert.equal(request.payload.id, "restaurant-test");
    assert.equal(context.store.businessType, fails ? "shop" : "restaurant");
    assert.equal(context.select.disabled, false);
    assert.equal(context.button.disabled, !fails);
    assert.equal(vm.runInContext("state.pending.size", context), 0);
    assert.ok(context.calls.some(call => fails ? call.error : call.success));
  }
});
