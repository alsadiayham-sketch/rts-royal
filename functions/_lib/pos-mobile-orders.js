import {
  commitFirestoreWrites, firestoreTimestamp, getFirestoreDocumentSnapshot, queryFirestoreDocuments,
} from "./firestore.js";
import {
  ApiError, jsonResponse, parseJsonBody, requireJsonContentType,
  requireTrustedMutationRequest, withApiGuard,
} from "./http.js";
import { enforceRateLimit } from "./rate-limit.js";
import { requireMobileSession } from "./pos-mobile.js";
import { getPosUserAuthVersion } from "./pos-session.js";
import { getPosStoreMode } from "./pos-store-mode.js";
import { normalizeUsername } from "./validation.js";
import { findPrivateRequest, getPrivateRequest, getPrivateSnapshot, privateRef, stagePrivateSnapshot } from "./pos-private-snapshots.js";
import { loadSharedRestaurantConfig } from "./pos-shared-settings.js";

const ID = /^[A-Za-z0-9_-]{8,80}$/;
const PRODUCT_ID = /^[^/]{1,150}$/;
const root = (storeId) => `projects/${storeId}`;
const holdPath = (storeId, id) => `${root(storeId)}/pos_mobile_holds/${id}`;
const tablePath = (storeId, id) => `${root(storeId)}/pos_mobile_tables/${id}`;
const requestPath = (storeId, id) => `${root(storeId)}/pos_mobile_requests/${id}`;
const productPath = (storeId, id) => `${root(storeId)}/products/${id}`;
const billPath = (storeId, id) => `${root(storeId)}/orders/POS-M-${id}`;

