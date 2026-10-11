import { ApiError } from "./http.js";

export const TELEMETRY_MAX_AGE_MS = 15 * 60 * 1000;
export const TELEMETRY_MAX_FUTURE_SKEW_MS = 5 * 60 * 1000;

const APP_VERSION_REGEX =
  /^v?\d{1,5}(?:\.\d{1,5}){1,3}(?:-[0-9A-Za-z]+(?:[.-][0-9A-Za-z]+)*)?(?:\+[0-9A-Za-z]+(?:[.-][0-9A-Za-z]+)*)?$/;

const COMMON_METRICS = {
  terminalCount: { type: "integer", max: 10000 },
  activeTerminalCount: { type: "integer", max: 10000 },
  pendingSyncCount: { type: "integer", max: 1000000000 },
  failedSyncCount: { type: "integer", max: 1000000000 },
  databaseHealthy: { type: "boolean" },
  syncHealthy: { type: "boolean" },
  backupHealthy: { type: "boolean" },
};

const PRODUCT_METRICS = {
  business: {
    salesToday: { type: "number", max: 1000000000000 },
    ordersToday: { type: "integer", max: 1000000000 },
    averageOrderValue: { type: "number", max: 1000000000000 },
    lowStockItems: { type: "integer", max: 1000000000 },
    inventoryUnits: { type: "integer", max: 1000000000 },
    inventoryValue: { type: "number", max: 1000000000000 },
    returnsToday: { type: "integer", max: 1000000000 },
    refundsToday: { type: "number", max: 1000000000000 },
    damageUnitsToday: { type: "integer", max: 1000000000 },
  },
  clinic: {
    appointmentsToday: { type: "integer", max: 1000000000 },
    waitingCount: { type: "integer", max: 1000000000 },
    completedSessionsToday: { type: "integer", max: 1000000000 },
    followUpsDue: { type: "integer", max: 1000000000 },
    collectionsToday: { type: "number", max: 1000000000000 },
    outstandingInsurance: { type: "number", max: 1000000000000 },
    openSessions: { type: "integer", max: 1000000000 },
    activeAccounts: { type: "integer", max: 10000 },
  },
};

const COMMON_EVENT_COUNTERS = {
  auditEvents: true,
  warningEvents: true,
  errorEvents: true,
  loginsSucceeded: true,
  loginsFailed: true,
  syncsSucceeded: true,
  syncsFailed: true,
  backupsSucceeded: true,
  backupsFailed: true,
};

const PRODUCT_EVENT_COUNTERS = {
  business: {
    salesCompleted: true,
    salesVoided: true,
    returnsCompleted: true,
    inventoryAdjustments: true,
  },
  clinic: {
    appointmentsCreated: true,
    appointmentsCancelled: true,
    sessionsCompleted: true,
    paymentsRecorded: true,
    followUpsCreated: true,
  },
};

function isPlainObject(value) {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function metricRules(productType) {
  return { ...COMMON_METRICS, ...PRODUCT_METRICS[productType] };
}

function counterRules(productType) {
  return { ...COMMON_EVENT_COUNTERS, ...PRODUCT_EVENT_COUNTERS[productType] };
}

function normalizeMetricValue(value, rule) {
  if (rule.type === "boolean") return typeof value === "boolean" ? value : undefined;
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > rule.max) return undefined;
  if (rule.type === "integer" && !Number.isSafeInteger(value)) return undefined;
  return value;
}

function normalizeMetrics(value, productType, { rejectInvalid }) {
  if (!isPlainObject(value)) {
    if (rejectInvalid) throw new ApiError(400, "INVALID_TELEMETRY_METRICS", "Telemetry metrics must be an object.");
    return {};
  }

  const rules = metricRules(productType);
  const normalized = {};
  for (const [key, item] of Object.entries(value)) {
    const rule = rules[key];
    if (!Object.hasOwn(rules, key)) {
      if (rejectInvalid) {
        throw new ApiError(400, "INVALID_TELEMETRY_METRIC", "Telemetry contains an unsupported metric.");
      }
      continue;
    }
    const metric = normalizeMetricValue(item, rule);
    if (metric === undefined) {
      if (rejectInvalid) {
        throw new ApiError(400, "INVALID_TELEMETRY_METRIC", "Telemetry metrics must be bounded numbers or booleans.");
      }
      continue;
    }
    normalized[key] = metric;
  }
  return normalized;
}

