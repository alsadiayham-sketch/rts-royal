import { ApiError } from "./http.js";
import {
  commitPosAtomic,
  readPosAtomicRecord,
  readPosAtomicRecords,
  replayPosAtomic,
} from "./pos-atomic-store.js";
import { requirePrivateRestaurantAuthority } from "./pos-private-authority.js";

const MAX_LINES = 60;
const MAX_LINE_QTY = 1000;
const MAX_MONEY_CENTS = 999_999_00;

const PAYMENT_KEYS = ["cash", "card", "debt"];
const SUPPORTED_PAYMENT_METHODS = new Set(["cash", "card", "debt", "split"]);

const RECORD_KEY = /^[A-Za-z0-9][A-Za-z0-9._:@-]*$/;

function badRequest(code, message) {
  throw new ApiError(400, code, message);
}

function conflict(code, message) {
  throw new ApiError(409, code, message);
}

function unavailable(code, message) {
  throw new ApiError(503, code, message);
}

function assertObject(value, code, message) {
  if (!value || typeof value !== "object" || Array.isArray(value)) badRequest(code, message);
  return value;
}

function requiredString(value, code, message, { max = 128, pattern = RECORD_KEY } = {}) {
  if (typeof value !== "string" || value.length < 1 || value.length > max || !pattern.test(value)) {
    badRequest(code, message);
  }
  return value;
}

function optionalString(value, code, message, { max = 200 } = {}) {
  if (value == null) return "";
  if (typeof value !== "string") badRequest(code, message);
  const trimmed = value.trim();
  if (trimmed.length > max) badRequest(code, message);
  return trimmed;
}

function safeInteger(value, code, message, { min = 0, max = Number.MAX_SAFE_INTEGER } = {}) {
  if (!Number.isSafeInteger(value) || value < min || value > max) badRequest(code, message);
  return value;
}

function parseMoneyToCents(value, code, message) {
  if (typeof value !== "number" || !Number.isFinite(value)) badRequest(code, message);
  const amount = Number(value);
  if (amount < 0) badRequest(code, message);
  const cents = Math.round(amount * 100);
  if (Math.abs(amount * 100 - cents) > 1e-7 || cents > MAX_MONEY_CENTS) badRequest(code, message);
  return cents;
}

function parseWalletCents(value, code, message) {
  return safeInteger(value, code, message, { min: 0, max: Number.MAX_SAFE_INTEGER });
}

function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

async function hashObject(value) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(canonical(value)));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

function requireAllowedKeys(value, allowed, code, message) {
  const keys = Object.keys(value);
  if (keys.some((key) => !allowed.includes(key))) badRequest(code, message);
}

function uniqueGuards(guards) {
  const map = new Map();
  for (const guard of guards) {
    const collection = requiredString(guard?.collection, "INVALID_GUARD", "Invalid guard collection.", { max: 64 });
    const id = requiredString(guard?.id, "INVALID_GUARD", "Invalid guard ID.");
    const expectedRevision = safeInteger(guard?.expectedRevision, "INVALID_GUARD", "Invalid guard revision.");
    const key = `${collection}\u0000${id}`;
    if (map.has(key) && map.get(key) !== expectedRevision) {
      conflict("AUTHORITY_GUARD_CONFLICT", "Authority guards conflict with current source guards.");
    }
    map.set(key, expectedRevision);
  }
  return Array.from(map.entries()).map(([key, expectedRevision]) => {
    const [collection, id] = key.split("\u0000");
    return { collection, id, expectedRevision };
  });
}

function recordGuard(record) {
  return { collection: record.collection, id: record.id, expectedRevision: record.revision };
}

function sanitizeService(value) {
  const service = assertObject(value, "INVALID_SERVICE", "Hold service is invalid.");
  const type = requiredString(service.type, "INVALID_SERVICE", "Hold service type is invalid.", { max: 20, pattern: /^[a-z]+$/ });
  if (!["dinein", "takeaway", "delivery"].includes(type)) conflict("SERVICE_UNSUPPORTED", "Unsupported service type.");
  const tableRaw = service.table;
  let tableId = null;
  if (type === "dinein") {
    if (typeof tableRaw === "number" && (!Number.isInteger(tableRaw) || tableRaw <= 0)) {
      badRequest("INVALID_SERVICE", "Dine-in table is invalid.");
    }
    const stringId = typeof tableRaw === "number" ? String(tableRaw) : tableRaw;
    tableId = requiredString(stringId, "INVALID_SERVICE", "Dine-in table is required.");
  }
  const customerName = optionalString(service.customerName, "INVALID_SERVICE", "Invalid customer name.", { max: 100 });
  const phone = optionalString(service.phone, "INVALID_SERVICE", "Invalid customer phone.", { max: 40 });
  const address = optionalString(service.address, "INVALID_SERVICE", "Invalid customer address.", { max: 500 });
  if (type === "delivery" && (!customerName || !phone || !address)) {
    conflict("INVALID_DELIVERY", "Delivery requires customer name, phone, and address.");
  }
  return {
    type,
    table: tableId,
    customerName,
    phone,
    address,
    deliveryFeeCents: type === "delivery" ? parseMoneyToCents(service.deliveryFee ?? 0, "INVALID_SERVICE", "Invalid delivery fee.") : 0,
  };
}

