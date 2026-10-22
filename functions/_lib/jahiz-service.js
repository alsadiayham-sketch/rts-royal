import { requirePlatformAdmin } from "./auth.js";
import { createPasswordRecord, createSessionToken, sha256Hex, verifyPassword } from "./crypto.js";
import {
  ApiError,
  jsonResponse,
  parseJsonBody,
  requireJsonContentType,
  requireTrustedMutationRequest,
} from "./http.js";
import { enforceRateLimit } from "./rate-limit.js";
import {
  authenticateJahizCredentials,
  clearJahizCookie,
  createJahizSession,
  removeJahizSession,
  requireJahizUser,
} from "./jahiz-auth.js";
import {
  DEFAULT_BRANDING,
  optionalExpiry,
  parseStoredBranding,
  requireBoolean,
  requireBusinessType,
  requireCurrency,
  requireInteger,
  requireName,
  requirePassword,
  requireSlug,
  requireUsername,
  requireUuid,
  validateApplication,
  validateBranding,
} from "./jahiz-validation.js";

const DAY = 86400;
const MONTH = 30 * DAY;
const PICKUP_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function iso(epoch) {
  return epoch === null || epoch === undefined ? null : new Date(Number(epoch) * 1000).toISOString();
}

function id() {
  return crypto.randomUUID();
}

function generatePickupCode() {
  const bytes = crypto.getRandomValues(new Uint8Array(12));
  let code = "";
  for (const byte of bytes) code += PICKUP_CODE_ALPHABET[byte & 31];
  return code;
}

function resultChanges(result) {
  return Number(result?.meta?.changes ?? result?.changes ?? 0);
}

function userDto(row) {
  return {
    id: row.id,
    username: row.username,
    name: row.name,
    role: row.role,
  };
}

function venueDto(row, { admin = false } = {}) {
  const venue = {
    id: row.venue_id ?? row.id,
    slug: row.slug,
    name: row.venue_name ?? row.name,
    businessType: row.business_type,
    status: row.status,
    expiresAt: iso(row.expires_at),
    isDemo: Boolean(row.is_demo),
    planId: row.plan_id ?? null,
    branding: parseStoredBranding(row.branding_json),
    customerUrl: `/jahiz/s/?shop=${encodeURIComponent(row.slug)}`,
    ownerUrl: `/jahiz/login/?shop=${encodeURIComponent(row.slug)}`,
  };
  if (admin) venue.ownerUsername = row.owner_username ?? "";
  return venue;
}

function planDto(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    currency: row.currency,
    amountMinor: Number(row.amount_minor),
    months: Number(row.months),
    active: Boolean(row.active),
  };
}

function paymentDto(row) {
  return {
    id: row.id,
    amountMinor: Number(row.amount_minor),
    currency: row.currency,
    months: Number(row.months),
    note: row.note || "",
    createdAt: iso(row.created_at),
  };
}

function orderDto(row, { includePickupCode = false } = {}) {
  const order = {
    id: row.id,
    number: row.number,
    status: row.status,
    createdAt: iso(row.created_at),
    estimatedReadyAt: iso(row.estimated_ready_at),
    revision: Number(row.revision),
    watching: Boolean(row.watching),
  };
  if (includePickupCode) order.pickupCode = row.pickup_code;
  return order;
}

function requireMutation(request) {
  requireTrustedMutationRequest(request);
  requireJsonContentType(request);
}

async function ensurePlan(db, planId, { activeOnly = false } = {}) {
  if (planId === undefined || planId === null || planId === "") return null;
  requireUuid(planId, "Plan ID");
  const row = await db.prepare(
    `SELECT id FROM jahiz_plans WHERE id = ?${activeOnly ? " AND active = 1" : ""}`
  ).bind(planId).first();
  if (!row) throw new ApiError(400, "INVALID_PLAN", "Plan does not exist.");
  return planId;
}

async function ensureVenueAbsent(db, slug) {
  if (await db.prepare("SELECT id FROM jahiz_venues WHERE slug = ?").bind(slug).first()) {
    throw new ApiError(409, "SLUG_EXISTS", "Slug is already in use.");
  }
}

