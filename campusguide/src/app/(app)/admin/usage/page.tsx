"use client";

import * as React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Download, FileQuestion, Flame, Library, Clock } from "lucide-react";
import {
  STALENESS,
  STALENESS_LABELS,
  downloadsLabel,
  openedShareLabel,
  staleness,
  type ResourceUsage,
  type UsageGroup,
  type UsageRow,
} from "@/lib/usage";

function StatTile({
  label,
  value,
  hint,
  icon,
  accent,
}: {
  label: string;
  value: number | string;
  hint?: string;
  icon: React.ReactNode;
  accent?: "primary" | "warning" | "risk" | "success";
}) {
  const tone =
    accent === "warning"
      ? "text-warning"
      : accent === "risk"
        ? "text-risk"
        : accent === "success"
          ? "text-success"
          : "text-primary";

  return (
    <div className="rounded-2xl border border-foreground/10 bg-background p-6">
      <div className="flex items-center justify-between gap-2">
        <p className="truncate text-sm font-semibold text-foreground/60">{label}</p>
        <span className={tone}>{icon}</span>
      </div>
      <p className="mt-3 break-all text-3xl font-extrabold leading-none tracking-tight sm:text-4xl">{value}</p>
      {hint ? <p className="mt-2 text-xs text-foreground/45">{hint}</p> : null}
    </div>
  );
}

