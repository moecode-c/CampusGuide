"use client";

import * as React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Pagination, usePaged } from "@/components/ui/pagination";
import { RefreshCw } from "lucide-react";
import { ActivityFeed, type ActivityItem } from "@/components/admin/ActivityFeed";
import { AlertsHistory } from "@/components/admin/AlertsHistory";
import {
  ActiveSessionsCard,
  BlockIpDialog,
  BlockedIpsCard,
  useIpBlocks,
} from "@/components/admin/IpSecurity";
import { ActivityActions } from "@/lib/activityActions";

/** Grouped so the filter reads as categories rather than a wall of dotted keys. */
const ACTION_GROUPS: { label: string; actions: { value: string; label: string }[] }[] = [
  {
    label: "Accounts",
    actions: [
      { value: ActivityActions.Register, label: "Registered" },
      { value: ActivityActions.SignIn, label: "Signed in" },
    ],
  },
  {
    label: "Moderation",
    actions: [
      { value: ActivityActions.UserCreate, label: "Account created by admin" },
      { value: ActivityActions.VerifyApprove, label: "Verified" },
      { value: ActivityActions.VerifyReject, label: "Rejected" },
      { value: ActivityActions.UserBan, label: "Banned" },
      { value: ActivityActions.UserUnban, label: "Unbanned" },
      { value: ActivityActions.UserDelete, label: "Account deleted" },
      { value: ActivityActions.UserUpdate, label: "Account edited" },
      { value: ActivityActions.UserPasswordReset, label: "Password reset" },
    ],
  },
  {
    label: "Content",
    actions: [
      { value: ActivityActions.ResourceCreate, label: "Resource added" },
      { value: ActivityActions.ResourceUpdate, label: "Resource edited" },
      { value: ActivityActions.ResourceReplace, label: "File replaced" },
      { value: ActivityActions.ResourceDelete, label: "Resource deleted" },
      { value: ActivityActions.FolderCreate, label: "Folder created" },
      { value: ActivityActions.FolderUpdate, label: "Folder changed" },
      { value: ActivityActions.FolderDelete, label: "Folder deleted" },
    ],
  },
  {
    label: "Teams",
    actions: [
      { value: ActivityActions.TeamPostCreate, label: "Team ad posted" },
      { value: ActivityActions.TeamPostDelete, label: "Team ad removed" },
      { value: ActivityActions.TeamPostPurge, label: "Stale team ads cleared" },
    ],
  },
  {
    label: "Videos",
    actions: [
      { value: ActivityActions.VideoCourseCreate, label: "Video course created" },
      { value: ActivityActions.VideoCourseUpdate, label: "Video course edited" },
      { value: ActivityActions.VideoCourseDelete, label: "Video course deleted" },
    ],
  },
  {
    label: "Security",
    actions: [
      { value: ActivityActions.SignInFailed, label: "Failed sign-in" },
      { value: ActivityActions.SignInUnknown, label: "Unknown account tried" },
      { value: ActivityActions.SignInBanned, label: "Banned account tried" },
      { value: ActivityActions.RateLimited, label: "Rate limit hit" },
      { value: ActivityActions.AlertAcknowledged, label: "Alert acknowledged" },
      { value: ActivityActions.FlagEnabled, label: "Area locked" },
      { value: ActivityActions.FlagDisabled, label: "Area unlocked" },
      { value: ActivityActions.IpBlocked, label: "Address blocked" },
      { value: ActivityActions.IpUnblocked, label: "Address unblocked" },
    ],
  },
];

export default function AdminActivityPage() {
  const [items, setItems] = React.useState<ActivityItem[]>([]);
  const [action, setAction] = React.useState("");
  const [limit, setLimit] = React.useState("50");
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const ipBlocks = useIpBlocks();
  const pagedEvents = usePaged(items, 25);
  const [blockTarget, setBlockTarget] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ limit });
    if (action) params.set("action", action);

    try {
      const res = await fetch(`/api/admin/activity?${params.toString()}`);
      const j = await res.json().catch(() => null);
      if (!res.ok) {
        setError(j?.error ?? "Failed to load the activity log");
        return;
      }
      setItems((j?.items ?? []) as ActivityItem[]);
      setError(null);
    } catch {
      setError("Network error. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }, [action, limit]);

  React.useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">Activity log</h1>
          <p className="text-sm text-foreground/60">Every recorded action, newest first.</p>
        </div>
        <Button variant="ghost" onClick={load} disabled={loading}>
          <RefreshCw className={loading ? "h-4 w-4 animate-spin" : "h-4 w-4"} /> Reload
        </Button>
      </div>

      <AlertsHistory />

      <div className="grid gap-5 xl:grid-cols-2">
        <ActiveSessionsCard onBlockIp={setBlockTarget} activeIps={ipBlocks.activeIps} />
        <BlockedIpsCard
          blocks={ipBlocks.blocks}
          onUnblock={ipBlocks.unblock}
          busy={ipBlocks.busy}
        />
      </div>

      {ipBlocks.error ? (
        <p className="rounded-2xl bg-risk/10 px-4 py-3 text-sm font-semibold text-risk">{ipBlocks.error}</p>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">
            {loading ? "Loading…" : `${items.length} event${items.length === 1 ? "" : "s"}`}
          </CardTitle>
          <CardDescription>
            Each entry shows the address it came from. Use the block button to refuse it everywhere.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {/*
            These live inside the log card rather than in a panel of their own.
            They used to sit at the top of the page, and the alerts, sessions and
            blocked-address panels were later added between them and the list —
            so you scrolled to the events and the filter was three panels behind
            you. Controls belong next to what they control.
          */}
          <div className="grid gap-3 sm:grid-cols-2 lg:max-w-xl">
            <div className="space-y-1">
              <label className="text-sm font-semibold">Action</label>
              <Select value={action} onChange={(e) => setAction(e.target.value)}>
                <option value="">All actions</option>
                {ACTION_GROUPS.map((group) => (
                  <optgroup key={group.label} label={group.label}>
                    {group.actions.map((a) => (
                      <option key={a.value} value={a.value}>
                        {a.label}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </Select>
            </div>
            <div className="space-y-1">
              <label className="text-sm font-semibold">Show</label>
              <Select value={limit} onChange={(e) => setLimit(e.target.value)}>
                <option value="25">Last 25</option>
                <option value="50">Last 50</option>
                <option value="100">Last 100</option>
              </Select>
            </div>
          </div>

          {action ? (
            <button
              type="button"
              onClick={() => setAction("")}
              className="text-xs font-semibold text-primary underline-offset-2 hover:underline"
            >
              Clear filter — show every action
            </button>
          ) : null}

          {error ? <p className="text-sm font-semibold text-risk">{error}</p> : null}

          <ActivityFeed items={pagedEvents.pageItems} onBlockIp={setBlockTarget} blockedIps={ipBlocks.activeIps} />
          <Pagination paged={pagedEvents} noun="events" />
        </CardContent>
      </Card>

      <BlockIpDialog
        ip={blockTarget}
        open={blockTarget !== null}
        onOpenChange={(open) => {
          if (!open) setBlockTarget(null);
        }}
        busy={ipBlocks.busy}
        yourIp={ipBlocks.yourIp}
        onConfirm={async (input) => {
          const ok = await ipBlocks.block(input);
          if (ok) setBlockTarget(null);
        }}
      />
    </div>
  );
}