function invalid(code, message) { throw new ApiError(400, code, message); }
function requireId(value, code = "INVALID_ID") {
  if (typeof value !== "string" || !ID.test(value)) invalid(code, "Invalid request identifier.");
  return value;
}
function text(value, limit) {
  if (value == null) return "";
  if (typeof value !== "string" || value.trim().length > limit) invalid("INVALID_TEXT", "Invalid order details.");
  return value.trim();
}
function moneyCents(value, name) {
  if (value == null || value === "") invalid("INVALID_AMOUNT", `Invalid ${name}.`);
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 999999
      || Math.abs(parsed * 100 - Math.round(parsed * 100)) > 1e-7) {
    invalid("INVALID_AMOUNT", `Invalid ${name}.`);
  }
  return Math.round(parsed * 100);
}
function normalizeDiscount(value) {
  if (value === undefined) return { type: "fixed", value: 0 };
  if (!value || typeof value !== "object" || Array.isArray(value)
      || Object.keys(value).some((key) => !["type", "value"].includes(key))
      || !["fixed", "percent"].includes(value.type) || typeof value.value !== "number") {
    invalid("INVALID_DISCOUNT", "Choose a valid fixed or percentage discount.");
  }
  moneyCents(value.value, "discount");
  if (value.type === "percent" && value.value > 100) invalid("INVALID_DISCOUNT", "Percentage discount cannot exceed 100.");
  return { type: value.type, value: value.value };
}
function normalizeOfferId(value) {
  if (value == null || value === "") return null;
  if (typeof value !== "string" || !PRODUCT_ID.test(value) || value === "." || value === "..") {
    invalid("INVALID_OFFER", "Select a valid restaurant offer.");
  }
  return value;
}
async function priceRestaurantOffer(storeId, offerId, items, subtotalCents) {
  if (!offerId) return null;
  const path = `${root(storeId)}/orders/${offerId}`;
  const snapshot = await getFirestoreDocumentSnapshot(path);
  const offer = snapshot?.data;
  const amount = Number(offer?.discountValue), cap = Number(offer?.maxDiscount ?? 0), minimum = Number(offer?.minQty);
  const expiresOn = offer?.expiresOn || "";
  if (!snapshot?.updateTime || offer?.recordType !== "restaurant-offer" || offer.enabled === false
      || typeof offer.name !== "string" || !offer.name.trim() || offer.name.length > 200
      || !["amount", "percent"].includes(offer.discountType)
      || !Number.isFinite(amount) || amount <= 0 || amount > 999999
      || (offer.discountType === "percent" && amount > 100)
      || !Number.isFinite(cap) || cap < 0 || cap > 999999
      || !Number.isInteger(minimum) || minimum < 1
      || (expiresOn && (typeof expiresOn !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(expiresOn)
        || new Date().toISOString().slice(0, 10) > expiresOn))
      || items.reduce((sum, item) => sum + item.qty, 0) < minimum || subtotalCents <= 0) {
    throw new ApiError(409, "OFFER_UNAVAILABLE", "The offer is unavailable or its minimum quantity is not met. Review the order.");
  }
  const raw = offer.discountType === "percent" ? subtotalCents * amount / 100 : amount * 100;
  const discountCents = Math.round(Math.min(subtotalCents, cap > 0 ? Math.min(raw, cap * 100) : raw));
  return { path, updateTime: snapshot.updateTime, discountCents, receipt: { id: offerId, name: offer.name, discount: discountCents / 100 } };
}
function normalizeService(service) {
  if (!service || !["dinein", "takeaway", "delivery"].includes(service.type)) {
    invalid("INVALID_SERVICE", "Select dine-in, takeaway, or delivery.");
  }
  const allowed = ["type", "table", "customerName", "phone", "address", "deliveryFee"];
  if (Object.keys(service).some((key) => !allowed.includes(key))) invalid("INVALID_SERVICE", "Invalid service details.");
  const type = service.type;
  const table = type === "dinein" ? Number(service.table) : null;
  if (type === "dinein" && (!Number.isInteger(table) || table < 1 || table > 2147483647)) {
    invalid("INVALID_TABLE", "Select a valid table.");
  }
  const customerName = text(service.customerName, 100);
  const phone = text(service.phone, 40);
  const address = type === "delivery" ? text(service.address, 500) : "";
  if (type === "delivery" && (!customerName || !phone || !address)) {
    invalid("INVALID_DELIVERY", "Delivery requires customer name, telephone, and address.");
  }
  const deliveryFee = type === "delivery" ? moneyCents(service.deliveryFee ?? 0, "delivery fee") / 100 : 0;
  return { type, table, customerName, phone, address, deliveryFee };
}
function normalizeItems(items) {
  if (!Array.isArray(items) || items.length < 1 || items.length > 60) invalid("INVALID_ITEMS", "Add between 1 and 60 order lines.");
  const keys = new Set();
  return items.map((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)
        || Object.keys(item).some((key) => !["productId", "color", "size", "qty", "note"].includes(key))
        || typeof item.productId !== "string" || !PRODUCT_ID.test(item.productId)
        || item.productId === "." || item.productId === ".."
        || !Number.isInteger(item.qty) || item.qty < 1 || item.qty > 1000) invalid("INVALID_ITEMS", "Invalid order line.");
    const color = text(item.color, 100), size = text(item.size, 100), note = text(item.note, 300);
    const key = JSON.stringify([item.productId, color, size]);
    if (keys.has(key)) invalid("DUPLICATE_LINE", "Combine duplicate product portions.");
    keys.add(key);
    return { productId: item.productId, color, size, qty: item.qty, note };
  });
}
function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`).join(",")}}`;
  return JSON.stringify(value);
}
export async function fingerprint(payload) {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(canonical(payload)));
  return Array.from(new Uint8Array(bytes), (v) => v.toString(16).padStart(2, "0")).join("");
}
export async function replay(context, storeId, requestId, actor, hash) {
  const ref = await privateRef(context.env, storeId, requestId);
  const found = await getFirestoreDocumentSnapshot(requestPath(storeId, ref));
  if (!found) return null;
  if (found.data.privateRef !== ref) throw new ApiError(503, "PRIVATE_SNAPSHOT_UNAVAILABLE", "Private order data is unavailable.");
  const snapshot = await getPrivateRequest(context.env, storeId, requestId, actor, hash);
  return { ...(snapshot.response.apiResponse || snapshot.response), replayed: true };
}
export async function guardedCommit(context, storeId, requestId, actor, hash, writes) {
  try { await commitFirestoreWrites(writes); }
  catch (error) {
    if (error?.code !== "POS_REGISTRY_CONFLICT") throw error;
    let completed = await replay(context, storeId, requestId, actor, hash);
    if (completed) return completed;
    let definitelyChanged = false;
    for (const write of writes) {
      if (!write.create && !write.updateTime) continue;
      const current = await getFirestoreDocumentSnapshot(write.path);
      if ((write.create && current) || (write.updateTime && current?.updateTime !== write.updateTime)) {
        definitelyChanged = true;
        break;
      }
    }
    if (definitelyChanged) {
      completed = await replay(context, storeId, requestId, actor, hash);
      if (completed) return completed;
      throw new ApiError(409, "ORDER_CONFLICT", "The order, table, or stock changed. Refresh before retrying.");
    }
    throw new ApiError(503, "COMMIT_UNCERTAIN", "Retry the same request to confirm its outcome.");
  }
  return null;
}
async function commitStagedCheckout(context, storeId, requestId, actor, hash, staged) {
  const writes = [];
  for (const entry of staged.plan) {
    if (!entry.stockChanges) {
      writes.push(entry);
      continue;
    }
    const snapshot = await getFirestoreDocumentSnapshot(entry.path, { includeRawFields: true });
    if (!snapshot || snapshot.updateTime !== entry.updateTime) {
      const completed = await replay(context, storeId, requestId, actor, hash);
      if (completed) return completed;
      throw new ApiError(409, "ORDER_CONFLICT", "The order, table, or stock changed. Refresh before retrying.");
    }
    const variants = structuredClone(snapshot.rawFields?.variants);
    const values = variants?.arrayValue?.values;
    if (!Array.isArray(values)) throw new ApiError(503, "PRODUCT_UNAVAILABLE", "Cannot safely update product stock.");
    for (const change of entry.stockChanges) {
      const fields = values[change.index]?.mapValue?.fields;
      if (!fields || !Number.isInteger(change.stock) || change.stock < 0) {
        throw new ApiError(503, "PRODUCT_UNAVAILABLE", "Cannot safely update product stock.");
      }
      fields.stock = { integerValue: String(change.stock) };
    }
    writes.push({ path: entry.path, updateTime: entry.updateTime, updateMask: ["variants"], encodedFields: { variants } });
  }
  return (await guardedCommit(context, storeId, requestId, actor, hash, writes)) || staged.apiResponse;
}
export function writeSnapshot(path, snapshot, data) {
  if (snapshot && !snapshot.updateTime) throw new ApiError(503, "ORDER_UNAVAILABLE", "Cannot safely update this record.");
  return snapshot ? { path, data, updateTime: snapshot.updateTime } : { path, data, create: true };
}
function tableId(service) { return service?.type === "dinein" ? service.table : null; }
function publicService(data) {
  return data?.serviceType === "dinein" ? { type: "dinein", table: data.table } : null;
}
export async function loadSharedTables(context, storeId) {
  const path = `${root(storeId)}/settings/pos_shared_tables`;
  const snapshot = await getFirestoreDocumentSnapshot(path);
  if (!snapshot) return { snapshot: null, path, revision: 0, tables: [], nextTableId: 1 };
  if (!snapshot.updateTime || !Number.isInteger(snapshot.data.revision)
      || typeof snapshot.data.privateRef !== "string") {
    throw new ApiError(503, "TABLES_UNAVAILABLE", "Shared tables are unavailable.");
  }
  const privateData = await getPrivateSnapshot(context.env, storeId, snapshot.data.privateRef);
  if (privateData.revision !== snapshot.data.revision || !Array.isArray(privateData.tables)) {
    throw new ApiError(503, "TABLES_UNAVAILABLE", "Shared tables are unavailable.");
  }
  const minimumNext = privateData.tables.reduce((max, table) => Math.max(max, Number(table.id) || 0), 0) + 1;
  const nextTableId = privateData.nextTableId ?? minimumNext;
  if (!Number.isInteger(nextTableId) || nextTableId < minimumNext || nextTableId > 2147483648) {
    throw new ApiError(503, "TABLES_UNAVAILABLE", "Shared tables are unavailable.");
  }
  return { snapshot, path, revision: privateData.revision, tables: privateData.tables, nextTableId };
}
export async function authPreconditions(context, actor) {
  const paths = [
    "projects/_global/settings/pos_stores",
    `${root(actor.storeId)}/settings/pos`,
    `${root(actor.storeId)}/settings/pos_users`,
  ];
  const [registry, licence, users] = await Promise.all(paths.map(getFirestoreDocumentSnapshot));
  const store = registry?.data?.stores?.find((item) => item?.id === actor.storeId);
  const matches = (Array.isArray(users?.data?.users) ? users.data.users : [])
    .filter((user) => normalizeUsername(user.username) === actor.username);
  const user = matches.length === 1 ? matches[0] : null;
  if (!store || getPosStoreMode(store) !== "business" || !user || user.active === false
      || user.role !== actor.role || !actor.authVersion
      || actor.authVersion !== await getPosUserAuthVersion(context.env.AUTH_SECRET, user)) {
    throw new ApiError(401, "POS_AUTH_REQUIRED", "Your account changed. Sign in again.");
  }
  if (!(new Date(licence?.data?.warrantyEnd).getTime() > Date.now())
      || licence.data.businessType !== "restaurant" || licence.data.dataBackend === "d1" || store.type === "d1") {
    throw new ApiError(403, "RESTAURANT_REQUIRED", "This restaurant is no longer available.");
  }
  const snapshots = [registry, licence, users];
  if (snapshots.some((snapshot) => !snapshot?.updateTime)) throw new ApiError(503, "AUTH_UNAVAILABLE", "Cannot verify account state.");
  return paths.map((path, index) => ({ path, verify: true, updateTime: snapshots[index].updateTime }));
}
async function tableWrites(storeId, holdId, previousService, nextService) {
  const previous = tableId(previousService), next = tableId(nextService);
  const ids = [...new Set([previous, next].filter((value) => value != null))];
  const writes = [];
  for (const id of ids) {
    const path = tablePath(storeId, id), snapshot = await getFirestoreDocumentSnapshot(path);
    const occupant = snapshot?.data?.holdId || "";
    if (id === next && occupant && occupant !== holdId) {
      throw new ApiError(409, "TABLE_OCCUPIED", "This table already has an open mobile order.");
    }
    if (id === previous && occupant !== holdId) {
      throw new ApiError(409, "TABLE_CONFLICT", "Table assignment changed; reload the order.");
    }
    writes.push(writeSnapshot(path, snapshot, { table: id, holdId: id === next ? holdId : "" }));
  }
  return writes;
}
async function latestStoreConfig(context, storeId) {
  const { path, snapshot, configured, config } = await loadSharedRestaurantConfig(context, storeId);
  if (!configured) {
    throw new ApiError(503, "CONFIG_UNAVAILABLE", "Shared tax settings require an administrator cutover.");
  }
  const taxRate = config.features.tax ? config.taxPercent : 0;
  return { selected: { ...snapshot, path }, taxRate, taxIncluded: config.taxIncluded };
}

