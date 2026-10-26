import { ApiError } from "./http.js";
import { validateDisplayName, validateNewPassword, normalizeUsername } from "./validation.js";

export const DEFAULT_BRANDING = Object.freeze({
  logoUrl: "",
  backgroundImage: "",
  backgroundMode: "cover",
  primaryColor: "#4b1d69",
  backgroundColor: "#ffffff",
  surfaceColor: "#ffffff",
  textColor: "#21172b",
  layout: "centered",
  spacing: "comfortable",
  radius: "soft",
  align: "start",
  font: "sans",
  welcomeText: "",
  readyText: "",
  reviewUrl: "",
  customHtml: "",
  customPageHeight: 640,
  blocks: [{ id: "tracking", type: "tracking", enabled: true }],
});

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const HEX_RE = /^#[0-9a-fA-F]{6}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const BLOCK_TYPES = new Set(["welcome", "tracking", "image", "text", "link", "review", "icon"]);
const ICONS = new Set(["coffee", "utensils", "bread", "star", "heart", "clock", "pin", "phone", "leaf", "sparkles"]);
const BACKGROUND_MODES = new Set(["cover", "tile"]);
const LAYOUTS = new Set(["centered", "wide", "split"]);
const SPACING = new Set(["compact", "comfortable", "airy"]);
const RADII = new Set(["square", "soft", "round"]);
const ALIGNMENTS = new Set(["start", "center"]);
const FONTS = new Set(["sans", "serif"]);
const CURRENCIES = new Set(["JOD", "ILS", "USD"]);
const MAX_CUSTOM_HTML_BYTES = 200 * 1024;

function stringValue(value, field, min, max, { optional = false } = {}) {
  if (optional && (value === undefined || value === null || value === "")) return "";
  if (typeof value !== "string") throw new ApiError(400, "INVALID_FIELD", `${field} is invalid.`);
  const normalized = value.trim().replace(/\s+/g, " ");
  if (normalized.length < min || normalized.length > max) {
    throw new ApiError(400, "INVALID_FIELD", `${field} is invalid.`);
  }
  return normalized;
}

function safeText(value, field, max, { optional = true } = {}) {
  const text = stringValue(value, field, optional ? 0 : 1, max, { optional });
  if (/[<>]/.test(text)) {
    throw new ApiError(400, "INVALID_TEXT", `${field} must be plain text.`);
  }
  return text;
}

function enumValue(value, field, allowed, fallback) {
  const candidate = value === undefined ? fallback : value;
  if (typeof candidate !== "string" || !allowed.has(candidate)) {
    throw new ApiError(400, "INVALID_FIELD", `${field} is invalid.`);
  }
  return candidate;
}

function utf8Size(value) {
  return new TextEncoder().encode(value).byteLength;
}

export function normalizeSlug(value) {
  if (typeof value !== "string") return null;
  const slug = value.trim().toLowerCase();
  return slug.length >= 3 && slug.length <= 48 && SLUG_RE.test(slug) ? slug : null;
}

export function requireSlug(value) {
  const slug = normalizeSlug(value);
  if (!slug) throw new ApiError(400, "INVALID_SLUG", "Slug must be lowercase words separated by hyphens.");
  return slug;
}

export function requireBusinessType(value) {
  if (!["cafe", "restaurant"].includes(value)) {
    throw new ApiError(400, "INVALID_BUSINESS_TYPE", "Business type must be cafe or restaurant.");
  }
  return value;
}

export function requireUsername(value) {
  const username = normalizeUsername(value);
  if (!username) throw new ApiError(400, "INVALID_USERNAME", "Username is invalid.");
  return username;
}

export function requireName(value, field = "Name") {
  const name = validateDisplayName(value);
  if (!name) throw new ApiError(400, "INVALID_NAME", `${field} is invalid.`);
  return name;
}

export function requirePassword(value) {
  if (!validateNewPassword(value)) {
    throw new ApiError(400, "INVALID_PASSWORD", "Password must be 12-128 characters.");
  }
  return value;
}

export function optionalExpiry(value) {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string") throw new ApiError(400, "INVALID_EXPIRY", "Expiry must be an ISO date.");
  const ms = Date.parse(value);
  if (!Number.isFinite(ms)) throw new ApiError(400, "INVALID_EXPIRY", "Expiry must be an ISO date.");
  return Math.floor(ms / 1000);
}

export function requireBoolean(value, field) {
  if (typeof value !== "boolean") throw new ApiError(400, "INVALID_FIELD", `${field} must be boolean.`);
  return value;
}

