import { requirePlatformAdmin, requirePlatformReader } from "../_lib/auth.js";
import { createPasswordRecord } from "../_lib/crypto.js";
import {
  ApiError,
  jsonResponse,
  parseJsonBody,
  requireJsonContentType,
  requireTrustedMutationRequest,
  withApiGuard,
} from "../_lib/http.js";
import { enforceRateLimit, opportunisticCleanup } from "../_lib/rate-limit.js";
import { assertUserStatusChangeAllowed } from "../_lib/user-rules.js";
import {
  normalizeUsername,
  validateDisplayName,
  validateNewPassword,
} from "../_lib/validation.js";

async function listUsers(db) {
  const { results } = await db
    .prepare(
      `SELECT username, name, portal_access, active, need_change, created_at, updated_at
       FROM users
       ORDER BY username ASC`
    )
    .all();

  return (results ?? []).map((row) => ({
    username: row.username,
    name: row.name,
    role: row.portal_access === "reader" ? "reader" : "admin",
    active: Number(row.active) === 1,
    passwordChangeRecommended: Number(row.need_change) === 1,
    createdAt: Number(row.created_at),
    updatedAt: Number(row.updated_at),
  }));
}

export async function onRequestGet(context) {
  return withApiGuard(context, async ({ env }) => {
    await requirePlatformReader(context);
    await opportunisticCleanup(env.DB, Math.floor(Date.now() / 1000));
    return jsonResponse({
      users: await listUsers(env.DB),
    });
  });
}

export async function onRequestPost(context) {
  return withApiGuard(context, async ({ request, env }) => {
    requireTrustedMutationRequest(request);
    requireJsonContentType(request);

    const authUser = await requirePlatformAdmin(context, false);
    await enforceRateLimit(context, {
      scope: "users_create",
      accountPart: authUser.username,
      maxRequests: 20,
      windowSeconds: 600,
    });

    const payload = await parseJsonBody(request, ["username", "name", "password", "role"]);
    const username = normalizeUsername(payload.username);
    const name = validateDisplayName(payload.name);
    const password = typeof payload.password === "string" ? payload.password : "";
    const role = payload.role ?? "admin";
    if (!["admin", "reader"].includes(role)) {
      throw new ApiError(400, "INVALID_ROLE", "Choose Admin or Reader.");
    }

    if (!username) {
      throw new ApiError(400, "INVALID_USERNAME", "Username must be 3-32 lowercase ASCII chars.");
    }
    if (!name) {
      throw new ApiError(400, "INVALID_NAME", "Display name is invalid.");
    }
    if (!validateNewPassword(password)) {
      throw new ApiError(400, "WEAK_PASSWORD", "Password must be between 12 and 128 characters.");
    }

    const existing = await env.DB.prepare("SELECT username FROM users WHERE username = ?")
      .bind(username)
      .first();
    if (existing) {
      throw new ApiError(409, "USERNAME_EXISTS", "Username already exists.");
    }

    const record = await createPasswordRecord(password);
    await env.DB.prepare(
      `INSERT INTO users
       (username, name, password_salt, password_hash, password_iterations, role, portal_access, active, need_change, session_version, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, 'platform_admin', ?, 1, 1, 1, unixepoch(), unixepoch())`
    )
      .bind(username, name, record.salt, record.hash, record.iterations, role)
      .run();

    await opportunisticCleanup(env.DB, Math.floor(Date.now() / 1000));
    return jsonResponse(
      {
        ok: true,
        user: {
          username,
          name,
          role,
          active: true,
          passwordChangeRecommended: true,
        },
      },
      201
    );
  });
}

export async function onRequestPatch(context) {
  return withApiGuard(context, async ({ request, env }) => {
    requireTrustedMutationRequest(request);
    requireJsonContentType(request);

    const authUser = await requirePlatformAdmin(context, false);
    await enforceRateLimit(context, {
      scope: "users_patch",
      accountPart: authUser.username,
      maxRequests: 25,
      windowSeconds: 600,
    });

    const payload = await parseJsonBody(request, ["username", "active", "role"]);
    const username = normalizeUsername(payload.username);
    const nextActive = payload.active;

    if (!username) {
      throw new ApiError(400, "INVALID_USERNAME", "Username must be 3-32 lowercase ASCII chars.");
    }
    if (payload.role !== undefined && !["admin", "reader"].includes(payload.role)) {
      throw new ApiError(400, "INVALID_ROLE", "Choose Admin or Reader.");
    }
    if ((nextActive !== undefined && typeof nextActive !== "boolean")
        || (nextActive === undefined && payload.role === undefined)) {
      throw new ApiError(400, "INVALID_ACTIVE_VALUE", "Active must be a boolean.");
    }

    const target = await env.DB.prepare("SELECT username, active, portal_access FROM users WHERE username = ?")
      .bind(username)
      .first();
    if (!target) {
      throw new ApiError(404, "USER_NOT_FOUND", "User not found.");
    }

    const activeCountRow = await env.DB.prepare("SELECT COUNT(*) AS count FROM users WHERE active = 1 AND portal_access = 'admin'")
      .first();
    const activeAdminCount = Number(activeCountRow?.count ?? 0);
    assertUserStatusChangeAllowed({
      actorUsername: authUser.username,
      targetUsername: username,
      nextActive: nextActive ?? Number(target.active) === 1,
      targetCurrentlyActive: Number(target.active) === 1,
      activeAdminCount: target.portal_access === "reader" ? Infinity : activeAdminCount,
    });

    const role = payload.role ?? target.portal_access ?? "admin";
    const active = nextActive ?? Number(target.active) === 1;
    if (username === authUser.username && role !== (target.portal_access ?? "admin")) {
      throw new ApiError(400, "SELF_ROLE_CHANGE_FORBIDDEN", "You cannot change your own portal role.");
    }
    const result = await env.DB.prepare(
      `UPDATE users SET active = ?, portal_access = ?, session_version = session_version + 1, updated_at = unixepoch()
       WHERE username = ?
       AND (portal_access <> 'admin' OR active = 0 OR (? = 1 AND ? = 'admin')
         OR (SELECT COUNT(*) FROM users WHERE active = 1 AND portal_access = 'admin') > 1)`
    ).bind(active ? 1 : 0, role, username, active ? 1 : 0, role).run();
    if (Number(result.meta?.changes) !== 1) {
      throw new ApiError(409, "LAST_ADMIN_FORBIDDEN", "Cannot remove the last active administrator.");
    }

    await opportunisticCleanup(env.DB, Math.floor(Date.now() / 1000));
    return jsonResponse({
      ok: true,
      user: {
        username,
        active,
        role,
      },
    });
  });
}