async function saveHold(context, actor, payload, hash, guards) {
  const { storeId, username } = actor;
  const id = requireId(payload.holdId), requestId = requireId(payload.requestId);
  const revision = Number(payload.revision);
  if (!Number.isInteger(revision) || revision < 0) invalid("INVALID_REVISION", "Invalid order revision.");
  const items = normalizeItems(payload.items), service = normalizeService(payload.service);
  const note = text(payload.note, 500);
  const tables = service.type === "dinein" ? await loadSharedTables(context, storeId) : null;
  if (tables && !tables.snapshot) throw new ApiError(503, "TABLES_UNAVAILABLE", "An administrator must configure shared tables.");
  if (tables && !tables.tables.some((table) => table.id === service.table && !table.archived)) {
    throw new ApiError(409, "TABLE_UNAVAILABLE", "This table is unavailable.");
  }
  const existing = await getFirestoreDocumentSnapshot(holdPath(storeId, id));
  if (existing && (existing.data.status !== "open" || existing.data.revision !== revision)) {
    throw new ApiError(409, "ORDER_CONFLICT", "This order changed or has already been paid.");
  }
  if (!existing && revision !== 0) throw new ApiError(409, "ORDER_CONFLICT", "The order no longer exists.");
  const tableUpdates = await tableWrites(storeId, id, publicService(existing?.data), service);
  const previous = existing ? await getPrivateSnapshot(context.env, storeId, existing.data.privateRef) : null;
  if (existing && (previous?.hold?.id !== id || previous.hold.revision !== revision)) {
    throw new ApiError(503, "PRIVATE_SNAPSHOT_UNAVAILABLE", "Private order data is unavailable.");
  }
  const discount = normalizeDiscount(payload.discount === undefined && existing ? previous.hold.discount : payload.discount);
  const offerId = normalizeOfferId(payload.offerId === undefined && existing ? previous.hold.offerId : payload.offerId);
  const now = new Date().toISOString();
  const hold = {
    id, status: "open", revision: revision + 1, items, service, note, discount, offerId,
    createdAtIso: previous?.hold?.createdAtIso || now, updatedAtIso: now, updatedBy: username,
  };
  const staged = await stagePrivateSnapshot(context.env, storeId, requestId, username, hash, { ok: true, replayed: false, hold });
  const response = staged.response;
  const stagedHold = response.hold;
  if (!stagedHold || stagedHold.id !== id || stagedHold.revision !== revision + 1) {
    throw new ApiError(503, "PRIVATE_SNAPSHOT_UNAVAILABLE", "Private order data is unavailable.");
  }
  const publicHold = {
    id, status: "open", revision: stagedHold.revision, serviceType: stagedHold.service.type,
    table: stagedHold.service.table, updatedAtIso: stagedHold.updatedAtIso, privateRef: staged.ref,
  };
  const writes = [
    writeSnapshot(holdPath(storeId, id), existing, publicHold), ...tableUpdates, ...guards,
    ...(tables ? [{ path: tables.path, verify: true, updateTime: tables.snapshot.updateTime }] : []),
    { path: requestPath(storeId, staged.ref), data: { privateRef: staged.ref }, create: true },
  ];
  return (await guardedCommit(context, storeId, requestId, username, hash, writes)) || response;
}

