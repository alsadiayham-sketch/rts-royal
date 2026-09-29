import { removeCurrentSession } from "../_lib/auth.js";
import {
  jsonResponse,
  requireTrustedMutationRequest,
  withApiGuard,
} from "../_lib/http.js";
import { opportunisticCleanup } from "../_lib/rate-limit.js";

export async function onRequestPost(context) {
  return withApiGuard(context, async ({ request, env }) => {
    requireTrustedMutationRequest(request);
    const clearedCookie = await removeCurrentSession(context);
    await opportunisticCleanup(env.DB, Math.floor(Date.now() / 1000));
    return jsonResponse(
      {
        ok: true,
      },
      200,
      {
        "Set-Cookie": clearedCookie,
      }
    );
  });
}
