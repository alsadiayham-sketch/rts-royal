import { ICONS } from "./jahiz-icons.js";

export const MAX_IMAGE_BYTES = 200 * 1024;
export const MAX_CUSTOM_PAGE_BYTES = 200 * 1024;
export const MAX_BLOCKS = 12;
export const TEMPLATE_FORMAT = "jahiz-page";
export const TEMPLATE_VERSION = 1;
const imageTypes = new Set(["image/png", "image/jpeg", "image/webp"]);
const layouts = new Set(["centered", "wide", "split"]);
const spacings = new Set(["compact", "comfortable", "airy"]);
const radii = new Set(["square", "soft", "round"]);
const aligns = new Set(["start", "center"]);
const fonts = new Set(["sans", "serif"]);
const modes = new Set(["cover", "tile"]);
const blockTypes = new Set(["welcome", "tracking", "image", "text", "link", "review", "icon"]);
const plainObject = value => value !== null && typeof value === "object" && !Array.isArray(value)
  && (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null);

export function defaultBranding() {
  return {
    logoUrl: "", primaryColor: "#4b1d69", backgroundColor: "#ffffff", textColor: "#21172b",
    welcomeText: "", readyText: "", reviewUrl: "", backgroundImage: "", backgroundMode: "cover",
    surfaceColor: "#ffffff", layout: "centered", spacing: "comfortable", radius: "soft",
    align: "start", font: "sans", customHtml: "", customPageHeight: 640,
    blocks: [{ id: "welcome", type: "welcome", enabled: true }, { id: "tracking", type: "tracking", enabled: true }],
  };
}

export function normalizeBranding(input = {}) {
  const base = defaultBranding();
  const value = plainObject(input) ? input : {};
  const branding = { ...base, ...structuredClone(value) };
  branding.backgroundMode = modes.has(branding.backgroundMode) ? branding.backgroundMode : base.backgroundMode;
  branding.layout = layouts.has(branding.layout) ? branding.layout : base.layout;
  branding.spacing = spacings.has(branding.spacing) ? branding.spacing : base.spacing;
  branding.radius = radii.has(branding.radius) ? branding.radius : base.radius;
  branding.align = aligns.has(branding.align) ? branding.align : base.align;
  branding.font = fonts.has(branding.font) ? branding.font : base.font;
  branding.surfaceColor = isHex(branding.surfaceColor) ? branding.surfaceColor : branding.backgroundColor;
  branding.customHtml = typeof branding.customHtml === "string" ? branding.customHtml.slice(0, MAX_CUSTOM_PAGE_BYTES) : "";
  branding.customPageHeight = clampInt(branding.customPageHeight, 320, 1600, 640);
  branding.blocks = Array.isArray(branding.blocks) ? branding.blocks.filter(validBlock).slice(0, MAX_BLOCKS) : [];
  if (!branding.blocks.some(block => block.type === "tracking")) branding.blocks.push({ id: "tracking", type: "tracking", enabled: true });
  branding.blocks = branding.blocks.map(block => block.type === "tracking" ? { ...block, enabled: true } : block);
  return branding;
}

export function imageFileError(file) {
  if (!file || !imageTypes.has(file.type) || file.size > MAX_IMAGE_BYTES) {
    return "Use a PNG, JPEG, or WebP image no larger than 200 KB.";
  }
  return "";
}

export function customFilesError(htmlFile, cssFile) {
  const total = (htmlFile?.size || 0) + (cssFile?.size || 0);
  if (!htmlFile || !/\.html?$/i.test(htmlFile.name || "")) return "Choose an HTML file.";
  return total > MAX_CUSTOM_PAGE_BYTES ? "HTML and CSS together must be no larger than 200 KB." : "";
}

export function combineCustomFiles(html, css = "") {
  const cleanedCss = String(css || "").replace(/<\/style/gi, "");
  return `${String(html || "")}\n${cleanedCss ? `<style>${cleanedCss}</style>` : ""}`;
}

export function exportTemplate(branding) {
  return JSON.stringify({ format: TEMPLATE_FORMAT, version: TEMPLATE_VERSION, branding: normalizeBranding(branding) }, null, 2);
}

export function importTemplate(text) {
  let payload;
  try { payload = JSON.parse(text); } catch { throw new Error("The template is not valid JSON."); }
  if (!plainObject(payload) || payload.format !== TEMPLATE_FORMAT || payload.version !== TEMPLATE_VERSION || !plainObject(payload.branding)) {
    throw new Error("This is not a Jahiz page template.");
  }
  if (hasUnsafeKeys(payload) || hasUnsafeKeys(payload.branding)) throw new Error("The template contains unsupported keys.");
  const branding = normalizeBranding(payload.branding);
  if (!isHex(branding.primaryColor) || !isHex(branding.backgroundColor) || !isHex(branding.textColor)) {
    throw new Error("The template contains an invalid color.");
  }
  return branding;
}

export function canUseAssetUrl(value) {
  return typeof value === "string" && (/^\/(?!\/)[A-Za-z0-9/_.,@%+\-]+$/.test(value) || /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/i.test(value));
}

function validBlock(block) {
  if (!plainObject(block) || !blockTypes.has(block.type) || typeof block.id !== "string" || !/^[\w-]{1,48}$/.test(block.id)) return false;
  if (block.icon && !ICONS.includes(block.icon)) return false;
  return typeof block.enabled === "boolean";
}
function hasUnsafeKeys(value) {
  return Object.keys(value).some(key => key === "__proto__" || key === "prototype" || key === "constructor");
}
function clampInt(value, min, max, fallback) {
  const number = Number(value);
  return Number.isInteger(number) && number >= min && number <= max ? number : fallback;
}
function isHex(value) { return typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value); }