async function completeHold(context, actor, payload, hash, guards) {
  const { storeId, username } = actor;
  const id = requireId(payload.holdId), requestId = requireId(payload.requestId);
  const revision = Number(payload.revision);
  if (!Number.isInteger(revision) || revision < 1) invalid("INVALID_REVISION", "Invalid order revision.");
  if (payload.action === "checkout" && !["cash", "card"].includes(payload.paymentMethod)) invalid("INVALID_PAYMENT", "Choose cash or card.");
  if (payload.action === "checkout") {
    const staged = await findPrivateRequest(context.env, storeId, requestId, username, hash);
    if (staged) {
      if (!Array.isArray(staged.response.plan) || !staged.response.apiResponse?.bill) {
        throw new ApiError(503, "PRIVATE_SNAPSHOT_UNAVAILABLE", "Private order data is unavailable.");
      }
      return commitStagedCheckout(context, storeId, requestId, username, hash, staged.response);
    }
  }
  const tables = await loadSharedTables(context, storeId);
  if (!tables.snapshot) throw new ApiError(503, "TABLES_UNAVAILABLE", "An administrator must configure shared tables.");
  const holdSnapshot = await getFirestoreDocumentSnapshot(holdPath(storeId, id));
  if (!holdSnapshot || holdSnapshot.data.status !== "open" || holdSnapshot.data.revision !== revision) {
    throw new ApiError(409, "ORDER_CONFLICT", "This order changed or has already been paid.");
  }
  const hold = (await getPrivateSnapshot(context.env, storeId, holdSnapshot.data.privateRef)).hold;
  if (!hold || hold.id !== id || hold.revision !== revision || hold.status !== "open") {
    throw new ApiError(503, "PRIVATE_SNAPSHOT_UNAVAILABLE", "Private order data is unavailable.");
  }
  const items = normalizeItems(hold.items), service = normalizeService(hold.service);
  const byProduct = new Map();
  for (const item of items) {
    if (!byProduct.has(item.productId)) byProduct.set(item.productId, []);
    byProduct.get(item.productId).push(item);
  }
  const updates = [], receiptItems = [], costs = [];
  let subtotalCents = 0;
  for (const [productId, lines] of byProduct) {
    const snapshot = await getFirestoreDocumentSnapshot(productPath(storeId, productId));
    if (!snapshot?.updateTime) throw new ApiError(409, "PRODUCT_UNAVAILABLE", "A product is no longer available.");
    const data = structuredClone(snapshot.data);
    if (!Array.isArray(data.variants)) throw new ApiError(409, "PRODUCT_UNAVAILABLE", "A product has no valid portions.");
    const stockChanges = [];
    for (const line of lines) {
      const matches = data.variants.map((variant, index) => ({ variant, index }))
        .filter(({ variant }) => String(variant.color || "").trim() === line.color && String(variant.size || "").trim() === line.size);
      if (matches.length !== 1) throw new ApiError(409, "PRODUCT_CHANGED", "A product portion changed. Refresh the order.");
      const { variant, index } = matches[0], available = Number(variant.stock);
      if (!Number.isInteger(available) || available < line.qty) throw new ApiError(409, "INSUFFICIENT_STOCK", "A product has insufficient stock.");
      const priceCents = moneyCents(variant.price, "product price");
      variant.stock = available - line.qty;
      stockChanges.push({ index, stock: variant.stock });
      subtotalCents += priceCents * line.qty;
      if (!Number.isSafeInteger(subtotalCents) || subtotalCents > 99999999) invalid("INVALID_TOTAL", "Order total is too large.");
      receiptItems.push({
        productId, name: String(data.name || "").slice(0, 200), color: line.color, size: line.size,
        price: priceCents / 100, qty: line.qty, total: priceCents * line.qty / 100, note: line.note,
      });
      costs.push({ productId, color: line.color, size: line.size, qty: line.qty, cost: variant.cost ?? null });
    }
    updates.push({
      path: productPath(storeId, productId), updateTime: snapshot.updateTime, stockChanges,
    });
  }
  const { selected, taxRate, taxIncluded } = await latestStoreConfig(context, storeId);
  const offer = await priceRestaurantOffer(storeId, normalizeOfferId(hold.offerId), items, subtotalCents);
  const discount = offer ? { type: "fixed", value: offer.discountCents / 100 } : normalizeDiscount(hold.discount);
  const discountCents = offer ? offer.discountCents : discount.type === "percent" ? Math.round(subtotalCents * discount.value / 100) : moneyCents(discount.value, "discount");
  if (discountCents > subtotalCents) invalid("INVALID_DISCOUNT", "Discount cannot exceed the current item subtotal.");
  const baseCents = subtotalCents - discountCents + moneyCents(service.deliveryFee, "delivery fee");
  const taxCents = taxIncluded ? Math.round(baseCents - baseCents / (1 + taxRate / 100)) : Math.round(baseCents * taxRate / 100);
  const totalCents = taxIncluded ? baseCents : baseCents + taxCents;
  const quote = {
    holdId: id, revision, items: receiptItems,
    subtotal: subtotalCents / 100, deliveryFee: service.deliveryFee,
    discount: discountCents / 100, discountType: discount.type, discountValue: discount.value,
    taxRate, taxAmount: taxCents / 100, taxIncluded, total: totalCents / 100,
    ...(offer ? { restaurantOffer: offer.receipt } : {}),
  };
  const quoteHash = await fingerprint({ quote, config: [selected.path, selected.updateTime], ...(offer ? { offer: [offer.path, offer.updateTime] } : {}) });
  if (payload.action === "quote") return { ok: true, quote, quoteHash };
  if (typeof payload.quoteHash !== "string" || payload.quoteHash !== quoteHash) {
    throw new ApiError(409, "QUOTE_CHANGED", "Prices or tax changed. Review the updated total before payment.");
  }
  const tableUpdates = await tableWrites(storeId, id, service, null);
  const now = new Date().toISOString(), billNumber = `POS-M-${id}`;
  const ref = await privateRef(context.env, storeId, requestId);
  const publicBill = {
    billNumber, orderNumber: billNumber, items: receiptItems.map(({ note, ...item }) => item), subtotal: subtotalCents / 100,
    discount: discountCents / 100, discountType: discount.type, discountValue: discount.value, redeemPoints: 0, redeemValue: 0,
    taxRate, taxAmount: taxCents / 100, taxIncluded, total: totalCents / 100, totalBase: totalCents / 100,
    paymentMethod: payload.paymentMethod, paymentBreakdown: { [payload.paymentMethod]: totalCents / 100 },
    source: "pos", status: "completed", privateRef: ref,
    createdAt: firestoreTimestamp(now), createdAtIso: now,
    restaurantOrder: { type: service.type, table: service.table, heldId: id }, deliveryFee: service.deliveryFee,
  };
  const apiResponse = { ok: true, replayed: false, bill: {
    ...publicBill, items: receiptItems, note: hold.note || "", cashier: username,
    restaurantOrder: { ...service, heldId: id }, createdAt: now,
    ...(offer ? { restaurantOffer: offer.receipt } : {}),
  } };
  const writes = [
    ...updates, ...tableUpdates, ...guards,
    { path: tables.path, verify: true, updateTime: tables.snapshot.updateTime },
    writeSnapshot(holdPath(storeId, id), holdSnapshot, { ...holdSnapshot.data, status: "paid", paidAt: now, billNumber }),
    { path: billPath(storeId, id), data: publicBill, create: true },
    { path: requestPath(storeId, ref), data: { privateRef: ref }, create: true },
    { path: selected.path, verify: true, updateTime: selected.updateTime },
    ...(offer ? [{ path: offer.path, verify: true, updateTime: offer.updateTime }] : []),
  ];
  const staged = await stagePrivateSnapshot(context.env, storeId, requestId, username, hash, { apiResponse, plan: writes, costs });
  if (!Array.isArray(staged.response.plan) || !staged.response.apiResponse?.bill) {
    throw new ApiError(503, "PRIVATE_SNAPSHOT_UNAVAILABLE", "Private order data is unavailable.");
  }
  return commitStagedCheckout(context, storeId, requestId, username, hash, staged.response);
}