function dateLabel(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

function StalenessBadge({ row }: { row: UsageRow }) {
  const state = staleness(row.lastDownloadedAt);
  const tone =
    state === STALENESS.Recent ? "success" : state === STALENESS.Stale ? "warning" : "neutral";

  return <Badge tone={tone}>{STALENESS_LABELS[state]}</Badge>;
}

function RowMeta({ row }: { row: UsageRow }) {
  return (
    <span className="mt-0.5 block truncate text-xs text-foreground/50">
      {[row.subject, row.academicYear ? `Year ${row.academicYear}` : null, row.type]
        .filter(Boolean)
        .join(" · ") || "No subject set"}
    </span>
  );
}

/**
 * A count bar, sized against the busiest row rather than the total — with one
 * runaway file a share-of-total bar would render every other row as a hairline.
 */
function GroupBars({ groups, emptyLabel }: { groups: UsageGroup[]; emptyLabel: string }) {
  const max = Math.max(...groups.map((g) => g.downloads), 1);

  if (groups.length === 0) {
    return <p className="text-sm text-foreground/60">Nothing to show yet.</p>;
  }

  return (
    <ul className="space-y-2.5">
      {groups.map((g) => (
        <li key={g.key ?? "__none__"}>
          <div className="flex items-baseline justify-between gap-3">
            <span className="min-w-0 truncate text-sm font-semibold">{g.key ?? emptyLabel}</span>
            <span className="shrink-0 text-xs text-foreground/55">
              {g.downloads} · {g.files} file{g.files === 1 ? "" : "s"}
            </span>
          </div>
          <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-foreground/8">
            <div
              className="h-full rounded-full bg-primary"
              style={{ width: `${Math.max(2, Math.round((g.downloads / max) * 100))}%` }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

export default function AdminUsagePage() {
  const [data, setData] = React.useState<ResourceUsage | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const res = await fetch("/api/admin/resource-usage", { cache: "no-cache" });
        const j = await res.json().catch(() => null);
        if (cancelled) return;

        if (!res.ok) {
          setError(j?.error ?? "Failed to load usage");
          return;
        }
        setData(j as ResourceUsage);
        setError(null);
      } catch {
        if (!cancelled) setError("Network error. Check your connection and try again.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="space-y-2">
      <h1 className="text-2xl font-extrabold tracking-tight">Usage</h1>
      <p className="text-sm text-foreground/70">
        Which resources students actually open, so you know what to keep updating and where the gaps are.
      </p>

      {error ? (
        <p className="mt-4 rounded-2xl bg-risk/10 px-4 py-3 text-sm font-semibold text-risk">{error}</p>
      ) : null}

      {loading ? (
        <p className="mt-4 text-sm text-foreground/70">Loading…</p>
      ) : !data ? null : (
        <div className="mt-4 space-y-4">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatTile
              label="Downloads"
              value={data.totals.downloads}
              hint={
                data.firstRecordedAt
                  ? `Since ${dateLabel(data.firstRecordedAt)}`
                  : "Nothing recorded yet"
              }
              icon={<Download className="h-5 w-5" />}
            />
            <StatTile
              label="Files in the drive"
              value={data.totals.files}
              icon={<Library className="h-5 w-5" />}
            />
            <StatTile
              label="Ever opened"
              value={openedShareLabel(data.totals.opened, data.totals.files)}
              hint={`${data.totals.opened} of ${data.totals.files}`}
              accent="success"
              icon={<Flame className="h-5 w-5" />}
            />
            <StatTile
              label="Never opened"
              value={data.totals.neverOpened}
              hint="Candidates for removal, or for better naming"
              accent="warning"
              icon={<FileQuestion className="h-5 w-5" />}
            />
          </div>

          {data.totals.downloads === 0 ? (
            <Card>
              <CardContent className="py-10 text-center">
                <Clock className="mx-auto h-8 w-8 text-foreground/25" />
                <p className="mt-3 text-sm font-extrabold">No downloads recorded yet</p>
                <p className="mx-auto mt-1 max-w-lg text-sm text-foreground/70">
                  Counting starts from the moment this shipped, not from when the files were uploaded. The
                  numbers here will only mean something after students have had a few days with it.
                </p>
              </CardContent>
            </Card>
          ) : null}

          <div className="grid gap-4 xl:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Flame className="h-5 w-5 text-primary" />
                  Most opened
                </CardTitle>
                <CardDescription>The files worth keeping current.</CardDescription>
              </CardHeader>
              <CardContent>
                {data.top.length === 0 ? (
                  <p className="text-sm text-foreground/60">Nothing has been opened yet.</p>
                ) : (
                  <ol className="space-y-2">
                    {data.top.map((row, index) => (
                      <li
                        key={row.id}
                        className="flex items-center gap-3 rounded-xl bg-background px-3 py-2.5"
                      >
                        <span className="w-5 shrink-0 text-right text-xs font-extrabold text-foreground/35">
                          {index + 1}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-bold">{row.title}</span>
                          <RowMeta row={row} />
                        </span>
                        <span className="shrink-0 text-sm font-extrabold">{row.downloadCount}</span>
                      </li>
                    ))}
                  </ol>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileQuestion className="h-5 w-5 text-warning" />
                  Never opened
                </CardTitle>
                <CardDescription>
                  Oldest first — something added last week has not had its chance yet.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {data.neverOpened.length === 0 ? (
                  <p className="text-sm text-foreground/60">Every file has been opened at least once.</p>
                ) : (
                  <ul className="space-y-2">
                    {data.neverOpened.map((row) => (
                      <li key={row.id} className="rounded-xl bg-background px-3 py-2.5">
                        <span className="block truncate text-sm font-bold">{row.title}</span>
                        <RowMeta row={row} />
                        <span className="mt-1 block text-xs text-foreground/40">
                          Added {dateLabel(row.createdAt)}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Demand by folder</CardTitle>
                <CardDescription>
                  Rolled up to the top-level folder, with the file count beside each.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <GroupBars groups={data.byFolder} emptyLabel="Drive root" />
              </CardContent>
            </Card>

            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Demand by year</CardTitle>
                  <CardDescription>Where the library is carrying its weight.</CardDescription>
                </CardHeader>
                <CardContent>
                  <GroupBars
                    groups={data.byYear.map((g) => ({
                      ...g,
                      key: g.key ? `Year ${g.key}` : null,
                    }))}
                    emptyLabel="No year set"
                  />
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Clock className="h-5 w-5 text-primary" />
                    Recently opened
                  </CardTitle>
                  <CardDescription>What students are reaching for right now.</CardDescription>
                </CardHeader>
                <CardContent>
                  {data.recent.length === 0 ? (
                    <p className="text-sm text-foreground/60">Nothing yet.</p>
                  ) : (
                    <ul className="space-y-2">
                      {data.recent.map((row) => (
                        <li
                          key={row.id}
                          className="flex items-center gap-3 rounded-xl bg-background px-3 py-2.5"
                        >
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-bold">{row.title}</span>
                            <span className="mt-0.5 block truncate text-xs text-foreground/50">
                              {dateLabel(row.lastDownloadedAt)} · {downloadsLabel(row.downloadCount)}
                            </span>
                          </span>
                          <StalenessBadge row={row} />
                        </li>
                      ))}
                    </ul>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
