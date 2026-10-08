export const ORGANIZATION_TYPES = new Set(["business", "clinic"]);
export const CREDIT_LEDGER_ENTRY_TYPES = new Set(["allocation", "usage"]);
export const DELIVERY_STATUSES = new Set(["requested", "queued", "delivered", "failed", "cancelled"]);
export const REQUEST_STATUSES = new Set(["new", "in_progress", "resolved", "archived"]);

export function normalizeOrganizationType(value) {
  return ORGANIZATION_TYPES.has(value) ? value : null;
}

export function normalizeDefaultMessageBalance(value) {
  const amount = Number(value);
  return Number.isInteger(amount) && amount >= 0 && amount <= 10_000_000 ? amount : null;
}

export function normalizeMessageAmount(value) {
  if (value === "" || value === null || value === undefined) return 0;
  const amount = Number(value);
  return Number.isInteger(amount) && amount >= 0 && amount <= 10_000_000 ? amount : null;
}

export function normalizeNisToAgorot(value, { allowZero = true } = {}) {
  if (value === "" || value === null || value === undefined) return allowZero ? 0 : null;
  const text = String(value).trim();
  if (!/^\d+(?:\.\d{1,2})?$/.test(text)) return null;
  const amount = Math.round(Number(text) * 100);
  if (!Number.isSafeInteger(amount) || amount < 0 || amount > 100_000_000) return null;
  return amount === 0 && !allowZero ? null : amount;
}

export function agorotToNis(agorot) {
  return Number((Number(agorot || 0) / 100).toFixed(2));
}

export function normalizeShortText(value, max = 160) {
  if (value === null || value === undefined) return "";
  if (typeof value !== "string") return null;
  const normalized = value.trim().replace(/\s+/g, " ");
  return normalized.length <= max ? normalized : null;
}

export function normalizeUnixDate(value, endOfDay = false) {
  if (!value) return null;
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const suffix = endOfDay ? "T23:59:59Z" : "T00:00:00Z";
  const time = Date.parse(`${value}${suffix}`);
  return Number.isFinite(time) ? Math.floor(time / 1000) : null;
}