export function requireInteger(value, field, min, max) {
  if (!Number.isSafeInteger(value) || value < min || value > max) {
    throw new ApiError(400, "INVALID_FIELD", `${field} is invalid.`);
  }
  return value;
}

export function requireCurrency(value) {
  if (typeof value !== "string" || !CURRENCIES.has(value.toUpperCase())) {
    throw new ApiError(400, "INVALID_CURRENCY", "Currency must be JOD, ILS, or USD.");
  }
  return value.toUpperCase();
}

export function requireUuid(value, field = "ID") {
  if (
    typeof value !== "string"
    || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
  ) {
    throw new ApiError(400, "INVALID_ID", `${field} is invalid.`);
  }
  return value;
}

export function validateApplication(payload) {
  const email = stringValue(payload.email, "Email", 5, 254).toLowerCase();
  if (!EMAIL_RE.test(email)) throw new ApiError(400, "INVALID_EMAIL", "Email is invalid.");
  const phone = stringValue(payload.phone, "Phone", 7, 24);
  if (!/^[0-9+().\s-]+$/.test(phone)) throw new ApiError(400, "INVALID_PHONE", "Phone is invalid.");
  return {
    name: safeText(payload.name, "Name", 100, { optional: false }),
    businessType: requireBusinessType(payload.businessType),
    ownerName: requireName(payload.ownerName, "Owner name"),
    email,
    phone,
    message: safeText(payload.message ?? "", "Message", 1000),
  };
}

function rgb(hex) {
  const value = Number.parseInt(hex.slice(1), 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

function luminance(hex) {
  const channels = rgb(hex).map((part) => {
    const c = part / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

function contrast(a, b) {
  const [high, low] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (high + 0.05) / (low + 0.05);
}

function safeHttpsUrl(value, field, { optional = true } = {}) {
  if (optional && (value === undefined || value === null || value === "")) return "";
  if (typeof value !== "string" || value.length > 2048) {
    throw new ApiError(400, "INVALID_URL", `${field} must be a safe HTTPS URL.`);
  }
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.username || url.password) throw new Error("unsafe");
    return url.toString();
  } catch {
    throw new ApiError(400, "INVALID_URL", `${field} must be a safe HTTPS URL.`);
  }
}

function safeImage(value, field, { optional = true } = {}) {
  if (optional && (value === undefined || value === null || value === "")) return "";
  if (typeof value !== "string") throw new ApiError(400, "INVALID_IMAGE", `${field} is invalid.`);
  if (/^\/(?!\/)[A-Za-z0-9/_.,@%+\-]+$/.test(value) && value.length <= 512) return value;
  const match = /^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/]+={0,2})$/i.exec(value);
  if (!match) throw new ApiError(400, "INVALID_IMAGE", `${field} must use a safe image.`);
  const encoded = match[2];
  const bytes = Math.floor((encoded.length * 3) / 4) - (encoded.endsWith("==") ? 2 : encoded.endsWith("=") ? 1 : 0);
  if (bytes > 200 * 1024) throw new ApiError(400, "IMAGE_TOO_LARGE", `${field} exceeds 200KB.`);
  return value;
}

function validateBlock(raw, ids) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new ApiError(400, "INVALID_BLOCK", "Branding block is invalid.");
  }
  const allowed = new Set(["id", "type", "enabled", "text", "url", "icon", "caption"]);
  if (Object.keys(raw).some((key) => !allowed.has(key))) {
    throw new ApiError(400, "INVALID_BLOCK", "Branding block contains unsupported fields.");
  }
  const id = stringValue(raw.id, "Block id", 1, 48);
  if (!/^[a-zA-Z0-9_-]+$/.test(id) || ids.has(id)) {
    throw new ApiError(400, "INVALID_BLOCK", "Branding block IDs must be unique and safe.");
  }
  ids.add(id);
  if (!BLOCK_TYPES.has(raw.type) || typeof raw.enabled !== "boolean") {
    throw new ApiError(400, "INVALID_BLOCK", "Branding block type or enabled state is invalid.");
  }
  const block = { id, type: raw.type, enabled: raw.type === "tracking" ? true : raw.enabled };
  if (raw.icon !== undefined) {
    block.icon = enumValue(raw.icon, "Block icon", ICONS);
  }
  if (["welcome", "text", "review"].includes(raw.type)) {
    block.text = safeText(raw.text ?? "", "Block text", 500);
  }
  if (raw.type === "image") block.url = safeImage(raw.url, "Image URL", { optional: false });
  if (raw.type === "link") block.url = safeHttpsUrl(raw.url, "Link URL", { optional: false });
  if (raw.type === "link") block.text = safeText(raw.text ?? "", "Link text", 120, { optional: false });
  if (raw.type === "icon") {
    if (!block.icon) {
      throw new ApiError(400, "INVALID_BLOCK", "Icon blocks require a supported icon.");
    }
    block.url = safeImage(raw.url, "Icon image");
    block.caption = safeText(raw.caption ?? "", "Icon caption", 160);
  }
  return block;
}

