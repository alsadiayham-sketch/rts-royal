import { hmacSha256Hex } from "./crypto.js";
import { ApiError } from "./http.js";

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
  for (let index = 0; index < left.length; index += 1) difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  return difference === 0;
}

export async function createOwnerSessionToken(secret, claims) {
  const encodedClaims = toBase64Url(JSON.stringify(claims));
  return `${encodedClaims}.${await hmacSha256Hex(secret, encodedClaims)}`;
}

export async function requireOwnerSession(request, secret) {
  const value = request.headers.get("Authorization") || "";
  const token = value.replace(/^Bearer\s+/i, "").trim();
  const [encodedClaims, signature, ...extra] = token.split(".");
  if (!encodedClaims || !signature || extra.length > 0) {
    throw new ApiError(401, "OWNER_AUTH_REQUIRED", "Owner authentication is required.");
  }
  const expectedSignature = await hmacSha256Hex(secret, encodedClaims);
  if (!timingSafeEqual(signature, expectedSignature)) {
    throw new ApiError(401, "OWNER_AUTH_REQUIRED", "Owner authentication is required.");
  }

  let claims;
  try {
    claims = JSON.parse(fromBase64Url(encodedClaims));
  } catch {
    throw new ApiError(401, "OWNER_AUTH_REQUIRED", "Owner authentication is required.");
  }
  if (
    !claims ||
    (claims.mode !== "business" && claims.mode !== "clinic") ||
    typeof claims.organizationId !== "string" ||
    typeof claims.ownerUsername !== "string" ||
    !Number.isInteger(claims.passwordVersion) ||
    claims.passwordVersion < 1 ||
    !Number.isInteger(claims.exp) ||
    claims.exp <= Math.floor(Date.now() / 1000)
  ) {
    throw new ApiError(401, "OWNER_AUTH_REQUIRED", "Owner authentication is required.");
  }
  return claims;
}
