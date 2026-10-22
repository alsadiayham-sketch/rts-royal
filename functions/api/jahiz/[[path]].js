import { ApiError, errorResponse, withApiGuard } from "../../_lib/http.js";
import { routeJahiz } from "../../_lib/jahiz-service.js";

function routePath(request) {
  const pathname = new URL(request.url).pathname;
  const prefix = "/api/jahiz/";
  return pathname.startsWith(prefix)
    ? pathname.slice(prefix.length).replace(/^\/+|\/+$/g, "")
    : "";
}

export async function onRequest(context) {
  return withApiGuard(context, async () => {
    const method = context.request.method.toUpperCase();
    if (!["GET", "POST", "PATCH", "DELETE"].includes(method)) {
      throw new ApiError(405, "METHOD_NOT_ALLOWED", "Method is not allowed.");
    }
    return routeJahiz(context, routePath(context.request), method);
  });
}

export function onRequestOptions() {
  return errorResponse(405, "METHOD_NOT_ALLOWED", "Method is not allowed.");
}
