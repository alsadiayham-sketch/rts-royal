import { canUseAssetUrl, normalizeBranding } from "./jahiz-designer.js";
import { iconSvg } from "./jahiz-icons.js";

export function applyCustomerTheme(node, rawBranding) {
  const branding = normalizeBranding(rawBranding);
  node.style.setProperty("--venue-primary", branding.primaryColor);
  node.style.setProperty("--venue-bg", branding.backgroundColor);
  node.style.setProperty("--venue-surface", branding.surfaceColor);
  node.style.setProperty("--venue-text", branding.textColor);
  node.style.setProperty("--venue-bg-image", canUseAssetUrl(branding.backgroundImage) ? `url("${branding.backgroundImage.replace(/"/g, "%22")}")` : "none");
  node.dataset.layout = branding.layout;
  node.dataset.spacing = branding.spacing;
  node.dataset.radius = branding.radius;
  node.dataset.align = branding.align;
  node.dataset.font = branding.font;
  node.dataset.backgroundMode = branding.backgroundMode;
  return branding;
}

export function blockIcon(block, alt = "") {
  if (canUseAssetUrl(block.iconUrl)) return { type: "image", value: block.iconUrl, alt };
  return { type: "svg", value: iconSvg(block.icon || "sparkles", alt), alt };
}
