# RTS - Royal Technology Solutions

Arabic-first, bilingual company website for web development, desktop applications,
iOS and Android development, and point of sale.

- Website: https://rts-royal.pages.dev
- Administration: https://rts-royal.pages.dev/admin/
- Windows download: https://rts-royal.pages.dev/download-business/

## Administration

Sign in at `/admin/`. **Business Settings** changes the public WhatsApp number
and approved POS release link. **Credits** manages the platform message balance,
per-message customer price/cost defaults, organization allocations, delivery
usage, the audit ledger, and credit analytics. **Admins** adds administrators and activates or
deactivates accounts. **My Password** changes the current user's password and
invalidates their existing sessions.

Administrators have equal management rights. An administrator cannot deactivate
their own account or the last active administrator. Initial-password warnings
remain visible until the password is changed. New passwords require 12-128
characters. Use a password manager and unique passwords.

Creating an RTS Business store or RTS Clinic atomically writes its licence,
hashed owner account, and typed registry entry. It also initializes the D1
credit account; if registry creation fails, that new D1 record is removed.
New Firestore-backed Business stores additionally declare RTS server authentication
(`authBackend: "rts"`, `authContractVersion: 1`, and
`authApiBaseUrl: "https://rts-royal.pages.dev"`). Business 4.0.10+ uses that
server to verify passwords without rerouting the store's data to D1. Existing
Firestore stores need these fields enabled on their licence by an administrator;
never switch `dataBackend` merely to bypass a login guard. Owner passwords are
unchanged by this configuration.

RTS Admin selects **Shop** or **Restaurant / Cafe** when creating a Business
tenant, and can change it in the Business stores table. This writes only
`businessType: "shop" | "restaurant"` on the tenant licence; it does not change
`productType`, storage routing, passwords, or existing transactions. Business
4.0.11+ gives this central selection precedence over legacy local restaurant
flags. Unconfigured legacy tenants remain unconfigured until explicitly saved.
Menu sections and items are managed by the restaurant administrator inside
Business, not by switching the business type in the desktop add-ons screen.

The primary owner account is linked to the RTS Tracking API at
`/owner/login` and `/owner/dashboard`; configure the Tracking app with this
site as its HTTPS API base URL.

`GET /owner/dashboard?mode=business|clinic` returns contract version 2 while
retaining the original `mode`, `metrics`, `sites`, `alerts`, and
`synchronizedLabel` fields used by current Tracking releases. New clients can
also consume `overview`, `locations`, `recentActivity`, the partial
privacy-safe `auditLog`, `financialMetrics`, `operationalMetrics`,
`modeDetail`, and `dataAvailability`.

The endpoint has authoritative licence, aggregate staff-account, RTS platform
messaging-credit data, and the latest privacy-safe source snapshot when one has
been published. Missing Business or Clinic fields remain explicitly unavailable.
Tracking never returns clinic patient identities, medical details, attachments,
raw audit entries, or unnecessary staff PII.

`POST /api/owner-telemetry` accepts the existing `/api/pos-login` bearer token.
Tenant and product identity come only from the signed token. The JSON body is
limited to 4 KiB and exactly `generatedAt`, `appVersion`, `metrics`, and
`eventCounters`. Metrics are fixed, product-specific numeric/boolean aggregates;
event counters are fixed non-negative integer keys. Snapshots older than 15
minutes are rejected. The endpoint never accepts customer/patient identities,
medical data, product names, bill IDs, notes, or raw audit records. It stores
only the latest snapshot under the tenant licence `telemetry` field using a
Firestore update-time precondition.

Common metrics: `terminalCount`, `activeTerminalCount`, `pendingSyncCount`,
`failedSyncCount`, `databaseHealthy`, `syncHealthy`, and `backupHealthy`.
Business adds `salesToday`, `ordersToday`, `averageOrderValue`,
`lowStockItems`, `inventoryValue`, `returnsToday`, and `refundsToday`. Clinic
adds `appointmentsToday`, `waitingCount`, `completedSessionsToday`,
`followUpsDue`, `collectionsToday`, and `outstandingInsurance`. Accepted event
counters are common audit/login/sync/backup counters plus fixed Business
sale/return/inventory or Clinic appointment/session/payment/follow-up counters.

The public enquiry form opens WhatsApp with an editable message; it does not
send messages automatically or store enquiries in D1.

## Development

Requires Node.js 24 or later.

