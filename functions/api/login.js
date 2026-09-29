import { authenticateCredentials, createLoginSession } from "../_lib/auth.js";
import {
  ApiError,
  jsonResponse,
  parseJsonBody,
  requireJsonContentType,
  requireTrustedMutationRequest,
  withApiGuard,
} from "../_lib/http.js";
import { enforceRateLimit, opportunisticCleanup } from "../_lib/rate-limit.js";
import { normalizeUsername } from "../_lib/validation.js";

export async function onRequestPost(context) {
  return withApiGuard(context, async ({ request, env }) => {
    requireTrustedMutationRequest(request);
    requireJsonContentType(request);

    const payload = await parseJsonBody(request, ["username", "password"]);
    const username = normalizeUsername(payload.username);
    const password = typeof payload.password === "string" ? payload.password : "";
    if (!username || !password) {
      throw new ApiError(401, "AUTH_FAILED", "Invalid username or password.");
    }

    await enforceRateLimit(context, {
      scope: "login",
      accountPart: username,
      maxRequests: 10,
      windowSeconds: 900,
    });

    const user = await authenticateCredentials(env.DB, username, password);
    const session = await createLoginSession(env.DB, user.username, Number(user.session_version));
    await opportunisticCleanup(env.DB, Math.floor(Date.now() / 1000));

    return jsonResponse(
      {
        ok: true,
        user: {
          username: user.username,
          name: user.name,
        },
        passwordChangeRecommended: Number(user.need_change) === 1,
      },
      200,
      {
        "Set-Cookie": session.cookie,
      }
    );
  });
}
