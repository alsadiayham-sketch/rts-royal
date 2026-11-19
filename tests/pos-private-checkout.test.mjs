import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { commitPosAtomic, readPosAtomicRecord } from "../functions/_lib/pos-atomic-store.js";
import {
  quotePrivateRestaurantCheckout,
  completePrivateRestaurantCheckout,
} from "../functions/_lib/pos-private-checkout.js";

const session = {
  storeId: "restaurant-one",
  username: "cashier",
  role: "worker",
  productType: "business",
  authVersion: "a".repeat(64),
};

const authorityStore = {
  schemaVersion: 1,
  state: "active",
  storeId: session.storeId,
  businessType: "restaurant",
  licenceEndsAt: "2099-01-01T00:00:00Z",
  migrationId: "migration-0009",
};

const authorityUser = {
  schemaVersion: 1,
  state: "active",
  username: session.username,
  role: session.role,
  authVersion: session.authVersion,
};

function fixture(t) {
  const sqlite = new DatabaseSync(":memory:");
  sqlite.exec(readFileSync(new URL("../migrations/0009_pos_atomic_store.sql", import.meta.url), "utf8"));
  let loseBatchResponse = false;
  let failNextRead = false;
  let beforeBatchHook = null;

  function prepare(sql) {
    let params = [];
    return {
      bind(...values) {
        params = values;
        return this;
      },
      async first() {
        if (failNextRead) {
          failNextRead = false;
          throw new Error("simulated read loss");
        }
        return sqlite.prepare(sql).get(...params) ?? null;
      },
      async all() {
        return { results: sqlite.prepare(sql).all(...params) };
      },
      run() {
        return sqlite.prepare(sql).run(...params);
      },
    };
  }

  const db = {
    prepare,
    async batch(statements) {
      sqlite.exec("BEGIN IMMEDIATE");
      try {
        if (beforeBatchHook) {
          const hook = beforeBatchHook;
          beforeBatchHook = null;
          hook(sqlite);
        }
        const results = statements.map((statement) => statement.run());
        sqlite.exec("COMMIT");
        if (loseBatchResponse) {
          loseBatchResponse = false;
          failNextRead = true;
          throw new Error("simulated lost response");
        }
        return results;
      } catch (error) {
        if (sqlite.isTransaction) sqlite.exec("ROLLBACK");
        throw error;
      }
    },
  };

  const env = {
    POS_PRIVATE_RESTAURANT_STATE: "enabled",
    DB: {
      withSession(mode) {
        assert.equal(mode, "first-primary");
        return db;
      },
    },
  };
  t.after(() => sqlite.close());

  let seq = 0;
  async function upsert(collection, id, value) {
    const current = await readPosAtomicRecord(env, session.storeId, collection, id);
    const expectedRevision = current?.revision ?? 0;
    await commitPosAtomic(env, {
      storeId: session.storeId,
      requestId: `seed-${++seq}`,
      actor: "fixture",
      fingerprint: `seed-${seq}`,
      guards: [{ collection, id, expectedRevision }],
      writes: [{ collection, id, expectedRevision, value }],
      result: { ok: true },
    });
  }

  async function seedBaseline(overrides = {}) {
    const config = {
      features: { tax: true },
      taxPercent: 10,
      taxIncluded: false,
      loyalty: { enabled: true, mechanism: "purchase", earnPer: 10, redeemRate: 100, minRedeem: 100 },
      ...overrides.config,
    };
    const hold = {
      id: "hold-1",
      status: "open",
      revision: 1,
      items: [
        { productId: "prod-1", color: "Red", size: "M", qty: 2, note: "" },
        { productId: "prod-2", color: "Blue", size: "L", qty: 1, note: "less spice" },
      ],
      service: { type: "delivery", customerName: "Ali", phone: "0500", address: "Street 1", deliveryFee: 5 },
      note: "table note",
      discount: { type: "fixed", value: 2 },
      offerId: null,
      customerId: "cust-1",
      redeemPoints: 200,
      creditUse: 3,
      ...overrides.hold,
    };
    const products = {
      "prod-1": {
        name: "Burger",
        variants: [{ color: "Red", size: "M", price: 10, stock: 10, cost: 4 }],
      },
      "prod-2": {
        name: "Pizza",
        variants: [{ color: "Blue", size: "L", price: 20, stock: 5 }],
      },
      ...overrides.products,
    };
    const customer = { id: "cust-1", name: "Ali", phone: "0500", tier: "gold", ...(overrides.customer ?? {}) };
    const wallet = { points: 500, creditCents: 1000, debtCents: 2000, ...(overrides.wallet ?? {}) };

    await upsert("authority", "store", { ...authorityStore, ...(overrides.authorityStore ?? {}) });
    await upsert("authority", `user:${session.username}`, { ...authorityUser, ...(overrides.authorityUser ?? {}) });
    await upsert("settings", "config", config);
    for (const [id, value] of Object.entries(products)) await upsert("products", id, value);
    await upsert("holds", hold.id, hold);
    if (hold.customerId) {
      await upsert("customers", hold.customerId, customer);
      if (!overrides.skipWallet) await upsert("wallets", hold.customerId, wallet);
    }
    if (hold.service?.type === "dinein") {
      await upsert("tables", String(hold.service.table), {
        id: String(hold.service.table),
        name: `T-${hold.service.table}`,
        archived: false,
        holdId: hold.id,
        ...(overrides.table ?? {}),
      });
    }
    if (hold.offerId) {
      await upsert("offers", hold.offerId, {
        recordType: "restaurant-offer",
        name: "Offer",
        discountType: "percent",
        discountValue: 10,
        maxDiscount: 1000,
        minQty: 1,
        enabled: true,
        ...overrides.offer,
      });
    }
    return hold;
  }

  return {
    env,
    sqlite,
    upsert,
    seedBaseline,
    loseNextBatchResponse() {
      loseBatchResponse = true;
    },
    beforeNextBatch(hook) {
      beforeBatchHook = hook;
    },
  };
}