function normalizeEventCounters(value, productType, { rejectInvalid }) {
  if (!isPlainObject(value)) {
    if (rejectInvalid) {
      throw new ApiError(400, "INVALID_EVENT_COUNTERS", "Telemetry event counters must be an object.");
    }
    return {};
  }

  const rules = counterRules(productType);
  const normalized = {};
  for (const [key, item] of Object.entries(value)) {
    if (!Object.hasOwn(rules, key)) {
      if (rejectInvalid) {
        throw new ApiError(400, "INVALID_EVENT_COUNTER", "Telemetry contains an unsupported event counter.");
      }
      continue;
    }
    if (!Number.isSafeInteger(item) || item < 0 || item > 1000000000) {
      if (rejectInvalid) {
        throw new ApiError(400, "INVALID_EVENT_COUNTER", "Telemetry event counters must be bounded integers.");
      }
      continue;
    }
    normalized[key] = item;
  }
  return normalized;
}

function normalizeIsoTimestamp(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(value)) {
    return null;
  }
  const timestamp = new Date(value);
  return Number.isNaN(timestamp.getTime()) ? null : timestamp.toISOString();
}

export function isValidTelemetryAppVersion(value) {
  return typeof value === "string" && value.length <= 64 && APP_VERSION_REGEX.test(value);
}

export function normalizeTelemetryPayload(payload, productType, now = Date.now()) {
  if (!isPlainObject(payload)) {
    throw new ApiError(400, "INVALID_TELEMETRY", "Telemetry payload must be an object.");
  }
  for (const field of ["generatedAt", "appVersion", "metrics", "eventCounters"]) {
    if (!Object.hasOwn(payload, field)) {
      throw new ApiError(400, "MISSING_TELEMETRY_FIELD", "Telemetry payload is incomplete.");
    }
  }

  const generatedAt = normalizeIsoTimestamp(payload.generatedAt);
  if (!generatedAt) {
    throw new ApiError(400, "INVALID_TELEMETRY_TIMESTAMP", "Telemetry timestamp must be UTC ISO-8601.");
  }
  const generatedTime = new Date(generatedAt).getTime();
  if (generatedTime < now - TELEMETRY_MAX_AGE_MS) {
    throw new ApiError(409, "STALE_TELEMETRY", "Telemetry snapshot is stale.");
  }
  if (generatedTime > now + TELEMETRY_MAX_FUTURE_SKEW_MS) {
    throw new ApiError(400, "INVALID_TELEMETRY_TIMESTAMP", "Telemetry timestamp is too far in the future.");
  }
  if (!isValidTelemetryAppVersion(payload.appVersion)) {
    throw new ApiError(400, "INVALID_APP_VERSION", "Application version is invalid.");
  }

  const metrics = normalizeMetrics(payload.metrics, productType, { rejectInvalid: true });
  const eventCounters = normalizeEventCounters(payload.eventCounters, productType, { rejectInvalid: true });
  if (Object.keys(metrics).length === 0) {
    throw new ApiError(400, "EMPTY_TELEMETRY_METRICS", "At least one aggregate metric is required.");
  }

  return {
    generatedAt,
    appVersion: payload.appVersion,
    metrics,
    eventCounters,
  };
}

export function sanitizeStoredTelemetry(value, productType) {
  if (!isPlainObject(value)) return null;
  if (value.productType && value.productType !== productType) return null;
  const generatedAt = normalizeIsoTimestamp(value.generatedAt);
  const lastHeartbeatAt = normalizeIsoTimestamp(value.lastHeartbeatAt);
  const receivedAt = normalizeIsoTimestamp(value.receivedAt);
  const source = value.source === `rts-${productType}-pos` ? value.source : null;
  const appVersion = isValidTelemetryAppVersion(value.appVersion) ? value.appVersion : null;
  return {
    generatedAt,
    lastHeartbeatAt,
    receivedAt,
    source,
    appVersion,
    metrics: normalizeMetrics(value.metrics, productType, { rejectInvalid: false }),
    eventCounters: normalizeEventCounters(value.eventCounters, productType, { rejectInvalid: false }),
  };
}

export function telemetryHealthMetricKeys() {
  return Object.keys(COMMON_METRICS);
}
