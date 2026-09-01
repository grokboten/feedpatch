import type { GmcField, ScoredRow } from "@/lib/types";
import { GMC_FIELDS } from "@/lib/types";

const PREVIEW: GmcField[] = [
  "id",
  "title",
  "availability",
  "price",
  "brand",
  "gtin",
  "identifier_exists",
  "video_link",
];

const STATUS: Record<ScoredRow["status"], string> = {
  red: "bg-red-100 text-red-800",
  amber: "bg-amber-100 text-amber-900",
  green: "bg-emerald-100 text-emerald-900",
  unscored: "bg-neutral-200 text-neutral-600",
};

export function FeedTable({ rows }: { rows: ScoredRow[] }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-rule bg-white/40">
      <table className="min-w-[720px] w-full text-left text-xs">
        <thead className="bg-ink text-paper">
          <tr>
            <th className="px-2 py-2 font-medium">#</th>
            <th className="px-2 py-2 font-medium">status</th>
            {PREVIEW.map((f) => (
              <th key={f} className="px-2 py-2 font-mono font-medium">
                {f}
              </th>
            ))}
            <th className="px-2 py-2 font-medium">issues</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={row.index}
              className={
                row.status === "red"
                  ? "bg-red-50/80"
                  : row.status === "amber"
                    ? "bg-amber-50/70"
                    : row.status === "green"
                      ? "bg-emerald-50/70"
                      : "bg-neutral-50 text-slate"
              }
            >
              <td className="px-2 py-1.5 font-mono">{row.index + 1}</td>
              <td className="px-2 py-1.5">
                <span className={`rounded-full px-2 py-0.5 ${STATUS[row.status]}`}>
                  {row.status}
                </span>
              </td>
              {PREVIEW.map((f) => {
                const changed = row.changed.includes(f);
                return (
                  <td
                    key={f}
                    className={`max-w-[140px] truncate px-2 py-1.5 ${changed ? "font-medium text-patch" : ""}`}
                    title={
                      changed
                        ? `${row.original[f] || "(empty)"} → ${row.patched[f]}`
                        : row.patched[f]
                    }
                  >
                    {row.patched[f] || "—"}
                  </td>
                );
              })}
              <td className="max-w-[220px] px-2 py-1.5 text-slate">
                {row.status === "unscored"
                  ? "Unlock to score this SKU"
                  : row.issues
                      .slice(0, 3)
                      .map((i) => i.message)
                      .join(" · ") || "ok"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="px-3 py-2 text-[11px] text-slate">
        Showing {PREVIEW.length} of {GMC_FIELDS.length} GMC columns. Red = blocking. Amber =
        machine-checkable warnings (title promo, ALL CAPS, length). Image 500×500 stays an honest
        warning and does not by itself block green/ready. Changed cells are marked in red type.
      </p>
    </div>
  );
}