test("completes credit+loyalty+debt checkout atomically with split payment", async (t) => {
  const f = fixture(t);
  const hold = await f.seedBaseline();

  const { quoteHash, quote } = await quotePrivateRestaurantCheckout(f.env, session, {
    holdId: hold.id,
    revision: 1,
  });
  assert.equal(quote.total, 42.1);
  assert.equal(quote.loyaltyEarnPoints, 4);
  assert.equal(quote.creditUse, 3);
  assert.equal("cost" in quote.items[0], false);

  const result = await completePrivateRestaurantCheckout(f.env, session, {
    requestId: "req-1",
    holdId: hold.id,
    revision: 1,
    quoteHash,
    paymentMethod: "split",
    paymentBreakdown: { cash: 20, card: 10, debt: 12.1 },
  });
  assert.equal(result.ok, true);
  assert.equal(result.receipt.total, 42.1);
  assert.deepEqual(result.receipt.paymentBreakdown, { cash: 20, card: 10, debt: 12.1 });
  assert.equal("cost" in result.receipt.items[0], false);
  assert.deepEqual(result.receipt.customer, { id: "cust-1", name: "Ali", phone: "0500" });

  const wallet = await readPosAtomicRecord(f.env, session.storeId, "wallets", "cust-1");
  assert.deepEqual(wallet.value, { points: 304, creditCents: 700, debtCents: 3210 });
  const holdRecord = await readPosAtomicRecord(f.env, session.storeId, "holds", hold.id);
  assert.equal(holdRecord.value.status, "paid");
  const receipt = await readPosAtomicRecord(f.env, session.storeId, "receipts", hold.id);
  assert.ok(receipt.value.items.some((item) => item.cost === 4));
  assert.ok(receipt.value.items.some((item) => item.cost === null));
  assert.deepEqual(receipt.value.customer, { id: "cust-1", name: "Ali", phone: "0500" });
  assert.equal(receipt.value.quoteHash, quoteHash);
  assert.equal((await readPosAtomicRecord(f.env, session.storeId, "ledger", "req-1")).value.debtDeltaCents, 1210);
});

