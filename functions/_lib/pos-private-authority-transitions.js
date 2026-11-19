import { ApiError } from "./http.js";
import { commitPosAtomic, readPosAtomicRecords } from "./pos-atomic-store.js";
import { requirePrivateRestaurantAuthority } from "./pos-private-authority.js";
import { getFirestoreDocumentSnapshot, patchFirestoreDocumentAtUpdateTime } from "./firestore.js";
import { getPosUserAuthVersion } from "./pos-session.js";
import { normalizeStoreId } from "./pos-store-validation.js";
import { normalizeUsername } from "./validation.js";

function invalid(message) { throw new ApiError(400, "INVALID_AUTHORITY_CHANGE", message); }
function conflict(message) { throw new ApiError(409, "AUTHORITY_CHANGE_CONFLICT", message); }
function validVersion(value) { return typeof value === "string" && /^[a-f0-9]{64}$/.test(value); }
function normalizeCommand(input) {
  if (!input || !input.storeId || normalizeStoreId(input.storeId) !== input.storeId
      || typeof input.requestId !== "string" || !/^[A-Za-z0-9_-]{8,80}$/.test(input.requestId)
      || !["user", "licence"].includes(input.target)) invalid("Invalid private authority operation.");
  if (input.target === "user" && (!input.username || normalizeUsername(input.username) !== input.username)) {
    invalid("Choose a canonical account name.");
  }
  return { storeId: input.storeId, requestId: input.requestId, target: input.target, ...(input.target === "user" ? { username: input.username } : {}) };
}
function nextValue(command, next) {
  if (command.target === "user") {
    if (next === null) return null;
    if (!next || !validVersion(next.authVersion) || !["admin", "worker"].includes(next.role) || typeof next.active !== "boolean") {
      invalid("Provide the next server-derived account version and role.");
    }
    return { schemaVersion: 1, username: command.username, role: next.role, authVersion: next.authVersion, state: next.active ? "active" : "inactive" };
  }
  if (!next || typeof next.licenceEndsAt !== "string" || !Number.isFinite(Date.parse(next.licenceEndsAt))
      || !["restaurant", "shop"].includes(next.businessType)) invalid("Provide the next canonical licence state.");
  return { licenceEndsAt: new Date(next.licenceEndsAt).toISOString(), businessType: next.businessType };
}
function actorId(operator) {
  if (!operator || operator.role !== "admin" || !operator.username || normalizeUsername(operator.username) !== operator.username
      || !["platform", "business"].includes(operator.productType)) {
    throw new ApiError(403, "ADMIN_REQUIRED", "An authenticated administrator is required.");
  }
  return `${operator.productType}:${operator.productType === "business" ? `${operator.storeId}:` : ""}${operator.username}`;
}
async function operatorGuards(env, operator, command, transition, target) {
  actorId(operator);
  if (operator.productType === "platform") return [];
  if (operator.storeId !== command.storeId || command.target === "licence") {
    throw new ApiError(403, "ADMIN_REQUIRED", "Only the platform administrator can change this authority.");
  }
  // A verified self-password-change request can finish the revocation it started.
  if (transition?.phase === "pending" && command.username === operator.username
      && transition.initiator === actorId(operator) && target?.value?.transitionId === command.requestId
      && validVersion(operator.authVersion)
      && [transition.previous?.authVersion, transition.next?.authVersion].includes(operator.authVersion)) {
    return [];
  }
  return (await requirePrivateRestaurantAuthority(env, operator, { admin: true })).guards;
}
function guard(record, collection, id) { return { collection, id, expectedRevision: record?.revision || 0 }; }
function uniqueGuards(guards) {
  const found = new Map();
  for (const entry of guards) {
    const key = `${entry.collection}/${entry.id}`;
    if (found.has(key) && found.get(key).expectedRevision !== entry.expectedRevision) conflict("Administrator authority changed.");
    found.set(key, entry);
  }
  return [...found.values()];
}
async function digest(value) {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(JSON.stringify(value)));
  return Array.from(new Uint8Array(bytes), byte => byte.toString(16).padStart(2, "0")).join("");
}
async function records(env, command) {
  if (env?.POS_PRIVATE_RESTAURANT_STATE !== "enabled") {
    throw new ApiError(503, "PRIVATE_RESTAURANT_DISABLED", "Private restaurant operations have not been activated.");
  }
  const targetId = command.target === "user" ? `user:${command.username}` : "store";
  const [store, target, operation] = await readPosAtomicRecords(env, command.storeId, [
    { collection: "authority", id: "store" },
    ...(targetId === "store" ? [] : [{ collection: "authority", id: targetId }]),
    { collection: "authority_transitions", id: command.requestId },
  ]).then(rows => targetId === "store" ? [rows[0], rows[0], rows[1]] : rows);
  if (!store || store.deleted || store.value?.schemaVersion !== 1 || store.value.storeId !== command.storeId
      || !store.value.migrationId) throw new ApiError(503, "PRIVATE_RESTAURANT_NOT_READY", "Private authority has not been initialized.");
  return { store, target, operation, targetId };
}
async function source(env, command) {
  const path = `projects/${command.storeId}/settings/${command.target === "user" ? "pos_users" : "pos"}`;
  const snapshot = await getFirestoreDocumentSnapshot(path);
  if (!snapshot?.updateTime) throw new ApiError(503, "AUTHORITY_SOURCE_UNAVAILABLE", "Cannot verify the administrative source.");
  if (command.target === "licence") {
    const value = snapshot.data;
    if (!Number.isFinite(Date.parse(value.warrantyEnd)) || !["restaurant", "shop"].includes(value.businessType)) {
      throw new ApiError(503, "AUTHORITY_SOURCE_UNAVAILABLE", "Cannot verify the licence source.");
    }
    return { path, snapshot, value: { licenceEndsAt: new Date(value.warrantyEnd).toISOString(), businessType: value.businessType } };
  }
  if (!Array.isArray(snapshot.data.users)) throw new ApiError(503, "AUTHORITY_SOURCE_UNAVAILABLE", "Cannot verify the account source.");
  const matches = snapshot.data.users.filter(user => normalizeUsername(user?.username) === command.username);
  if (matches.length > 1) conflict("Resolve duplicate account names before changing authority.");
  const user = matches[0];
  if (user && !["admin", "worker"].includes(user.role)) conflict("The source account has an invalid role.");
  return { path, snapshot, value: user ? {
    schemaVersion: 1, username: command.username, role: user.role,
    authVersion: await getPosUserAuthVersion(env.AUTH_SECRET, user), state: user.active === false ? "inactive" : "active",
  } : null };
}
function matchesSource(command, value, expected) {
  if (command.target === "user") {
    if (value === null || expected === null) return value === expected;
    return value.schemaVersion === expected.schemaVersion && value.username === expected.username
      && value.role === expected.role && value.authVersion === expected.authVersion && value.state === expected.state;
  }
  return !!expected && Number.isFinite(Date.parse(expected.licenceEndsAt))
    && value.licenceEndsAt === new Date(expected.licenceEndsAt).toISOString() && value.businessType === expected.businessType;
}
function assertOperation(command, operation) {
  const value = operation?.value;
  if (!value || operation.deleted || value.target !== command.target || value.username !== command.username) {
    conflict("The pending authority operation does not match.");
  }
  return value;
}