async function cancelHold(context, actor, payload, hash, guards) {
  const { storeId, username } = actor;
  const id = requireId(payload.holdId), requestId = requireId(payload.requestId);
  const revision = Number(payload.revision);
  if (!Number.isInteger(revision) || revision < 1) invalid("INVALID_REVISION", "Invalid order revision.");
  const snapshot = await getFirestoreDocumentSnapshot(holdPath(storeId, id));
  if (!snapshot || snapshot.data.status !== "open" || snapshot.data.revision !== revision) {
    throw new ApiError(409, "ORDER_CONFLICT", "This order changed or has already been paid.");
  }
  const tableUpdates = await tableWrites(storeId, id, publicService(snapshot.data), null);
  const staged = await stagePrivateSnapshot(context.env, storeId, requestId, username, hash, { ok: true, replayed: false, cancelled: true });
  const response = staged.response;
  const writes = [
    writeSnapshot(holdPath(storeId, id), snapshot, {
      ...snapshot.data, status: "cancelled", cancelledAt: new Date().toISOString(),
    }),
    ...tableUpdates, ...guards,
    { path: requestPath(storeId, staged.ref), data: { privateRef: staged.ref }, create: true },
  ];
  return (await guardedCommit(context, storeId, requestId, username, hash, writes)) || response;
}

