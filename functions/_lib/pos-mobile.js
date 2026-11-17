import { getFirestoreDocument, listFirestoreDocuments } from "./firestore.js";
import { ApiError, jsonResponse, withApiGuard } from "./http.js";
import { getPosUserAuthVersion, requirePosSession } from "./pos-session.js";
import { normalizeUsername } from "./validation.js";
import { getPosStoreMode } from "./pos-store-mode.js";

export async function requireMobileSession(context) {
  const session = await requirePosSession(context.request, context.env.AUTH_SECRET);
  if (session.productType !== "business") {
    throw new ApiError(403, "POS_PRODUCT_MISMATCH", "This app is for RTS Business.");
  }
  const root = `projects/${session.storeId}`;
  const [registry, licence, users] = await Promise.all([
    getFirestoreDocument("projects/_global/settings/pos_stores"),
    getFirestoreDocument(`${root}/settings/pos`),
    getFirestoreDocument(`${root}/settings/pos_users`),
  ]);
  const store = registry?.stores?.find((item) => item?.id === session.storeId);
  const matches = (Array.isArray(users?.users) ? users.users : [])
    .filter((user) => normalizeUsername(user.username) === session.username);
  const user = matches.length === 1 ? matches[0] : null;
  if (!store || getPosStoreMode(store) !== "business" || !user || user.active === false || !session.authVersion
      || user.role !== session.role
      || session.authVersion !== await getPosUserAuthVersion(context.env.AUTH_SECRET, user)) {
    throw new ApiError(401, "POS_AUTH_REQUIRED", "Your account changed. Sign in again.");
  }
  if (!(new Date(licence?.warrantyEnd).getTime() > Date.now())) {
    throw new ApiError(403, "LICENCE_EXPIRED", "This tenant licence is inactive.");
  }
  if (licence?.dataBackend === "d1" || store.type === "d1") {
    throw new ApiError(409, "BACKEND_UNSUPPORTED", "This tenant uses a different data backend.");
  }
  return { session, licence };
}

function publicProduct(doc) {
  const p = doc.data || {};
  return {
    id: doc.id,
    name: String(p.name || "").slice(0, 200),
    category: String(p.category || p.type || "").slice(0, 100),
    variants: (Array.isArray(p.variants) ? p.variants : []).slice(0, 100).map((variant) => ({
      color: String(variant.color || "").slice(0, 100),
      size: String(variant.size || "").slice(0, 100),
      price: Number.isFinite(Number(variant.price)) ? Number(variant.price) : null,
      stock: Number.isFinite(Number(variant.stock)) ? Number(variant.stock) : null,
    })),
  };
}

export async function onRequestGet(context) {
  return withApiGuard(context, async () => {
    const { session, licence } = await requireMobileSession(context);
    const cursor = new URL(context.request.url).searchParams.get("cursor") || "";
    if (cursor.length > 2000) throw new ApiError(400, "INVALID_CURSOR", "Invalid product cursor.");
    const page = await listFirestoreDocuments(`projects/${session.storeId}/products`, {
      pageSize: 100,
      pageToken: cursor,
    });
    return jsonResponse({
      products: page.documents.map(publicProduct),
      cursor: page.nextPageToken || null,
      businessType: licence?.businessType || null,
      capabilities: { checkout: false, syncedTables: false, notifications: false },
    });
  });
}
