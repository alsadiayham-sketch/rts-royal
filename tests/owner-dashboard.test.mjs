import test from "node:test";
import assert from "node:assert/strict";

import { buildOwnerDashboard } from "../functions/_lib/owner-dashboard.js";

function creditDatabase() {
  return {
    prepare(sql) {
      let values = [];
      return {
        bind(...args) {
          values = args;
          return this;
        },
        async first() {
          assert.match(sql, /FROM credit_accounts/);
          assert.deepEqual(values, ["business", "royal-market"]);
          return {
            message_balance: 42,
            money_balance_agorot: 1250,
            customer_price_agorot: 20,
            platform_cost_agorot: 10,
            updated_at: 1791718200,
          };
        },
        async all() {
          assert.match(sql, /FROM credit_ledger/);
          assert.deepEqual(values, ["business", "royal-market"]);
          return {
            results: [{
              id: "ledger-private-note",
              entry_type: "usage",
              money_delta_agorot: -40,
              message_delta: -2,
              delivery_status: "delivered",
              note: "Customer phone 0500000000",
              created_by: "private.admin",
              created_at: 1791718000,
            }],
          };
        },
      };
    },
  };
}

test("owner dashboard v2 preserves legacy fields and adds management sections", async () => {
  const dashboard = await buildOwnerDashboard({
    db: creditDatabase(),
    store: { id: "royal-market", name: "Royal Market", type: "d1" },
    licence: {
      warrantyEnd: "2030-01-01T00:00:00.000Z",
      createdAt: "2026-09-01T08:00:00.000Z",
      lastChecked: "2026-10-11T10:00:00.000Z",
      dataBackend: "d1",
    },
    usersDocument: {
      users: [
        { username: "owner.private", displayName: "Private Owner", role: "admin", isOwner: true, active: true, passwordHash: "secret-hash" },
        { username: "cashier.private", displayName: "Private Cashier", role: "worker", active: true },
        { username: "former.private", displayName: "Former Worker", role: "worker", active: false },
      ],
    },
    mode: "business",
    generatedAt: new Date("2026-10-11T12:00:00.000Z"),
  });

  assert.equal(dashboard.contractVersion, 2);
  assert.equal(dashboard.mode, "business");
  assert.ok(Array.isArray(dashboard.metrics));
  assert.ok(Array.isArray(dashboard.sites));
  assert.ok(Array.isArray(dashboard.alerts));
  assert.equal(typeof dashboard.synchronizedLabel, "string");
  assert.equal(dashboard.overview.staff.activeAccounts, 2);
  assert.equal(dashboard.locations[0].status, "unknown");
  assert.equal(dashboard.locations[0].online, false);
  assert.equal(dashboard.financialMetrics.platformMessaging.messageBalance, 42);
  assert.equal(dashboard.financialMetrics.platformMessaging.prepaidBalanceNis, 12.5);
  assert.equal(dashboard.operationalMetrics.sourceBackend, "d1");
  assert.equal(dashboard.modeDetail.kind, "business");
  assert.equal(dashboard.modeDetail.salesToday.available, false);
  assert.equal(dashboard.auditLog.completeness, "partial");
  assert.ok(dashboard.recentActivity.some((event) => event.type === "credit-usage"));

  const serialized = JSON.stringify(dashboard);
  for (const privateValue of [
    "Private Owner",
    "Private Cashier",
    "owner.private",
    "cashier.private",
    "secret-hash",
    "Customer phone 0500000000",
    "private.admin",
  ]) {
    assert.equal(serialized.includes(privateValue), false);
  }
});

test("clinic dashboard is aggregate-only and never returns medical or patient details", async () => {
  const dashboard = await buildOwnerDashboard({
    store: { id: "north-clinic", name: "North Clinic", type: "clinic" },
    licence: {
      warrantyEnd: "2030-01-01T00:00:00.000Z",
      patientName: "Sensitive Patient",
      medicalNotes: "Sensitive diagnosis",
      nationalId: "000000000",
    },
    usersDocument: {
      users: [{
        username: "doctor.private",
        displayName: "Private Doctor",
        role: "admin",
        active: true,
      }],
    },
    mode: "clinic",
    generatedAt: new Date("2026-10-11T12:00:00.000Z"),
  });

  assert.equal(dashboard.modeDetail.kind, "clinic");
  assert.equal(dashboard.modeDetail.patientDetailsIncluded, false);
  assert.equal(dashboard.dataAvailability.privacy.patientMedicalDetailsIncluded, false);
  assert.equal(dashboard.dataAvailability.privacy.unnecessaryPersonalDataIncluded, false);
  assert.equal(dashboard.financialMetrics.businessRevenue.available, false);
  assert.equal(dashboard.operationalMetrics.sourceBackend, "local-workspace");
  assert.ok(dashboard.dataAvailability.unavailable.includes("appointments"));
  assert.ok(dashboard.alerts.some((alert) => alert.id === "operational-telemetry-unavailable"));

  const serialized = JSON.stringify(dashboard);
  for (const privateValue of [
    "Sensitive Patient",
    "Sensitive diagnosis",
    "000000000",
    "Private Doctor",
    "doctor.private",
  ]) {
    assert.equal(serialized.includes(privateValue), false);
  }
});

