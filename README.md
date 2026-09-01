# feedpatch
Drop a messy Shopify/Woo CSV. Download a GMC-ready TSV.

Live demo: https://feedpatch.vercel.app

## License keys

`FEEDPATCH-DEV` is the demo license key. Paste it in the tool to unlock paid exports when commerce env vars are not set (including production).

### Commerce env (Vercel)

- `POLAR_ORGANIZATION_ID` — when set, `/api/license` validates keys via Polar (`POST https://api.polar.sh/v1/customer-portal/license-keys/validate`).
- `POLAR_BENEFIT_ID` — optional; when set, a successful Polar key must also match this `benefit_id`.
- Gumroad (optional fallback / alternate): `GUMROAD_ACCESS_TOKEN`, `GUMROAD_PRODUCT_PERMALINK`, and/or `GUMROAD_PRODUCT_ID`.

When either Polar or Gumroad is configured, demo (`FEEDPATCH-DEV`) and signed FP1 keys are rejected. Verification order: Polar first (if configured), then Gumroad on Polar 404 if Gumroad is also configured.

See scripts/mint-license.mjs to print extra FP1 keys. Pass an optional nonce.
Usage: node scripts/mint-license.mjs
Usage: node scripts/mint-license.mjs shop-42
Commerce env present: demo and signed keys rejected.
package.json script name: mint-key
