import test from "node:test";
import assert from "node:assert/strict";

import {
  canonicalizePhone,
  isAllowedDownloadUrl,
  normalizeUsername,
  validateDisplayName,
  validateNewPassword,
} from "../functions/_lib/validation.js";
import { jsonResponse, requireTrustedMutationRequest } from "../functions/_lib/http.js";
import { createPasswordRecord, verifyPassword } from "../functions/_lib/crypto.js";
import { createStoredPosPassword, verifyStoredPosPassword } from "../functions/_lib/pos-password.js";
import { assertUserStatusChangeAllowed } from "../functions/_lib/user-rules.js";
import { createRateLimitKey } from "../functions/_lib/rate-limit.js";
import {
  normalizeApiBaseUrl,
  normalizeBackend,
  normalizeStoreId,
  normalizeStoreName,
  normalizeWarrantyMonths,
} from "../functions/_lib/pos-store-validation.js";

test("normalizeUsername enforces lowercase ascii format", () => {
  assert.equal(normalizeUsername(" Admin.User-1 "), "admin.user-1");
  assert.equal(normalizeUsername("UPPER"), "upper");
  assert.equal(normalizeUsername("ab"), null);
  assert.equal(normalizeUsername("bad space"), null);
  assert.equal(normalizeUsername("équipe"), null);
});

test("validateDisplayName accepts readable names and rejects invalid", () => {
  assert.equal(validateDisplayName("  Ayham Alsadi "), "Ayham Alsadi");
  assert.equal(validateDisplayName("مؤسسة RTS"), "مؤسسة RTS");
  assert.equal(validateDisplayName("x"), null);
  assert.equal(validateDisplayName("<script>"), null);
});

test("canonicalizePhone validates canonical business number format", () => {
  assert.equal(canonicalizePhone("+972 56-923-6758"), "972569236758");
  assert.equal(canonicalizePhone("00123"), null);
  assert.equal(canonicalizePhone("099"), null);
});

test("download URL allowlist rejects arbitrary destinations", () => {
  assert.equal(
    isAllowedDownloadUrl(
      "https://github.com/alsadiayham-sketch/rts-business-releases/releases/latest/download/RTS-Business-Setup.exe"
    ),
    true
  );
  assert.equal(
    isAllowedDownloadUrl(
      "https://github.com/alsadiayham-sketch/rts-business-releases/releases/download/v4.0.0/RTS-Business-Setup.exe"
    ),
    true
  );
  assert.equal(isAllowedDownloadUrl("https://example.com/file.exe"), false);
});

test("POS store provisioning inputs are strictly normalized", () => {
  assert.equal(normalizeStoreId(" Royal-Market "), "royal-market");
  assert.equal(normalizeStoreId("../market"), null);
  assert.equal(normalizeStoreName("  Royal Market  "), "Royal Market");
  assert.equal(normalizeStoreName("x"), null);
  assert.equal(normalizeBackend("d1"), "d1");
  assert.equal(normalizeBackend("other"), null);
  assert.equal(normalizeWarrantyMonths(12), 12);
  assert.equal(normalizeWarrantyMonths(0), null);
  assert.equal(normalizeApiBaseUrl("https://shop.pages.dev/"), "https://shop.pages.dev");
  assert.equal(normalizeApiBaseUrl("http://shop.example.com"), null);
});

test("new passwords require minimum length", () => {
  assert.equal(validateNewPassword("short"), false);
  assert.equal(validateNewPassword("test-only-password-123"), true);
  assert.equal(validateNewPassword("x".repeat(129)), false);
});

test("mutation origin and fetch metadata are strictly enforced", () => {
  const goodReq = new Request("https://rts.example.com/api/login", {
    method: "POST",
    headers: {
      Origin: "https://rts.example.com",
      "Sec-Fetch-Site": "same-origin",
    },
  });
  assert.doesNotThrow(() => requireTrustedMutationRequest(goodReq));

  const missingOrigin = new Request("https://rts.example.com/api/login", {
    method: "POST",
    headers: { "Sec-Fetch-Site": "same-origin" },
  });
  assert.throws(() => requireTrustedMutationRequest(missingOrigin));

  const badFetchSite = new Request("https://rts.example.com/api/login", {
    method: "POST",
    headers: {
      Origin: "https://rts.example.com",
      "Sec-Fetch-Site": "cross-site",
    },
  });
  assert.throws(() => requireTrustedMutationRequest(badFetchSite));
});

test("password hashing verifies correctly and accepts legacy weak input for login checks", async () => {
  const weakLegacy = "test-legacy-weak";
  const record = await createPasswordRecord(weakLegacy, 100000);
  assert.equal(record.iterations, 100000);
  assert.equal(await verifyPassword(weakLegacy, record), true);
  assert.equal(await verifyPassword("test-wrong-password", record), false);
});

test("tenant password records hash new users and migrate legacy users", async () => {
  const record = await createStoredPosPassword("admin123");
  assert.equal(typeof record.passwordSalt, "string");
  assert.equal(typeof record.passwordHash, "string");
  assert.equal(await verifyStoredPosPassword(record, "admin123").then((result) => result.verified), true);
  assert.equal(await verifyStoredPosPassword(record, "wrong-password").then((result) => result.verified), false);

  const legacyUser = { username: "admin", password: "admin123", role: "admin", active: true };
  const migrated = await verifyStoredPosPassword(legacyUser, "admin123");
  assert.equal(migrated.verified, true);
  assert.equal(migrated.migratedUser.password, undefined);
  assert.equal(typeof migrated.migratedUser.passwordHash, "string");
  assert.equal(typeof migrated.migratedUser.passwordSalt, "string");
});

test("deactivation rules prevent self and last admin deactivation", () => {
  assert.throws(() =>
    assertUserStatusChangeAllowed({
      actorUsername: "owner",
      targetUsername: "owner",
      nextActive: false,
      targetCurrentlyActive: true,
      activeAdminCount: 3,
    })
  );

  assert.throws(() =>
    assertUserStatusChangeAllowed({
      actorUsername: "owner",
      targetUsername: "admin2",
      nextActive: false,
      targetCurrentlyActive: true,
      activeAdminCount: 1,
    })
  );

  assert.doesNotThrow(() =>
    assertUserStatusChangeAllowed({
      actorUsername: "owner",
      targetUsername: "admin2",
      nextActive: false,
      targetCurrentlyActive: true,
      activeAdminCount: 2,
    })
  );
});

test("rate limit key is deterministic and does not expose raw IP", async () => {
  const env = { AUTH_SECRET: "test-secret-for-rate-limit-123456" };
  const req = new Request("https://rts.example.com/api/login", {
    headers: {
      "CF-Connecting-IP": "203.0.113.10",
    },
  });
  const key1 = await createRateLimitKey(env, req, "login", "owner");
  const key2 = await createRateLimitKey(env, req, "login", "owner");
  assert.equal(key1, key2);
  assert.equal(key1.includes("203.0.113.10"), false);
});

test("all API JSON responses include security and no-store headers", async () => {
  const response = jsonResponse({ ok: true });
  assert.equal(response.headers.get("Cache-Control"), "no-store, max-age=0");
  assert.equal(response.headers.get("Pragma"), "no-cache");
  assert.equal(response.headers.get("X-Content-Type-Options"), "nosniff");
  assert.equal(response.headers.get("X-Frame-Options"), "DENY");
  assert.equal(response.headers.get("Referrer-Policy"), "no-referrer");
  assert.equal(
    response.headers.get("Content-Security-Policy"),
    "default-src 'none'; frame-ancestors 'none'; base-uri 'none'"
  );
});