function sanitizeDiscount(value) {
  if (value == null) return { type: "fixed", valueCents: 0, value: 0 };
  const discount = assertObject(value, "INVALID_DISCOUNT", "Discount is invalid.");
  const type = requiredString(discount.type, "INVALID_DISCOUNT", "Discount type is invalid.", { max: 20, pattern: /^[a-z]+$/ });
  if (!["fixed", "percent"].includes(type)) badRequest("INVALID_DISCOUNT", "Discount type is invalid.");
  const amount = Number(discount.value);
  if (!Number.isFinite(amount) || amount < 0) badRequest("INVALID_DISCOUNT", "Discount value is invalid.");
  if (type === "percent") {
    if (amount > 100) badRequest("INVALID_DISCOUNT", "Percentage discount cannot exceed 100.");
    return { type, valuePercent: amount, value: amount };
  }
  return { type, valueCents: parseMoneyToCents(amount, "INVALID_DISCOUNT", "Discount value is invalid."), value: amount };
}

function validateHoldValue(holdId, revision, value) {
  const hold = assertObject(value, "HOLD_UNAVAILABLE", "Hold data is unavailable.");
  const unsupportedPresent = (field) => (
    Array.isArray(field) ? field.length > 0 : field != null && field !== false
  );
  if (unsupportedPresent(hold.customItems) || unsupportedPresent(hold.returnItems)
      || unsupportedPresent(hold.prizes) || unsupportedPresent(hold.rewards)
      || unsupportedPresent(hold.rewardIds)) {
    conflict("UNSUPPORTED_CHECKOUT_FEATURE", "This checkout contains unsupported private features.");
  }
  if (hold.id !== holdId || hold.status !== "open") conflict("HOLD_NOT_OPEN", "Hold is not open.");
  safeInteger(hold.revision, "HOLD_UNAVAILABLE", "Hold revision is invalid.", { min: 1 });
  if (hold.revision !== revision) conflict("HOLD_CHANGED", "Hold revision changed.");
  const items = Array.isArray(hold.items) ? hold.items : null;
  if (!items || items.length < 1 || items.length > MAX_LINES) badRequest("INVALID_ITEMS", "Hold lines are invalid.");
  const lineKeys = new Set();
  const normalizedItems = items.map((item) => {
    const line = assertObject(item, "INVALID_ITEMS", "Hold line is invalid.");
    const productId = requiredString(line.productId, "INVALID_ITEMS", "Product ID is invalid.", { max: 128, pattern: RECORD_KEY });
    const color = optionalString(line.color, "INVALID_ITEMS", "Line color is invalid.", { max: 100 });
    const size = optionalString(line.size, "INVALID_ITEMS", "Line size is invalid.", { max: 100 });
    const qty = safeInteger(line.qty, "INVALID_ITEMS", "Line quantity is invalid.", { min: 1, max: MAX_LINE_QTY });
    const note = optionalString(line.note, "INVALID_ITEMS", "Line note is invalid.", { max: 300 });
    const key = `${productId}\u0000${color}\u0000${size}`;
    if (lineKeys.has(key)) conflict("DUPLICATE_LINE", "Duplicate hold line exists.");
    lineKeys.add(key);
    return { productId, color, size, qty, note };
  });
  const discount = sanitizeDiscount(hold.discount);
  const offerId = hold.offerId == null || hold.offerId === "" ? null
    : requiredString(hold.offerId, "INVALID_OFFER", "Offer ID is invalid.", { max: 128, pattern: RECORD_KEY });
  const customerId = hold.customerId == null || hold.customerId === "" ? null
    : requiredString(hold.customerId, "INVALID_CUSTOMER", "Customer ID is invalid.");
  const redeemPoints = hold.redeemPoints == null ? 0 : safeInteger(Number(hold.redeemPoints), "INVALID_LOYALTY", "Redeem points are invalid.");
  const creditUseCents = hold.creditUse == null ? 0 : parseMoneyToCents(hold.creditUse, "INVALID_CREDIT", "Credit usage is invalid.");
  if (!customerId && (redeemPoints > 0 || creditUseCents > 0)) {
    conflict("CUSTOMER_REQUIRED", "Customer is required for loyalty redemption or credit usage.");
  }
  return {
    hold,
    items: normalizedItems,
    service: sanitizeService(hold.service),
    note: optionalString(hold.note, "INVALID_HOLD", "Hold note is invalid.", { max: 500 }),
    discount,
    offerId,
    customerId,
    redeemPoints,
    creditUseCents,
  };
}