async function createVenueStatements(db, data) {
  const venueId = id();
  const userId = id();
  const password = await createPasswordRecord(data.password);
  return {
    venueId,
    userId,
    statements: [
      db.prepare(
        `INSERT INTO jahiz_venues
           (id, slug, name, business_type, status, expires_at, is_demo, plan_id, branding_json)
         VALUES (?, ?, ?, ?, 'active', ?, ?, ?, ?)`
      ).bind(
        venueId,
        data.slug,
        data.name,
        data.businessType,
        data.expiresAt,
        data.isDemo ? 1 : 0,
        data.planId,
        JSON.stringify(DEFAULT_BRANDING)
      ),
      db.prepare(
        `INSERT INTO jahiz_users
           (id, venue_id, username, name, role, password_salt, password_hash, password_iterations)
         VALUES (?, ?, ?, ?, 'owner', ?, ?, ?)`
      ).bind(
        userId,
        venueId,
        data.username,
        data.ownerName,
        password.salt,
        password.hash,
        password.iterations
      ),
    ],
  };
}

async function adminGet(context) {
  await requirePlatformAdmin(context);
  const [venuesResult, applicationsResult, plansResult] = await Promise.all([
    context.env.DB.prepare(
      `SELECT v.*, u.username AS owner_username
       FROM jahiz_venues v
       LEFT JOIN jahiz_users u ON u.venue_id = v.id AND u.role = 'owner'
       ORDER BY v.created_at DESC LIMIT 500`
    ).all(),
    context.env.DB.prepare(
      `SELECT id, name, business_type, owner_name, email, phone, message, status, created_at
       FROM jahiz_applications ORDER BY created_at DESC LIMIT 500`
    ).all(),
    context.env.DB.prepare(
      `SELECT id, name, currency, amount_minor, months, active
       FROM jahiz_plans ORDER BY active DESC, amount_minor ASC, name ASC`
    ).all(),
  ]);
  return jsonResponse({
    venues: (venuesResult.results || []).map((row) => venueDto(row, { admin: true })),
    applications: (applicationsResult.results || []).map((row) => ({
      id: row.id,
      name: row.name,
      businessType: row.business_type,
      ownerName: row.owner_name,
      email: row.email,
      phone: row.phone,
      message: row.message || "",
      status: row.status,
      createdAt: iso(row.created_at),
    })),
    plans: (plansResult.results || []).map(planDto),
    paymentsEnabled: false,
  });
}

