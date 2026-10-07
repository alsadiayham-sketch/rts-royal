import { MAX_JSON_BYTES } from "./constants.js";

export class ApiError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store, max-age=0",
  Pragma: "no-cache",
};

const SECURITY_HEADERS = {
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "no-referrer",
  "Permissions-Policy": "geolocation=(), microphone=(), camera=()",
  "Cross-Origin-Resource-Policy": "same-origin",
  "Content-Security-Policy": "default-src 'none'; frame-ancestors 'none'; base-uri 'none'",
};

export function jsonResponse(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      ...NO_STORE_HEADERS,
      ...SECURITY_HEADERS,
      ...headers,
    },
  });
}

export function errorResponse(status, code, message) {
  return jsonResponse(
    {
      error: {
        code,
        message,
      },
    },
    status
  );
}

export async function withApiGuard(context, handler) {
  const { env } = context;
  if (!env?.AUTH_SECRET || typeof env.AUTH_SECRET !== "string" || env.AUTH_SECRET.length < 16) {
    return errorResponse(503, "SERVICE_UNAVAILABLE", "Service temporarily unavailable.");
  }
  try {
    return await handler(context);
  } catch (error) {
    if (error instanceof ApiError) {
      return errorResponse(error.status, error.code, error.message);
    }
    console.error("API_ERROR", {
      route: new URL(context.request.url).pathname,
      name: error?.name ?? "Error",
      message: error?.message ?? "Unhandled",
    });
    return errorResponse(500, "INTERNAL_ERROR", "Internal server error.");
  }
}

export function requireTrustedMutationRequest(request) {
  const origin = request.headers.get("Origin");
  const expectedOrigin = new URL(request.url).origin;
  if (!origin || origin !== expectedOrigin) {
    throw new ApiError(403, "ORIGIN_FORBIDDEN", "Request origin is not allowed.");
  }

  const fetchSite = request.headers.get("Sec-Fetch-Site");
  if (fetchSite && !["same-origin", "same-site", "none"].includes(fetchSite)) {
    throw new ApiError(403, "FETCH_METADATA_FORBIDDEN", "Cross-site request is not allowed.");
  }
}

export function requireJsonContentType(request) {
  const contentType = request.headers.get("Content-Type") ?? "";
  if (!contentType.toLowerCase().startsWith("application/json")) {
    throw new ApiError(415, "UNSUPPORTED_MEDIA_TYPE", "Content-Type must be application/json.");
  }
}

export async function parseJsonBody(request, allowedFields, maxBytes = MAX_JSON_BYTES) {
  const bodyBytes = await request.arrayBuffer();
  if (bodyBytes.byteLength > maxBytes) {
    throw new ApiError(413, "PAYLOAD_TOO_LARGE", "JSON payload too large.");
  }

  let data;
  try {
    data = JSON.parse(new TextDecoder().decode(bodyBytes));
  } catch {
    throw new ApiError(400, "INVALID_JSON", "Invalid JSON payload.");
  }

  if (typeof data !== "object" || data === null || Array.isArray(data)) {
    throw new ApiError(400, "INVALID_JSON_SHAPE", "JSON body must be an object.");
  }

  const extraFields = Object.keys(data).filter((key) => !allowedFields.includes(key));
  if (extraFields.length > 0) {
    throw new ApiError(400, "UNKNOWN_FIELDS", `Unknown fields: ${extraFields.join(", ")}`);
  }
  return data;
}

export function parseCookies(request) {
  const raw = request.headers.get("Cookie") ?? "";
  const pairs = raw.split(";").map((segment) => segment.trim()).filter(Boolean);
  const cookies = new Map();
  for (const pair of pairs) {
    const [name, ...rest] = pair.split("=");
    cookies.set(name, rest.join("="));
  }
  return cookies;
}
