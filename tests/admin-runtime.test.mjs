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
  return { context, listeners, elements };
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

test("saving a POS account verifies the exact saved login and distinguishes save from sign-in failures", async () => {
  for (const mode of ["success", "denied", "mismatch", "refresh", "save", "unchanged", "inactive", "d1"]) {
    const { context, elements } = adminContext();
    const password = mode === "unchanged" ? "" : " fixture password ";
    Object.assign(context, {
      mode, calls: [], messages: [],
      FormData: class {
        get(name) { return { username: " New-Worker ", name: "Worker", password }[name]; }
      },
    });
    vm.runInContext(`
      state.lang = "en";
      state.currentStore = { id: "fixture-store", backend: mode === "d1" ? "d1" : "firestore" };
      els.storeUserForm.elements = { username: {}, password: {}, role: { value: "worker" } };
      els.storeUserForm.reset = () => {};
      clearMessages = () => {};
      showAlert = message => messages.push({ error: message });
      showStatus = message => messages.push({ success: message });
      loadStoreUsers = async () => { if (mode === "refresh") throw new Error("refresh unavailable"); };
      apiFetch = async (url, options) => {
        calls.push({ url, payload: JSON.parse(options.body) });
        if (url === "/api/pos-store-users") {
          if (mode === "save") throw new Error("save rejected");
          return { user: { username: "new-worker", role: "worker", active: mode !== "inactive" } };
        }
        if (mode === "denied") throw new Error("licence expired");
        return { token: "fixture-only", user: { username: "new-worker", role: "worker" },
          store: { id: mode === "mismatch" ? "wrong-store" : "fixture-store" } };
      };
    `, context);
    await vm.runInContext("handleStoreUserSave({ preventDefault() {} })", context);
    const expectedVerification = !["save", "unchanged", "inactive", "d1"].includes(mode);
    assert.equal(context.calls.length, expectedVerification ? 2 : 1, mode);
    assert.equal(context.calls[0].payload.password, password, "preserve exact password whitespace");
    if (expectedVerification) {
      assert.equal(context.calls[1].url, "/api/pos-login");
      assert.deepEqual(JSON.parse(JSON.stringify(context.calls[1].payload)), {
        storeId: "fixture-store", username: "new-worker", password,
      });
    }
    const result = context.messages.at(-1);
    if (["denied", "mismatch", "refresh"].includes(mode)) {
      assert.match(result.error, /account was saved/i, mode);
      assert.equal(result.success, undefined);
    } else if (mode === "save") {
      assert.equal(result.error, "save rejected");
    } else {
      assert.match(result.success, /store ID fixture-store, username new-worker/);
      if (mode === "success") assert.match(result.success, /POS sign-in verified/);
      else assert.doesNotMatch(result.success, /POS sign-in verified/);
    }
    assert.equal(elements.get("store-user-submit").disabled, false);
    assert.equal(elements.get("store-user-password").value, "");
    assert.equal(vm.runInContext("state.pending.size", context), 0);
  }
});

test("editing a POS account targets its original username despite input changes", async () => {
  const { context } = adminContext();
  Object.assign(context, {
    calls: [],
    FormData: class {
      get(name) { return { username: "different-account", name: "Updated name", password: "" }[name]; }
    },
  });
  vm.runInContext(`
    state.currentStore = { id: "fixture-store", backend: "firestore" };
    state.editingStoreUsername = "original-worker";
    els.storeUserForm.elements = { username: {}, password: {}, role: { value: "worker" } };
    els.storeUserForm.reset = () => {};
    clearMessages = showAlert = showStatus = () => {};
    loadStoreUsers = async () => {};
    apiFetch = async (url, options) => {
      calls.push(JSON.parse(options.body));
      return { user: { username: "original-worker", role: "worker", active: true } };
    };
  `, context);
  await vm.runInContext("handleStoreUserSave({ preventDefault() {} })", context);
  assert.equal(context.calls.length, 1);
  assert.equal(context.calls[0].username, "original-worker");
  assert.equal(context.calls[0].name, "Updated name");
});