test("fails closed on overspend and on authority revoke race without partial writes", async (t) => {
  const f = fixture(t);
  await f.seedBaseline({ wallet: { creditCents: 100 } });
  await assert.rejects(
    quotePrivateRestaurantCheckout(f.env, session, { holdId: "hold-1", revision: 1 }),
    (error) => error.code === "CREDIT_INSUFFICIENT"
  );
  assert.equal(await readPosAtomicRecord(f.env, session.storeId, "receipts", "hold-1"), null);

  const f2 = fixture(t);
  await f2.seedBaseline();
  const q = await quotePrivateRestaurantCheckout(f2.env, session, { holdId: "hold-1", revision: 1 });
  f2.beforeNextBatch((sqlite) => {
    sqlite.prepare(
      "UPDATE pos_atomic_records SET revision=?, value_json=? WHERE store_id=? AND collection='authority' AND record_id=?"
    ).run(
      2,
      JSON.stringify({ ...authorityUser, state: "blocked" }),
      session.storeId,
      `user:${session.username}`
    );
  });
  await assert.rejects(
    completePrivateRestaurantCheckout(f2.env, session, {
      requestId: "req-revoke",
      holdId: "hold-1",
      revision: 1,
      quoteHash: q.quoteHash,
      paymentMethod: "cash",
    }),
    (error) => error.code === "CHECKOUT_CONFLICT"
  );
  assert.equal(await readPosAtomicRecord(f2.env, session.storeId, "receipts", "hold-1"), null);
  assert.equal((await readPosAtomicRecord(f2.env, session.storeId, "holds", "hold-1")).value.status, "open");
});

test("rejects checkout when source price or offer revisions drift from quoted hash", async (t) => {
  const f = fixture(t);
  await f.seedBaseline({ hold: { discount: { type: "fixed", value: 0 }, offerId: "offer-1" } });
  const first = await quotePrivateRestaurantCheckout(f.env, session, { holdId: "hold-1", revision: 1 });
  await f.upsert("offers", "offer-1", {
    recordType: "restaurant-offer",
    name: "Offer changed",
    discountType: "percent",
    discountValue: 20,
    maxDiscount: 1000,
    minQty: 1,
    enabled: true,
  });
  await assert.rejects(
    completePrivateRestaurantCheckout(f.env, session, {
      requestId: "req-drift",
      holdId: "hold-1",
      revision: 1,
      quoteHash: first.quoteHash,
      paymentMethod: "cash",
    }),
    (error) => error.code === "QUOTE_CHANGED"
  );
  assert.equal(await readPosAtomicRecord(f.env, session.storeId, "receipts", "hold-1"), null);
});

test("replays lost-response checkout idempotently", async (t) => {
  const f = fixture(t);
  await f.seedBaseline();
  const { quoteHash } = await quotePrivateRestaurantCheckout(f.env, session, { holdId: "hold-1", revision: 1 });
  const payload = {
    requestId: "req-replay",
    holdId: "hold-1",
    revision: 1,
    quoteHash,
    paymentMethod: "cash",
  };
  f.beforeNextBatch(() => {
    f.loseNextBatchResponse();
  });
  await assert.rejects(
    completePrivateRestaurantCheckout(f.env, session, payload),
    (error) => error.code === "ATOMIC_COMMIT_UNCERTAIN"
  );
  const replayed = await completePrivateRestaurantCheckout(f.env, session, payload);
  assert.equal(replayed.ok, true);
  assert.equal("cost" in replayed.receipt.items[0], false);
  assert.equal((await readPosAtomicRecord(f.env, session.storeId, "receipts", "hold-1")).revision, 1);
});

test("prevents duplicate billing after a successful checkout", async (t) => {
  const f = fixture(t);
  await f.seedBaseline();
  const { quoteHash } = await quotePrivateRestaurantCheckout(f.env, session, { holdId: "hold-1", revision: 1 });
  await completePrivateRestaurantCheckout(f.env, session, {
    requestId: "req-main",
    holdId: "hold-1",
    revision: 1,
    quoteHash,
    paymentMethod: "cash",
  });
  await assert.rejects(
    completePrivateRestaurantCheckout(f.env, session, {
      requestId: "req-duplicate",
      holdId: "hold-1",
      revision: 2,
      quoteHash,
      paymentMethod: "cash",
    }),
    (error) => error.code === "HOLD_ALREADY_PAID"
  );
  assert.equal(f.sqlite.prepare("SELECT COUNT(*) AS count FROM pos_atomic_records WHERE collection='receipts'").get().count, 1);
});

