import { ApiError } from "./http.js";

const FIREBASE_PROJECT_ID = "dimaboutique-b4f16";
const FIREBASE_WEB_API_KEY = "AIzaSyAp3mDn6c5D3GKIV7BZ2aKIsm7MxYP0vG0";
const FIRESTORE_ROOT =
  `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents`;

export function firestoreTimestamp(value) {
  return { __firestoreTimestamp: value };
}

function encodeValue(value) {
  if (value?.__firestoreTimestamp) {
    return { timestampValue: value.__firestoreTimestamp };
  }
  if (value === null || value === undefined) return { nullValue: null };
  if (Array.isArray(value)) return { arrayValue: { values: value.map(encodeValue) } };
  if (typeof value === "boolean") return { booleanValue: value };
  if (typeof value === "number") {
    return Number.isInteger(value) ? { integerValue: String(value) } : { doubleValue: value };
  }
  if (typeof value === "object") {
    return {
      mapValue: {
        fields: Object.fromEntries(Object.entries(value).map(([key, item]) => [key, encodeValue(item)])),
      },
    };
  }
  return { stringValue: String(value) };
}

function decodeValue(value = {}) {
  if (Object.hasOwn(value, "nullValue")) return null;
  if (Object.hasOwn(value, "stringValue")) return value.stringValue;
  if (Object.hasOwn(value, "integerValue")) return Number(value.integerValue);
  if (Object.hasOwn(value, "doubleValue")) return Number(value.doubleValue);
  if (Object.hasOwn(value, "booleanValue")) return Boolean(value.booleanValue);
  if (Object.hasOwn(value, "timestampValue")) return value.timestampValue;
  if (value.arrayValue) return (value.arrayValue.values ?? []).map(decodeValue);
  if (value.mapValue) return decodeFields(value.mapValue.fields);
  return null;
}

function decodeFields(fields = {}) {
  return Object.fromEntries(Object.entries(fields).map(([key, value]) => [key, decodeValue(value)]));
}

async function firestoreRequest(path, options = {}) {
  const url = new URL(`${FIRESTORE_ROOT}/${path}`);
  url.searchParams.set("key", FIREBASE_WEB_API_KEY);
  for (const field of options.updateMask ?? []) {
    url.searchParams.append("updateMask.fieldPaths", field);
  }
  let response;
  try {
    response = await fetch(url, {
      method: options.method ?? "GET",
      headers: options.body ? { "Content-Type": "application/json" } : undefined,
      body: options.body ? JSON.stringify(options.body) : undefined,
    });
  } catch {
    throw new ApiError(502, "POS_REGISTRY_UNAVAILABLE", "POS store registry is unavailable.");
  }

  if (response.status === 404 && options.allowMissing) return null;
  if (!response.ok) {
    throw new ApiError(502, "POS_REGISTRY_UNAVAILABLE", "POS store registry request failed.");
  }
  return response.json();
}

export async function getFirestoreDocument(path) {
  const document = await firestoreRequest(path, { allowMissing: true });
  return document ? decodeFields(document.fields) : null;
}

export async function setFirestoreDocument(path, data) {
  const fields = Object.fromEntries(Object.entries(data).map(([key, value]) => [key, encodeValue(value)]));
  const document = await firestoreRequest(path, {
    method: "PATCH",
    body: { fields },
  });
  return decodeFields(document.fields);
}

export async function patchFirestoreDocument(path, data) {
  const fields = Object.fromEntries(Object.entries(data).map(([key, value]) => [key, encodeValue(value)]));
  const document = await firestoreRequest(path, {
    method: "PATCH",
    updateMask: Object.keys(data),
    body: { fields },
  });
  return decodeFields(document.fields);
}