// Only verified admin handlers may call these. Apply the source change with the
// returned sourceRevision; never refresh its CAS while the transition is pending.
export async function beginPrivateAuthorityTransition(env, operator, input) {
  const command = normalizeCommand(input), next = nextValue(command, input.next), initiator = actorId(operator);
  const state = await records(env, command);
  const accessGuards = await operatorGuards(env, operator, command, state.operation?.value, state.target);
  const fingerprint = await digest({ command, next, initiator });
  if (state.operation) {
    const operation = assertOperation(command, state.operation);
    if (operation.fingerprint !== fingerprint) conflict("This operation ID already belongs to a different administrative change.");
    return { transitionId: command.requestId, phase: operation.phase, sourceRevision: operation.sourceRevision };
  }
  if (state.store.value.state !== "active" || state.target?.value?.transitionId) conflict("Complete the existing authority change first.");
  const currentSource = await source(env, command);
  const previous = state.target && !state.target.deleted ? state.target.value : null;
  if (!matchesSource(command, currentSource.value, previous)) conflict("Private and source authority differ; do not overwrite either.");
  const blocked = command.target === "user"
    ? { schemaVersion: 1, username: command.username, state: "blocked", transitionId: command.requestId }
    : { ...state.store.value, state: "blocked", transitionId: command.requestId };
  const operation = {
    ...command, next, previous, initiator, fingerprint, phase: "pending",
    sourceRevision: currentSource.snapshot.updateTime, createdAtIso: new Date().toISOString(),
  };
  return commitPosAtomic(env, {
    storeId: command.storeId, requestId: `authority-begin-${command.requestId}`, actor: initiator, fingerprint,
    guards: uniqueGuards([
      ...accessGuards, guard(state.store, "authority", "store"),
      guard(state.target, "authority", state.targetId), guard(null, "authority_transitions", command.requestId),
    ]),
    writes: [
      { ...guard(state.target, "authority", state.targetId), value: blocked },
      { ...guard(null, "authority_transitions", command.requestId), value: operation },
    ],
    result: { transitionId: command.requestId, phase: "pending", sourceRevision: operation.sourceRevision },
  });
}

