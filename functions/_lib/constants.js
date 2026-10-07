export const SESSION_COOKIE_NAME = "__Host-rts_session";
export const SESSION_TTL_SECONDS = 60 * 60 * 8;
export const MAX_JSON_BYTES = 8 * 1024;
export const MAX_SETTINGS_JSON_BYTES = 8 * 1024 * 1024;
export const PASSWORD_ITERATIONS = 100000;
export const PASSWORD_DERIVED_BITS = 256;

export const DEFAULT_DOWNLOAD_URL =
  "https://github.com/alsadiayham-sketch/rts-business-releases/releases/latest/download/RTS-Business-Setup.exe";

export { DOWNLOAD_URL_REGEX, PHONE_DIGITS_REGEX } from "../../public/settings-policy.js";

export const USERNAME_REGEX = /^[a-z0-9._-]{3,32}$/;
export const DISPLAY_NAME_REGEX = /^[\p{L}\p{N} .,'’_-]{2,80}$/u;