test("enforces strict payload fields and payment breakdown rules", async (t) => {
  const f = fixture(t);
  await f.seedBaseline();
  await assert.rejects(
    quotePrivateRestaurantCheckout(f.env, session, { holdId: "hold-1", revision: 1, total: 10 }),
    (error) => error.code === "INVALID_QUOTE"
  );
  const { quoteHash } = await quotePrivateRestaurantCheckout(f.env, session, { holdId: "hold-1", revision: 1 });
  await assert.rejects(
    completePrivateRestaurantCheckout(f.env, session, {
      requestId: "req-extra",
      holdId: "hold-1",
      revision: 1,
      quoteHash,
      paymentMethod: "cash",
      paymentBreakdown: { cash: 42.1 },
    }),
    (error) => error.code === "INVALID_PAYMENT"
  );
  await assert.rejects(
    completePrivateRestaurantCheckout(f.env, session, {
      requestId: "req-extra-2",
      holdId: "hold-1",
      revision: 1,
      quoteHash,
      paymentMethod: "cash",
      customerPhone: "0500",
    }),
    (error) => error.code === "INVALID_CHECKOUT"
  );
});

test("requires strict tax, loyalty, wallet and delivery source state", async (t) => {
  const f = fixture(t);
  await f.seedBaseline({ config: { features: {}, taxPercent: 10, taxIncluded: false } });
  await assert.rejects(
    quotePrivateRestaurantCheckout(f.env, session, { holdId: "hold-1", revision: 1 }),
    (error) => error.code === "INVALID_CONFIG"
  );

  const f2 = fixture(t);
  await f2.seedBaseline({ config: { loyalty: { enabled: true, mechanism: "purchase", earnPer: 10, redeemRate: 100, minRedeem: 100 }, features: { tax: true }, taxPercent: 10, taxIncluded: false } });
  await f2.upsert("settings", "config", {
    features: { tax: true },
    taxPercent: 10,
    taxIncluded: false,
  });
  await assert.rejects(
    quotePrivateRestaurantCheckout(f2.env, session, { holdId: "hold-1", revision: 1 }),
    (error) => error.code === "INVALID_LOYALTY"
  );

  const f3 = fixture(t);
  await f3.seedBaseline({ wallet: { points: null, creditCents: 1000, debtCents: 0 } });
  await assert.rejects(
    quotePrivateRestaurantCheckout(f3.env, session, { holdId: "hold-1", revision: 1 }),
    (error) => error.code === "INVALID_WALLET"
  );

  const f4 = fixture(t);
  await f4.seedBaseline({ hold: { service: { type: "delivery", customerName: "", phone: "0500", address: "A", deliveryFee: 5 } } });
  await assert.rejects(
    quotePrivateRestaurantCheckout(f4.env, session, { holdId: "hold-1", revision: 1 }),
    (error) => error.code === "INVALID_DELIVERY"
  );
});

test("accepts offer with stale discount hint and rejects unsupported id formats", async (t) => {
  const f = fixture(t);
  await f.seedBaseline({
    hold: {
      discount: { type: "fixed", value: 7 },
      offerId: "offer_1",
    },
    offer: {
      recordType: "restaurant-offer",
      name: "Offer",
      discountType: "amount",
      discountValue: 2,
      maxDiscount: 0,
      minQty: 1,
      enabled: true,
    },
  });
  const { quote } = await quotePrivateRestaurantCheckout(f.env, session, { holdId: "hold-1", revision: 1 });
  assert.equal(quote.discount, 2);
  assert.equal(quote.discountType, "fixed");

  const f2 = fixture(t);
  await f2.seedBaseline({
    hold: {
      items: [{ productId: "bad/id", color: "Red", size: "M", qty: 1, note: "" }],
    },
  });
  await assert.rejects(
    quotePrivateRestaurantCheckout(f2.env, session, { holdId: "hold-1", revision: 1 }),
    (error) => error.code === "INVALID_ITEMS"
  );
});
