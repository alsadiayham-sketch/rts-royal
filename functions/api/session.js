import { requireAuthenticatedUser } from "../_lib/auth.js";
import { jsonResponse, withApiGuard } from "../_lib/http.js";
import { opportunisticCleanup } from "../_lib/rate-limit.js";

export async function onRequestGet(context) {
  return withApiGuard(context, async ({ env }) => {
    const user = await requireAuthenticatedUser(context, false);
    await opportunisticCleanup(env.DB, Math.floor(Date.now() / 1000));
    return jsonResponse({
      authenticated: true,
      user: {
        username: user.username,
        name: user.name,
      },
      passwordChangeRecommended: Number(user.need_change) === 1,
    });
  });
}