test("a future periodic heartbeat drives the location status without changing legacy fields", async () => {
  const dashboard = await buildOwnerDashboard({
    store: { id: "heartbeat-store", name: "Heartbeat Store", type: "firestore" },
    licence: {
      warrantyEnd: "2030-01-01T00:00:00.000Z",
      telemetry: { lastHeartbeatAt: "2026-10-11T11:55:00.000Z" },
    },
    usersDocument: { users: [] },
    mode: "business",
    generatedAt: new Date("2026-10-11T12:00:00.000Z"),
  });

  assert.equal(dashboard.locations[0].status, "online");
  assert.equal(dashboard.sites[0].online, true);
  assert.equal(
    dashboard.alerts.some((alert) => alert.id === "operational-telemetry-unavailable"),
    false
  );
});

test("business aggregate telemetry populates operations, health, finances, and event counts", async () => {
  const dashboard = await buildOwnerDashboard({
    store: { id: "telemetry-market", name: "Telemetry Market", type: "firestore" },
    licence: {
      warrantyEnd: "2030-01-01T00:00:00.000Z",
      telemetry: {
        schemaVersion: 1,
        productType: "business",
        source: "rts-business-pos",
        generatedAt: "2026-10-11T11:58:00.000Z",
        receivedAt: "2026-10-11T11:58:02.000Z",
        lastHeartbeatAt: "2026-10-11T11:58:00.000Z",
        appVersion: "4.2.1",
        metrics: {
          salesToday: 2500.5,
          ordersToday: 20,
          averageOrderValue: 125.025,
          inventoryValue: 9000,
          lowStockItems: 3,
          returnsToday: 1,
          refundsToday: 50,
          databaseHealthy: true,
          syncHealthy: true,
          backupHealthy: false,
          terminalCount: 2,
        },
        eventCounters: {
          auditEvents: 31,
          salesCompleted: 20,
          inventoryAdjustments: 2,
        },
      },
    },
    usersDocument: { users: [] },
    mode: "business",
    generatedAt: new Date("2026-10-11T12:00:00.000Z"),
  });

  assert.equal(dashboard.modeDetail.salesToday.available, true);
  assert.equal(dashboard.modeDetail.salesToday.value, 2500.5);
  assert.equal(dashboard.financialMetrics.businessRevenue.value, 2500.5);
  assert.equal(dashboard.financialMetrics.sourceApplication.inventoryValue.value, 9000);
  assert.equal(dashboard.operationalMetrics.health.metrics.terminalCount, 2);
  assert.equal(dashboard.auditLog.completeness, "aggregate-only");
  assert.equal(dashboard.auditLog.eventCounts.salesCompleted, 20);
  assert.ok(dashboard.alerts.some((alert) => alert.id === "source-backupHealthy"));
  assert.equal(dashboard.dataAvailability.unavailable.includes("sales"), false);
  assert.equal(dashboard.dataAvailability.available.includes("aggregate-event-counters"), true);
});

test("clinic aggregate telemetry exposes counts and totals without leaking medical or free-text fields", async () => {
  const dashboard = await buildOwnerDashboard({
    store: { id: "telemetry-clinic", name: "Telemetry Clinic", type: "clinic" },
    licence: {
      warrantyEnd: "2030-01-01T00:00:00.000Z",
      telemetry: {
        schemaVersion: 1,
        productType: "clinic",
        source: "rts-clinic-pos",
        generatedAt: "2026-10-11T11:58:00.000Z",
        receivedAt: "2026-10-11T11:58:02.000Z",
        lastHeartbeatAt: "2026-10-11T11:58:00.000Z",
        appVersion: "2.1.0",
        metrics: {
          appointmentsToday: 12,
          waitingCount: 2,
          completedSessionsToday: 8,
          followUpsDue: 4,
          collectionsToday: 1600,
          outstandingInsurance: 300,
          syncHealthy: true,
          patientName: "Sensitive Patient",
        },
        eventCounters: {
          appointmentsCreated: 5,
          paymentsRecorded: 8,
          rawAuditEntry: "Sensitive diagnosis",
        },
        notes: "Sensitive medical notes",
      },
    },
    usersDocument: { users: [] },
    mode: "clinic",
    generatedAt: new Date("2026-10-11T12:00:00.000Z"),
  });

  assert.equal(dashboard.modeDetail.appointmentsToday.value, 12);
  assert.equal(dashboard.modeDetail.collectionsToday.value, 1600);
  assert.equal(dashboard.financialMetrics.sourceApplication.revenueToday.value, 1600);
  assert.equal(dashboard.financialMetrics.sourceApplication.outstandingBalance.value, 300);
  assert.equal(dashboard.auditLog.eventCounts.paymentsRecorded, 8);
  assert.equal(dashboard.modeDetail.patientDetailsIncluded, false);
  const serialized = JSON.stringify(dashboard);
  for (const privateValue of ["Sensitive Patient", "Sensitive diagnosis", "Sensitive medical notes", "rawAuditEntry"]) {
    assert.equal(serialized.includes(privateValue), false);
  }
});
