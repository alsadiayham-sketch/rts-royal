import { requireAuthenticatedUser } from "../_lib/auth.js";
import {
  ApiError,
  jsonResponse,
  parseJsonBody,
  requireJsonContentType,
  requireTrustedMutationRequest,
  withApiGuard,
} from "../_lib/http.js";
import { getFirestoreDocument } from "../_lib/firestore.js";
import { enforceRateLimit } from "../_lib/rate-limit.js";
import { normalizeStoreId } from "../_lib/pos-store-validation.js";
import {
  CREDIT_LEDGER_ENTRY_TYPES,
  DELIVERY_STATUSES,
  REQUEST_STATUSES,
  agorotToNis,
  normalizeDefaultMessageBalance,
  normalizeMessageAmount,
  normalizeNisToAgorot,
  normalizeOrganizationType,
  normalizeShortText,
  normalizeUnixDate,
} from "../_lib/credit-validation.js";

const REGISTRY_PATH = "projects/_global/settings/pos_stores";
const DEFAULT_SETTINGS = {
  defaultMessageBalance: 500,
  customerPriceAgorot: 20,
  platformCostAgorot: 10,
};

function cleanSearch(value) {
  const text = normalizeShortText(value || "", 80);
  return text === null ? "" : text.toLowerCase();
}

function applyDateFilter(row, fromEpoch, toEpoch) {
  const createdAt = Number(row.createdAt || row.created_at || 0);
  return (!fromEpoch || createdAt >= fromEpoch) && (!toEpoch || createdAt <= toEpoch);
}

function settingsFromRow(row) {
  return {
    defaultMessageBalance: Number(row?.default_message_balance ?? DEFAULT_SETTINGS.defaultMessageBalance),
    customerPriceNis: agorotToNis(row?.customer_price_agorot ?? DEFAULT_SETTINGS.customerPriceAgorot),
    platformCostNis: agorotToNis(row?.platform_cost_agorot ?? DEFAULT_SETTINGS.platformCostAgorot),
    updatedAt: Number(row?.updated_at || 0),
    updatedBy: row?.updated_by || "",
  };
}

async function loadSettings(db) {
  await db.prepare(
    `INSERT OR IGNORE INTO credit_settings
       (id, default_message_balance, customer_price_agorot, platform_cost_agorot)
     VALUES (1, ?, ?, ?)`
  )
    .bind(
      DEFAULT_SETTINGS.defaultMessageBalance,
      DEFAULT_SETTINGS.customerPriceAgorot,
      DEFAULT_SETTINGS.platformCostAgorot
    )
    .run();
  return db.prepare(
    `SELECT default_message_balance, customer_price_agorot, platform_cost_agorot, updated_at, updated_by
     FROM credit_settings
     WHERE id = 1`
  ).first();
}

function serializeAccount(row, settings) {
  return {
    organizationType: row.organization_type,
    organizationId: row.organization_id,
    displayName: row.display_name,
    messageBalance: Number(row.message_balance ?? settings.defaultMessageBalance),
    moneyBalanceNis: agorotToNis(row.money_balance_agorot),
    customerPriceNis: agorotToNis(row.customer_price_agorot ?? Math.round(settings.customerPriceNis * 100)),
    platformCostNis: agorotToNis(row.platform_cost_agorot ?? Math.round(settings.platformCostNis * 100)),
    updatedAt: Number(row.updated_at || 0),
  };
}

async function loadAccounts(db, settings) {
  const { results } = await db.prepare(
    `SELECT organization_type, organization_id, display_name, message_balance, money_balance_agorot,
            customer_price_agorot, platform_cost_agorot, updated_at
     FROM credit_accounts`
  ).all();
  return new Map(
    (results || []).map((row) => [
      `${row.organization_type}:${row.organization_id}`,
      serializeAccount(row, settings),
    ])
  );
}

