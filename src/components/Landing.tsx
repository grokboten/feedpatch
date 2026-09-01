export function Landing() {
  return (
    <header className="border-b border-rule">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
        <a href="#tool" className="font-serif text-xl tracking-tight">
          FeedPatch
        </a>
        <nav className="flex items-center gap-4 text-sm">
          <a href="#who" className="text-slate hover:text-ink">
            Who it is for
          </a>
          <a href="#tool" className="rounded-full bg-ink px-3 py-1.5 text-paper">
            Open the tool
          </a>
        </nav>
      </div>

      <div className="mx-auto max-w-5xl px-4 pb-16 pt-10 sm:pt-16">
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-patch">
          One-time patch · $39 · not hosted
        </p>
        <h1 className="mt-3 max-w-3xl font-serif text-4xl leading-[1.1] sm:text-6xl">
          Excel turned your barcodes into 8.90E+12. Merchant Center will not forgive that.
        </h1>
        <p className="mt-6 max-w-2xl text-lg text-slate">
          Drop a messy Shopify, Woo, or Google Merchant Center CSV. FeedPatch repairs GTINs as
          text, writes prices like <code className="font-mono text-ink">19.99 USD</code>, and
          hands you a GMC-ready TSV plus a supplemental source Google will actually ingest.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <a
            href="#tool"
            className="rounded-full bg-patch px-5 py-2.5 text-sm font-medium text-paper"
          >
            Load the 40-row demo
          </a>
          <a
            href="https://buy.polar.sh/polar_cl_pMF8fjJvGT2GqhDNk89oahf68APOdTT2zfY7n0bzV4F"
            target="_blank"
            rel="noopener"
            className="rounded-full border border-ink px-5 py-2.5 text-sm"
          >
            $39 one-time
          </a>
        </div>
        <p className="mt-4 text-sm text-slate">
          Your file never leaves this browser. Papa Parse + SheetJS only. No LLM. We never invent
          GTINs.
        </p>
      </div>

      <section id="who" className="border-t border-rule">
        <div className="mx-auto grid max-w-5xl gap-8 px-4 py-12 sm:grid-cols-3">
          <div>
            <h2 className="font-serif text-2xl">Who it is for</h2>
            <p className="mt-3 text-sm leading-6 text-slate">
              Merchants who already export a product CSV from Shopify, WooCommerce, or Merchant
              Center and upload it themselves. Operators who are tired of “Needs attention” on
              identifiers, availability, and price format.
            </p>
          </div>
          <div>
            <h2 className="font-serif text-2xl">The Excel GTIN bug</h2>
            <p className="mt-3 text-sm leading-6 text-slate">
              Open a Shopify export in Excel and 13-digit barcodes become scientific notation.
              Leading zeros vanish. FeedPatch expands <code className="font-mono">8.90E+12</code>
              back to digits, pads zeros, and keeps the GS1 check digit — or leaves the original
              alone if the check cannot be proven.
            </p>
          </div>
          <div id="price">
            <h2 className="font-serif text-2xl">$39, once</h2>
            <p className="mt-3 text-sm leading-6 text-slate">
              A license later on Polar (or Gumroad) unlocks the full primary TSV, a supplemental
              TSV (id + changed columns only), an action workbook, a Meta catalog CSV, and the last
              10 runs in localStorage. Not a Shopify app. Not a monthly feed host. No OAuth. On
              this live demo, enter <code className="font-mono">FEEDPATCH-DEV</code> in the license
              box to unlock paid exports (rejected once Polar/Gumroad verification is wired).
            </p>
          </div>
        </div>
      </section>
    </header>
  );
}
