export type RunSnapshot = {
  at: number;
  fileName: string;
  rowCount: number;
  scored: number;
  errors: number;
  warnings: number;
  green: number;
  paid: boolean;
};

const RUNS_KEY = "feedpatch-runs";
const LICENSE_KEY = "feedpatch-license";

export function loadRuns(): RunSnapshot[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(RUNS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.slice(0, 10) as RunSnapshot[];
  } catch {
    return [];
  }
}

export function saveRun(run: RunSnapshot): RunSnapshot[] {
  const next = [run, ...loadRuns()].slice(0, 10);
  localStorage.setItem(RUNS_KEY, JSON.stringify(next));
  return next;
}

export function loadStoredLicense(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem(LICENSE_KEY);
  } catch {
    return null;
  }
}

export function saveStoredLicense(key: string) {
  localStorage.setItem(LICENSE_KEY, key);
}

export function clearStoredLicense() {
  localStorage.removeItem(LICENSE_KEY);
}
