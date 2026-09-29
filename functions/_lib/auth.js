import { SESSION_COOKIE_NAME } from "./constants.js";
import {
  clearSessionCookie,
  createSessionToken,
  setSessionCookie,
  sha256Hex,
  verifyPassword,
} from "./crypto.js";
import { ApiError, parseCookies } from "./http.js";

export async function requireAuthenticatedUser(context, includePasswordFields = false) {
  const { request, env } = context;
  const cookies = parseCookies(request);
  const token = cookies.get(SESSION_COOKIE_NAME);
  if (!token) {
    throw new ApiError(401, "AUTH_REQUIRED", "Authentication required.");
  }
  const tokenHash = await sha256Hex(token);
  const now = Math.floor(Date.now() / 1000);

  const fields = includePasswordFields
    ? "u.username, u.name, u.need_change, u.session_version, u.password_salt, u.password_hash, u.password_iterations"
    : "u.username, u.name, u.need_change, u.session_version";

  const row = await env.DB.prepare(
    `SELECT ${fields}
     FROM sessions s
     JOIN users u ON u.username = s.username
     WHERE s.token_hash = ?
       AND s.expires_at > ?
       AND u.active = 1
       AND s.session_version = u.session_version`
  )
    .bind(tokenHash, now)
    .first();

  if (!row) {
    throw new ApiError(401, "AUTH_REQUIRED", "Authentication required.");
  }

  await env.DB.prepare("UPDATE sessions SET last_seen_at = ? WHERE token_hash = ?")
    .bind(now, tokenHash)
    .run();

  return {
    ...row,
    tokenHash,
  };
}

export async function createLoginSession(db, username, sessionVersion) {
  const token = createSessionToken();
  const tokenHash = await sha256Hex(token);
  const now = Math.floor(Date.now() / 1000);
  const expiresAt = now + 60 * 60 * 8;
  await db
    .prepare(
      `INSERT INTO sessions (token_hash, username, session_version, expires_at, created_at, last_seen_at)
       VALUES (?, ?, ?, ?, ?, ?)`
    )
    .bind(tokenHash, username, sessionVersion, expiresAt, now, now)
    .run();
  return {
    token,
    cookie: setSessionCookie(token),
  };
}

export async function removeCurrentSession(context) {
  const cookies = parseCookies(context.request);
  const token = cookies.get(SESSION_COOKIE_NAME);
  if (!token) {
    return clearSessionCookie();
  }
  const tokenHash = await sha256Hex(token);
  await context.env.DB.prepare("DELETE FROM sessions WHERE token_hash = ?").bind(tokenHash).run();
  return clearSessionCookie();
}

export async function authenticateCredentials(db, username, password) {
  const genericFailure = new ApiError(401, "AUTH_FAILED", "Invalid username or password.");
  const row = await db
    .prepare(
      `SELECT username, name, password_salt, password_hash, password_iterations, need_change, active, session_version
       FROM users
       WHERE username = ?`
    )
    .bind(username)
    .first();

  if (!row || Number(row.active) !== 1) {
    throw genericFailure;
  }

  const verified = await verifyPassword(password, {
    salt: row.password_salt,
    hash: row.password_hash,
    iterations: Number(row.password_iterations),
  });
  if (!verified) {
    throw genericFailure;
  }
  return row;
}
