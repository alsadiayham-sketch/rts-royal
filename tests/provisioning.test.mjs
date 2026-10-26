import test from "node:test";
import assert from "node:assert/strict";

import { onRequestPost as createStore } from "../functions/api/pos-stores.js";
import { onRequestPost as createClinic } from "../functions/api/clinics.js";
import { onRequestPost as ownerLogin } from "../functions/owner/login.js";
import { onRequestGet as ownerDashboard } from "../functions/owner/dashboard.js";
import { createStoredPosPassword } from "../functions/_lib/pos-password.js";

function firestoreFields(value) {
  if (Array.isArray(value)) return { arrayValue: { values: value.map(firestoreFields) } };
  if (value && typeof value === "object") {
    return { mapValue: { fields: Object.fromEntries(Object.entries(value).map(([key, item]) => [key, firestoreFields(item)])) } };
  }
  if (typeof value === "boolean") return { booleanValue: value };
  if (typeof value === "number") return { integerValue: String(value) };
  return { stringValue: String(value) };
}

function firestoreDocument(data, updateTime = "2026-10-11T00:00:00.000000Z") {
  return { updateTime, fields: Object.fromEntries(Object.entries(data).map(([key, value]) => [key, firestoreFields(value)])) };
}

function database() {
  const calls = [];
  return {
    calls,
    prepare(sql) {
      let values = [];
      return {
        bind(...args) {
          values = args;
          return this;
        },
        async first() {
          if (sql.includes("JOIN users")) {
            return { username: "admin", name: "Admin", role: "platform_admin", need_change: 0, session_version: 1 };
          }
          if (sql.includes("RETURNING count")) return { count: 1 };
          if (sql.includes("SELECT 1 FROM credit_accounts")) return null;
          if (sql.includes("FROM credit_settings")) {
            return { default_message_balance: 500, customer_price_agorot: 20, platform_cost_agorot: 10 };
          }
          throw new Error(`Unexpected query: ${sql}`);
        },
        async run() {
          calls.push({ sql, values });
          return { meta: { changes: 1 } };
        },
      };
    },
  };
}

function adminRequest(path, payload) {
  return new Request(`https://admin.example${path}`, {
    method: "POST",
    headers: {
      Origin: "https://admin.example",
      "Content-Type": "application/json",
      Cookie: "__Host-rts_session=admin-session",
    },
    body: JSON.stringify(payload),
  });
}

function useFirestoreMock(documents, { commitStatus = 200, capture = [], patches = [] } = {}) {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input, options = {}) => {
    const url = new URL(input);
    if (url.pathname.endsWith(":commit")) {
      capture.push(JSON.parse(options.body));
      return new Response(JSON.stringify({ writeResults: [] }), { status: commitStatus });
    }
    const path = decodeURIComponent(url.pathname.split("/documents/")[1] || "");
    if (options.method === "PATCH") {
      const body = JSON.parse(options.body);
      patches.push({ path, body });
      documents[path] = { fields: body.fields };
      return new Response(JSON.stringify(documents[path]), { status: 200 });
    }
    const document = documents[path];
    return document
      ? new Response(JSON.stringify(document), { status: 200 })
      : new Response("", { status: 404 });
  };
  return () => {
    globalThis.fetch = originalFetch;
  };
}

test("clinic provisioning atomically creates owner, licence, registry, and D1 credit account", async () => {
  const commits = [];
  const restoreFetch = useFirestoreMock({
    "projects/_global/settings/pos_stores": firestoreDocument({ stores: [] }),
  }, { capture: commits });
  try {
    const DB = database();
    const response = await createClinic({
      request: adminRequest("/api/clinics", {
        id: "north-clinic",
        name: "North Clinic",
        warrantyMonths: 12,
        adminUsername: "clinic.owner",
        adminName: "Clinic Owner",
        adminPassword: "clinic-owner-password",
        initialUsers: [{ username: "reception", name: "Reception", password: "reception-password", role: "worker" }],
      }),
      env: { DB, AUTH_SECRET: "test-only-auth-secret-is-long-enough" },
    });
    assert.equal(response.status, 201);
    assert.equal(commits.length, 1);
    const writes = commits[0].writes;
    assert.equal(writes.length, 3);
    const registry = writes.find((write) => write.update.name.endsWith("/projects/_global/settings/pos_stores"));
    assert.equal(registry.update.fields.stores.arrayValue.values[0].mapValue.fields.productType.stringValue, "clinic");
    assert.equal(registry.update.fields.stores.arrayValue.values[0].mapValue.fields.ownerUsername.stringValue, "clinic.owner");
    const users = writes.find((write) => write.update.name.endsWith("/settings/pos_users"));
    const owner = users.update.fields.users.arrayValue.values[0].mapValue.fields;
    assert.equal(owner.isOwner.booleanValue, true);
    assert.equal(owner.password, undefined);
    assert.ok(owner.passwordHash.stringValue);
    assert.ok(DB.calls.some((call) => call.sql.includes("INSERT OR IGNORE INTO credit_accounts")));
  } finally {
    restoreFetch();
  }
});