function normalizeLoyalty(configValue) {
  if (!Object.hasOwn(configValue, "loyalty")) {
    badRequest("INVALID_LOYALTY", "Loyalty configuration is required.");
  }
  const loyaltyRaw = configValue?.loyalty;
  if (!loyaltyRaw || typeof loyaltyRaw !== "object" || Array.isArray(loyaltyRaw)
      || typeof loyaltyRaw.enabled !== "boolean") {
    badRequest("INVALID_LOYALTY", "Loyalty configuration is invalid.");
  }
  if (loyaltyRaw.enabled !== true) {
    return { enabled: false, mechanism: "none", earnPer: 0, redeemRate: 0, minRedeem: 0 };
  }
  const mechanism = requiredString(loyaltyRaw.mechanism ?? "purchase", "INVALID_LOYALTY", "Loyalty mechanism is invalid.", { max: 20, pattern: /^[a-z]+$/ });
  if (mechanism !== "purchase") conflict("UNSUPPORTED_LOYALTY_MECHANISM", "Only purchase loyalty mechanism is supported.");
  const earnPer = safeInteger(Number(loyaltyRaw.earnPer), "INVALID_LOYALTY", "Loyalty earnPer is invalid.", { min: 1, max: 1_000_000 });
  const redeemRate = safeInteger(Number(loyaltyRaw.redeemRate), "INVALID_LOYALTY", "Loyalty redeemRate is invalid.", { min: 1, max: 1_000_000 });
  const minRedeem = safeInteger(Number(loyaltyRaw.minRedeem ?? 0), "INVALID_LOYALTY", "Loyalty minRedeem is invalid.", { min: 0, max: 10_000_000 });
  return { enabled: true, mechanism, earnPer, redeemRate, minRedeem };
}

function computeOffer(offerRecord, lineCount, subtotalCents) {
  if (!offerRecord) return null;
  const offer = offerRecord.value;
  const amount = Number(offer?.discountValue);
  const cap = Number(offer?.maxDiscount ?? 0);
  const minimum = Number(offer?.minQty);
  const expiresOn = offer?.expiresOn || "";
  const today = new Date().toISOString().slice(0, 10);
  const valid = offer?.recordType === "restaurant-offer"
    && offer.enabled !== false
    && typeof offer?.name === "string"
    && offer.name.trim().length >= 1
    && offer.name.length <= 200
    && ["percent", "amount"].includes(offer.discountType)
    && Number.isFinite(amount) && amount > 0 && amount <= 999999
    && (offer.discountType !== "percent" || amount <= 100)
    && Number.isFinite(cap) && cap >= 0 && cap <= 999999
    && Number.isInteger(minimum) && minimum >= 1
    && (!expiresOn || (/^\d{4}-\d{2}-\d{2}$/.test(expiresOn) && today <= expiresOn))
    && lineCount >= minimum
    && subtotalCents > 0;
  if (!valid) conflict("OFFER_UNAVAILABLE", "Offer is unavailable or no longer valid.");
  const raw = offer.discountType === "percent" ? (subtotalCents * amount) / 100 : amount * 100;
  const capCents = cap > 0 ? Math.min(raw, cap * 100) : raw;
  const discountCents = Math.round(Math.min(subtotalCents, capCents));
  return {
    id: offerRecord.id,
    name: offer.name,
    discountCents,
    discount: discountCents / 100,
  };
}

function verifyTaxConfig(configValue) {
  const features = assertObject(configValue?.features, "INVALID_CONFIG", "Tax configuration is invalid.");
  if (typeof features.tax !== "boolean") badRequest("INVALID_CONFIG", "Tax configuration is invalid.");
  if (typeof configValue?.taxPercent !== "number" || !Number.isFinite(configValue.taxPercent)
      || configValue.taxPercent < 0 || configValue.taxPercent > 100) {
    badRequest("INVALID_CONFIG", "Tax percent is invalid.");
  }
  if (typeof configValue?.taxIncluded !== "boolean") badRequest("INVALID_CONFIG", "Tax included flag is invalid.");
  return { taxEnabled: features.tax, taxPercent: configValue.taxPercent, taxIncluded: configValue.taxIncluded };
}

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value));
}

function toDisplayBreakdown(centsBreakdown) {
  const output = {};
  for (const [key, cents] of Object.entries(centsBreakdown)) output[key] = cents / 100;
  return output;
}

function toWorkerResult(result) {
  const output = cloneJson(result);
  if (Array.isArray(output?.receipt?.items)) {
    output.receipt.items = output.receipt.items.map(({ cost, ...item }) => item);
  }
  return output;
}

