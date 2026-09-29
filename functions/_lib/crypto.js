import {
  PASSWORD_DERIVED_BITS,
  PASSWORD_ITERATIONS,
  SESSION_COOKIE_NAME,
  SESSION_TTL_SECONDS,
} from "./constants.js";

const textEncoder = new TextEncoder();

function toHex(bytes) {
  let out = "";
  for (const byte of bytes) {
    out += byte.toString(16).padStart(2, "0");
  }
  return out;
}

function fromBase64Url(base64url) {
  const padding = "=".repeat((4 - (base64url.length % 4 || 4)) % 4);
  const base64 = base64url.replace(/-/g, "+").replace(/_/g, "/") + padding;
  const bin = atob(base64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) {
    bytes[i] = bin.charCodeAt(i);
  }
  return bytes;
}

function toBase64Url(bytes) {
  let bin = "";
  for (const byte of bytes) {
    bin += String.fromCharCode(byte);
  }
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

async function sha256Bytes(data) {
  const bytes = typeof data === "string" ? textEncoder.encode(data) : data;
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return new Uint8Array(digest);
}

export async function sha256Hex(data) {
  return toHex(await sha256Bytes(data));
}

export async function hmacSha256Hex(secret, message) {
  const key = await crypto.subtle.importKey(
    "raw",
    textEncoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", key, textEncoder.encode(message));
  return toHex(new Uint8Array(signature));
}

async function derivePasswordHash(password, saltBytes, iterations) {
  const key = await crypto.subtle.importKey(
    "raw",
    textEncoder.encode(password),
    "PBKDF2",
    false,
    ["deriveBits"]
  );
  const bits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      hash: "SHA-256",
      salt: saltBytes,
      iterations,
    },
    key,
    PASSWORD_DERIVED_BITS
  );
  return new Uint8Array(bits);
}

export async function createPasswordRecord(password, iterations = PASSWORD_ITERATIONS) {
  const saltBytes = crypto.getRandomValues(new Uint8Array(16));
  const hashBytes = await derivePasswordHash(password, saltBytes, iterations);
  return {
    salt: toBase64Url(saltBytes),
    hash: toBase64Url(hashBytes),
    iterations,
  };
}

function timingSafeEqualBytes(a, b) {
  if (a.length !== b.length) {
    return false;
  }
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) {
    diff |= a[i] ^ b[i];
  }
  return diff === 0;
}

export async function verifyPassword(password, record) {
  const iterations = Number(record.iterations) || PASSWORD_ITERATIONS;
  const saltBytes = fromBase64Url(record.salt);
  const expectedHash = fromBase64Url(record.hash);
  const actualHash = await derivePasswordHash(password, saltBytes, iterations);
  return timingSafeEqualBytes(expectedHash, actualHash);
}

export function createSessionToken() {
  const tokenBytes = crypto.getRandomValues(new Uint8Array(32));
  return toBase64Url(tokenBytes);
}

export function setSessionCookie(token) {
  return `${SESSION_COOKIE_NAME}=${token}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${SESSION_TTL_SECONDS}`;
}

export function clearSessionCookie() {
  return `${SESSION_COOKIE_NAME}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`;
}
