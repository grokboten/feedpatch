# feedpatch
Drop a messy Shopify/Woo CSV. Download a GMC-ready TSV.

Live demo: https://feedpatch.vercel.app

## License keys

`FEEDPATCH-DEV` is the demo license key. Paste it in the tool to unlock paid exports when Gumroad env vars are not set (including production).

See scripts/mint-license.mjs to print extra FP1 keys. Pass an optional nonce.
Usage: node scripts/mint-license.mjs
Usage: node scripts/mint-license.mjs shop-42
Gumroad env present: demo and signed keys rejected.
package.json script name: mint-key