function normalizePayment(totalCents, method, paymentBreakdown, customerRequired) {
  const paymentMethod = requiredString(method, "INVALID_PAYMENT", "Payment method is invalid.", { max: 10, pattern: /^[a-z]+$/ });
  if (!SUPPORTED_PAYMENT_METHODS.has(paymentMethod)) badRequest("INVALID_PAYMENT", "Payment method is invalid.");

  let breakdownCents = { cash: 0, card: 0, debt: 0 };
  if (paymentMethod === "split") {
    const object = assertObject(paymentBreakdown, "INVALID_PAYMENT", "Split payment breakdown is required.");
    for (const key of Object.keys(object)) if (!PAYMENT_KEYS.includes(key)) badRequest("INVALID_PAYMENT", "Split payment includes an unsupported method.");
    breakdownCents = {
      cash: paymentBreakdown.cash == null ? 0 : parseMoneyToCents(paymentBreakdown.cash, "INVALID_PAYMENT", "Invalid cash split amount."),
      card: paymentBreakdown.card == null ? 0 : parseMoneyToCents(paymentBreakdown.card, "INVALID_PAYMENT", "Invalid card split amount."),
      debt: paymentBreakdown.debt == null ? 0 : parseMoneyToCents(paymentBreakdown.debt, "INVALID_PAYMENT", "Invalid debt split amount."),
    };
    if (breakdownCents.cash + breakdownCents.card + breakdownCents.debt !== totalCents) {
      conflict("PAYMENT_TOTAL_MISMATCH", "Split payment must equal the checkout total.");
    }
  } else {
    if (paymentBreakdown !== undefined) badRequest("INVALID_PAYMENT", "Non-split checkout cannot include paymentBreakdown.");
    breakdownCents = { cash: 0, card: 0, debt: 0 };
    breakdownCents[paymentMethod] = totalCents;
  }

  if (breakdownCents.debt > 0 && !customerRequired) conflict("CUSTOMER_REQUIRED", "Customer is required for debt payment.");
  if (breakdownCents.cash + breakdownCents.card + breakdownCents.debt !== totalCents) {
    conflict("PAYMENT_TOTAL_MISMATCH", "Payment total mismatch.");
  }
  return {
    paymentMethod,
    paymentBreakdownCents: breakdownCents,
    paymentBreakdown: toDisplayBreakdown(breakdownCents),
  };
}