test("business provisioning rejects IDs used by clinics before creating any record", async () => {
  const commits = [];
  const restoreFetch = useFirestoreMock({
    "projects/_global/settings/pos_stores": firestoreDocument({
      stores: [{ id: "shared-id", name: "Existing clinic", type: "clinic", productType: "clinic" }],
    }),
  }, { capture: commits });
  try {
    const DB = database();
    const response = await createStore({
      request: adminRequest("/api/pos-stores", {
        id: "shared-id",
        name: "New Business",
        backend: "firestore",
        warrantyMonths: 12,
        adminUsername: "business.owner",
        adminName: "Business Owner",
        adminPassword: "business-owner-password",
      }),
      env: { DB, AUTH_SECRET: "test-only-auth-secret-is-long-enough" },
    });
    assert.equal(response.status, 409);
    assert.equal((await response.json()).error.code, "STORE_EXISTS");
    assert.equal(commits.length, 0);
    assert.equal(DB.calls.some((call) => call.sql.includes("credit_accounts")), false);
  } finally {
    restoreFetch();
  }
});

test("D1 business provisioning records the owner and desktop backend contract", async () => {
  const commits = [];
  const restoreFetch = useFirestoreMock({
    "projects/_global/settings/pos_stores": firestoreDocument({ stores: [] }),
  }, { capture: commits });
  try {
    const DB = database();
    const response = await createStore({
      request: adminRequest("/api/pos-stores", {
        id: "royal-market",
        name: "Royal Market",
        backend: "d1",
        linkedProject: "market-web",
        apiBaseUrl: "https://market.example.com",
        messagingEnabled: true,
        warrantyMonths: 12,
        adminUsername: "market.owner",
        adminName: "Market Owner",
        adminPassword: "market-owner-password",
      }),
      env: { DB, AUTH_SECRET: "test-only-auth-secret-is-long-enough" },
    });
    assert.equal(response.status, 201);
    const writes = commits[0].writes;
    const licence = writes.find((write) => write.update.name.endsWith("/projects/royal-market/settings/pos"));
    assert.equal(licence.update.fields.dataBackend.stringValue, "d1");
    assert.equal(licence.update.fields.productType.stringValue, "business");
    assert.equal(licence.update.fields.apiBaseUrl.stringValue, "https://market.example.com");
    assert.equal(licence.update.fields.messaging.mapValue.fields.enabled.booleanValue, true);
    assert.equal(licence.update.fields.messaging.mapValue.fields.contractVersion.integerValue, "1");
    const users = writes.find((write) => write.update.name.endsWith("/settings/pos_users"));
    assert.equal(users.update.fields.users.arrayValue.values[0].mapValue.fields.isOwner.booleanValue, true);
  } finally {
    restoreFetch();
  }
});

test("Firestore Business creation provisions server authentication without changing data routing", async () => {
  const commits = [];
  const restoreFetch = useFirestoreMock({
    "projects/_global/settings/pos_stores": firestoreDocument({ stores: [] }),
  }, { capture: commits });
  try {
    const response = await createStore({
      request: adminRequest("/api/pos-stores", {
        id: "rts-resturant", name: "Restaurant Test", backend: "firestore",
        warrantyMonths: 12, adminUsername: "owner", adminName: "Owner",
        adminPassword: "fixture-only-owner-password",
      }),
      env: { DB: database(), AUTH_SECRET: "test-only-auth-secret-is-long-enough" },
    });
    assert.equal(response.status, 201);
    const fields = commits[0].writes.find((write) => write.update.name.endsWith("/settings/pos")).update.fields;
    assert.equal(fields.dataBackend.stringValue, "firestore");
    assert.equal(fields.authBackend.stringValue, "rts");
    assert.equal(fields.authContractVersion.integerValue, "1");
    assert.equal(fields.authApiBaseUrl.stringValue, "https://rts-royal.pages.dev");
    assert.equal(fields.apiBaseUrl, undefined);
    assert.equal(fields.messaging.mapValue.fields.enabled.booleanValue, false);
  } finally {
    restoreFetch();
  }
});

test("a failed Firestore commit compensates a newly created D1 credit account", async () => {
  const restoreFetch = useFirestoreMock({
    "projects/_global/settings/pos_stores": firestoreDocument({ stores: [] }),
  }, { commitStatus: 409 });
  try {
    const DB = database();
    const response = await createStore({
      request: adminRequest("/api/pos-stores", {
        id: "rollback-store",
        name: "Rollback Store",
        backend: "firestore",
        warrantyMonths: 12,
        adminUsername: "rollback.owner",
        adminName: "Rollback Owner",
        adminPassword: "rollback-owner-password",
      }),
      env: { DB, AUTH_SECRET: "test-only-auth-secret-is-long-enough" },
    });
    assert.equal(response.status, 409);
    assert.equal((await response.json()).error.code, "POS_REGISTRY_CONFLICT");
    assert.ok(DB.calls.some((call) => call.sql.startsWith("DELETE FROM credit_accounts")));
  } finally {
    restoreFetch();
  }
});