async function finishTransition(env, operator, input, cancel) {
  const command = normalizeCommand(input), actor = actorId(operator);
  const state = await records(env, command), operation = assertOperation(command, state.operation);
  const accessGuards = await operatorGuards(env, operator, command, operation, state.target);
  const phase = cancel ? "cancelled" : "completed";
  if (operation.phase === phase) return { transitionId: command.requestId, phase };
  if (operation.phase !== "pending" || state.target?.value?.transitionId !== command.requestId) conflict("This authority operation is no longer pending.");
  let observed = await source(env, command);
  const expected = cancel ? operation.previous : operation.next;
  if (!matchesSource(command, observed.value, expected)) conflict("The source does not match the intended authority version.");
  if (cancel) {
    // Advancing the source CAS fences a delayed original write before restoring access.
    const patch = command.target === "user" ? { users: observed.snapshot.data.users } : {
      warrantyEnd: observed.snapshot.data.warrantyEnd, businessType: observed.snapshot.data.businessType,
    };
    await patchFirestoreDocumentAtUpdateTime(observed.path, patch, observed.snapshot.updateTime);
    const afterFence = await source(env, command);
    if (afterFence.snapshot.updateTime === observed.snapshot.updateTime || !matchesSource(command, afterFence.value, expected)) {
      conflict("The source changed while cancelling; access remains blocked.");
    }
    observed = afterFence;
  } else if (observed.snapshot.updateTime === operation.sourceRevision) {
    conflict("The source change has not been confirmed.");
  }
  const value = command.target === "licence"
    ? { ...(cancel ? operation.previous : state.target.value), ...expected, state: expected.businessType === "restaurant" ? "active" : "disabled" }
    : expected;
  if (value) delete value.transitionId;
  return commitPosAtomic(env, {
    storeId: command.storeId, requestId: `authority-${phase}-${command.requestId}`, actor,
    fingerprint: await digest({ phase, fingerprint: operation.fingerprint }),
    guards: uniqueGuards([
      ...accessGuards, guard(state.store, "authority", "store"),
      guard(state.target, "authority", state.targetId), guard(state.operation, "authority_transitions", command.requestId),
    ]),
    writes: [
      { ...guard(state.target, "authority", state.targetId), ...(value ? { value } : { deleted: true }) },
      { ...guard(state.operation, "authority_transitions", command.requestId), value: {
        ...operation, phase, finishedBy: actor, sourceFinalRevision: observed.snapshot.updateTime, finishedAtIso: new Date().toISOString(),
      } },
    ],
    result: { transitionId: command.requestId, phase },
  });
}
export function completePrivateAuthorityTransition(env, operator, input) { return finishTransition(env, operator, input, false); }
export function cancelPrivateAuthorityTransition(env, operator, input) { return finishTransition(env, operator, input, true); }
