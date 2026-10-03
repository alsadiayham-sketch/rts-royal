export const STORE_ID_REGEX = /^[a-z0-9](?:[a-z0-9-]{0,30}[a-z0-9])?$/;

export function normalizeStoreId(value) {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase();
  return STORE_ID_REGEX.test(normalized) ? normalized : null;
}

export function normalizeStoreName(value) {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized.length >= 2 && normalized.length <= 80 ? normalized : null;
}

export function normalizeWarrantyMonths(value) {
  const months = Number(value);
  return Number.isInteger(months) && months >= 1 && months <= 60 ? months : null;
}

export function normalizeBackend(value) {
  return value === "d1" || value === "firestore" ? value : null;
}

export function normalizeApiBaseUrl(value) {
  if (typeof value !== "string") return null;
  try {
    const url = new URL(value.trim());
    if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash) return null;
    return url.origin;
  } catch {
    return null;
  }
}

