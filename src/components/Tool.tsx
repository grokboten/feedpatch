"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { autoMapColumns, detectSource } from "@/lib/columns";
import {
  DOWNLOAD_NAMES,
  MERCHANT_CENTER_NOTE,
  actionPlanXlsx,
  collectActionIssues,
  csvBlob,
  downloadBlob,
  freeWatermarkedTsv,
  itemsToSupplementalTsv,
  primaryTsvPayload,
  metaCatalogCsv,
  scoreSummary,
  tsvBlob,
} from "@/lib/export";
import {
  clearStoredLicense,
  loadRuns,
  loadStoredLicense,
  saveRun,
  saveStoredLicense,
  type RunSnapshot,
} from "@/lib/history";
import { parseFile, parseSampleCsv } from "@/lib/parse";
import { runPipeline } from "@/lib/pipeline";
import {
  DEFAULT_FIXES,
  DEV_LICENSE_KEY,
  FREE_ACTION_ISSUES,
  FREE_EXPORT_ROWS,
  FREE_SCORED_ROWS,
  GMC_FIELDS,
  type ColumnMapping,
  type FixToggles,
  type GmcField,
  type ParsedFeed,
} from "@/lib/types";
import { FeedTable } from "./FeedTable";

export function Tool() {
  const [feed, setFeed] = useState<ParsedFeed | null>(null);
  const [mapping, setMapping] = useState<ColumnMapping>({});
  const [toggles, setToggles] = useState<FixToggles>(DEFAULT_FIXES);
  const [paid, setPaid] = useState(false);
  const [licenseInput, setLicenseInput] = useState("");
  const [licenseMsg, setLicenseMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [successFile, setSuccessFile] = useState("");
  const [history, setHistory] = useState<RunSnapshot[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const lastSaved = useRef("");

  const source = feed ? detectSource(feed.headers) : "unknown";
  const rows = useMemo(() => {
    if (!feed) return [];
    return runPipeline(feed, mapping, toggles, { paid });
  }, [feed, mapping, toggles, paid]);
  const summary = useMemo(() => scoreSummary(rows), [rows]);

  useEffect(() => {
    setHistory(loadRuns());
    const stored = loadStoredLicense();
    if (stored) {
      setLicenseInput(stored);
      void unlock(stored, false);
    }
  }, []);

  const ingest = useCallback(async (file: File | "sample") => {
    setBusy(true);
    setError("");
    setSuccess(false);
    setSuccessFile("");
    try {
      const parsed = file === "sample" ? await parseSampleCsv() : await parseFile(file);
      if (!parsed.rows.length) {
        setError("No rows found in that file.");
        setBusy(false);
        return;
      }
      setFeed(parsed);
      setMapping(autoMapColumns(parsed.headers));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not parse file");
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    if (!feed || !paid || !rows.length) return;
    const id = `${feed.fileName}:${feed.rows.length}`;
    if (lastSaved.current === id) return;
    lastSaved.current = id;
    setHistory(
      saveRun({
        at: Date.now(),
        fileName: feed.fileName,
        rowCount: rows.length,
        scored: rows.filter((r) => r.status !== "unscored").length,
        errors: summary.errors,
        warnings: summary.warnings,
        green: summary.green,
        paid,
      }),
    );
  }, [feed, rows, summary, paid]);

  async function unlock(key: string, persist = true) {
    setLicenseMsg("");
    try {
      const res = await fetch("/api/license", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string; source?: string };
      if (data.ok) {
        setPaid(true);
        if (persist) saveStoredLicense(key.trim());
        setLicenseMsg(data.source === "dev" ? "Demo license accepted. Paid exports unlocked." : data.source === "signed" ? "Signed license accepted. Paid exports unlocked." : data.source === "polar" ? "Polar license accepted. Paid exports unlocked." : "License unlocked.");
      } else {
        setPaid(false);
        setLicenseMsg(data.error || "Invalid license key");
      }
    } catch {
      setPaid(false);
      setLicenseMsg("Could not reach the license endpoint");
    }
  }

  function remap(field: GmcField, header: string) {
    setMapping((m) => {
      const next = { ...m };
      if (!header) delete next[field];
      else next[field] = header;
      return next;
    });
  }

  function markDownloaded(filename: string) {
    setSuccessFile(filename);
    setSuccess(true);
  }

  function downloadFreeTsv() {
    // One user gesture → one HTMLElement.click(). Chrome will not save later
    // files from the same click, and untrusted MouseEvents ignore download=.
    const items = rows.slice(0, FREE_EXPORT_ROWS).map((r) => r.patched);
    const { filename, blob } = freeWatermarkedTsv(items);
    downloadBlob(filename, blob);
    markDownloaded(filename);
  }

  async function downloadFreeXlsx() {
    const issues = collectActionIssues(rows, FREE_ACTION_ISSUES);
    const buf = await actionPlanXlsx(issues);
    downloadBlob(
      DOWNLOAD_NAMES.actionFree,
      new Blob([buf], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      }),
    );
  }

  function downloadPaidPrimary() {
    const items = rows.map((r) => r.patched);
    const { filename, blob } = primaryTsvPayload(items);
    downloadBlob(filename, blob);
    markDownloaded(filename);
  }

  function downloadPaidSupplemental() {
    downloadBlob(DOWNLOAD_NAMES.supplemental, tsvBlob(itemsToSupplementalTsv(rows)));
  }

  async function downloadPaidXlsx() {
    const buf = await actionPlanXlsx(collectActionIssues(rows));
    downloadBlob(
      DOWNLOAD_NAMES.action,
      new Blob([buf], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      }),
    );
  }

  function downloadPaidMeta() {
    const items = rows.map((r) => r.patched);
    downloadBlob(DOWNLOAD_NAMES.meta, csvBlob(metaCatalogCsv(items)));
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) void ingest(file);
  }

  if (success && feed) {
    return (
      <section id="tool" className="mx-auto max-w-5xl px-4 py-16">
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-pass">Ready to upload</p>
        <h2 className="mt-2 font-serif text-4xl">
          {successFile || DOWNLOAD_NAMES.primary} is on disk. Six lines for Merchant Center.
        </h2>
        <ol className="mt-8 space-y-3 text-sm leading-6 text-slate">
          {MERCHANT_CENTER_NOTE.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ol>
        <div className="mt-10 flex flex-wrap gap-3">
          {paid ? (
            <>
              <button
                className="rounded-full border border-ink px-5 py-2.5 text-sm"
                onClick={() => downloadPaidSupplemental()}
              >
                Download supplemental TSV
              </button>
              <button
                className="rounded-full border border-ink px-5 py-2.5 text-sm"
                onClick={() => void downloadPaidXlsx()}
              >
                Download action xlsx
              </button>
              <button
                className="rounded-full border border-ink px-5 py-2.5 text-sm"
                onClick={() => downloadPaidMeta()}
              >
                Download Meta catalog
              </button>
            </>
          ) : (
            <button
              className="rounded-full border border-ink px-5 py-2.5 text-sm"
              onClick={() => void downloadFreeXlsx()}
            >
              Download action xlsx
            </button>
          )}
          <button
            className="rounded-full bg-ink px-5 py-2.5 text-sm text-paper"
            onClick={() => setSuccess(false)}
          >
            Back to the table
          </button>
        </div>
      </section>
    );
  }

  return (
    <section id="tool" className="mx-auto max-w-5xl px-4 py-12">
      <div
        onDragOver={(e) => e.preventDefault()}
        onDrop={onDrop}
        className="rounded-2xl border border-dashed border-ink/40 bg-white/50 p-6 sm:p-10"
      >
        <h2 className="font-serif text-3xl">Patch a feed in the browser</h2>
        <p className="mt-2 max-w-xl text-sm text-slate">
          CSV, TSV, XLSX, or Google XML. Parsed locally — we never upload the file. Auto-map
          Shopify / Woo / GMC, then remap anything that looks wrong.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <button
            className="rounded-full bg-patch px-4 py-2 text-sm text-paper disabled:opacity-50"
            disabled={busy}
            onClick={() => void ingest("sample")}
          >
            {busy ? "Loading…" : "Load sample"}
          </button>
          <button
            className="rounded-full border border-ink px-4 py-2 text-sm"
            onClick={() => inputRef.current?.click()}
          >
            Choose your CSV
          </button>
          <input
            ref={inputRef}
            type="file"
            accept=".csv,.tsv,.txt,.xlsx,.xls,.xml"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void ingest(f);
            }}
          />
        </div>
        {error ? <p className="mt-3 text-sm text-patch">{error}</p> : null}
      </div>

      <div className="mt-8 grid gap-6 sm:grid-cols-[1fr_16rem]">
        <form
          className="rounded-xl border border-rule bg-white/40 p-4"
          onSubmit={(e) => {
            e.preventDefault();
            void unlock(licenseInput);
          }}
        >
          <label className="text-sm font-medium">License key (demo: FEEDPATCH-DEV)</label>
          <div className="mt-2 flex flex-col gap-2 sm:flex-row">
            <input
              value={licenseInput}
              onChange={(e) => setLicenseInput(e.target.value)}
              placeholder={DEV_LICENSE_KEY}
              className="flex-1 rounded-md border border-rule bg-paper px-3 py-2 font-mono text-sm"
            />
            <button className="rounded-md bg-ink px-4 py-2 text-sm text-paper" type="submit">
              Unlock
            </button>
          </div>
          <p className="mt-2 text-xs text-slate">
            {paid
              ? "Paid: the GMC pack button downloads feedpatch-primary.tsv only. Supplemental TSV, action xlsx, and Meta catalog are separate clicks. Last 10 runs saved."
              : `Free: first ${FREE_SCORED_ROWS} SKUs scored. The watermark button downloads a ${FREE_EXPORT_ROWS}-row TSV; action xlsx is a second click (${FREE_ACTION_ISSUES} issues).`}
          </p>
          <p className="mt-2 text-xs text-slate">
            Demo license key: <code className="font-mono text-ink">{DEV_LICENSE_KEY}</code> unlocks
            paid exports when Polar/Gumroad env vars are not set. When commerce verification is
            configured, that demo key is rejected — paste a Polar (or Gumroad) license key instead.
          </p>
          {licenseMsg ? <p className="mt-1 text-xs">{licenseMsg}</p> : null}
          {paid ? (
            <button
              type="button"
              className="mt-2 text-xs underline"
              onClick={() => {
                setPaid(false);
                clearStoredLicense();
                setLicenseMsg("");
              }}
            >
              Lock again
            </button>
          ) : null}
        </form>
        <aside className="rounded-xl border border-rule p-4 text-sm">
          <p className="font-medium">Not included</p>
          <ul className="mt-2 list-disc space-y-1 pl-4 text-slate">
            <li>Not a Shopify app</li>
            <li>Not a monthly host</li>
            <li>No image-dimension fetch</li>
          </ul>
        </aside>
      </div>

      {feed ? (
        <div className="mt-10 space-y-8">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="font-mono text-xs uppercase tracking-widest text-slate">
                {source} · {feed.fileName} · {feed.rows.length} rows
              </p>
              <p className="mt-1 text-sm">
                {summary.errors} errors · {summary.warnings} warnings · {summary.green} green
                {!paid ? ` · ${Math.max(0, feed.rows.length - FREE_SCORED_ROWS)} unscored` : ""}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {paid ? (
                <>
                  <button
                    className="rounded-full bg-pass px-4 py-2 text-sm text-white"
                    onClick={() => downloadPaidPrimary()}
                  >
                    Download GMC pack
                  </button>
                  <button
                    className="rounded-full border border-ink px-4 py-2 text-sm"
                    onClick={() => downloadPaidSupplemental()}
                  >
                    Supplemental TSV
                  </button>
                  <button
                    className="rounded-full border border-ink px-4 py-2 text-sm"
                    onClick={() => void downloadPaidXlsx()}
                  >
                    Action xlsx
                  </button>
                  <button
                    className="rounded-full border border-ink px-4 py-2 text-sm"
                    onClick={() => downloadPaidMeta()}
                  >
                    Meta catalog
                  </button>
                </>
              ) : (
                <>
                  <button
                    className="rounded-full bg-ink px-4 py-2 text-sm text-paper"
                    onClick={() => downloadFreeTsv()}
                  >
                    Download 5-row watermark
                  </button>
                  <button
                    className="rounded-full border border-ink px-4 py-2 text-sm"
                    onClick={() => void downloadFreeXlsx()}
                  >
                    Action xlsx
                  </button>
                </>
              )}
            </div>
          </div>

          <details className="rounded-xl border border-rule bg-white/30 p-4" open>
            <summary className="cursor-pointer font-medium">Column map (manual remap)</summary>
            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {GMC_FIELDS.map((field) => (
                <label key={field} className="text-xs">
                  <span className="font-mono">{field}</span>
                  <select
                    className="mt-1 w-full rounded-md border border-rule bg-paper px-2 py-1.5"
                    value={mapping[field] || ""}
                    onChange={(e) => remap(field, e.target.value)}
                  >
                    <option value="">— not mapped —</option>
                    {feed.headers.map((h) => (
                      <option key={h} value={h}>
                        {h}
                      </option>
                    ))}
                  </select>
                </label>
              ))}
            </div>
          </details>

          <fieldset className="flex flex-wrap gap-4 text-sm">
            <legend className="sr-only">Auto-fixes</legend>
            {(
              [
                ["gtin", "GTIN text + check digit"],
                ["identifierExists", "identifier_exists"],
                ["availability", "availability"],
                ["price", "price"],
                ["videoLink", "YouTube-only video_link"],
                ["stripHtml", "strip HTML"],
              ] as const
            ).map(([key, label]) => (
              <label key={key} className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={toggles[key]}
                  onChange={(e) => setToggles((t) => ({ ...t, [key]: e.target.checked }))}
                />
                {label}
              </label>
            ))}
          </fieldset>

          <FeedTable rows={rows} />

          {paid && history.length ? (
            <div>
              <h3 className="font-serif text-xl">Last 10 runs</h3>
              <ul className="mt-3 divide-y divide-rule text-sm">
                {history.map((run) => (
                  <li key={run.at} className="flex flex-wrap justify-between gap-2 py-2">
                    <span className="font-mono">{run.fileName}</span>
                    <span className="text-slate">
                      {run.rowCount} rows · {run.errors} err · {run.warnings} warn · {run.green}{" "}
                      green · {new Date(run.at).toLocaleString()}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