async function buildQuoteContext(env, authority, holdId, requestedRevision) {
  const keys = [
    { collection: "settings", id: "config" },
    { collection: "holds", id: holdId },
    { collection: "receipts", id: holdId },
  ];
  const [configRecord, holdRecord, receiptRecord] = await readPosAtomicRecords(env, authority.storeId, keys);
  if (!configRecord || configRecord.deleted) unavailable("CONFIG_UNAVAILABLE", "Store configuration is unavailable.");
  if (receiptRecord && !receiptRecord.deleted) conflict("HOLD_ALREADY_PAID", "Hold has already been billed.");
  if (!holdRecord || holdRecord.deleted) conflict("HOLD_NOT_FOUND", "Hold was not found.");
  if (holdRecord.revision !== requestedRevision) conflict("HOLD_CHANGED", "Hold revision changed.");
  const holdContext = validateHoldValue(holdId, requestedRevision, holdRecord.value);
  const configValue = assertObject(configRecord.value, "INVALID_CONFIG", "Store configuration is invalid.");
  const tax = verifyTaxConfig(configValue);
  const loyalty = normalizeLoyalty(configValue);

  const productIds = new Set(holdContext.items.map((item) => item.productId));
  const productKeys = Array.from(productIds).map((id) => ({ collection: "products", id }));
  const productRecords = await readPosAtomicRecords(env, authority.storeId, productKeys);
  const productsById = new Map();
  productRecords.forEach((record, index) => {
    if (!record || record.deleted) conflict("PRODUCT_UNAVAILABLE", `Product ${productKeys[index].id} is unavailable.`);
    productsById.set(record.id, record);
  });

  const extraKeys = [];
  if (holdContext.offerId) extraKeys.push({ collection: "offers", id: holdContext.offerId });
  if (holdContext.customerId) {
    extraKeys.push({ collection: "customers", id: holdContext.customerId });
    extraKeys.push({ collection: "wallets", id: holdContext.customerId });
  }
  if (holdContext.service.type === "dinein") extraKeys.push({ collection: "tables", id: holdContext.service.table });
  const extras = extraKeys.length > 0 ? await readPosAtomicRecords(env, authority.storeId, extraKeys) : [];
  const extraMap = new Map();
  extraKeys.forEach((key, index) => extraMap.set(`${key.collection}\u0000${key.id}`, extras[index]));

  const offerRecord = holdContext.offerId ? extraMap.get(`offers\u0000${holdContext.offerId}`) : null;
  if (holdContext.offerId && (!offerRecord || offerRecord.deleted)) conflict("OFFER_UNAVAILABLE", "Offer is unavailable.");
  const customerRecord = holdContext.customerId ? extraMap.get(`customers\u0000${holdContext.customerId}`) : null;
  const walletRecord = holdContext.customerId ? extraMap.get(`wallets\u0000${holdContext.customerId}`) : null;
  if (holdContext.customerId && (!customerRecord || customerRecord.deleted)) conflict("CUSTOMER_UNAVAILABLE", "Customer is unavailable.");
  if (holdContext.customerId && (!walletRecord || walletRecord.deleted)) {
    conflict("WALLET_REQUIRED", "Customer wallet is missing. Create wallet before checkout.");
  }
  if (holdContext.service.type === "dinein") {
    const tableRecord = extraMap.get(`tables\u0000${holdContext.service.table}`);
    if (!tableRecord || tableRecord.deleted) conflict("TABLE_UNAVAILABLE", "Table is unavailable.");
    if (tableRecord.value?.archived) conflict("TABLE_UNAVAILABLE", "Table is archived.");
    if (String(tableRecord.value?.holdId ?? "") !== holdId) {
      conflict("TABLE_CONFLICT", "Table assignment changed.");
    }
  }

  const lines = [];
  let subtotalCents = 0;
  let lineCount = 0;
  const stockPlan = [];
  for (const line of holdContext.items) {
    const productRecord = productsById.get(line.productId);
    const product = assertObject(productRecord.value, "PRODUCT_UNAVAILABLE", "Product data is invalid.");
    if (!Array.isArray(product.variants)) conflict("PRODUCT_UNAVAILABLE", "Product variants are invalid.");
    const matches = product.variants.map((variant, index) => ({ variant, index })).filter(({ variant }) => (
      optionalString(variant?.color, "PRODUCT_UNAVAILABLE", "Variant color is invalid.", { max: 100 }) === line.color
      && optionalString(variant?.size, "PRODUCT_UNAVAILABLE", "Variant size is invalid.", { max: 100 }) === line.size
    ));
    if (matches.length !== 1) conflict("PRODUCT_CHANGED", "Product variant changed.");
    const { variant, index } = matches[0];
    const stock = safeInteger(Number(variant.stock), "PRODUCT_UNAVAILABLE", "Product stock is invalid.", { min: 0, max: Number.MAX_SAFE_INTEGER });
    if (stock < line.qty) conflict("INSUFFICIENT_STOCK", "Insufficient stock.");
    const priceCents = parseMoneyToCents(variant.price, "PRODUCT_UNAVAILABLE", "Product price is invalid.");
    const lineTotal = priceCents * line.qty;
    if (!Number.isSafeInteger(lineTotal)) badRequest("INVALID_TOTAL", "Line total is too large.");
    subtotalCents += lineTotal;
    lineCount += line.qty;
    if (!Number.isSafeInteger(subtotalCents) || subtotalCents > MAX_MONEY_CENTS) badRequest("INVALID_TOTAL", "Order total is too large.");
    lines.push({
      productId: line.productId,
      name: typeof product.name === "string" ? product.name : line.productId,
      color: line.color,
      size: line.size,
      qty: line.qty,
      note: line.note,
      price: priceCents / 100,
      priceCents,
      total: lineTotal / 100,
      totalCents: lineTotal,
      cost: variant.cost == null ? null : Number(variant.cost),
    });
    stockPlan.push({ productId: line.productId, variantIndex: index, nextStock: stock - line.qty });
  }

  const offer = computeOffer(offerRecord, lineCount, subtotalCents);
  let discountCents = 0;
  let discountType = holdContext.discount.type;
  let discountValue = holdContext.discount.value;
  if (offer) {
    discountCents = offer.discountCents;
    discountType = "fixed";
    discountValue = offer.discount;
  } else if (holdContext.discount.type === "percent") {
    discountCents = Math.round((subtotalCents * holdContext.discount.valuePercent) / 100);
  } else {
    discountCents = holdContext.discount.valueCents;
  }
  if (discountCents > subtotalCents) conflict("INVALID_DISCOUNT", "Discount exceeds subtotal.");
  const subtotalAfterDiscountCents = subtotalCents - discountCents;

  const wallet = walletRecord?.value ? {
    points: safeInteger(walletRecord.value.points, "INVALID_WALLET", "Wallet points are invalid.", { min: 0 }),
    creditCents: parseWalletCents(walletRecord.value.creditCents, "INVALID_WALLET", "Wallet credit is invalid."),
    debtCents: parseWalletCents(walletRecord.value.debtCents, "INVALID_WALLET", "Wallet debt is invalid."),
  } : null;
  if (holdContext.redeemPoints > 0 && !holdContext.customerId) conflict("CUSTOMER_REQUIRED", "Customer is required for loyalty redemption.");
  if (holdContext.redeemPoints > 0 && !loyalty.enabled) conflict("LOYALTY_DISABLED", "Loyalty purchase redemption is disabled.");
  if (holdContext.redeemPoints > 0 && holdContext.redeemPoints < loyalty.minRedeem) {
    conflict("LOYALTY_MIN_REDEEM", "Redeem points are below minimum redeem points.");
  }
  let redeemValueCents = 0;
  if (holdContext.redeemPoints > 0) {
    if (!wallet) conflict("WALLET_REQUIRED", "Wallet is required for loyalty redemption.");
    if (holdContext.redeemPoints > wallet.points) conflict("LOYALTY_POINTS_INSUFFICIENT", "Insufficient loyalty points.");
    redeemValueCents = Math.floor((holdContext.redeemPoints * 100) / loyalty.redeemRate);
    if (redeemValueCents > subtotalAfterDiscountCents) {
      conflict("LOYALTY_REDEEM_EXCEEDS_SUBTOTAL", "Redeem value exceeds discountable subtotal.");
    }
  }

  if (holdContext.creditUseCents > 0 && !wallet) conflict("WALLET_REQUIRED", "Wallet is required for credit usage.");

  const baseCents = Math.max(0, subtotalAfterDiscountCents - redeemValueCents) + holdContext.service.deliveryFeeCents;
  let taxCents = 0;
  let totalBeforeCreditCents = baseCents;
  if (tax.taxEnabled && tax.taxPercent > 0) {
    if (tax.taxIncluded) {
      taxCents = Math.round(baseCents - (baseCents / (1 + tax.taxPercent / 100)));
      totalBeforeCreditCents = baseCents;
    } else {
      taxCents = Math.round((baseCents * tax.taxPercent) / 100);
      totalBeforeCreditCents = baseCents + taxCents;
    }
  }
  if (holdContext.creditUseCents > totalBeforeCreditCents) conflict("CREDIT_EXCEEDS_TOTAL", "Credit usage exceeds total.");
  if (holdContext.creditUseCents > 0 && holdContext.creditUseCents > wallet.creditCents) {
    conflict("CREDIT_INSUFFICIENT", "Insufficient customer credit.");
  }
  const totalCents = totalBeforeCreditCents - holdContext.creditUseCents;
  const earnedPoints = holdContext.customerId && loyalty.enabled
    ? Math.floor(totalCents / (loyalty.earnPer * 100))
    : 0;

  const productRevisions = {};
  for (const productRecord of productRecords) productRevisions[productRecord.id] = productRecord.revision;
  const sourceRevisions = {
    hold: holdRecord.revision,
    config: configRecord.revision,
    products: productRevisions,
    offer: offerRecord?.revision ?? null,
    customer: customerRecord?.revision ?? null,
    wallet: walletRecord?.revision ?? null,
    table: holdContext.service.type === "dinein" ? extraMap.get(`tables\u0000${holdContext.service.table}`)?.revision ?? null : null,
  };

  const quote = {
    holdId,
    revision: holdRecord.revision,
    items: lines.map(({ priceCents, totalCents: lineTotalCents, cost, ...line }) => line),
    subtotal: subtotalCents / 100,
    discount: discountCents / 100,
    discountType,
    discountValue,
    redeemPoints: holdContext.redeemPoints,
    redeemValue: redeemValueCents / 100,
    deliveryFee: holdContext.service.deliveryFeeCents / 100,
    taxRate: tax.taxEnabled ? tax.taxPercent : 0,
    taxIncluded: tax.taxIncluded,
    taxAmount: taxCents / 100,
    creditUse: holdContext.creditUseCents / 100,
    total: totalCents / 100,
    loyaltyEarnPoints: earnedPoints,
    customerId: holdContext.customerId,
    service: {
      type: holdContext.service.type,
      table: holdContext.service.table,
      customerName: holdContext.service.customerName,
      phone: holdContext.service.phone,
      address: holdContext.service.address,
    },
    ...(offer ? { restaurantOffer: offer } : {}),
  };

  const quoteHash = await hashObject({
    quote,
    sourceRevisions,
    authorityGuards: authority.guards,
    intent: {
      holdId,
      revision: holdRecord.revision,
      discount: holdContext.hold.discount ?? null,
      offerId: holdContext.offerId,
      customerId: holdContext.customerId,
      redeemPoints: holdContext.redeemPoints,
      creditUseCents: holdContext.creditUseCents,
      serviceType: holdContext.service.type,
      table: holdContext.service.table,
    },
  });

  const sourceGuards = [
    { collection: "holds", id: holdId, expectedRevision: holdRecord.revision },
    { collection: "settings", id: "config", expectedRevision: configRecord.revision },
    ...productRecords.map(recordGuard),
  ];
  if (offerRecord) sourceGuards.push(recordGuard(offerRecord));
  if (customerRecord) sourceGuards.push(recordGuard(customerRecord));
  if (walletRecord) sourceGuards.push(recordGuard(walletRecord));
  if (holdContext.service.type === "dinein") {
    sourceGuards.push(recordGuard(extraMap.get(`tables\u0000${holdContext.service.table}`)));
  }

  return {
    quote,
    quoteHash,
    hold: holdContext,
    lines,
    stockPlan,
    sourceGuards,
    sourceRevisions,
    wallet,
    walletRecord,
    loyalty,
    totalCents,
    holdRecord,
    tableRecord: holdContext.service.type === "dinein" ? extraMap.get(`tables\u0000${holdContext.service.table}`) : null,
    customerRecord,
    offer,
    productRecords,
  };
}