```powershell
npm ci
npm run build:jahiz
npx wrangler d1 execute rts-royal-db --local --file schema.sql
npx wrangler d1 execute rts-royal-db --local --file migrations/0005_jahiz.sql
npm run dev
```

Provide a local-only `AUTH_SECRET` binding through an ignored `.dev.vars` file
or the Wrangler CLI for authenticated development. Never use production credentials
for local fixtures. `npm test` runs Node's built-in tests.

## Deployment

Cloudflare Pages serves only `public/` and bundles `functions/` separately.
`DB` is bound to the D1 database in `wrangler.toml`. `AUTH_SECRET` is a private
Cloudflare Pages binding used for privacy-preserving request throttling.

The GitHub Actions workflow deploys `main` after the tests and idempotent schema
initialization. GitHub repository secrets `CLOUDFLARE_API_TOKEN` and
`CLOUDFLARE_ACCOUNT_ID` supply deployment authorization. Keep account credentials,
passwords, database exports, and `.wrangler/` out of source control.

## Product and assets

### Jahiz | جاهز

Jahiz is the bilingual restaurant/cafe order-readiness product at `/jahiz/`.
Public applications are submitted at `/jahiz/signup/`; platform administrators
approve them or create venues directly in the **Jahiz** tab at `/admin/`.
Each venue has a separate owner login at `/jahiz/login/?shop=SLUG` and customer
QR destination at `/jahiz/s/?shop=SLUG`. Owner/staff cookies and accounts are
separate from RTS administrator credentials, and all operations are tenant-scoped.

Owners manage orders, staff, branding, and an allowlisted drag-and-drop block
layout. The tracking block cannot be removed. The page designer includes live
native previews, backgrounds, readable content surfaces, layout/spacing controls,
icons, and versioned JSON template import/export. Raster uploads support PNG,
JPEG, and WebP; raw SVG uploads are not accepted.

Owners can also upload HTML with embedded CSS, optionally adding a separate CSS
file. Uploaded designs are sanitized server-side and shown in a sandboxed section;
scripts, forms, embedded frames, navigation, and external stylesheets are not
supported. The real tracking form remains outside this section. Uploaded HTML
previews update after saving; native block changes preview immediately. The public
HTML endpoint serves only active venues and uses an independent restrictive CSP,
including sandboxing even if someone opens the endpoint directly. Existing saved
branding remains compatible; these settings use the existing JSON column.
Published HTML/CSS is publicly viewable like any webpage source; never upload
credentials, private customer data, or other secrets in a template.

QR generation runs locally using the bundled `qrcode` library; PNG/SVG
export and printing do not send venue URLs to an external QR service. All QR
variants encode a full HTTPS customer URL, not a relative path. Posters or images
exported before this fix must be downloaded/printed again; an existing printed QR
cannot be changed remotely. Rebuild
`public/jahiz/vendor/` with `npm run build:jahiz`; the dependency license ships
beside the bundle. HTTPS images are allowed only by the scoped Jahiz page CSP.

Customers enter a receipt number and the random pickup code supplied by staff,
or open a private order link. Receipt numbers alone cannot unlock tracking.
Private links carry their code in a URL fragment, not a server-visible query,
and the customer page removes the fragment after reading it. Staff should share
these codes only with the matching customer.
Customers leave the tracking page open. Updates poll
every five seconds; sound requires a user gesture and device support. Background
or closed-tab alerts are **not guaranteed**, including on iPhones. This release
does not include Web Push, SMS, automatic POS import, or payment-provider checkout.
The platform supports manual subscription plans/payments. Online checkout stays
explicitly disabled until a real provider is configured and integrated.
JOD amounts use three decimal places; ILS/USD use two. Fictional demo venues are
free and isolated; their credentials must never be committed or published.

Apply the additive `migrations/0005_jahiz.sql` to D1 before deploying Jahiz.
The production workflow applies it after the existing base schema. Existing RTS
data is not replaced. Deployment credentials and generated demo passwords stay
outside `public/` and source control.

The website showcases the real **RTS Business 4.0** Windows application. Public
screenshots avoid customer/store identifiers, and the release download is restricted
to the approved RTS installer in the compatibility release repository.
The separate interactive sector demo is illustrative and never takes payments.

Fonts are locally hosted Manrope and Noto Sans Arabic, with their OFL license
files in `public/assets/`. The angular R mark is derived from the supplied RTS logo.
