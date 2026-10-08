import { requireAuthenticatedUser } from "../_lib/auth.js";
import { DEFAULT_DOWNLOAD_URL } from "../_lib/constants.js";
import { MAX_SETTINGS_JSON_BYTES } from "../_lib/constants.js";
import {
  ApiError,
  jsonResponse,
  parseJsonBody,
  requireJsonContentType,
  requireTrustedMutationRequest,
  withApiGuard,
} from "../_lib/http.js";
import { enforceRateLimit } from "../_lib/rate-limit.js";
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

function isSafeMediaUrl(value) {
  if (typeof value !== "string" || !value.trim()) return false;
  const url = value.trim();
  if (url.startsWith("/") && !url.startsWith("//")) return true;
  if (url.startsWith("data:image/")) {
    return /^data:image\/(?:png|jpe?g|webp|gif);base64,[A-Za-z0-9+/=]+$/.test(url) && url.length <= 900000;
  }
  try {
    return new URL(url).protocol === "https:";
  } catch {
    return false;
  }
}

function normalizeShowcases(content) {
  if (!Object.hasOwn(content, "showcases")) return content;
  if (!content.showcases || typeof content.showcases !== "object" || Array.isArray(content.showcases)) {
    throw new ApiError(400, "INVALID_SHOWCASES", "Showcase galleries must be an object.");
  }
  const categories = ["websites", "applications", "business", "clinic"];
  const showcases = {};
  for (const category of categories) {
    const entries = content.showcases[category];
    if (entries === undefined) continue;
    if (!Array.isArray(entries) || entries.length > 12) {
      throw new ApiError(400, "INVALID_SHOWCASE_ITEMS", "Each showcase gallery must contain at most 12 items.");
    }
    showcases[category] = entries.map((item) => {
      if (!item || typeof item !== "object" || Array.isArray(item) || !isSafeMediaUrl(item.url)) {
        throw new ApiError(400, "INVALID_SHOWCASE_ITEM", "Showcase items must use safe image URLs.");
      }
      return {
        url: item.url.trim(),
        ...(typeof item.alt === "string" && item.alt.trim() ? { alt: item.alt.trim().slice(0, 160) } : {}),
      };
    });
  }
  return { ...content, showcases };
}

function normalizeHeroBackground(content) {
  if (!Object.hasOwn(content, "heroBackground")) return content;
  if (content.heroBackground === "" || content.heroBackground === null) {
    return { ...content, heroBackground: "" };
  }
  if (!isSafeMediaUrl(content.heroBackground)) {
    throw new ApiError(400, "INVALID_HERO_BACKGROUND", "Hero background must use a safe image URL.");
  }
  return { ...content, heroBackground: content.heroBackground.trim() };
}

function normalizeHeroSlides(content) {
  if (!Object.hasOwn(content, "heroSlides")) return content;
  if (!Array.isArray(content.heroSlides) || content.heroSlides.length > 8) {
    throw new ApiError(400, "INVALID_HERO_SLIDES", "Hero slides must contain at most 8 items.");
  }
  const heroSlides = content.heroSlides.map((slide) => {
    if (!slide || typeof slide !== "object" || Array.isArray(slide)) {
      throw new ApiError(400, "INVALID_HERO_SLIDE", "Each hero slide must be an object.");
    }
    if (!["image", "video"].includes(slide.type) || !isSafeMediaUrl(slide.url)) {
      throw new ApiError(400, "INVALID_HERO_SLIDE", "Hero slides must use image/video types and safe URLs.");
    }
    if (slide.poster !== undefined && slide.poster !== "" && !isSafeMediaUrl(slide.poster)) {
      throw new ApiError(400, "INVALID_HERO_SLIDE_POSTER", "Hero video posters must use safe URLs.");
    }
    return {
      type: slide.type,
      url: slide.url.trim(),
      ...(slide.poster ? { poster: slide.poster.trim() } : {}),
      ...(typeof slide.alt === "string" && slide.alt.trim()
        ? { alt: slide.alt.trim().slice(0, 160) }
        : {}),
    };
  });
  return { ...content, heroSlides };
}

export async function onRequestGet(context) {
  return withApiGuard(context, async ({ env }) => {
    return jsonResponse(await getSettings(env.DB), 200, {
      "Cache-Control": "public, max-age=0, s-maxage=300, stale-while-revalidate=900",
    });
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

    const payload = await parseJsonBody(request, ["whatsappNumber", "downloadUrl", "content"], MAX_SETTINGS_JSON_BYTES);
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
        ? JSON.stringify(normalizeShowcases(normalizeHeroBackground(normalizeHeroSlides(payload.content))))
        : null
      : JSON.stringify(current.content || {});

    if (!nextDownloadUrl || !isAllowedDownloadUrl(nextDownloadUrl)) {
      throw new ApiError(400, "INVALID_DOWNLOAD_URL", "Download URL is not allowed.");
    }
    if (!nextContent || nextContent.length > 7500000) {
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

    return jsonResponse({
      whatsappNumber: nextPhone,
      downloadUrl: nextDownloadUrl,
      content: JSON.parse(nextContent),
    });
  });
}