function finalizeFingerprintInput(authority, payload) {
  return {
    op: "private-restaurant-checkout-v1",
    storeId: authority.storeId,
    actor: authority.username,
    role: authority.role,
    authVersion: authority.user?.authVersion,
    requestId: payload.requestId,
    holdId: payload.holdId,
    revision: payload.revision,
    quoteHash: payload.quoteHash,
    paymentMethod: payload.paymentMethod,
    paymentBreakdown: payload.paymentBreakdown ?? null,
  };
}

export async function quotePrivateRestaurantCheckout(env, verifiedSession, payload) {
  const input = assertObject(payload, "INVALID_QUOTE", "Quote payload is invalid.");
  requireAllowedKeys(input, ["holdId", "revision"], "INVALID_QUOTE", "Quote payload contains unsupported fields.");
  const holdId = requiredString(input.holdId, "INVALID_HOLD_ID", "Hold ID is invalid.");
  const revision = safeInteger(Number(input.revision), "INVALID_REVISION", "Hold revision is invalid.", { min: 1 });
  const authority = await requirePrivateRestaurantAuthority(env, verifiedSession, { admin: false });
  if (authority?.storeId == null) unavailable("PRIVATE_AUTH_UNAVAILABLE", "Private authority data is unavailable.");

  const built = await buildQuoteContext(env, authority, holdId, revision);
  return { ok: true, quote: built.quote, quoteHash: built.quoteHash };
}