export async function onRequestGet(context) {
  return withApiGuard(context, async () => {
    const { session, licence } = await requireMobileSession(context);
    if (licence.businessType !== "restaurant") throw new ApiError(403, "RESTAURANT_REQUIRED", "Orders are available for restaurant tenants only.");
    const url = new URL(context.request.url);
    const receiptId = url.searchParams.get("receiptId");
    if (receiptId !== null) {
      requireId(receiptId);
      const includeCost = url.searchParams.get("includeCost") === "1";
      if (includeCost && session.role !== "admin") throw new ApiError(403, "ADMIN_REQUIRED", "Only administrators can access historical cost.");
      const receipt = await getFirestoreDocumentSnapshot(billPath(session.storeId, receiptId));
      if (!receipt || typeof receipt.data.privateRef !== "string") throw new ApiError(404, "RECEIPT_NOT_FOUND", "Receipt not found.");
      const snapshot = await getPrivateSnapshot(context.env, session.storeId, receipt.data.privateRef);
      if (snapshot.apiResponse?.bill?.billNumber !== `POS-M-${receiptId}` || !Array.isArray(snapshot.costs)) {
        throw new ApiError(503, "PRIVATE_SNAPSHOT_UNAVAILABLE", "Private order data is unavailable.");
      }
      return jsonResponse({ bill: snapshot.apiResponse.bill, ...(includeCost ? { costs: snapshot.costs } : {}) });
    }
    const page = await queryFirestoreDocuments({
      parentPath: root(session.storeId), collectionId: "pos_mobile_holds",
      fieldFilters: [{ field: "status", op: "EQUAL", value: "open" }], limit: 500,
    });
    if (page.documents.length >= 500) throw new ApiError(503, "HOLD_LIMIT", "Too many mobile open orders; contact support.");
    const holds = await Promise.all(page.documents.map(async (doc) => {
      const { privateRef: ref, id, revision } = doc.data;
      if (typeof ref !== "string") throw new ApiError(503, "PRIVATE_SNAPSHOT_UNAVAILABLE", "Private order data is unavailable.");
      const snapshot = await getPrivateSnapshot(context.env, session.storeId, ref);
      if (snapshot.hold?.id !== id || snapshot.hold?.revision !== revision || snapshot.hold?.status !== "open") {
        throw new ApiError(503, "PRIVATE_SNAPSHOT_UNAVAILABLE", "Private order data is unavailable.");
      }
      return snapshot.hold;
    }));
    return jsonResponse({ holds });
  });
}

