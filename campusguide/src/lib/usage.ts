/**
 * Vocabulary for the resource-usage dashboard.
 *
 * In `lib` so the client page can use it without pulling mongoose in — the same
 * split ActivityActions, teams and videoCourses use.
 */

export type UsageRow = {
  id: string;
  title: string;
  subject: string | null;
  academicYear: number | null;
  type: string | null;
  kind: "file" | "link";
  downloadCount: number;
  lastDownloadedAt: string | null;
  createdAt: string | null;
};

export type UsageGroup = {
  /** Null is the "drive root" / "no year set" bucket, which is worth seeing. */
  key: string | null;
  files: number;
  downloads: number;
};

export type ResourceUsage = {
  totals: {
    files: number;
    downloads: number;
    opened: number;
    neverOpened: number;
  };
  top: UsageRow[];
  neverOpened: UsageRow[];
  recent: UsageRow[];
  /** Rolled up to the top-level folder — the term, not the individual lecture folder. */
  byFolder: UsageGroup[];
  byYear: UsageGroup[];
  /**
   * The oldest recorded download. Counting only began when the counter shipped,
   * so this is what stops a small number being read as low demand.
   */
  firstRecordedAt: string | null;
};

export const STALENESS = {
  Never: "never",
  Recent: "recent",
  Quiet: "quiet",
  Stale: "stale",
} as const;

export type Staleness = (typeof STALENESS)[keyof typeof STALENESS];

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * How long a file has gone untouched.
 *
 * The thresholds are deliberately coarse: this drives a colour and a word, and
 * a term is long enough that "quiet for a month" is not yet a problem.
 */
export function staleness(lastDownloadedAt: string | null, now: Date = new Date()): Staleness {
  if (!lastDownloadedAt) return STALENESS.Never;

  const then = new Date(lastDownloadedAt).getTime();
  if (!Number.isFinite(then)) return STALENESS.Never;

  const days = (now.getTime() - then) / DAY_MS;
  if (days <= 7) return STALENESS.Recent;
  if (days <= 90) return STALENESS.Quiet;
  return STALENESS.Stale;
}

export const STALENESS_LABELS: Record<Staleness, string> = {
  [STALENESS.Never]: "Never opened",
  [STALENESS.Recent]: "Opened this week",
  [STALENESS.Quiet]: "Quiet",
  [STALENESS.Stale]: "Untouched for 3 months",
};

/** Share of the library that has ever been opened, as a whole percent. */
export function openedShare(opened: number, files: number): number {
  if (files <= 0) return 0;
  return Math.round((opened / files) * 100);
}

/**
 * The same share, worded for display.
 *
 * A handful of downloads against a 426-file drive rounds to zero, and "0%"
 * sitting directly above "1 of 426" reads as a broken stat rather than a small
 * one. "<1%" is the honest version, and it is the normal case for the first week.
 */
export function openedShareLabel(opened: number, files: number): string {
  const pct = openedShare(opened, files);
  if (pct === 0 && opened > 0) return "<1%";
  return `${pct}%`;
}

/** "1 download" / "12 downloads" — the count is the headline, so it reads properly at one. */
export function downloadsLabel(count: number): string {
  return `${count} download${count === 1 ? "" : "s"}`;
}
