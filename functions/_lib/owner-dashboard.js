import { sanitizeStoredTelemetry, telemetryHealthMetricKeys } from "./telemetry.js";

const TELEMETRY_FRESHNESS_MS = 15 * 60 * 1000;

function asIso(value) {
  if (value === null || value === undefined || value === "") return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function epochSecondsAsIso(value) {
  const seconds = Number(value);
  return Number.isFinite(seconds) && seconds > 0
    ? new Date(seconds * 1000).toISOString()
    : null;
}

function agorotToNis(value) {
  return Math.round(Number(value || 0)) / 100;
}

function formatNis(value) {
  return `₪${Number(value || 0).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function staffSummary(usersDocument) {
  const users = Array.isArray(usersDocument?.users) ? usersDocument.users : [];
  const active = users.filter((user) => user?.active !== false);
  return {
    totalAccounts: users.length,
    activeAccounts: active.length,
    adminAccounts: active.filter((user) => user?.role === "admin" || user?.isOwner === true).length,
  };
}

async function loadPlatformMessaging(db, mode, organizationId) {
  const unavailable = {
    available: false,
    source: "rts-royal-d1",
    messageBalance: null,
    prepaidBalanceNis: null,
    customerPriceNis: null,
    platformCostNis: null,
    updatedAt: null,
    recentLedger: [],
  };
  if (!db?.prepare) return unavailable;

  try {
    const account = await db.prepare(
      `SELECT message_balance, money_balance_agorot, customer_price_agorot,
              platform_cost_agorot, updated_at
       FROM credit_accounts
       WHERE organization_type = ? AND organization_id = ?`
    ).bind(mode, organizationId).first();
    if (!account) return unavailable;

    const ledgerResult = await db.prepare(
      `SELECT id, entry_type, money_delta_agorot, message_delta, delivery_status, created_at
       FROM credit_ledger
       WHERE organization_type = ? AND organization_id = ?
       ORDER BY created_at DESC
       LIMIT 10`
    ).bind(mode, organizationId).all();

    return {
      available: true,
      source: "rts-royal-d1",
      messageBalance: Number(account.message_balance || 0),
      prepaidBalanceNis: agorotToNis(account.money_balance_agorot),
      customerPriceNis: agorotToNis(account.customer_price_agorot),
      platformCostNis: agorotToNis(account.platform_cost_agorot),
      updatedAt: epochSecondsAsIso(account.updated_at),
      recentLedger: Array.isArray(ledgerResult?.results) ? ledgerResult.results : [],
    };
  } catch {
    return unavailable;
  }
}

function telemetrySummary(licence, generatedAt, sourceTelemetry) {
  const heartbeatAt = asIso(
    sourceTelemetry?.lastHeartbeatAt
      || licence?.tracking?.lastHeartbeatAt
      || licence?.lastHeartbeatAt
  );
  if (!heartbeatAt) {
    return {
      available: false,
      status: "unknown",
      lastHeartbeatAt: null,
      source: null,
      generatedAt: null,
      receivedAt: null,
      appVersion: null,
      detail: "No periodic operational heartbeat is published by the source application.",
    };
  }

  const ageMs = generatedAt.getTime() - new Date(heartbeatAt).getTime();
  return {
    available: true,
    status: ageMs <= TELEMETRY_FRESHNESS_MS ? "online" : "offline",
    lastHeartbeatAt: heartbeatAt,
    source: sourceTelemetry?.source || "source-application-heartbeat",
    generatedAt: sourceTelemetry?.generatedAt || null,
    receivedAt: sourceTelemetry?.receivedAt || null,
    appVersion: sourceTelemetry?.appVersion || null,
    detail: ageMs <= TELEMETRY_FRESHNESS_MS
      ? "A recent source-application heartbeat was received."
      : "The source-application heartbeat is stale.",
  };
}

function ledgerActivity(row) {
  const messageDelta = Number(row.message_delta || 0);
  const moneyDeltaNis = agorotToNis(row.money_delta_agorot);
  const allocation = row.entry_type === "allocation";
  return {
    id: `credit-${row.id}`,
    category: "platform-messaging",
    type: allocation ? "credit-allocation" : "credit-usage",
    title: allocation ? "Messaging credits allocated" : "Messaging credits used",
    detail: `${Math.abs(messageDelta)} messages · ${formatNis(Math.abs(moneyDeltaNis))}`,
    level: row.delivery_status === "failed" ? "warning" : "info",
    occurredAt: epochSecondsAsIso(row.created_at),
    source: "rts-royal-d1",
    changes: {
      messageDelta,
      moneyDeltaNis,
      deliveryStatus: row.delivery_status || null,
    },
  };
}

function unavailableMetric(reason) {
  return { available: false, value: null, reason };
}

function sourceMetric(sourceTelemetry, key, reason) {
  if (!Object.hasOwn(sourceTelemetry?.metrics || {}, key)) return unavailableMetric(reason);
  return {
    available: true,
    value: sourceTelemetry.metrics[key],
    source: sourceTelemetry.source,
    generatedAt: sourceTelemetry.generatedAt,
  };
}

function modeDetail(mode, sourceTelemetry) {
  if (mode === "business") {
    const reason = "RTS Business telemetry has not been received yet.";
    return {
      kind: "business",
      salesToday: sourceMetric(sourceTelemetry, "salesToday", reason),
      ordersToday: sourceMetric(sourceTelemetry, "ordersToday", reason),
      averageOrderValue: sourceMetric(sourceTelemetry, "averageOrderValue", reason),
      lowStockItems: sourceMetric(sourceTelemetry, "lowStockItems", reason),
      inventoryUnits: sourceMetric(sourceTelemetry, "inventoryUnits", reason),
      inventoryValue: sourceMetric(sourceTelemetry, "inventoryValue", reason),
      returnsToday: sourceMetric(sourceTelemetry, "returnsToday", reason),
      refundsToday: sourceMetric(sourceTelemetry, "refundsToday", reason),
      damageUnitsToday: sourceMetric(sourceTelemetry, "damageUnitsToday", reason),
    };
  }

  const reason = "RTS Clinic telemetry has not been received yet.";
  return {
    kind: "clinic",
    appointmentsToday: sourceMetric(sourceTelemetry, "appointmentsToday", reason),
    waitingCount: sourceMetric(sourceTelemetry, "waitingCount", reason),
    completedSessionsToday: sourceMetric(sourceTelemetry, "completedSessionsToday", reason),
    followUpsDue: sourceMetric(sourceTelemetry, "followUpsDue", reason),
    collectionsToday: sourceMetric(sourceTelemetry, "collectionsToday", reason),
    outstandingInsurance: sourceMetric(sourceTelemetry, "outstandingInsurance", reason),
    openSessions: sourceMetric(sourceTelemetry, "openSessions", reason),
    activeAccounts: sourceMetric(sourceTelemetry, "activeAccounts", reason),
    patientDetailsIncluded: false,
  };
}

function operationalGaps(mode, sourceTelemetry, telemetry) {
  const hasOperationalMetrics = Object.keys(sourceTelemetry?.metrics || {}).some(
    (key) => !telemetryHealthMetricKeys().includes(key)
  );
  const gaps = [];
  if (mode === "business") {
    if (!hasOperationalMetrics) {
      gaps.push({
        key: "business-operations",
        reason: "Sales, orders, inventory, returns, damage, and POS audit data remain in each Business backend.",
        requiredTelemetry: "Publish tenant-scoped aggregate snapshots and sanitized operational events to a server-authorized RTS Royal endpoint.",
      });
    }
    if (!telemetry.available) {
      gaps.push({
        key: "business-connectivity",
        reason: "The existing licence lastChecked value is a startup/login check, not a periodic heartbeat.",
        requiredTelemetry: "Publish a signed heartbeat with terminal count, application version, and last successful sync.",
      });
    }
    return gaps;
  }
  if (!hasOperationalMetrics) {
    gaps.push({
      key: "clinic-operations",
      reason: "Appointments, sessions, payments, and audit records are stored in a local workspace.json file.",
      requiredTelemetry: "Publish aggregate-only counts and financial totals; never upload patient names, identifiers, notes, diagnoses, files, or session details.",
    });
  }
  if (!telemetry.available) {
    gaps.push({
      key: "clinic-connectivity",
      reason: "RTS Clinic currently authenticates remotely but does not publish a periodic heartbeat.",
      requiredTelemetry: "Publish a signed clinic heartbeat containing only clinic ID, app version, sync time, and aggregate queue health.",
    });
  }
  return gaps;
}

function sourceHealth(sourceTelemetry) {
  const metrics = {};
  for (const key of telemetryHealthMetricKeys()) {
    if (Object.hasOwn(sourceTelemetry?.metrics || {}, key)) metrics[key] = sourceTelemetry.metrics[key];
  }
  return {
    available: Object.keys(metrics).length > 0,
    source: sourceTelemetry?.source || null,
    generatedAt: sourceTelemetry?.generatedAt || null,
    appVersion: sourceTelemetry?.appVersion || null,
    metrics,
  };
}

function sourceFinancials(mode, sourceTelemetry) {
  const reason = mode === "clinic"
    ? "Clinic financial aggregates are not published to RTS Royal."
    : "Business financial aggregates are not published to RTS Royal.";
  const fields = mode === "clinic"
    ? {
        revenueToday: "collectionsToday",
        outstandingBalance: "outstandingInsurance",
      }
    : {
        revenueToday: "salesToday",
        averageOrderValue: "averageOrderValue",
        inventoryValue: "inventoryValue",
        refundsToday: "refundsToday",
      };
  const result = {};
  for (const [key, metricKey] of Object.entries(fields)) {
    result[key] = sourceMetric(sourceTelemetry, metricKey, reason);
  }
  return {
    available: Object.values(result).some((metric) => metric.available),
    source: sourceTelemetry?.source || null,
    generatedAt: sourceTelemetry?.generatedAt || null,
    ...result,
  };
}

export async function buildOwnerDashboard({
  db,
  store,
  licence,
  usersDocument,
  mode,
  generatedAt = new Date(),
}) {
  const generatedAtIso = generatedAt.toISOString();
  const warrantyEnd = asIso(licence?.warrantyEnd);
  const licenceActive = Boolean(warrantyEnd && new Date(warrantyEnd).getTime() > generatedAt.getTime());
  const licenceCreatedAt = asIso(licence?.createdAt);
  const lastLicenceCheckAt = asIso(licence?.lastChecked);
  const staff = staffSummary(usersDocument);
  const sourceTelemetry = sanitizeStoredTelemetry(licence?.telemetry, mode);
  const telemetry = telemetrySummary(licence, generatedAt, sourceTelemetry);
  const health = sourceHealth(sourceTelemetry);
  const sourceFinances = sourceFinancials(mode, sourceTelemetry);
  const eventCounters = sourceTelemetry?.eventCounters || {};
  const messaging = await loadPlatformMessaging(db, mode, store.id);
  const productLabel = mode === "clinic" ? "Clinic" : "Business";
  const organizationName = store.name || licence?.storeName || store.id;

  const recentActivity = messaging.recentLedger
    .map(ledgerActivity)
    .filter((activity) => activity.occurredAt);
  if (lastLicenceCheckAt) {
    recentActivity.push({
      id: `licence-check-${store.id}`,
      category: "system",
      type: "licence-check",
      title: `${productLabel} licence checked`,
      detail: "The source application checked its licence. This is not a live heartbeat.",
      level: "info",
      occurredAt: lastLicenceCheckAt,
      source: "firestore-licence",
      changes: {},
    });
  }
  if (licenceCreatedAt) {
    recentActivity.push({
      id: `licence-created-${store.id}`,
      category: "administration",
      type: "licence-created",
      title: `${productLabel} location provisioned`,
      detail: organizationName,
      level: "info",
      occurredAt: licenceCreatedAt,
      source: "firestore-licence",
      changes: {},
    });
  }
  recentActivity.sort((left, right) => right.occurredAt.localeCompare(left.occurredAt));
  recentActivity.splice(10);

  const alerts = [];
  if (!licenceActive) {
    alerts.push({
      id: "licence-expired",
      title: `${productLabel} licence is inactive`,
      detail: organizationName,
      level: "critical",
    });
  }
  if (telemetry.status === "unknown") {
    alerts.push({
      id: "operational-telemetry-unavailable",
      title: "Live operational status is unavailable",
      detail: `${organizationName} does not publish a periodic heartbeat.`,
      level: "warning",
    });
  } else if (telemetry.status === "offline") {
    alerts.push({
      id: "operational-heartbeat-stale",
      title: `${productLabel} location heartbeat is stale`,
      detail: telemetry.lastHeartbeatAt,
      level: "critical",
    });
  }
  if (messaging.available && messaging.messageBalance <= 50) {
    alerts.push({
      id: "messaging-credit-low",
      title: "Messaging credit balance is low",
      detail: `${messaging.messageBalance} messages remain.`,
      level: messaging.messageBalance === 0 ? "critical" : "warning",
    });
  }
  for (const [key, title] of [
    ["databaseHealthy", "Source database health check failed"],
    ["syncHealthy", "Source synchronization is unhealthy"],
    ["backupHealthy", "Source backup health check failed"],
  ]) {
    if (sourceTelemetry?.metrics?.[key] === false) {
      alerts.push({
        id: `source-${key}`,
        title,
        detail: sourceTelemetry.generatedAt,
        level: "critical",
      });
    }
  }
  if (Number(sourceTelemetry?.metrics?.failedSyncCount || 0) > 0) {
    alerts.push({
      id: "source-sync-failures",
      title: "Source synchronization failures reported",
      detail: `${sourceTelemetry.metrics.failedSyncCount} aggregate failures.`,
      level: "warning",
    });
  }

  const metrics = [
    { key: "licence", label: "Licence", value: licenceActive ? "Active" : "Expired" },
    { key: "licenceEnd", label: "Licence ends", value: warrantyEnd?.slice(0, 10) || "Unavailable" },
    { key: "activeStaff", label: "Active staff", value: String(staff.activeAccounts) },
    {
      key: "operationalStatus",
      label: "Live status",
      value: telemetry.status === "unknown"
        ? "Not connected"
        : telemetry.status === "online" ? "Online" : "Offline",
    },
  ];
  if (messaging.available) {
    metrics.push({
      key: "messageCredits",
      label: "Message credits",
      value: String(messaging.messageBalance),
    });
  }
  const headlineMetrics = mode === "clinic"
    ? [["appointmentsToday", "Appointments today"], ["waitingCount", "Waiting"]]
    : [["salesToday", "Sales today"], ["ordersToday", "Orders today"]];
  for (const [key, label] of headlineMetrics) {
    if (Object.hasOwn(sourceTelemetry?.metrics || {}, key)) {
      metrics.push({
        key,
        label,
        value: key === "salesToday" ? formatNis(sourceTelemetry.metrics[key]) : String(sourceTelemetry.metrics[key]),
      });
    }
  }

  const attention = !licenceActive
    ? "Licence renewal is required."
    : telemetry.status === "unknown"
      ? "Live operational telemetry is not connected."
      : telemetry.status === "offline"
        ? "Operational heartbeat is stale."
        : undefined;
  const synchronizedLabel = `Owner data generated ${generatedAtIso}`;
  const location = {
    id: store.id,
    name: organizationName,
    mode,
    status: telemetry.status,
    online: telemetry.status === "online",
    updatedLabel: telemetry.lastHeartbeatAt
      ? `Heartbeat ${telemetry.lastHeartbeatAt}`
      : "Live status unavailable",
    primaryLabel: `${productLabel} licence`,
    primaryValue: licenceActive ? "Active" : "Expired",
    ...(attention ? { attention } : {}),
    telemetry,
    licence: {
      active: licenceActive,
      endsAt: warrantyEnd,
      lastCheckedAt: lastLicenceCheckAt,
    },
  };

  const available = ["licence", "staff-counts"];
  if (lastLicenceCheckAt) available.push("last-licence-check");
  if (messaging.available) available.push("platform-messaging-balance", "platform-messaging-ledger");
  if (telemetry.available) available.push("operational-heartbeat");
  if (health.available) available.push("source-health");
  if (sourceFinances.available) available.push("source-financial-aggregates");
  if (Object.keys(sourceTelemetry?.metrics || {}).length > 0) available.push(`${mode}-aggregate-metrics`);
  if (Object.keys(eventCounters).length > 0) available.push("aggregate-event-counters");

  const unavailable = mode === "clinic"
    ? [
        ["appointments", "appointmentsToday"],
        ["queue", "waitingCount"],
        ["sessions", "completedSessionsToday"],
        ["follow-ups", "followUpsDue"],
        ["clinic-revenue", "collectionsToday"],
      ]
    : [
        ["sales", "salesToday"],
        ["orders", "ordersToday"],
        ["inventory", "inventoryValue"],
        ["returns", "returnsToday"],
        ["damage", null],
      ];
  const unavailableData = unavailable
    .filter(([, metricKey]) => !metricKey || !Object.hasOwn(sourceTelemetry?.metrics || {}, metricKey))
    .map(([key]) => key);
  unavailableData.push("complete-audit-log");

  return {
    contractVersion: 2,
    generatedAt: generatedAtIso,
    mode,
    metrics,
    sites: [location],
    alerts,
    synchronizedLabel,
    overview: {
      organization: { id: store.id, name: organizationName, mode },
      licence: location.licence,
      locations: { total: 1, online: telemetry.status === "online" ? 1 : 0, unknown: telemetry.status === "unknown" ? 1 : 0 },
      alerts: { total: alerts.length, critical: alerts.filter((alert) => alert.level === "critical").length },
      staff,
    },
    locations: [location],
    recentActivity,
    auditLog: {
      completeness: Object.keys(eventCounters).length > 0 ? "aggregate-only" : "partial",
      detail: Object.keys(eventCounters).length > 0
        ? "Privacy-safe source event counters and RTS Royal platform events are available; raw audit entries are never ingested."
        : "Only privacy-safe RTS Royal platform events are available.",
      source: sourceTelemetry?.source || null,
      generatedAt: sourceTelemetry?.generatedAt || null,
      eventCounts: eventCounters,
      events: recentActivity.map((activity) => ({
        id: activity.id,
        category: activity.category,
        action: activity.type,
        occurredAt: activity.occurredAt,
        source: activity.source,
        changes: activity.changes,
      })),
    },
    financialMetrics: {
      currency: "ILS",
      businessRevenue: {
        ...(mode === "business"
          ? sourceMetric(
              sourceTelemetry,
              "salesToday",
              "Business sales remain in the tenant operational backend and are not published to RTS Royal."
            )
          : unavailableMetric("Clinic revenue remains local and is not published to Tracking.")),
      },
      sourceApplication: sourceFinances,
      platformMessaging: {
        available: messaging.available,
        source: messaging.source,
        messageBalance: messaging.messageBalance,
        prepaidBalanceNis: messaging.prepaidBalanceNis,
        customerPriceNis: messaging.customerPriceNis,
        platformCostNis: messaging.platformCostNis,
        updatedAt: messaging.updatedAt,
      },
    },
    operationalMetrics: {
      connectivity: telemetry,
      staff,
      health,
      sourceBackend: mode === "clinic" ? "local-workspace" : (licence?.dataBackend || store.type || "firestore"),
    },
    modeDetail: modeDetail(mode, sourceTelemetry),
    dataAvailability: {
      available,
      unavailable: unavailableData,
      gaps: operationalGaps(mode, sourceTelemetry, telemetry),
      privacy: {
        scope: "aggregate-only",
        patientMedicalDetailsIncluded: false,
        unnecessaryPersonalDataIncluded: false,
      },
    },
  };
}