export function validateBranding(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new ApiError(400, "INVALID_BRANDING", "Branding must be an object.");
  }
  const allowed = new Set([
    "logoUrl", "backgroundImage", "backgroundMode", "primaryColor", "backgroundColor",
    "surfaceColor", "textColor", "layout", "spacing", "radius", "align", "font",
    "welcomeText", "readyText", "reviewUrl", "customHtml", "customPageHeight", "blocks",
  ]);
  if (Object.keys(value).some((key) => !allowed.has(key))) {
    throw new ApiError(400, "INVALID_BRANDING", "Branding contains unsupported fields.");
  }
  const primaryColor = value.primaryColor;
  const backgroundColor = value.backgroundColor;
  const surfaceColor = value.surfaceColor ?? backgroundColor;
  const textColor = value.textColor;
  if (![primaryColor, backgroundColor, surfaceColor, textColor].every((color) => typeof color === "string" && HEX_RE.test(color))) {
    throw new ApiError(400, "INVALID_COLOR", "Branding colors must be six-digit HEX values.");
  }
  if (contrast(textColor, surfaceColor) < 4.5 || contrast(primaryColor, surfaceColor) < 4.5) {
    throw new ApiError(400, "INSUFFICIENT_CONTRAST", "Branding colors must meet WCAG AA contrast.");
  }
  if (!Array.isArray(value.blocks) || value.blocks.length > 12) {
    throw new ApiError(400, "INVALID_BLOCKS", "Branding must contain at most 12 blocks.");
  }
  const ids = new Set();
  const blocks = value.blocks.map((block) => validateBlock(block, ids));
  if (blocks.filter((block) => block.type === "tracking").length !== 1) {
    throw new ApiError(400, "TRACKING_BLOCK_REQUIRED", "Branding must contain exactly one tracking block.");
  }
  const customHtml = value.customHtml ?? "";
  if (typeof customHtml !== "string") {
    throw new ApiError(400, "INVALID_FIELD", "Custom HTML is invalid.");
  }
  if (utf8Size(customHtml) > MAX_CUSTOM_HTML_BYTES) {
    throw new ApiError(400, "CUSTOM_HTML_TOO_LARGE", "Custom HTML exceeds 200KB.");
  }
  return {
    logoUrl: safeImage(value.logoUrl, "Logo URL"),
    backgroundImage: safeImage(value.backgroundImage, "Background image"),
    backgroundMode: enumValue(value.backgroundMode, "Background mode", BACKGROUND_MODES, "cover"),
    primaryColor: primaryColor.toLowerCase(),
    backgroundColor: backgroundColor.toLowerCase(),
    surfaceColor: surfaceColor.toLowerCase(),
    textColor: textColor.toLowerCase(),
    layout: enumValue(value.layout, "Layout", LAYOUTS, "centered"),
    spacing: enumValue(value.spacing, "Spacing", SPACING, "comfortable"),
    radius: enumValue(value.radius, "Radius", RADII, "soft"),
    align: enumValue(value.align, "Alignment", ALIGNMENTS, "start"),
    font: enumValue(value.font, "Font", FONTS, "sans"),
    welcomeText: safeText(value.welcomeText ?? "", "Welcome text", 300),
    readyText: safeText(value.readyText ?? "", "Ready text", 300),
    reviewUrl: safeHttpsUrl(value.reviewUrl, "Review URL"),
    customHtml,
    customPageHeight: value.customPageHeight === undefined
      ? 640
      : requireInteger(value.customPageHeight, "Custom page height", 320, 1600),
    blocks,
  };
}

export function parseStoredBranding(value) {
  try {
    const stored = JSON.parse(value || "{}");
    const branding = { ...DEFAULT_BRANDING, ...stored };
    if (stored.surfaceColor === undefined) {
      branding.surfaceColor = stored.backgroundColor ?? DEFAULT_BRANDING.backgroundColor;
    }
    return branding;
  } catch {
    return { ...DEFAULT_BRANDING, blocks: [...DEFAULT_BRANDING.blocks] };
  }
}