export async function completePrivateRestaurantCheckout(env, verifiedSession, payload) {
  const input = assertObject(payload, "INVALID_CHECKOUT", "Checkout payload is invalid.");
  requireAllowedKeys(input, ["requestId", "holdId", "revision", "quoteHash", "paymentMethod", "paymentBreakdown"], "INVALID_CHECKOUT", "Checkout payload contains unsupported fields.");
  const requestId = requiredString(input.requestId, "INVALID_REQUEST_ID", "Request ID is invalid.");
  const holdId = requiredString(input.holdId, "INVALID_HOLD_ID", "Hold ID is invalid.");
  const revision = safeInteger(Number(input.revision), "INVALID_REVISION", "Hold revision is invalid.", { min: 1 });
  const quoteHash = requiredString(input.quoteHash, "INVALID_QUOTE_HASH", "Quote hash is invalid.", { max: 128, pattern: /^[a-f0-9]{64}$/i });

  const authority = await requirePrivateRestaurantAuthority(env, verifiedSession, { admin: false });
  if (authority?.storeId == null || !Array.isArray(authority?.guards)) {
    unavailable("PRIVATE_AUTH_UNAVAILABLE", "Private authority data is unavailable.");
  }

  const paymentMethod = requiredString(input.paymentMethod, "INVALID_PAYMENT", "Payment method is invalid.", { max: 10, pattern: /^[a-z]+$/ });
  const fingerprint = await hashObject(finalizeFingerprintInput(authority, {
    requestId,
    holdId,
    revision,
    quoteHash,
    paymentMethod,
    paymentBreakdown: input.paymentBreakdown ?? null,
  }));

  const replay = await replayPosAtomic(env, {
    storeId: authority.storeId,
    requestId,
    actor: authority.username,
    fingerprint,
  });
  if (replay?.found) return toWorkerResult(replay.result);

  const built = await buildQuoteContext(env, authority, holdId, revision);
  if (built.quoteHash !== quoteHash) conflict("QUOTE_CHANGED", "Quote changed. Re-quote before checkout.");

  const payment = normalizePayment(built.totalCents, paymentMethod, input.paymentBreakdown, Boolean(built.hold.customerId));
  const pointsToDeduct = built.hold.redeemPoints;
  const pointsToAdd = built.quote.loyaltyEarnPoints;
  const debtDelta = payment.paymentBreakdownCents.debt;

  let walletNext = null;
  let walletExpectedRevision = null;
  if (built.hold.customerId) {
    walletExpectedRevision = built.sourceRevisions.wallet;
    walletNext = {
      points: built.wallet.points - pointsToDeduct + pointsToAdd,
      creditCents: built.wallet.creditCents - built.hold.creditUseCents,
      debtCents: built.wallet.debtCents + debtDelta,
    };
    if (!Number.isSafeInteger(walletNext.points) || !Number.isSafeInteger(walletNext.creditCents) || !Number.isSafeInteger(walletNext.debtCents)
        || walletNext.points < 0 || walletNext.creditCents < 0 || walletNext.debtCents < 0) {
      conflict("WALLET_BOUNDS", "Wallet bounds would become negative.");
    }
  } else if (debtDelta > 0 || built.hold.creditUseCents > 0 || built.hold.redeemPoints > 0) {
    conflict("CUSTOMER_REQUIRED", "Customer is required for debt, credit, or loyalty redemption.");
  }

  const nowIso = new Date().toISOString();
  const receipt = {
    schemaVersion: 1,
    recordType: "restaurant-receipt",
    holdId,
    requestId,
    revision: built.holdRecord.revision + 1,
    status: "paid",
    storeId: authority.storeId,
    quoteHash,
    cashier: {
      username: authority.username,
      role: authority.role,
    },
    customer: built.hold.customerId ? {
      id: built.hold.customerId,
      name: optionalString(built.customerRecord?.value?.name, "INVALID_CUSTOMER", "Customer name is invalid.", { max: 200 }),
      phone: optionalString(built.customerRecord?.value?.phone, "INVALID_CUSTOMER", "Customer phone is invalid.", { max: 80 }),
    } : null,
    service: {
      type: built.hold.service.type,
      table: built.hold.service.table,
      customerName: built.hold.service.customerName,
      phone: built.hold.service.phone,
      address: built.hold.service.address,
      deliveryFee: built.hold.service.deliveryFeeCents / 100,
    },
    items: built.lines.map((line) => ({
      productId: line.productId,
      name: line.name,
      color: line.color,
      size: line.size,
      qty: line.qty,
      note: line.note,
      price: line.price,
      total: line.total,
      cost: line.cost,
    })),
    subtotal: built.quote.subtotal,
    discount: built.quote.discount,
    discountType: built.quote.discountType,
    discountValue: built.quote.discountValue,
    redeemPoints: built.quote.redeemPoints,
    redeemValue: built.quote.redeemValue,
    creditUse: built.quote.creditUse,
    loyaltyEarnPoints: built.quote.loyaltyEarnPoints,
    taxRate: built.quote.taxRate,
    taxIncluded: built.quote.taxIncluded,
    taxAmount: built.quote.taxAmount,
    total: built.quote.total,
    paymentMethod: payment.paymentMethod,
    paymentBreakdown: payment.paymentBreakdown,
    debtApplied: payment.paymentBreakdown.debt ?? 0,
    restaurantOffer: built.offer ? { id: built.offer.id, name: built.offer.name, discount: built.offer.discount } : null,
    holdNote: built.hold.note,
    createdAtIso: nowIso,
  };

  const ledger = {
    schemaVersion: 1,
    recordType: "restaurant-ledger-entry",
    requestId,
    holdId,
    receiptId: holdId,
    customerId: built.hold.customerId,
    actor: authority.username,
    role: authority.role,
    storeId: authority.storeId,
    quoteHash,
    pointsDelta: built.hold.customerId ? (pointsToAdd - pointsToDeduct) : 0,
    pointsEarned: built.hold.customerId ? pointsToAdd : 0,
    pointsRedeemed: built.hold.customerId ? pointsToDeduct : 0,
    creditDeltaCents: -built.hold.creditUseCents,
    debtDeltaCents: debtDelta,
    paymentBreakdown: payment.paymentBreakdown,
    totalCents: built.totalCents,
    createdAtIso: nowIso,
  };

  const writes = [];
  const productRecordsById = new Map(built.productRecords.map((record) => [record.id, record]));
  const byProduct = new Map();
  for (const change of built.stockPlan) {
    if (!byProduct.has(change.productId)) byProduct.set(change.productId, []);
    byProduct.get(change.productId).push(change);
  }
  for (const [productId, changes] of byProduct.entries()) {
    const productRecord = productRecordsById.get(productId);
    const productValue = cloneJson(productRecord.value);
    for (const change of changes) {
      if (!productValue.variants?.[change.variantIndex]) conflict("CHECKOUT_CONFLICT", "Product variant changed during checkout.");
      productValue.variants[change.variantIndex].stock = change.nextStock;
    }
    writes.push({
      collection: "products",
      id: productId,
      expectedRevision: productRecord.revision,
      value: productValue,
    });
  }

  if (walletNext) {
    const walletRecord = built.walletRecord;
    if (!walletRecord || walletRecord.deleted || walletRecord.revision !== walletExpectedRevision) conflict("CHECKOUT_CONFLICT", "Wallet changed during checkout.");
    writes.push({
      collection: "wallets",
      id: built.hold.customerId,
      expectedRevision: walletRecord.revision,
      value: {
        ...cloneJson(walletRecord.value),
        points: walletNext.points,
        creditCents: walletNext.creditCents,
        debtCents: walletNext.debtCents,
      },
    });
  }

  writes.push({
    collection: "holds",
    id: holdId,
    expectedRevision: built.holdRecord.revision,
    value: {
      ...cloneJson(built.holdRecord.value),
      status: "paid",
      revision: built.holdRecord.value.revision + 1,
      paidAtIso: nowIso,
      receiptId: holdId,
      paymentMethod: payment.paymentMethod,
    },
  });

  if (built.tableRecord) {
    writes.push({
      collection: "tables",
      id: built.tableRecord.id,
      expectedRevision: built.tableRecord.revision,
      value: {
        ...cloneJson(built.tableRecord.value),
        holdId: "",
      },
    });
  }

  writes.push(
    { collection: "receipts", id: holdId, expectedRevision: 0, value: receipt },
    { collection: "ledger", id: requestId, expectedRevision: 0, value: ledger },
  );

  const guards = uniqueGuards([
    ...built.sourceGuards,
    ...authority.guards,
    { collection: "receipts", id: holdId, expectedRevision: 0 },
    { collection: "ledger", id: requestId, expectedRevision: 0 },
  ]);

  let result;
  try {
    result = await commitPosAtomic(env, {
      storeId: authority.storeId,
      requestId,
      actor: authority.username,
      fingerprint,
      guards,
      writes,
      result: {
        ok: true,
        replayed: false,
        receipt,
        ledger,
      },
    });
  } catch (error) {
    if (error instanceof ApiError && error.code === "ATOMIC_REVISION_CONFLICT") {
      conflict("CHECKOUT_CONFLICT", "Checkout conflict. Refresh and retry.");
    }
    throw error;
  }
  return toWorkerResult(result);
}
