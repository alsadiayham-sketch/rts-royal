# RTS - Royal Technology Solutions

Arabic-first, bilingual company website for web development, desktop applications,
iOS and Android development, and point of sale.

- Website: https://rts-royal.pages.dev
- Administration: https://rts-royal.pages.dev/admin/
- Windows download: https://rts-royal.pages.dev/download-business/

## Administration

Sign in at `/admin/`. **Business Settings** changes the public WhatsApp number
and approved POS release link. **Admins** adds administrators and activates or
deactivates accounts. **My Password** changes the current user's password and
invalidates their existing sessions.

Administrators have equal management rights. An administrator cannot deactivate
their own account or the last active administrator. Initial-password warnings
remain visible until the password is changed. New passwords require 12-128
characters. Use a password manager and unique passwords.

The public enquiry form opens WhatsApp with an editable message; it does not
send messages automatically or store enquiries in D1.

## Development

Requires Node.js 22 or later.

```powershell
npm ci
npx wrangler d1 execute rts-royal-db --local --file schema.sql
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

The website showcases the real **RTS Business 4.0** Windows application. Public
screenshots avoid customer/store identifiers, and the release download is restricted
to the approved RTS installer in the compatibility release repository.
The separate interactive sector demo is illustrative and never takes payments.

Fonts are locally hosted Manrope and Noto Sans Arabic, with their OFL license
files in `public/assets/`. The angular R mark is derived from the supplied RTS logo.
