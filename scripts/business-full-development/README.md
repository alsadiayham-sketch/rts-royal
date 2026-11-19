# Business renderer development preview

From the Royal repository, run `node scripts\business-full-development-build.mjs`.
The sibling `Downloads\rts-business` checkout is the default source; `RTS_BUSINESS_SOURCE`
can select another local checkout. Output is always the ignored
`test-results\business-full-development` directory, never `public`.

This is an isolated, fixture-only feasibility build, not a POS or release artifact.
Use store `fixture`, username `preview`, password `preview`. All database writes,
shared restaurant routes, real authentication and network access fail closed.
It does not include Firebase configuration or credentials. Its CSP permits
neither inline scripts/styles nor eval. A build transform routes existing
click/image-error attributes through an explicit action allowlist; static and
dynamic styles are applied with CSSOM. Unknown event
types or action names stop the build. Unknown or malformed expressions fail closed.
Legacy single-quoted arguments containing an apostrophe or backslash are rejected;
JSON-quoted held-order identifiers are supported. A production port still needs
a separate untrusted-HTML/injection audit and an origin-specific network policy.

The browser printer adapter converts receipt HTML to text and requests the system
print dialog. Printing and sharing are not verified on Android. Thermal printing,
cash drawers, file operations, image editing, legacy-ticket hashing/import and secure
business routes remain unimplemented. Image dimension parsing now uses the bundled
existing `image-size` module, but full image selection/upload is not verified. This
does not replace the existing mobile POS.

For the network-blocked Electron smoke test, build first and run
`tests\electron\business-full-development.cjs` with the installed Business Electron.
