import { requireAuthenticatedUser } from "../_lib/auth.js";
import {
  clearSessionCookie,
  createPasswordRecord,
  verifyPassword,
} from "../_lib/crypto.js";
import {
  ApiError,
  jsonResponse,
  parseJsonBody,
  requireJsonContentType,
  requireTrustedMutationRequest,
  withApiGuard,
} from "../_lib/http.js";
import { enforceRateLimit, opportunisticCleanup } from "../_lib/rate-limit.js";
import { validateNewPassword } from "../_lib/validation.js";

export async function onRequestPost(context) {
  return withApiGuard(context, async ({ request, env }) => {
    requireTrustedMutationRequest(request);
    requireJsonContentType(request);
    const user = await requireAuthenticatedUser(context, true);

    await enforceRateLimit(context, {
      scope: "password_change",
      accountPart: user.username,
      maxRequests: 8,
      windowSeconds: 900,
    });

    const payload = await parseJsonBody(request, ["currentPassword", "newPassword"]);
    const currentPassword =
      typeof payload.currentPassword === "string" ? payload.currentPassword : "";
    const newPassword = typeof payload.newPassword === "string" ? payload.newPassword : "";

    const currentVerified = await verifyPassword(currentPassword, {
      salt: user.password_salt,
      hash: user.password_hash,
      iterations: Number(user.password_iterations),
    });
    if (!currentVerified) {
      throw new ApiError(401, "AUTH_FAILED", "Invalid username or password.");
    }
    if (!validateNewPassword(newPassword)) {
      throw new ApiError(
        400,
        "WEAK_PASSWORD",
        "New password must be between 12 and 128 characters."
      );
    }
    if (currentPassword === newPassword) {
      throw new ApiError(400, "PASSWORD_REUSE", "New password must be different.");
    }

    const record = await createPasswordRecord(newPassword);
    await env.DB.prepare(
      `UPDATE users
       SET password_salt = ?, password_hash = ?, password_iterations = ?, need_change = 0,
           session_version = session_version + 1, updated_at = unixepoch()
       WHERE username = ?`
    )
      .bind(record.salt, record.hash, record.iterations, user.username)
      .run();
    await env.DB.prepare("DELETE FROM sessions WHERE username = ?").bind(user.username).run();
    await opportunisticCleanup(env.DB, Math.floor(Date.now() / 1000));

    return jsonResponse(
      {
        ok: true,
        requiresRelogin: true,
      },
      200,
      {
        "Set-Cookie": clearSessionCookie(),
      }
    );
  });
}
