import type {
  ColumnMapping,
  FixToggles,
  GmcItem,
  ParsedFeed,
  ScoredRow,
} from "./types";
import { FREE_SCORED_ROWS } from "./types";
import { applyMapping } from "./columns";
import { applyFixes, changedFields } from "./fix";
import { collectDuplicateIds, statusForIssues, validateItem } from "./validate";

export function runPipeline(
  feed: ParsedFeed,
  mapping: ColumnMapping,
  toggles: FixToggles,
  opts: { paid: boolean },
): ScoredRow[] {
  const originals: GmcItem[] = feed.rows.map((row) => applyMapping(row, mapping));
  const patched = originals.map((item) => applyFixes(item, toggles));
  const scoredLimit = opts.paid ? patched.length : Math.min(FREE_SCORED_ROWS, patched.length);
  const dup = collectDuplicateIds(patched.slice(0, scoredLimit));

  return patched.map((item, index) => {
    const original = originals[index];
    const changed = changedFields(original, item);
    if (index >= scoredLimit) {
      return {
        index,
        original,
        patched: item,
        issues: [],
        status: "unscored" as const,
        changed,
      };
    }
    const issues = validateItem(item, dup);
    return {
      index,
      original,
      patched: item,
      issues,
      status: statusForIssues(issues),
      changed,
    };
  });
}
