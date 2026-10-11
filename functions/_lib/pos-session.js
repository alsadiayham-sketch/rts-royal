import { hmacSha256Hex } from "./crypto.js";
import { ApiError } from "./http.js";
import { normalizeStoreId } from "./pos-store-validation.js";
import { normalizeUsername } from "./validation.js";

function toBase64Url(value) {
  return btoa(value).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function fromBase64Url(value) {
  const padding = "=".repeat((4 - (value.length % 4 || 4)) % 4);
  return atob(value.replace(/-/g, "+").replace(/_/g, "/") + padding);
}

function timingSafeEqual(left, right) {
  if (typeof left !== "string" || typeof right !== "string" || left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) {
    difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return difference === 0;
}

function authFailure() {
  return new ApiError(401, "POS_AUTH_REQUIRED", "POS authentication is required.");
}

export async function createPosSessionToken(secret, claims) {
  const encodedClaims = toBase64Url(JSON.stringify(claims));
  const signature = await hmacSha256Hex(secret, encodedClaims);
  return `${encodedClaims}.${signature}`;
}

export async function requirePosSession(request, secret) {
  const authorization = request.headers.get("Authorization") || "";
  const match = authorization.match(/^Bearer\s+([^\s]+)$/i);
  if (!match) throw authFailure();

  const [encodedClaims, signature, ...extra] = match[1].split(".");
  if (!encodedClaims || !signature || extra.length > 0 || !/^[a-f0-9]{64}$/.test(signature)) {
    throw authFailure();
  }

  const expectedSignature = await hmacSha256Hex(secret, encodedClaims);
  if (!timingSafeEqual(signature, expectedSignature)) throw authFailure();

  let claims;
  try {
    claims = JSON.parse(fromBase64Url(encodedClaims));
  } catch {
    throw authFailure();
  }

  if (
    !claims
    || typeof claims !== "object"
    || Array.isArray(claims)
    || normalizeStoreId(claims.storeId) !== claims.storeId
    || normalizeUsername(claims.username) !== claims.username
    || (claims.role !== "admin" && claims.role !== "worker")
    || (claims.productType !== "business" && claims.productType !== "clinic")
    || !Number.isInteger(claims.exp)
    || claims.exp <= Math.floor(Date.now() / 1000)
  ) {
    throw authFailure();
  }

  return {
    storeId: claims.storeId,
    username: claims.username,
    role: claims.role,
    productType: claims.productType,
    exp: claims.exp,
  };
}