async function loadRegisteredOrganizations(db, settings) {
  const [registry, accounts] = await Promise.all([
    getFirestoreDocument(REGISTRY_PATH),
    loadAccounts(db, settings),
  ]);
  const stores = Array.isArray(registry?.stores) ? registry.stores : [];
  const seen = new Set();
  const organizations = stores
    .filter((store) => store?.id && store?.name)
    .map((store) => {
      const organizationType = store.type === "clinic" ? "clinic" : "business";
      const key = `${organizationType}:${store.id}`;
      seen.add(key);
      const account = accounts.get(key);
      return {
        organizationType,
        organizationId: store.id,
        displayName: store.name,
        backend: store.type === "clinic" ? "clinic" : store.type || "firestore",
        messageBalance: account?.messageBalance ?? settings.defaultMessageBalance,
        moneyBalanceNis: account?.moneyBalanceNis ?? 0,
        customerPriceNis: account?.customerPriceNis ?? settings.customerPriceNis,
        platformCostNis: account?.platformCostNis ?? settings.platformCostNis,
        updatedAt: account?.updatedAt ?? 0,
      };
    });

  for (const [key, account] of accounts.entries()) {
    if (!seen.has(key)) {
      organizations.push({
        organizationType: account.organizationType,
        organizationId: account.organizationId,
        displayName: account.displayName,
        backend: "archived",
        messageBalance: account.messageBalance,
        moneyBalanceNis: account.moneyBalanceNis,
        customerPriceNis: account.customerPriceNis,
        platformCostNis: account.platformCostNis,
        updatedAt: account.updatedAt,
      });
    }
  }
  return organizations.sort((a, b) => a.displayName.localeCompare(b.displayName));
}

function filterOrganizations(organizations, { search, organizationType }) {
  return organizations.filter((org) => {
    if (organizationType && org.organizationType !== organizationType) return false;
    if (!search) return true;
    return `${org.displayName} ${org.organizationId} ${org.organizationType}`.toLowerCase().includes(search);
  });
}

function serializeLedger(row) {
  return {
    id: row.id,
    entryType: row.entry_type,
    organizationType: row.organization_type,
    organizationId: row.organization_id,
    displayName: row.display_name,
    moneyDeltaNis: agorotToNis(row.money_delta_agorot),
    messageDelta: Number(row.message_delta || 0),
    customerPriceNis: agorotToNis(row.customer_price_agorot),
    platformCostNis: agorotToNis(row.platform_cost_agorot),
    status: row.delivery_status || "",
    note: row.note || "",
    createdBy: row.created_by || "",
    createdAt: Number(row.created_at),
  };
}

function requestLedgerRow(row) {
  return {
    id: row.id,
    entryType: "request",
    organizationType: "",
    organizationId: "",
    displayName: row.business,
    moneyDeltaNis: 0,
    messageDelta: 0,
    customerPriceNis: 0,
    platformCostNis: 0,
    status: row.status,
    note: `${row.service}: ${row.name} — ${row.message}`,
    createdBy: "",
    createdAt: Number(row.created_at),
  };
}

async function loadLedger(db, filters) {
  const { fromEpoch, toEpoch, ledgerSearch, organizationType, organizationId, status, entryType } = filters;
  const [ledgerResult, requestResult] = await Promise.all([
    db.prepare(
      `SELECT id, organization_type, organization_id, display_name, entry_type, money_delta_agorot,
              message_delta, customer_price_agorot, platform_cost_agorot, delivery_status,
              note, created_by, created_at
       FROM credit_ledger
       WHERE (? IS NULL OR created_at >= ?)
         AND (? IS NULL OR created_at <= ?)
       ORDER BY created_at DESC
       LIMIT 300`
    ).bind(fromEpoch, fromEpoch, toEpoch, toEpoch).all(),
    db.prepare(
      `SELECT id, name, service, business, message, status, created_at
       FROM requests
       WHERE (? IS NULL OR created_at >= ?)
         AND (? IS NULL OR created_at <= ?)
       ORDER BY created_at DESC
       LIMIT 300`
    ).bind(fromEpoch, fromEpoch, toEpoch, toEpoch).all(),
  ]);

  const rows = [];
  if (!entryType || entryType !== "request") {
    rows.push(...(ledgerResult.results || []).map(serializeLedger));
  }
  if (!entryType || entryType === "request") {
    rows.push(...(requestResult.results || []).map(requestLedgerRow));
  }
  return rows
    .filter((row) => {
      if (!applyDateFilter(row, fromEpoch, toEpoch)) return false;
      if (entryType && row.entryType !== entryType) return false;
      if (organizationType && row.organizationType !== organizationType) return false;
      if (organizationId && row.organizationId !== organizationId) return false;
      if (status && row.status !== status) return false;
      if (!ledgerSearch) return true;
      return `${row.displayName} ${row.organizationId} ${row.entryType} ${row.status} ${row.note}`.toLowerCase().includes(ledgerSearch);
    })
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, 200);
}