async function adminPost(context) {
  requireMutation(context.request);
  const admin = await requirePlatformAdmin(context);
  await enforceRateLimit(context, {
    scope: "jahiz_admin",
    accountPart: admin.username,
    maxRequests: 100,
    windowSeconds: 300,
  });
  const payload = await parseJsonBody(context.request, [
    "action", "name", "slug", "businessType", "ownerName", "username", "password",
    "expiresAt", "isDemo", "planId", "applicationId", "venueId", "status", "id",
    "currency", "amountMinor", "months", "active", "note",
  ]);
  const db = context.env.DB;

  if (payload.action === "create") {
    const slug = requireSlug(payload.slug);
    await ensureVenueAbsent(db, slug);
    const planId = await ensurePlan(db, payload.planId, { activeOnly: true });
    const data = {
      name: requireName(payload.name),
      slug,
      businessType: requireBusinessType(payload.businessType),
      ownerName: requireName(payload.ownerName, "Owner name"),
      username: requireUsername(payload.username),
      password: requirePassword(payload.password),
      expiresAt: optionalExpiry(payload.expiresAt),
      isDemo: payload.isDemo === undefined ? false : requireBoolean(payload.isDemo, "isDemo"),
      planId,
    };
    const created = await createVenueStatements(db, data);
    await db.batch(created.statements);
    return jsonResponse({ ok: true, venueId: created.venueId }, 201);
  }

  if (payload.action === "approve") {
    const applicationId = requireUuid(payload.applicationId, "Application ID");
    const application = await db.prepare(
      `SELECT id, name, business_type, owner_name FROM jahiz_applications
       WHERE id = ? AND status = 'pending'`
    ).bind(applicationId).first();
    if (!application) throw new ApiError(404, "APPLICATION_NOT_FOUND", "Pending application was not found.");
    const slug = requireSlug(payload.slug);
    await ensureVenueAbsent(db, slug);
    const planId = await ensurePlan(db, payload.planId, { activeOnly: true });
    const venueId = id();
    const userId = id();
    const username = requireUsername(payload.username);
    const password = await createPasswordRecord(requirePassword(payload.password));
    const expiresAt = optionalExpiry(payload.expiresAt);
    const isDemo = payload.isDemo === undefined ? false : requireBoolean(payload.isDemo, "isDemo");
    const statements = [
      db.prepare(
        `UPDATE jahiz_applications SET status = 'approved', resolved_at = unixepoch(), updated_at = unixepoch()
         WHERE id = ? AND status = 'pending'`
      ).bind(applicationId),
      db.prepare(
        `INSERT INTO jahiz_venues
           (id, slug, name, business_type, status, expires_at, is_demo, plan_id, branding_json)
         SELECT ?, ?, ?, ?, 'active', ?, ?, ?, ?
         WHERE changes() = 1`
      ).bind(
        venueId,
        slug,
        application.name,
        application.business_type,
        expiresAt,
        isDemo ? 1 : 0,
        planId,
        JSON.stringify(DEFAULT_BRANDING)
      ),
      db.prepare(
        `INSERT INTO jahiz_users
           (id, venue_id, username, name, role, password_salt, password_hash, password_iterations)
         VALUES (?, ?, ?, ?, 'owner', ?, ?, ?)`
      ).bind(
        userId,
        venueId,
        username,
        application.owner_name,
        password.salt,
        password.hash,
        password.iterations
      ),
    ];
    try {
      const results = await db.batch(statements);
      if (resultChanges(results[0]) !== 1 || resultChanges(results[1]) !== 1) {
        throw new ApiError(409, "APPLICATION_RESOLVED", "Application was already resolved.");
      }
    } catch (error) {
      if (error instanceof ApiError) throw error;
      const current = await db.prepare("SELECT status FROM jahiz_applications WHERE id = ?")
        .bind(applicationId).first();
      if (current?.status !== "pending") {
        throw new ApiError(409, "APPLICATION_RESOLVED", "Application was already resolved.");
      }
      throw error;
    }
    return jsonResponse({ ok: true, venueId });
  }

  if (payload.action === "reject") {
    const result = await db.prepare(
      `UPDATE jahiz_applications SET status = 'rejected', resolved_at = unixepoch(), updated_at = unixepoch()
       WHERE id = ? AND status = 'pending'`
    ).bind(requireUuid(payload.applicationId, "Application ID")).run();
    if (resultChanges(result) !== 1) throw new ApiError(404, "APPLICATION_NOT_FOUND", "Pending application was not found.");
    return jsonResponse({ ok: true });
  }

  if (payload.action === "update") {
    const venueId = requireUuid(payload.venueId, "Venue ID");
    if (!["active", "suspended"].includes(payload.status)) {
      throw new ApiError(400, "INVALID_STATUS", "Venue status is invalid.");
    }
    const expiresAt = optionalExpiry(payload.expiresAt);
    const planId = payload.planId === undefined ? undefined : await ensurePlan(db, payload.planId);
    const sql = planId === undefined
      ? `UPDATE jahiz_venues SET status = ?, expires_at = ?, updated_at = unixepoch() WHERE id = ?`
      : `UPDATE jahiz_venues SET status = ?, expires_at = ?, plan_id = ?, updated_at = unixepoch() WHERE id = ?`;
    const result = planId === undefined
      ? await db.prepare(sql).bind(payload.status, expiresAt, venueId).run()
      : await db.prepare(sql).bind(payload.status, expiresAt, planId, venueId).run();
    if (resultChanges(result) !== 1) throw new ApiError(404, "VENUE_NOT_FOUND", "Venue was not found.");
    if (payload.status === "suspended") {
      await db.prepare("DELETE FROM jahiz_sessions WHERE venue_id = ?").bind(venueId).run();
    }
    return jsonResponse({ ok: true });
  }

  if (payload.action === "reset-password") {
    const venueId = requireUuid(payload.venueId, "Venue ID");
    const username = requireUsername(payload.username);
    const record = await createPasswordRecord(requirePassword(payload.password));
    const statements = [
      db.prepare(
        `UPDATE jahiz_users SET password_salt = ?, password_hash = ?, password_iterations = ?,
           session_version = session_version + 1, updated_at = unixepoch()
         WHERE venue_id = ? AND username = ? AND active = 1`
      ).bind(record.salt, record.hash, record.iterations, venueId, username),
      db.prepare(
        `DELETE FROM jahiz_sessions
         WHERE venue_id = ? AND user_id IN
           (SELECT id FROM jahiz_users WHERE venue_id = ? AND username = ?)`
      ).bind(venueId, venueId, username),
    ];
    const results = await db.batch(statements);
    if (resultChanges(results[0]) !== 1) throw new ApiError(404, "USER_NOT_FOUND", "User was not found.");
    return jsonResponse({ ok: true });
  }

  if (payload.action === "save-plan") {
    const planId = payload.id === undefined || payload.id === null || payload.id === ""
      ? id()
      : requireUuid(payload.id, "Plan ID");
    const name = requireName(payload.name, "Plan name");
    const currency = requireCurrency(payload.currency);
    const amount = requireInteger(payload.amountMinor, "amountMinor", 0, 2_147_483_647);
    const months = requireInteger(payload.months, "months", 1, 60);
    const active = requireBoolean(payload.active, "active");
    await db.prepare(
      `INSERT INTO jahiz_plans (id, name, currency, amount_minor, months, active)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET name = excluded.name, currency = excluded.currency,
         amount_minor = excluded.amount_minor, months = excluded.months,
         active = excluded.active, updated_at = unixepoch()`
    ).bind(planId, name, currency, amount, months, active ? 1 : 0).run();
    return jsonResponse({ ok: true, planId });
  }

  if (payload.action === "record-payment") {
    const venueId = requireUuid(payload.venueId, "Venue ID");
    if (!await db.prepare("SELECT id FROM jahiz_venues WHERE id = ?").bind(venueId).first()) {
      throw new ApiError(404, "VENUE_NOT_FOUND", "Venue was not found.");
    }
    const paymentId = id();
    const amount = requireInteger(payload.amountMinor, "amountMinor", 0, 2_147_483_647);
    const currency = requireCurrency(payload.currency);
    const months = requireInteger(payload.months, "months", 1, 60);
    const note = typeof payload.note === "string" ? payload.note.trim() : "";
    if (note.length > 240) throw new ApiError(400, "INVALID_NOTE", "Payment note is too long.");
    await db.batch([
      db.prepare(
        `INSERT INTO jahiz_payments
           (id, venue_id, amount_minor, currency, months, note, recorded_by)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      ).bind(paymentId, venueId, amount, currency, months, note, admin.username),
      db.prepare(
        `UPDATE jahiz_venues
         SET expires_at = MAX(COALESCE(expires_at, unixepoch()), unixepoch()) + (? * ?),
             updated_at = unixepoch()
         WHERE id = ?`
      ).bind(months, MONTH, venueId),
    ]);
    const venue = await db.prepare("SELECT expires_at FROM jahiz_venues WHERE id = ?").bind(venueId).first();
    return jsonResponse({ ok: true, paymentId, expiresAt: iso(venue.expires_at) });
  }

  throw new ApiError(400, "INVALID_ACTION", "Admin action is invalid.");
}

async function applicationsPost(context) {
  requireMutation(context.request);
  await enforceRateLimit(context, {
    scope: "jahiz_application",
    maxRequests: 5,
    windowSeconds: 3600,
  });
  const payload = await parseJsonBody(
    context.request,
    ["name", "businessType", "ownerName", "email", "phone", "message"]
  );
  const data = validateApplication(payload);
  if (await context.env.DB.prepare(
    "SELECT id FROM jahiz_applications WHERE lower(email) = ? AND status = 'pending'"
  ).bind(data.email).first()) {
    throw new ApiError(409, "APPLICATION_EXISTS", "A pending application already exists for this email.");
  }
  await context.env.DB.prepare(
    `INSERT INTO jahiz_applications
       (id, name, business_type, owner_name, email, phone, message)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).bind(id(), data.name, data.businessType, data.ownerName, data.email, data.phone, data.message).run();
  return jsonResponse({ ok: true }, 201);
}

async function loginPost(context) {
  requireMutation(context.request);
  const payload = await parseJsonBody(context.request, ["slug", "username", "password"]);
  const slug = requireSlug(payload.slug);
  const username = requireUsername(payload.username);
  await enforceRateLimit(context, {
    scope: "jahiz_login",
    accountPart: `${slug}:${username}`,
    maxRequests: 10,
    windowSeconds: 900,
  });
  if (typeof payload.password !== "string" || payload.password.length > 128) {
    throw new ApiError(401, "AUTH_FAILED", "Invalid credentials or inactive venue.");
  }
  const row = await authenticateJahizCredentials(context.env.DB, slug, username, payload.password);
  const session = await createJahizSession(context.env.DB, row);
  return jsonResponse(
    { ok: true, venue: venueDto(row), user: userDto(row) },
    200,
    { "Set-Cookie": session.cookie }
  );
}

async function sessionGet(context) {
  const auth = await requireJahizUser(context);
  const [staffResult, plan, paymentsResult] = await Promise.all([
    auth.role === "owner"
      ? context.env.DB.prepare(
        `SELECT id, username, name, role FROM jahiz_users
         WHERE venue_id = ? AND role = 'staff' AND active = 1 ORDER BY name LIMIT 100`
      ).bind(auth.venue_id).all()
      : Promise.resolve({ results: [] }),
    auth.plan_id
      ? context.env.DB.prepare(
        `SELECT id, name, currency, amount_minor, months, active FROM jahiz_plans WHERE id = ?`
      ).bind(auth.plan_id).first()
      : Promise.resolve(null),
    auth.role === "owner"
      ? context.env.DB.prepare(
        `SELECT id, amount_minor, currency, months, note, created_at FROM jahiz_payments
         WHERE venue_id = ? ORDER BY created_at DESC LIMIT 100`
      ).bind(auth.venue_id).all()
      : Promise.resolve({ results: [] }),
  ]);
  return jsonResponse({
    venue: venueDto(auth),
    user: userDto(auth),
    staff: (staffResult.results || []).map(userDto),
    billing: {
      paymentsEnabled: false,
      plan: planDto(plan),
      payments: (paymentsResult.results || []).map(paymentDto),
    },
  });
}

async function logoutPost(context) {
  requireTrustedMutationRequest(context.request);
  return jsonResponse({ ok: true }, 200, { "Set-Cookie": await removeJahizSession(context) });
}

async function passwordPost(context) {
  requireMutation(context.request);
  const auth = await requireJahizUser(context, { password: true });
  await enforceRateLimit(context, {
    scope: "jahiz_password",
    accountPart: auth.id,
    maxRequests: 5,
    windowSeconds: 3600,
  });
  const payload = await parseJsonBody(context.request, ["currentPassword", "newPassword"]);
  if (typeof payload.currentPassword !== "string" || !await verifyPassword(payload.currentPassword, {
    salt: auth.password_salt,
    hash: auth.password_hash,
    iterations: Number(auth.password_iterations),
  })) {
    throw new ApiError(401, "CURRENT_PASSWORD_INVALID", "Current password is invalid.");
  }
  const record = await createPasswordRecord(requirePassword(payload.newPassword));
  await context.env.DB.batch([
    context.env.DB.prepare(
      `UPDATE jahiz_users SET password_salt = ?, password_hash = ?, password_iterations = ?,
       session_version = session_version + 1, updated_at = unixepoch() WHERE id = ? AND venue_id = ?`
    ).bind(record.salt, record.hash, record.iterations, auth.id, auth.venue_id),
    context.env.DB.prepare(
      "DELETE FROM jahiz_sessions WHERE user_id = ? AND token_hash <> ?"
    ).bind(auth.id, auth.tokenHash),
    context.env.DB.prepare(
      "UPDATE jahiz_sessions SET session_version = session_version + 1 WHERE token_hash = ?"
    ).bind(auth.tokenHash),
  ]);
  return jsonResponse({ ok: true });
}

async function settingsPatch(context) {
  requireMutation(context.request);
  const auth = await requireJahizUser(context, { owner: true });
  const payload = await parseJsonBody(context.request, ["branding"], 320 * 1024);
  const branding = validateBranding(payload.branding);
  await context.env.DB.prepare(
    `UPDATE jahiz_venues SET branding_json = ?, branding_revision = branding_revision + 1,
       updated_at = unixepoch() WHERE id = ?`
  ).bind(JSON.stringify(branding), auth.venue_id).run();
  return jsonResponse({ branding, revision: Number(auth.branding_revision) + 1 });
}

async function staffPost(context) {
  requireMutation(context.request);
  const auth = await requireJahizUser(context, { owner: true });
  const payload = await parseJsonBody(context.request, ["username", "name", "password"]);
  const username = requireUsername(payload.username);
  if (await context.env.DB.prepare(
    "SELECT id FROM jahiz_users WHERE venue_id = ? AND username = ?"
  ).bind(auth.venue_id, username).first()) {
    throw new ApiError(409, "USERNAME_EXISTS", "Username is already in use.");
  }
  const record = await createPasswordRecord(requirePassword(payload.password));
  const userId = id();
  await context.env.DB.prepare(
    `INSERT INTO jahiz_users
       (id, venue_id, username, name, role, password_salt, password_hash, password_iterations)
     VALUES (?, ?, ?, ?, 'staff', ?, ?, ?)`
  ).bind(
    userId,
    auth.venue_id,
    username,
    requireName(payload.name),
    record.salt,
    record.hash,
    record.iterations
  ).run();
  return jsonResponse({ user: { id: userId, username, name: requireName(payload.name), role: "staff" } }, 201);
}

async function staffDelete(context) {
  requireMutation(context.request);
  const auth = await requireJahizUser(context, { owner: true });
  const payload = await parseJsonBody(context.request, ["id"]);
  const staffId = requireUuid(payload.id, "Staff ID");
  const results = await context.env.DB.batch([
    context.env.DB.prepare(
      `UPDATE jahiz_users SET active = 0, session_version = session_version + 1, updated_at = unixepoch()
       WHERE id = ? AND venue_id = ? AND role = 'staff' AND active = 1`
    ).bind(staffId, auth.venue_id),
    context.env.DB.prepare(
      `DELETE FROM jahiz_sessions WHERE user_id = ? AND venue_id = ?`
    ).bind(staffId, auth.venue_id),
  ]);
  if (resultChanges(results[0]) !== 1) throw new ApiError(404, "STAFF_NOT_FOUND", "Staff member was not found.");
  return jsonResponse({ ok: true });
}

async function ordersGet(context) {
  const auth = await requireJahizUser(context);
  const now = Math.floor(Date.now() / 1000);
  const result = await context.env.DB.prepare(
    `SELECT o.id, o.number, o.pickup_code, o.status, o.created_at, o.estimated_ready_at, o.revision,
       EXISTS(
         SELECT 1 FROM jahiz_order_capabilities c
         WHERE c.order_id = o.id AND c.expires_at > ?
       ) AS watching
     FROM jahiz_orders o
     WHERE o.venue_id = ? AND (o.status IN ('waiting', 'ready') OR o.created_at > ?)
     ORDER BY CASE o.status WHEN 'ready' THEN 0 WHEN 'waiting' THEN 1 ELSE 2 END, o.created_at DESC
     LIMIT 200`
  ).bind(now, auth.venue_id, now - DAY).all();
  return jsonResponse({
    orders: (result.results || []).map((row) => orderDto(row, { includePickupCode: true })),
    serverTime: iso(now),
  });
}

async function ordersPost(context) {
  requireMutation(context.request);
  const auth = await requireJahizUser(context);
  const payload = await parseJsonBody(context.request, ["number", "minutes"]);
  const number = typeof payload.number === "string" ? payload.number.trim() : String(payload.number ?? "");
  if (!/^\d{1,12}$/.test(number)) throw new ApiError(400, "INVALID_ORDER_NUMBER", "Receipt number must be 1-12 digits.");
  const minutes = payload.minutes === undefined || payload.minutes === null
    ? null
    : requireInteger(payload.minutes, "minutes", 1, 180);
  if (await context.env.DB.prepare(
    `SELECT id FROM jahiz_orders WHERE venue_id = ? AND number = ? AND status IN ('waiting', 'ready')`
  ).bind(auth.venue_id, number).first()) {
    throw new ApiError(409, "ORDER_EXISTS", "A pending order already uses this receipt number.");
  }
  const orderId = id();
  let pickupCode;
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const candidate = generatePickupCode();
    const collision = await context.env.DB.prepare(
      "SELECT 1 FROM jahiz_orders WHERE venue_id = ? AND pickup_code = ?"
    ).bind(auth.venue_id, candidate).first();
    if (!collision) {
      pickupCode = candidate;
      break;
    }
  }
  if (!pickupCode) throw new ApiError(503, "CODE_GENERATION_FAILED", "Could not create a secure pickup code.");
  await context.env.DB.prepare(
    `INSERT INTO jahiz_orders
       (id, venue_id, number, pickup_code, estimated_ready_at, created_by)
     VALUES (?, ?, ?, ?, CASE WHEN ? IS NULL THEN NULL ELSE unixepoch() + (? * 60) END, ?)`
  ).bind(orderId, auth.venue_id, number, pickupCode, minutes, minutes, auth.id).run();
  const row = await context.env.DB.prepare(
    `SELECT id, number, pickup_code, status, created_at, estimated_ready_at, revision, 0 AS watching
     FROM jahiz_orders WHERE id = ? AND venue_id = ?`
  ).bind(orderId, auth.venue_id).first();
  return jsonResponse({ order: orderDto(row, { includePickupCode: true }) }, 201);
}

async function ordersPatch(context) {
  requireMutation(context.request);
  const auth = await requireJahizUser(context);
  const payload = await parseJsonBody(context.request, ["id", "action", "minutes", "revision"]);
  const orderId = requireUuid(payload.id, "Order ID");
  const revision = requireInteger(payload.revision, "revision", 1, 2_147_483_647);
  const transitions = {
    ready: { from: ["waiting"], status: "ready" },
    done: { from: ["ready"], status: "done" },
    cancel: { from: ["waiting", "ready"], status: "cancelled" },
  };
  let sql;
  let bindings;
  if (payload.action === "estimate") {
    const minutes = payload.minutes === null
      ? null
      : requireInteger(payload.minutes, "minutes", 1, 180);
    sql = `UPDATE jahiz_orders SET estimated_ready_at =
             CASE WHEN ? IS NULL THEN NULL ELSE unixepoch() + (? * 60) END,
             revision = revision + 1, updated_at = unixepoch()
           WHERE id = ? AND venue_id = ? AND revision = ? AND status IN ('waiting', 'ready')`;
    bindings = [minutes, minutes, orderId, auth.venue_id, revision];
  } else {
    const transition = transitions[payload.action];
    if (!transition) throw new ApiError(400, "INVALID_ACTION", "Order action is invalid.");
    const placeholders = transition.from.map(() => "?").join(", ");
    sql = `UPDATE jahiz_orders SET status = ?, revision = revision + 1, updated_at = unixepoch(),
             completed_at = CASE WHEN ? IN ('done', 'cancelled') THEN unixepoch() ELSE completed_at END
           WHERE id = ? AND venue_id = ? AND revision = ? AND status IN (${placeholders})`;
    bindings = [
      transition.status,
      transition.status,
      orderId,
      auth.venue_id,
      revision,
      ...transition.from,
    ];
  }
  const result = await context.env.DB.prepare(sql).bind(...bindings).run();
  if (resultChanges(result) !== 1) {
    const exists = await context.env.DB.prepare(
      "SELECT revision, status FROM jahiz_orders WHERE id = ? AND venue_id = ?"
    ).bind(orderId, auth.venue_id).first();
    if (!exists) throw new ApiError(404, "ORDER_NOT_FOUND", "Order was not found.");
    if (Number(exists.revision) !== revision) throw new ApiError(409, "REVISION_CONFLICT", "Order was updated elsewhere.");
    throw new ApiError(409, "INVALID_TRANSITION", "Order state transition is not allowed.");
  }
  const row = await context.env.DB.prepare(
    `SELECT id, number, pickup_code, status, created_at, estimated_ready_at, revision,
       EXISTS(SELECT 1 FROM jahiz_order_capabilities c
              WHERE c.order_id = jahiz_orders.id AND c.expires_at > unixepoch()) AS watching
     FROM jahiz_orders WHERE id = ? AND venue_id = ?`
  ).bind(orderId, auth.venue_id).first();
  return jsonResponse({ order: orderDto(row, { includePickupCode: true }) });
}

async function publicVenueGet(context) {
  const slug = requireSlug(new URL(context.request.url).searchParams.get("slug"));
  const now = Math.floor(Date.now() / 1000);
  const row = await context.env.DB.prepare(
    `SELECT id, slug, name, business_type, status, expires_at, is_demo, plan_id, branding_json
     FROM jahiz_venues
     WHERE slug = ? AND status = 'active' AND (expires_at IS NULL OR expires_at > ?)`
  ).bind(slug, now).first();
  if (!row) throw new ApiError(404, "VENUE_NOT_FOUND", "Venue was not found.");
  return jsonResponse({ venue: venueDto(row) });
}

async function publicJoinPost(context) {
  requireMutation(context.request);
  const payload = await parseJsonBody(context.request, ["slug", "number", "pickupCode"]);
  const slug = requireSlug(payload.slug);
  const number = typeof payload.number === "string" ? payload.number.trim() : String(payload.number ?? "");
  if (!/^\d{1,12}$/.test(number)) throw new ApiError(400, "INVALID_ORDER_NUMBER", "Receipt number must be 1-12 digits.");
  await enforceRateLimit(context, {
    scope: "jahiz_join",
    accountPart: slug,
    maxRequests: 20,
    windowSeconds: 900,
  });
  const pickupCode = typeof payload.pickupCode === "string"
    ? payload.pickupCode.trim().toUpperCase()
    : "";
  if (
    pickupCode.length !== 12
    || [...pickupCode].some((character) => !PICKUP_CODE_ALPHABET.includes(character))
  ) {
    throw new ApiError(404, "ORDER_NOT_FOUND", "Active order was not found.");
  }
  const now = Math.floor(Date.now() / 1000);
  const order = await context.env.DB.prepare(
    `SELECT o.id, o.venue_id, o.created_at
     FROM jahiz_orders o
     JOIN jahiz_venues v ON v.id = o.venue_id
     WHERE v.slug = ? AND v.status = 'active' AND (v.expires_at IS NULL OR v.expires_at > ?)
       AND o.number = ? AND o.pickup_code = ?
       AND o.status IN ('waiting', 'ready') AND o.created_at > ?
     ORDER BY o.created_at DESC LIMIT 1`
  ).bind(slug, now, number, pickupCode, now - DAY).first();
  if (!order) throw new ApiError(404, "ORDER_NOT_FOUND", "Active order was not found.");
  const token = createSessionToken();
  const expiresAt = Math.min(now + 4 * 60 * 60, Number(order.created_at) + DAY);
  await context.env.DB.prepare(
    `INSERT INTO jahiz_order_capabilities (token_hash, order_id, venue_id, expires_at)
     VALUES (?, ?, ?, ?)`
  ).bind(await sha256Hex(token), order.id, order.venue_id, expiresAt).run();
  return jsonResponse({ token });
}

async function publicOrderGet(context) {
  const token = new URL(context.request.url).searchParams.get("token");
  if (typeof token !== "string" || token.length < 32 || token.length > 128) {
    throw new ApiError(404, "ORDER_NOT_FOUND", "Order was not found.");
  }
  const now = Math.floor(Date.now() / 1000);
  const row = await context.env.DB.prepare(
    `SELECT o.id, o.number, o.status, o.created_at, o.estimated_ready_at, o.revision,
            1 AS watching, v.id AS venue_id, v.slug, v.name AS venue_name, v.business_type,
            v.status AS venue_status, v.expires_at, v.is_demo, v.plan_id, v.branding_json
     FROM jahiz_order_capabilities c
     JOIN jahiz_orders o ON o.id = c.order_id AND o.venue_id = c.venue_id
     JOIN jahiz_venues v ON v.id = c.venue_id
     WHERE c.token_hash = ? AND c.expires_at > ? AND v.status = 'active'
       AND (v.expires_at IS NULL OR v.expires_at > ?)`
  ).bind(await sha256Hex(token), now, now).first();
  if (!row) throw new ApiError(404, "ORDER_NOT_FOUND", "Order was not found.");
  return jsonResponse({
    order: orderDto(row),
    venue: {
      id: row.venue_id,
      slug: row.slug,
      name: row.venue_name,
      businessType: row.business_type,
      branding: parseStoredBranding(row.branding_json),
      customerUrl: `/jahiz/s/?shop=${encodeURIComponent(row.slug)}`,
    },
    serverTime: iso(now),
  });
}

export async function routeJahiz(context, path, method) {
  if (path === "admin" && method === "GET") return adminGet(context);
  if (path === "admin" && method === "POST") return adminPost(context);
  if (path === "applications" && method === "POST") return applicationsPost(context);
  if (path === "login" && method === "POST") return loginPost(context);
  if (path === "session" && method === "GET") return sessionGet(context);
  if (path === "logout" && method === "POST") return logoutPost(context);
  if (path === "password" && method === "POST") return passwordPost(context);
  if (path === "settings" && method === "PATCH") return settingsPatch(context);
  if (path === "staff" && method === "POST") return staffPost(context);
  if (path === "staff" && method === "DELETE") return staffDelete(context);
  if (path === "orders" && method === "GET") return ordersGet(context);
  if (path === "orders" && method === "POST") return ordersPost(context);
  if (path === "orders" && method === "PATCH") return ordersPatch(context);
  if (path === "public/venue" && method === "GET") return publicVenueGet(context);
  if (path === "public/join" && method === "POST") return publicJoinPost(context);
  if (path === "public/order" && method === "GET") return publicOrderGet(context);
  if (path === "checkout") {
    if (method !== "GET") requireTrustedMutationRequest(context.request);
    throw new ApiError(503, "PAYMENTS_DISABLED", "Online checkout is not available.");
  }
  throw new ApiError(404, "NOT_FOUND", "Endpoint was not found.");
}

export { clearJahizCookie };