test("Tracking owner login and dashboard enforce the provisioned product mode", async () => {
  const store = {
    id: "north-clinic",
    name: "North Clinic",
    type: "clinic",
    productType: "clinic",
    ownerUsername: "clinic.owner",
    ownerName: "Clinic Owner",
  };
  const ownerPassword = await createStoredPosPassword("hashed-owner-password");
  const documents = {
    "projects/_global/settings/pos_stores": firestoreDocument({ stores: [store] }),
    "projects/north-clinic/settings/pos_users": firestoreDocument({
      users: [{
        username: "clinic.owner",
        ...ownerPassword,
        passwordVersion: 1,
        name: "Clinic Owner",
        displayName: "Clinic Owner",
        role: "admin",
        active: true,
      }],
    }),
    "projects/north-clinic/settings/pos": firestoreDocument({ warrantyEnd: "2030-01-01T00:00:00.000Z" }),
  };
  const restoreFetch = useFirestoreMock(documents);
  try {
    const DB = database();
    const loginResponse = await ownerLogin({
      request: new Request("https://admin.example/owner/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organizationName: "North Clinic",
          username: "clinic.owner",
          password: "hashed-owner-password",
        }),
      }),
      env: { DB, AUTH_SECRET: "test-only-auth-secret-is-long-enough" },
    });
    assert.equal(loginResponse.status, 200);
    const session = await loginResponse.json();
    assert.equal(session.mode, "clinic");
    assert.equal(session.organizationName, "North Clinic");

    const dashboard = await ownerDashboard({
      request: new Request("https://admin.example/owner/dashboard?mode=clinic", {
        headers: { Authorization: `Bearer ${session.token}` },
      }),
      env: { AUTH_SECRET: "test-only-auth-secret-is-long-enough" },
    });
    assert.equal(dashboard.status, 200);
    assert.equal((await dashboard.json()).mode, "clinic");

    const forbidden = await ownerDashboard({
      request: new Request("https://admin.example/owner/dashboard?mode=business", {
        headers: { Authorization: `Bearer ${session.token}` },
      }),
      env: { AUTH_SECRET: "test-only-auth-secret-is-long-enough" },
    });
    assert.equal(forbidden.status, 403);

    documents["projects/north-clinic/settings/pos_users"] = firestoreDocument({
      users: [{
        username: "clinic.owner",
        ...ownerPassword,
        passwordVersion: 2,
        name: "Clinic Owner",
        displayName: "Clinic Owner",
        role: "admin",
        active: true,
      }],
    });
    const revoked = await ownerDashboard({
      request: new Request("https://admin.example/owner/dashboard?mode=clinic", {
        headers: { Authorization: `Bearer ${session.token}` },
      }),
      env: { AUTH_SECRET: "test-only-auth-secret-is-long-enough" },
    });
    assert.equal(revoked.status, 401);
  } finally {
    restoreFetch();
  }
});

test("Tracking owner login accepts organization IDs and migrates legacy owner records", async () => {
  const commits = [];
  const restoreFetch = useFirestoreMock({
    "projects/_global/settings/pos_stores": firestoreDocument({
      stores: [{
        id: "rts-testing",
        name: "RTS Clinic · rts-testing",
        type: "firestore",
      }],
    }),
    "projects/rts-testing/settings/pos_users": firestoreDocument({
      users: [{
        username: "legacy.owner",
        password: "legacy-plaintext-password",
        role: "admin",
        active: true,
      }],
    }),
  }, { capture: commits });
  try {
    const response = await ownerLogin({
      request: new Request("https://admin.example/owner/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organizationName: "rts-testing",
          username: "legacy.owner",
          password: "legacy-plaintext-password",
        }),
      }),
      env: { DB: database(), AUTH_SECRET: "test-only-auth-secret-is-long-enough" },
    });
    assert.equal(response.status, 200);
    const session = await response.json();
    assert.equal(session.mode, "clinic");
    assert.equal(commits.length, 1);
    const migrationWrite = commits[0].writes[0];
    assert.equal(migrationWrite.currentDocument.updateTime, "2026-10-11T00:00:00.000000Z");
    const migratedOwner = migrationWrite.update.fields.users.arrayValue.values[0].mapValue.fields;
    assert.equal(migratedOwner.password, undefined);
    assert.ok(migratedOwner.passwordHash.stringValue);
    assert.equal(migratedOwner.passwordVersion.integerValue, "1");
  } finally {
    restoreFetch();
  }
});