export async function onRequestPost(context) {
  return withApiGuard(context, async ({ request }) => {
    requireTrustedMutationRequest(request);
    requireJsonContentType(request);
    const { session, licence } = await requireMobileSession(context);
    if (licence.businessType !== "restaurant") throw new ApiError(403, "RESTAURANT_REQUIRED", "Orders are available for restaurant tenants only.");
    const payload = await parseJsonBody(request, ["action", "requestId", "holdId", "revision", "items", "service", "note", "discount", "offerId", "paymentMethod", "quoteHash"], 32768);
    requireId(payload.requestId);
    if (!["hold", "quote", "checkout", "cancel"].includes(payload.action)) invalid("INVALID_ACTION", "Invalid order action.");
    if (payload.action === "hold" && ["paymentMethod", "quoteHash"].some((key) => key in payload)) invalid("INVALID_ACTION", "Unexpected payment field.");
    if (payload.action !== "hold" && ["items", "service", "note", "discount", "offerId"].some((key) => key in payload)) invalid("INVALID_ACTION", "Save changes before checkout.");
    if (payload.action === "quote" && ["paymentMethod", "quoteHash"].some((key) => key in payload)) invalid("INVALID_ACTION", "Unexpected payment field.");
    if (payload.action === "cancel" && ["paymentMethod", "quoteHash"].some((key) => key in payload)) invalid("INVALID_ACTION", "Unexpected payment field.");
    await enforceRateLimit(context, { scope: "pos_mobile_order", accountPart: `${session.storeId}:${session.username}`, maxRequests: 180, windowSeconds: 600 });
    const guards = await authPreconditions(context, session);
    if ((payload.action === "quote" || payload.action === "checkout")
        && context.env.POS_SHARED_CHECKOUT_STATE !== "writers-retired") {
      throw new ApiError(503, "CHECKOUT_UNAVAILABLE", "Checkout is unavailable until shared store settings are configured.");
    }
    if (payload.action === "quote") return jsonResponse(await completeHold(context, session, payload, "", guards));
    const hash = await fingerprint({ payload, authVersion: session.authVersion });
    const completed = await replay(context, session.storeId, payload.requestId, session.username, hash);
    if (completed) return jsonResponse(completed);
    const result = payload.action === "hold" ? await saveHold(context, session, payload, hash, guards)
      : payload.action === "cancel" ? await cancelHold(context, session, payload, hash, guards)
        : await completeHold(context, session, payload, hash, guards);
    return jsonResponse(result);
  });
}
