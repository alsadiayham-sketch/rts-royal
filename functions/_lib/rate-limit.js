import { ApiError } from "./http.js";
import { hmacSha256Hex } from "./crypto.js";

function getClientIp(request) {
  const cfIp = request.headers.get("CF-Connecting-IP");
  if (cfIp && cfIp.trim()) {
    return cfIp.trim();
  }
  const forwarded = request.headers.get("X-Forwarded-For");
  if (forwarded && forwarded.trim()) {
    return forwarded.split(",")[0].trim();
  }
  return "0.0.0.0";
}

export async function createRateLimitKey(env, request, scope, accountPart = "anon") {
  const clientIp = getClientIp(request);
  const ipHash = await hmacSha256Hex(env.AUTH_SECRET, `ip:${clientIp}`);
  const accountHash = await hmacSha256Hex(env.AUTH_SECRET, `acct:${accountPart}`);
  return `${scope}:${ipHash}:${accountHash}`;
}

export async function enforceRateLimit(context, options) {
  const { env, request } = context;
  const { scope, accountPart = "anon", maxRequests, windowSeconds } = options;
  const key = await createRateLimitKey(env, request, scope, accountPart);
  const now = Math.floor(Date.now() / 1000);
  const windowStart = Math.floor(now / windowSeconds) * windowSeconds;
  const expiresAt = windowStart + windowSeconds * 2;

  const row = await env.DB.prepare(
    `INSERT INTO rate_limits (scope_key, count, window_start, expires_at)
     VALUES (?, 1, ?, ?)
     ON CONFLICT(scope_key) DO UPDATE SET
       count = CASE
         WHEN rate_limits.window_start = excluded.window_start THEN rate_limits.count + 1
         ELSE 1
       END,
       window_start = excluded.window_start,
       expires_at = excluded.expires_at
     RETURNING count`
  )
    .bind(key, windowStart, expiresAt)
    .first();

  if (!row || Number(row.count) > maxRequests) {
    throw new ApiError(429, "RATE_LIMITED", "Too many requests. Please try again later.");
  }
}

export async function opportunisticCleanup(db, nowEpochSeconds) {
  if (Math.floor(Math.random() * 5) !== 0) {
    return;
  }
  await db
    .prepare(
      `DELETE FROM sessions
       WHERE token_hash IN (
         SELECT token_hash FROM sessions WHERE expires_at < ? LIMIT 200
       )`
    )
    .bind(nowEpochSeconds)
    .run();

  await db
    .prepare(
      `DELETE FROM rate_limits
       WHERE scope_key IN (
         SELECT scope_key FROM rate_limits WHERE expires_at < ? LIMIT 300
       )`
    )
    .bind(nowEpochSeconds)
    .run();
}
