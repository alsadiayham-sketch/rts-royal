import { requireAuthenticatedUser } from "../_lib/auth.js";
import { DEFAULT_DOWNLOAD_URL } from "../_lib/constants.js";
import {
  ApiError,
  jsonResponse,
  parseJsonBody,
  requireJsonContentType,
  requireTrustedMutationRequest,
  withApiGuard,
} from "../_lib/http.js";
import { enforceRateLimit, opportunisticCleanup } from "../_lib/rate-limit.js";
import { canonicalizePhone, isAllowedDownloadUrl } from "../_lib/validation.js";

async function getSettings(db) {
  const row = await db
    .prepare("SELECT whatsapp_number, download_url, content_json FROM site_settings WHERE id = 1")
    .first();
  if (!row) {
    return {
      whatsappNumber: "972569236758",
      downloadUrl: DEFAULT_DOWNLOAD_URL,
      content: {},
    };
  }
  return {
    whatsappNumber: row.whatsapp_number,
    downloadUrl: row.download_url,
    content: parseContent(row.content_json),
  };
}

function parseContent(value) {
  try {
    const content = JSON.parse(value || "{}");
    return content && typeof content === "object" && !Array.isArray(content) ? content : {};
  } catch {
    return {};
  }
}

export async function onRequestGet(context) {
  return withApiGuard(context, async ({ env }) => {
    await opportunisticCleanup(env.DB, Math.floor(Date.now() / 1000));
    return jsonResponse(await getSettings(env.DB));
  });
}

export async function onRequestPut(context) {
  return withApiGuard(context, async ({ request, env }) => {
    requireTrustedMutationRequest(request);
    requireJsonContentType(request);

    const authUser = await requireAuthenticatedUser(context, false);
    await enforceRateLimit(context, {
      scope: "settings_put",
      accountPart: authUser.username,
      maxRequests: 40,
      windowSeconds: 300,
    });

    const payload = await parseJsonBody(request, ["whatsappNumber", "downloadUrl"]);
    if (!Object.hasOwn(payload, "whatsappNumber") && !Object.hasOwn(payload, "downloadUrl") && !Object.hasOwn(payload, "content")) {
      throw new ApiError(400, "EMPTY_UPDATE", "At least one field is required.");
    }

    const current = await getSettings(env.DB);
    const nextPhone = Object.hasOwn(payload, "whatsappNumber")
      ? canonicalizePhone(payload.whatsappNumber)
      : current.whatsappNumber;
    if (!nextPhone) {
      throw new ApiError(400, "INVALID_WHATSAPP_NUMBER", "WhatsApp number must be 8-15 digits.");
    }

    const nextDownloadUrl = Object.hasOwn(payload, "downloadUrl")
      ? typeof payload.downloadUrl === "string"
        ? payload.downloadUrl.trim()
        : null
      : current.downloadUrl;
    const nextContent = Object.hasOwn(payload, "content")
      ? payload.content && typeof payload.content === "object" && !Array.isArray(payload.content)
        ? JSON.stringify(payload.content)
        : null
      : JSON.stringify(current.content || {});

    if (!nextDownloadUrl || !isAllowedDownloadUrl(nextDownloadUrl)) {
      throw new ApiError(400, "INVALID_DOWNLOAD_URL", "Download URL is not allowed.");
    }
    if (!nextContent || nextContent.length > 12000) {
      throw new ApiError(400, "INVALID_CONTENT", "Site content is invalid or too large.");
    }

    await env.DB.prepare(
      `INSERT INTO site_settings (id, whatsapp_number, download_url, content_json, updated_at)
       VALUES (1, ?, ?, ?, unixepoch())
       ON CONFLICT(id) DO UPDATE SET
         whatsapp_number = excluded.whatsapp_number,
         download_url = excluded.download_url,
         content_json = excluded.content_json,
         updated_at = excluded.updated_at`
    )
      .bind(nextPhone, nextDownloadUrl, nextContent)
      .run();

    await opportunisticCleanup(env.DB, Math.floor(Date.now() / 1000));
    return jsonResponse({
      whatsappNumber: nextPhone,
      downloadUrl: nextDownloadUrl,
      content: JSON.parse(nextContent),
    });
  });
}