async function loadAnalytics(db, organizations, filters) {
  const { fromEpoch, toEpoch } = filters;
  const [creditTotals, requestStatusRows, deliveryStatusRows] = await Promise.all([
    db.prepare(
      `SELECT
         SUM(CASE WHEN entry_type = 'allocation' THEN message_delta ELSE 0 END) AS allocated_messages,
         SUM(CASE WHEN entry_type = 'allocation' THEN money_delta_agorot ELSE 0 END) AS allocated_money_agorot,
         SUM(CASE WHEN entry_type = 'usage' THEN -message_delta ELSE 0 END) AS consumed_messages,
         SUM(CASE WHEN entry_type = 'usage' THEN (-message_delta * customer_price_agorot) ELSE 0 END) AS gross_revenue_agorot,
         SUM(CASE WHEN entry_type = 'usage' THEN (-message_delta * platform_cost_agorot) ELSE 0 END) AS platform_cost_agorot
       FROM credit_ledger
       WHERE (? IS NULL OR created_at >= ?)
         AND (? IS NULL OR created_at <= ?)`
    ).bind(fromEpoch, fromEpoch, toEpoch, toEpoch).first(),
    db.prepare(
      `SELECT status, COUNT(*) AS count
       FROM requests
       WHERE (? IS NULL OR created_at >= ?)
         AND (? IS NULL OR created_at <= ?)
       GROUP BY status`
    ).bind(fromEpoch, fromEpoch, toEpoch, toEpoch).all(),
    db.prepare(
      `SELECT delivery_status AS status, COUNT(*) AS count
       FROM credit_ledger
       WHERE delivery_status IS NOT NULL
         AND (? IS NULL OR created_at >= ?)
         AND (? IS NULL OR created_at <= ?)
       GROUP BY delivery_status`
    ).bind(fromEpoch, fromEpoch, toEpoch, toEpoch).all(),
  ]);
  const grossRevenue = Number(creditTotals?.gross_revenue_agorot || 0);
  const platformCost = Number(creditTotals?.platform_cost_agorot || 0);
  return {
    allocatedMessages: Number(creditTotals?.allocated_messages || 0),
    allocatedMoneyNis: agorotToNis(creditTotals?.allocated_money_agorot || 0),
    consumedCredits: Number(creditTotals?.consumed_messages || 0),
    grossRevenueNis: agorotToNis(grossRevenue),
    platformCostNis: agorotToNis(platformCost),
    netProfitNis: agorotToNis(grossRevenue - platformCost),
    remainingMessages: organizations.reduce((sum, org) => sum + Number(org.messageBalance || 0), 0),
    remainingMoneyNis: agorotToNis(organizations.reduce((sum, org) => sum + Math.round(Number(org.moneyBalanceNis || 0) * 100), 0)),
    requestStatusCounts: Object.fromEntries((requestStatusRows.results || []).map((row) => [row.status, Number(row.count)])),
    deliveryStatusCounts: Object.fromEntries((deliveryStatusRows.results || []).map((row) => [row.status, Number(row.count)])),
  };
}

function findOrganization(organizations, organizationType, organizationId) {
  return organizations.find((org) => org.organizationType === organizationType && org.organizationId === organizationId);
}

