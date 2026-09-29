import {
  DISPLAY_NAME_REGEX,
  DOWNLOAD_URL_REGEX,
  PHONE_DIGITS_REGEX,
  USERNAME_REGEX,
} from "./constants.js";

export function normalizeUsername(value) {
  if (typeof value !== "string") {
    return null;
  }
  const normalized = value.trim().toLowerCase();
  return USERNAME_REGEX.test(normalized) ? normalized : null;
}

export function validateDisplayName(value) {
  if (typeof value !== "string") {
    return null;
  }
  const normalized = value.trim().replace(/\s+/g, " ");
  return DISPLAY_NAME_REGEX.test(normalized) ? normalized : null;
}

export function validateNewPassword(password) {
  if (typeof password !== "string") {
    return false;
  }
  return password.length >= 12 && password.length <= 128;
}

export function canonicalizePhone(raw) {
  if (typeof raw !== "string") {
    return null;
  }
  const digits = raw.replace(/\D+/g, "");
  return PHONE_DIGITS_REGEX.test(digits) ? digits : null;
}

export function isAllowedDownloadUrl(value) {
  return typeof value === "string" && DOWNLOAD_URL_REGEX.test(value.trim());
}
