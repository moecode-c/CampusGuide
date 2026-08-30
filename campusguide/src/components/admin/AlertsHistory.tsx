"use client";

import * as React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Check, RefreshCw, ShieldAlert, ShieldCheck } from "lucide-react";
import {
  ALERT_LABELS,
  ALERT_STATUS_LABELS,
  AlertSeverities,
  AlertStatuses,
  AlertTypes,
  SEVERITY_TONES,
  explainAlert,
  type AlertSeverity,
  type AlertStatus,
  type AlertType,
} from "@/lib/alerts";

export type AlertRow = {
  id: string;
  type: AlertType;
  severity: AlertSeverity;
  subject: string;
  subjectLabel: string | null;
  userId: string | null;
  count: number;
  message: string;
  firstSeenAt: string | null;
  lastSeenAt: string | null;
  acknowledgedAt: string | null;
  acknowledgedByName: string | null;
};

type Counts = { open: number; acknowledged: number; total: number };

const PAGE_SIZE = 25;

function when(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString(undefined, {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function relative(iso: string | null) {
  if (!iso) return "";
  const seconds = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
  if (seconds < 60) return "just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

/**
 * The full alert record — open and dealt with — on the activity log.
 *
 * The overview card shows only what still needs attention. This is the other
 * half: what has happened before, who cleared it and when, so a pattern that
 * repeats across weeks is visible instead of vanishing on acknowledge.
 */
export function AlertsHistory() {
  const [rows, setRows] = React.useState<AlertRow[]>([]);
  const [counts, setCounts] = React.useState<Counts>({ open: 0, acknowledged: 0, total: 0 });
  const [cursor, setCursor] = React.useState<string | null>(null);

  const [status, setStatus] = React.useState<AlertStatus>(AlertStatuses.All);
  const [type, setType] = React.useState("");
  const [severity, setSeverity] = React.useState("");

  const [loading, setLoading] = React.useState(true);
  const [loadingMore, setLoadingMore] = React.useState(false);
  const [busyId, setBusyId] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const buildQuery = React.useCallback(
    (before?: string | null) => {
      const params = new URLSearchParams({ status, limit: String(PAGE_SIZE) });
      if (type) params.set("type", type);
      if (severity) params.set("severity", severity);
      if (before) params.set("before", before);
      return params.toString();
    },
    [severity, status, type]
  );

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/alerts?${buildQuery()}`, { cache: "no-store" });
      const j = await res.json().catch(() => null);
      if (!res.ok) {
        setError(j?.error ?? "Failed to load alerts");
        return;
      }
      setRows((j?.alerts ?? []) as AlertRow[]);
      setCounts(j?.counts ?? { open: 0, acknowledged: 0, total: 0 });
      setCursor(j?.nextCursor ?? null);
      setError(null);
    } catch {
      setError("Network error. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }, [buildQuery]);

  React.useEffect(() => {
    void load();
  }, [load]);

  async function loadMore() {
    if (!cursor) return;
    setLoadingMore(true);
    try {
      const res = await fetch(`/api/admin/alerts?${buildQuery(cursor)}`, { cache: "no-store" });
      const j = await res.json().catch(() => null);
      if (!res.ok) {
        setError(j?.error ?? "Failed to load more alerts");
        return;
      }
      // Appended, not replaced — the filters have not changed underneath.
      setRows((prev) => [...prev, ...((j?.alerts ?? []) as AlertRow[])]);
      setCursor(j?.nextCursor ?? null);
    } catch {
      setError("Network error. Check your connection and try again.");
    } finally {
      setLoadingMore(false);
    }
  }

  async function acknowledge(row: AlertRow) {
    setBusyId(row.id);
    setError(null);
    try {
      const res = await fetch("/api/admin/alerts", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id: row.id }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => null);
        setError(j?.error ?? "Could not acknowledge that alert");
        return;
      }
      // Reload rather than patch in place: acknowledging changes the counts and,
      // under the "still open" filter, removes the row entirely.
      await load();
    } catch {
      setError("Network error. Check your connection and try again.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-lg">
              <ShieldAlert className={counts.open > 0 ? "h-5 w-5 text-risk" : "h-5 w-5 text-foreground/50"} />
              Security alerts
            </CardTitle>
            <CardDescription>
              {counts.open} open · {counts.acknowledged} dealt with · {counts.total} in total
            </CardDescription>
          </div>
          <Button variant="ghost" onClick={load} disabled={loading}>
            <RefreshCw className={loading ? "h-4 w-4 animate-spin" : "h-4 w-4"} />
            Reload
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="block">
            <span className="mb-1 block text-xs font-bold text-foreground/60">Status</span>
            <Select value={status} onChange={(e) => setStatus(e.target.value as AlertStatus)}>
              {Object.entries(ALERT_STATUS_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          </label>

          <label className="block">
            <span className="mb-1 block text-xs font-bold text-foreground/60">Kind</span>
            <Select value={type} onChange={(e) => setType(e.target.value)}>
              <option value="">Every kind</option>
              {Object.values(AlertTypes).map((t) => (
                <option key={t} value={t}>
                  {ALERT_LABELS[t]}
                </option>
              ))}
            </Select>
          </label>

          <label className="block">
            <span className="mb-1 block text-xs font-bold text-foreground/60">Severity</span>
            <Select value={severity} onChange={(e) => setSeverity(e.target.value)}>
              <option value="">Any severity</option>
              {Object.values(AlertSeverities).map((s) => (
                <option key={s} value={s}>
                  {s[0].toUpperCase() + s.slice(1)}
                </option>
              ))}
            </Select>
          </label>
        </div>

        {error ? <p className="text-sm font-semibold text-risk">{error}</p> : null}

        {loading && rows.length === 0 ? (
          <p className="text-sm text-foreground/70">Loading…</p>
        ) : rows.length === 0 ? (
          <div className="rounded-2xl bg-background p-8 text-center">
            <ShieldCheck className="mx-auto h-8 w-8 text-success" />
            <p className="mt-2 text-sm font-extrabold">
              {counts.total === 0 ? "Nothing has ever been flagged" : "Nothing matches those filters"}
            </p>
            <p className="mt-1 text-sm text-foreground/70">
              {counts.total === 0
                ? "Alerts appear here when sign-ins, rate limits or deletions look wrong."
                : "Widen the filters to see the rest of the record."}
            </p>
          </div>
        ) : (
          <ul className="space-y-2">
            {rows.map((row) => {
              const open = !row.acknowledgedAt;

              return (
                <li key={row.id} className="rounded-2xl bg-background p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge tone={SEVERITY_TONES[row.severity]}>{row.severity}</Badge>
                        <span className="text-sm font-extrabold">{ALERT_LABELS[row.type]}</span>
                        {open ? (
                          <Badge tone="risk">Open</Badge>
                        ) : (
                          <Badge tone="neutral">Dealt with</Badge>
                        )}
                      </div>

                      <p className="mt-1.5 text-sm text-foreground/80">
                        {explainAlert(row.type, row.count)}
                      </p>

                      <p className="mt-1 truncate text-xs text-foreground/55">
                        <span className="font-mono">{row.subjectLabel ?? row.subject}</span>
                        {" · "}
                        {row.count} event{row.count === 1 ? "" : "s"}
                        {" · first "}
                        {when(row.firstSeenAt)}
                        {" · last "}
                        {when(row.lastSeenAt)} ({relative(row.lastSeenAt)})
                      </p>

                      {!open ? (
                        <p className="mt-1 text-xs text-foreground/45">
                          Cleared {when(row.acknowledgedAt)}
                          {row.acknowledgedByName ? ` by ${row.acknowledgedByName}` : ""}
                        </p>
                      ) : null}
                    </div>

                    {open ? (
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => acknowledge(row)}
                        disabled={busyId === row.id}
                      >
                        <Check className="h-4 w-4" />
                        {busyId === row.id ? "Clearing…" : "Mark dealt with"}
                      </Button>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        {cursor ? (
          <Button variant="ghost" className="w-full" onClick={loadMore} disabled={loadingMore}>
            {loadingMore ? "Loading…" : "Load older alerts"}
          </Button>
        ) : null}
      </CardContent>
    </Card>
  );
}