export async function onRequestGet(context) {
  return withApiGuard(context, async ({ request, env }) => {
    await requireAuthenticatedUser(context, false);
    const url = new URL(request.url);
    const rawType = url.searchParams.get("type") || "";
    const organizationType = rawType ? normalizeOrganizationType(rawType) : null;
    if (rawType && !organizationType) throw new ApiError(400, "INVALID_ORGANIZATION_TYPE", "Organization type is invalid.");
    const status = url.searchParams.get("status") || "";
    if (status && !DELIVERY_STATUSES.has(status) && !REQUEST_STATUSES.has(status)) {
      throw new ApiError(400, "INVALID_STATUS", "Status filter is invalid.");
    }
    const entryType = url.searchParams.get("entryType") || "";
    if (entryType && entryType !== "request" && !CREDIT_LEDGER_ENTRY_TYPES.has(entryType)) {
      throw new ApiError(400, "INVALID_ENTRY_TYPE", "Ledger entry type is invalid.");
    }
    const fromEpoch = normalizeUnixDate(url.searchParams.get("from"));
    const toEpoch = normalizeUnixDate(url.searchParams.get("to"), true);
    if ((url.searchParams.get("from") && !fromEpoch) || (url.searchParams.get("to") && !toEpoch)) {
      throw new ApiError(400, "INVALID_DATE_FILTER", "Date filters must use YYYY-MM-DD.");
    }

    const settings = settingsFromRow(await loadSettings(env.DB));
    const organizations = await loadRegisteredOrganizations(env.DB, settings);
    const filters = {
      search: cleanSearch(url.searchParams.get("search")),
      ledgerSearch: cleanSearch(url.searchParams.get("ledgerSearch")),
      organizationType,
      organizationId: normalizeStoreId(url.searchParams.get("organizationId") || "") || "",
      status,
      entryType,
      fromEpoch,
      toEpoch,
    };
    const filteredOrganizations = filterOrganizations(organizations, filters);
    const [ledger, analytics] = await Promise.all([
      loadLedger(env.DB, filters),
      loadAnalytics(env.DB, organizations, filters),
    ]);
    return jsonResponse({ settings, organizations: filteredOrganizations, ledger, analytics });
  });
}

export async function onRequestPatch(context) {
  return withApiGuard(context, async ({ request, env }) => {
    requireTrustedMutationRequest(request);
    requireJsonContentType(request);
    const user = await requireAuthenticatedUser(context, false);
    await enforceRateLimit(context, {
      scope: "credit_settings",
      accountPart: user.username,
      maxRequests: 20,
      windowSeconds: 600,
    });
    const payload = await parseJsonBody(request, [
      "defaultMessageBalance",
      "customerPriceNis",
      "platformCostNis",
    ]);
    const defaultMessageBalance = normalizeDefaultMessageBalance(payload.defaultMessageBalance);
    const customerPriceAgorot = normalizeNisToAgorot(payload.customerPriceNis, { allowZero: false });
    const platformCostAgorot = normalizeNisToAgorot(payload.platformCostNis, { allowZero: false });
    if (defaultMessageBalance === null || customerPriceAgorot === null || platformCostAgorot === null) {
      throw new ApiError(400, "INVALID_CREDIT_SETTINGS", "Credit defaults are invalid.");
    }
    await loadSettings(env.DB);
    await env.DB.prepare(
      `UPDATE credit_settings
       SET default_message_balance = ?, customer_price_agorot = ?, platform_cost_agorot = ?,
           updated_at = unixepoch(), updated_by = ?
       WHERE id = 1`
    ).bind(defaultMessageBalance, customerPriceAgorot, platformCostAgorot, user.username).run();
    return jsonResponse({ ok: true, settings: settingsFromRow(await loadSettings(env.DB)) });
  });
}

