import { requireAuthenticatedUser } from "../_lib/auth.js";
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
      `SELECT username, name, active, need_change, created_at, updated_at
       FROM users
       ORDER BY username ASC`
    )
    .all();

  return (results ?? []).map((row) => ({
    username: row.username,
    name: row.name,
    active: Number(row.active) === 1,
    passwordChangeRecommended: Number(row.need_change) === 1,
    createdAt: Number(row.created_at),
    updatedAt: Number(row.updated_at),
  }));
}

export async function onRequestGet(context) {
  return withApiGuard(context, async ({ env }) => {
    await requireAuthenticatedUser(context, false);
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

    const authUser = await requireAuthenticatedUser(context, false);
    await enforceRateLimit(context, {
      scope: "users_create",
      accountPart: authUser.username,
      maxRequests: 20,
      windowSeconds: 600,
    });

    const payload = await parseJsonBody(request, ["username", "name", "password"]);
    const username = normalizeUsername(payload.username);
    const name = validateDisplayName(payload.name);
    const password = typeof payload.password === "string" ? payload.password : "";

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
       (username, name, password_salt, password_hash, password_iterations, active, need_change, session_version, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, 1, 1, 1, unixepoch(), unixepoch())`
    )
      .bind(username, name, record.salt, record.hash, record.iterations)
      .run();

    await opportunisticCleanup(env.DB, Math.floor(Date.now() / 1000));
    return jsonResponse(
      {
        ok: true,
        user: {
          username,
          name,
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

    const authUser = await requireAuthenticatedUser(context, false);
    await enforceRateLimit(context, {
      scope: "users_patch",
      accountPart: authUser.username,
      maxRequests: 25,
      windowSeconds: 600,
    });

    const payload = await parseJsonBody(request, ["username", "active"]);
    const username = normalizeUsername(payload.username);
    const nextActive = payload.active;

    if (!username) {
      throw new ApiError(400, "INVALID_USERNAME", "Username must be 3-32 lowercase ASCII chars.");
    }
    if (typeof nextActive !== "boolean") {
      throw new ApiError(400, "INVALID_ACTIVE_VALUE", "Active must be a boolean.");
    }

    const target = await env.DB.prepare("SELECT username, active FROM users WHERE username = ?")
      .bind(username)
      .first();
    if (!target) {
      throw new ApiError(404, "USER_NOT_FOUND", "User not found.");
    }

    const activeCountRow = await env.DB.prepare("SELECT COUNT(*) AS count FROM users WHERE active = 1")
      .first();
    const activeAdminCount = Number(activeCountRow?.count ?? 0);
    assertUserStatusChangeAllowed({
      actorUsername: authUser.username,
      targetUsername: username,
      nextActive,
      targetCurrentlyActive: Number(target.active) === 1,
      activeAdminCount,
    });

    if (nextActive) {
      await env.DB.prepare("UPDATE users SET active = 1, updated_at = unixepoch() WHERE username = ?")
        .bind(username)
        .run();
    } else {
      await env.DB.prepare(
        `UPDATE users
         SET active = 0, session_version = session_version + 1, updated_at = unixepoch()
         WHERE username = ?`
      )
        .bind(username)
        .run();
      await env.DB.prepare("DELETE FROM sessions WHERE username = ?").bind(username).run();
    }

    await opportunisticCleanup(env.DB, Math.floor(Date.now() / 1000));
    return jsonResponse({
      ok: true,
      user: {
        username,
        active: nextActive,
      },
    });
  });
}
