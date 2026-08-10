"use client";

import * as React from "react";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  ArrowRight,
  Ban,
  CheckCircle2,
  Clock,
  FolderTree,
  RefreshCw,
  TrendingUp,
  Users,
  Zap,
} from "lucide-react";
import { ActivityFeed, type ActivityItem } from "@/components/admin/ActivityFeed";
import { barHeight, densifyDays } from "@/lib/chart";

type Stats = {
  activeUsers: { daily: number; weekly: number; monthly: number };
  users: { total: number; pending: number; banned: number; active: number };
  signups: { today: number; thisWeek: number };
  content: { resources: number; folders: number };
  actionsToday: number;
  signupSeries: { date: string; count: number }[];
};

const CHART_HEIGHT = 132;
const CHART_DAYS = 14;

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
    <div className="rounded-2xl border border-foreground/10 bg-background p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="truncate text-xs font-semibold text-foreground/60">{label}</p>
        <span className={tone}>{icon}</span>
      </div>
      <p className="mt-2 text-2xl font-extrabold leading-none tracking-tight">{value}</p>
      {hint ? <p className="mt-1 text-[11px] text-foreground/45">{hint}</p> : null}
    </div>
  );
}

/** Fourteen numbers don't justify pulling in a charting library. */
function SignupChart({ series }: { series: { date: string; count: number }[] }) {
  const days = densifyDays(series, CHART_DAYS);
  const max = Math.max(...days.map((d) => d.count), 1);
  const total = days.reduce((sum, d) => sum + d.count, 0);

  return (
    <div>
      <div className="flex items-end gap-1" style={{ height: CHART_HEIGHT }}>
        {days.map((d) => {
          const px = barHeight(d.count, max, CHART_HEIGHT);
          return (
            <div
              key={d.date}
              className="flex min-w-0 flex-1 flex-col items-center justify-end gap-1"
              title={`${d.date}: ${d.count} signup${d.count === 1 ? "" : "s"}`}
            >
              <span className="text-[10px] font-bold text-foreground/70">{d.count > 0 ? d.count : ""}</span>
              <div
                className={
                  d.count > 0
                    ? "w-full rounded-t bg-primary"
                    : "w-full rounded-t bg-foreground/15"
                }
                style={{ height: px }}
              />
            </div>
          );
        })}
      </div>

      <div className="mt-2 flex gap-1">
        {days.map((d) => (
          <span key={d.date} className="flex-1 text-center text-[9px] tabular-nums text-foreground/40">
            {d.date.slice(8)}
          </span>
        ))}
      </div>

      <p className="mt-3 text-xs text-foreground/50">
        {total} signup{total === 1 ? "" : "s"} in the last {CHART_DAYS} days
      </p>
    </div>
  );
}

export default function AdminOverviewPage() {
  const [stats, setStats] = React.useState<Stats | null>(null);
  const [activity, setActivity] = React.useState<ActivityItem[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const [statsRes, activityRes] = await Promise.all([
        fetch("/api/admin/stats"),
        fetch("/api/admin/activity?limit=12"),
      ]);

      const statsJson = await statsRes.json().catch(() => null);
      const activityJson = await activityRes.json().catch(() => null);

      if (!statsRes.ok) {
        setError(statsJson?.error ?? "Failed to load stats");
        return;
      }

      setStats(statsJson as Stats);
      setActivity((activityJson?.items ?? []) as ActivityItem[]);
      setError(null);
    } catch {
      setError("Network error. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">Overview</h1>
          <p className="text-sm text-foreground/60">Activity, accounts and content across CampusGuide.</p>
        </div>
        <Button variant="ghost" onClick={load} disabled={loading}>
          <RefreshCw className={loading ? "h-4 w-4 animate-spin" : "h-4 w-4"} /> Reload
        </Button>
      </div>

      {error ? <p className="text-sm font-semibold text-risk">{error}</p> : null}

      {stats && stats.users.pending > 0 ? (
        <Link
          href="/admin/verification"
          className="flex items-center justify-between gap-3 rounded-2xl border border-warning/30 bg-warning/10 px-4 py-3 transition hover:bg-warning/15"
        >
          <span className="flex items-center gap-2 text-sm font-bold">
            <Clock className="h-4 w-4 text-warning" />
            {stats.users.pending} account{stats.users.pending === 1 ? "" : "s"} waiting for verification
          </span>
          <ArrowRight className="h-4 w-4 shrink-0" />
        </Link>
      ) : null}

      {loading && !stats ? (
        <p className="text-sm text-foreground/60">Loading…</p>
      ) : stats ? (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <StatTile
              label="Daily active"
              value={stats.activeUsers.daily}
              hint="last 24 hours"
              icon={<Zap className="h-4 w-4" />}
            />
            <StatTile
              label="Weekly active"
              value={stats.activeUsers.weekly}
              hint="last 7 days"
              icon={<TrendingUp className="h-4 w-4" />}
            />
            <StatTile
              label="Monthly active"
              value={stats.activeUsers.monthly}
              hint="last 30 days"
              icon={<Users className="h-4 w-4" />}
            />
            <StatTile
              label="Actions today"
              value={stats.actionsToday}
              hint="logged events"
              icon={<Zap className="h-4 w-4" />}
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <StatTile
              label="Total accounts"
              value={stats.users.total}
              hint={`${stats.signups.thisWeek} new this week`}
              icon={<Users className="h-4 w-4" />}
            />
            <StatTile
              label="Verified"
              value={stats.users.active}
              icon={<CheckCircle2 className="h-4 w-4" />}
              accent="success"
            />
            <StatTile
              label="Pending"
              value={stats.users.pending}
              hint="awaiting ID check"
              icon={<Clock className="h-4 w-4" />}
              accent="warning"
            />
            <StatTile
              label="Banned"
              value={stats.users.banned}
              icon={<Ban className="h-4 w-4" />}
              accent="risk"
            />
          </div>

          <div className="grid gap-5 xl:grid-cols-5">
            <Card className="xl:col-span-3">
              <CardHeader>
                <CardTitle className="text-lg">Signups</CardTitle>
                <CardDescription>New accounts per day over the last fortnight.</CardDescription>
              </CardHeader>
              <CardContent>
                <SignupChart series={stats.signupSeries} />
              </CardContent>
            </Card>

            <Card className="xl:col-span-2">
              <CardHeader>
                <CardTitle className="text-lg">Content</CardTitle>
                <CardDescription>What is in the shared drive.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <StatTile
                  label="Resources"
                  value={stats.content.resources}
                  hint="files and links"
                  icon={<FolderTree className="h-4 w-4" />}
                />
                <StatTile
                  label="Folders"
                  value={stats.content.folders}
                  icon={<FolderTree className="h-4 w-4" />}
                />
                <Link href="/admin/resources" className="inline-flex">
                  <Button variant="secondary">
                    Open file storage <ArrowRight className="h-4 w-4" />
                  </Button>
                </Link>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader className="flex-row items-start justify-between gap-3 space-y-0">
              <div>
                <CardTitle className="text-lg">Recent activity</CardTitle>
                <CardDescription>The latest events across the site.</CardDescription>
              </div>
              <Link href="/admin/activity" className="shrink-0">
                <Button variant="ghost">
                  View all <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
            </CardHeader>
            <CardContent>
              <ActivityFeed items={activity} />
            </CardContent>
          </Card>
        </>
      ) : null}
    </div>
  );
}