export async function onRequestPost(context) {
  return withApiGuard(context, async ({ request, env }) => {
    requireTrustedMutationRequest(request);
    requireJsonContentType(request);
    const user = await requireAuthenticatedUser(context, false);
    await enforceRateLimit(context, {
      scope: "credit_allocation",
      accountPart: user.username,
      maxRequests: 40,
      windowSeconds: 600,
    });
    const payload = await parseJsonBody(request, [
      "entryType",
      "organizationType",
      "organizationId",
      "moneyAmountNis",
      "messageAmount",
      "customerPriceNis",
      "platformCostNis",
      "deliveryStatus",
      "note",
    ]);
    const entryType = payload.entryType === "usage" ? "usage" : "allocation";
    const organizationType = normalizeOrganizationType(payload.organizationType);
    const organizationId = normalizeStoreId(payload.organizationId);
    const moneyAgorot = normalizeNisToAgorot(payload.moneyAmountNis);
    const messageAmount = normalizeMessageAmount(payload.messageAmount);
    const note = normalizeShortText(payload.note || "", 240);
    if (!organizationType || !organizationId || moneyAgorot === null || messageAmount === null || note === null) {
      throw new ApiError(400, "INVALID_ALLOCATION", "Allocation details are invalid.");
    }
    if (entryType === "allocation" && moneyAgorot === 0 && messageAmount === 0) {
      throw new ApiError(400, "EMPTY_ALLOCATION", "Allocate money, messages, or both.");
    }
    if (entryType === "usage" && (messageAmount < 1 || moneyAgorot !== 0)) {
      throw new ApiError(400, "INVALID_USAGE", "Usage entries require consumed messages only.");
    }
    const deliveryStatus = payload.deliveryStatus || (entryType === "usage" ? "delivered" : "delivered");
    if (!DELIVERY_STATUSES.has(deliveryStatus)) {
      throw new ApiError(400, "INVALID_DELIVERY_STATUS", "Delivery status is invalid.");
    }

    const settings = settingsFromRow(await loadSettings(env.DB));
    const customerPriceAgorot = payload.customerPriceNis === undefined || payload.customerPriceNis === ""
      ? Math.round(settings.customerPriceNis * 100)
      : normalizeNisToAgorot(payload.customerPriceNis, { allowZero: false });
    const platformCostAgorot = payload.platformCostNis === undefined || payload.platformCostNis === ""
      ? Math.round(settings.platformCostNis * 100)
      : normalizeNisToAgorot(payload.platformCostNis, { allowZero: false });
    if (customerPriceAgorot === null || platformCostAgorot === null) {
      throw new ApiError(400, "INVALID_PRICING", "Message pricing is invalid.");
    }

    const organizations = await loadRegisteredOrganizations(env.DB, settings);
    const organization = findOrganization(organizations, organizationType, organizationId);
    if (!organization) throw new ApiError(404, "ORGANIZATION_NOT_FOUND", "Organization was not found.");

    const id = crypto.randomUUID();
    const currentAccount = await env.DB.prepare(
      `SELECT message_balance, money_balance_agorot
       FROM credit_accounts
       WHERE organization_type = ? AND organization_id = ?`
    ).bind(organizationType, organizationId).first();
    const currentMessages = Number(currentAccount?.message_balance ?? settings.defaultMessageBalance);
    if (entryType === "usage" && currentMessages < messageAmount) {
      throw new ApiError(400, "INSUFFICIENT_CREDITS", "Organization does not have enough message credits.");
    }
    const messageDelta = entryType === "usage" ? -messageAmount : messageAmount;
    await env.DB.batch([
      env.DB.prepare(
        `INSERT INTO credit_accounts
           (organization_type, organization_id, display_name, message_balance, money_balance_agorot,
            customer_price_agorot, platform_cost_agorot, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, unixepoch(), unixepoch())
         ON CONFLICT(organization_type, organization_id) DO UPDATE SET
           display_name = excluded.display_name,
           message_balance = credit_accounts.message_balance + ?,
           money_balance_agorot = credit_accounts.money_balance_agorot + ?,
           customer_price_agorot = excluded.customer_price_agorot,
           platform_cost_agorot = excluded.platform_cost_agorot,
           updated_at = unixepoch()`
      ).bind(
        organizationType,
        organizationId,
        organization.displayName,
        settings.defaultMessageBalance + messageDelta,
        moneyAgorot,
        customerPriceAgorot,
        platformCostAgorot,
        messageDelta,
        moneyAgorot
      ),
      env.DB.prepare(
        `INSERT INTO credit_ledger
           (id, organization_type, organization_id, display_name, entry_type, money_delta_agorot,
            message_delta, customer_price_agorot, platform_cost_agorot, delivery_status, note, created_by, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, unixepoch())`
      ).bind(
        id,
        organizationType,
        organizationId,
        organization.displayName,
        entryType,
        moneyAgorot,
        messageDelta,
        customerPriceAgorot,
        platformCostAgorot,
        deliveryStatus,
        note,
        user.username
      ),
    ]);
    return jsonResponse({ ok: true, id }, 201);
  });
}
