import { createSessionToken, sha256Hex, verifyPassword } from "./crypto.js";
import { ApiError, parseCookies } from "./http.js";

export const JAHIZ_COOKIE = "__Secure-jahiz_session";
const SESSION_SECONDS = 8 * 60 * 60;

export function setJahizCookie(token) {
  return `${JAHIZ_COOKIE}=${token}; Path=/api/jahiz; HttpOnly; Secure; SameSite=Strict; Max-Age=${SESSION_SECONDS}`;
}

export function clearJahizCookie() {
  return `${JAHIZ_COOKIE}=; Path=/api/jahiz; HttpOnly; Secure; SameSite=Strict; Max-Age=0`;
}

export async function authenticateJahizCredentials(db, slug, username, password) {
  const row = await db.prepare(
    `SELECT u.id, u.venue_id, u.username, u.name, u.role, u.password_salt, u.password_hash,
            u.password_iterations, u.session_version, u.active,
            v.slug, v.name AS venue_name, v.business_type, v.status, v.expires_at, v.is_demo,
            v.plan_id, v.branding_json
     FROM jahiz_users u
     JOIN jahiz_venues v ON v.id = u.venue_id
     WHERE v.slug = ? AND u.username = ?`
  ).bind(slug, username).first();
  const now = Math.floor(Date.now() / 1000);
  const invalid = !row || Number(row.active) !== 1 || row.status !== "active"
    || (row.expires_at !== null && Number(row.expires_at) <= now);
  if (invalid) throw new ApiError(401, "AUTH_FAILED", "Invalid credentials or inactive venue.");
  const verified = await verifyPassword(password, {
    salt: row.password_salt,
    hash: row.password_hash,
    iterations: Number(row.password_iterations),
  });
  if (!verified) throw new ApiError(401, "AUTH_FAILED", "Invalid credentials or inactive venue.");
  return row;
}

export async function createJahizSession(db, row) {
  const token = createSessionToken();
  const tokenHash = await sha256Hex(token);
  const now = Math.floor(Date.now() / 1000);
  await db.prepare(
    `INSERT INTO jahiz_sessions
       (token_hash, venue_id, user_id, session_version, expires_at, created_at, last_seen_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).bind(tokenHash, row.venue_id, row.id, row.session_version, now + SESSION_SECONDS, now, now).run();
  return { token, cookie: setJahizCookie(token) };
}

export async function requireJahizUser(context, { owner = false, password = false } = {}) {
  const token = parseCookies(context.request).get(JAHIZ_COOKIE);
  if (!token) throw new ApiError(401, "AUTH_REQUIRED", "Authentication required.");
  const hash = await sha256Hex(token);
  const now = Math.floor(Date.now() / 1000);
  const passwordFields = password
    ? ", u.password_salt, u.password_hash, u.password_iterations"
    : "";
  const row = await context.env.DB.prepare(
    `SELECT u.id, u.venue_id, u.username, u.name, u.role, u.session_version,
            v.slug, v.name AS venue_name, v.business_type, v.status, v.expires_at,
            v.is_demo, v.plan_id, v.branding_json, v.branding_revision
            ${passwordFields}
     FROM jahiz_sessions s
     JOIN jahiz_users u ON u.id = s.user_id AND u.venue_id = s.venue_id
     JOIN jahiz_venues v ON v.id = s.venue_id
     WHERE s.token_hash = ? AND s.expires_at > ? AND u.active = 1
       AND s.session_version = u.session_version
       AND v.status = 'active' AND (v.expires_at IS NULL OR v.expires_at > ?)`
  ).bind(hash, now, now).first();
  if (!row) throw new ApiError(401, "AUTH_REQUIRED", "Authentication required.");
  if (owner && row.role !== "owner") throw new ApiError(403, "OWNER_REQUIRED", "Owner access is required.");
  await context.env.DB.prepare("UPDATE jahiz_sessions SET last_seen_at = ? WHERE token_hash = ?")
    .bind(now, hash).run();
  return { ...row, tokenHash: hash };
}

export async function removeJahizSession(context) {
  const token = parseCookies(context.request).get(JAHIZ_COOKIE);
  if (token) {
    await context.env.DB.prepare("DELETE FROM jahiz_sessions WHERE token_hash = ?")
      .bind(await sha256Hex(token)).run();
  }
  return clearJahizCookie();
}
