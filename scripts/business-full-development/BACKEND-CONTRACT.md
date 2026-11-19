# Backend adapter requirements for the full Business renderer

This is an integration contract, not a claim that the proposed endpoints exist.
The preview's facade deliberately rejects all writes and real authentication.
Do not connect it to public Firestore or forward generic client write/transaction
objects. All tenant identity, roles, licensing, price, totals and timestamps must
be resolved or validated server-side; never expose credential hashes.

## Session and existing routes

* `POST /api/pos-login` takes `{storeId,username,password}` and returns
  `{token,user:{username,name,role},productType:"business",store:{id,...}}`.
  The token remains memory-only, is sent as `Authorization: Bearer …`, and is
  dropped on logout/account switch. Reject redirects and stale-session results.
* The desktop renderer calls `db.collection("settings").doc("pos").get()` **before**
  login. A browser implementation needs either a rate-limited, redacted bootstrap
  contract (business type and authentication capability only; no secrets), or a
  build adaptation that authenticates before reading settings. License validity
  must be enforced at login and every protected operation, not trusted to that
  pre-login document. `lastChecked` must be a server-side audit, not a client write.
* Existing bearer routes include `/api/pos-employees` (GET/POST/PATCH/DELETE),
  `/api/pos-supplies` (GET/POST), `/api/pos-shared-config`,
  `/api/pos-restaurant-tables` and `/api/pos-mobile-orders` (GET/POST).
  Preserve their current role, request-id, revision and retry contracts.
  Shared holds now include `{discount:{type:"fixed"|"percent",value},offerId}`
  where omitted existing fields are preserved and `offerId:null` clears it.
  Quote/checkout use server prices/tax and the offer replaces manual discount.
  This browser preview does not invoke any of those routes.

## Read facade required by existing views

The renderer expects `collection(name).limit(n).orderBy(field,direction).get()`,
`collection(name).onSnapshot(next,error)` with an unsubscribe function, and
`collection(name).doc(id).get({source:"server"})`. Query snapshots have
`{docs,empty,size,forEach(callback)}`; documents have `{id,exists,data()}`.
Dates used by renderers must either retain compatible `.toDate()` / `.toMillis()`
wrappers or be consistently adapted to ISO values.

A proposed authenticated, tenant-derived read API must provide:

* Collection list `{documents:[{id,data,revision}],cursor}` with bounded pages,
  stable continuation and server-defined filtering/order/limit; document read
  `{id,exists,data,revision}`. The facade must drain pages for current full-list
  views or explicitly signal truncation; never treat an incomplete page as all
  products, orders or financial records.
* A change feed or bounded polling with revision/change detection, unsubscribe,
  session-generation cancellation and a full refresh on reconnect. Polling alone
  must not be presented as a transactional snapshot across collections.
* `settings/pos`: authorized license/business-mode/capability data only.
  `products`: product/menu fields, variant IDs/colors/sizes/prices/stocks/images,
  barcode/category data and admin-only costs as required by the existing views.
  Current `/api/pos-mobile` is a reduced read-only catalog, rejects D1 and does
  not satisfy this full product contract.
* `orders`: role-filtered bills and typed records used by the renderer:
  customer/loyalty/store-credit, debts and payments, cash deposits/withdrawals,
  register, returns/exchanges, suppliers/purchase orders, stocktake, hookah,
  restaurant offers/employees/attendance and configuration. Sensitive customer
  data, held orders, private receipts and historic costs need private authenticated
  views. Shared receipts use `GET /api/pos-mobile-orders?receiptId=<holdId>` and
  admin-only `includeCost=1`; missing historical costs remain unknown, not current
  product costs. Public bill references are not a substitute for private data.
* `pos_damage` and `pos_logs`: scoped bounded list, ordering and authorized
  audit/history views. Preserve `limit` and descending `createdAt` behavior.

## Mutation/transaction contracts still needed

Existing desktop calls include `doc.set`, `doc.update`, `collection.add`,
`rawDb.runTransaction` and `batch`, including product/stock changes and financial
records. A browser adapter must map these to **specific authenticated domain
commands**, not accept arbitrary Firestore paths or client-supplied transactions:

* Product/menu create/edit, variant/portion management, inventory adjustments,
  damage, stocktake/import and supplier purchase orders; consistent stock CAS,
  non-negative quantities, audit identity and retry-safe request IDs.
* Checkout for restaurant and retail/D1 including customer identity, discounts,
  offers, loyalty earn/redemption/prizes, store credit, debt and split settlement.
  Atomic stock, totals, balance/benefit updates and immutable receipt creation;
  verify the current user/license and all relevant source revisions in the commit.
* Return/exchange/refund: original receipt and already-returned quantity checks,
  refund/credit/debt policy, stock deltas and accounting record as one idempotent
  transaction. Existing renderer separately changes stock and writes a record;
  translating those calls one-by-one is not sufficient.
* Customer create/edit, loyalty/credit ledgers, debt payments, cash drawer and
  shift close, restaurant records/attendance/offers, configuration and audit.
  Concurrency/version conflicts must fail visibly; retry the identical request ID
  after uncertain responses. Preserve original audit actors and historical values.
* Uploads: scoped authenticated file create/read/delete or short-lived authorized
  delivery, type/size checks and private authorization. Existing
  `storage.ref().child(path).put(file,metadata)` and later URL handling cannot
  safely become public object URLs, especially for medical attachments.

Existing legacy D1 mappings (`/api/products`, `/api/orders`, `/api/pos`,
`/api/pos-damage`, `/api/pos-stock`) are tenant-specific contracts, not proof of
equivalent secure operations for every store. Browser cross-origin CORS/redirect
rules and D1 coverage need explicit implementation and testing. Messaging uses
`/api/messaging/{status,audience-preview,credit-requests,messages,pricing}` with
existing idempotency headers; owner telemetry uses `/api/owner-telemetry`.

## Device and UI boundaries

The current preview bundles image-dimension parsing and existing browser file input,
but does not prove complete image editing/upload or import/export. Electron's
synchronous file save cannot be emulated honestly by an asynchronous browser
picker without adapting its call sites. Preview printing requests the system dialog
using text-only receipt data; no Android print completion confirmation, thermal
printer, cash drawer or working receipt-share UI is verified. Full mobile layout,
navigation, accessibility and CSP/untrusted-markup security review remain required.
