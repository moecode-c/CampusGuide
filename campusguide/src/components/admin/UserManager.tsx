"use client";

import * as React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Ban,
  CheckCircle2,
  Eye,
  RefreshCw,
  Search,
  ShieldCheck,
  Trash2,
  Undo2,
  XCircle,
} from "lucide-react";
import { ActivityFeed, type ActivityItem } from "@/components/admin/ActivityFeed";

export type AdminUser = {
  id: string;
  name: string;
  email: string;
  miuId: string | null;
  phone: string | null;
  role: string;
  status: "pending" | "active" | "banned";
  academicYear: number | null;
  lastSeenAt: string | null;
  verifiedAt: string | null;
  bannedAt: string | null;
  banReason: string | null;
  rejectionReason: string | null;
  createdAt: string | null;
};

type Detail = {
  user: AdminUser;
  data: { events: number; midterms: number; attendance: number };
  logs: ActivityItem[];
};

function statusTone(status: AdminUser["status"]) {
  if (status === "active") return "success" as const;
  if (status === "banned") return "risk" as const;
  return "warning" as const;
}

function formatWhen(iso: string | null) {
  if (!iso) return "never";
  return new Date(iso).toLocaleString();
}

export function UserManager({
  defaultStatus = "",
  emptyMessage = "No accounts match this filter.",
  lockStatusFilter = false,
}: {
  defaultStatus?: "" | "pending" | "active" | "banned";
  emptyMessage?: string;
  lockStatusFilter?: boolean;
}) {
  const [status, setStatus] = React.useState(defaultStatus);
  const [q, setQ] = React.useState("");
  const [items, setItems] = React.useState<AdminUser[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [detail, setDetail] = React.useState<Detail | null>(null);

  const load = React.useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (status) params.set("status", status);
    if (q.trim()) params.set("q", q.trim());

    try {
      const res = await fetch(`/api/admin/users?${params.toString()}`);
      const j = await res.json().catch(() => null);
      if (!res.ok) {
        setError(j?.error ?? "Failed to load accounts");
        return;
      }
      setItems((j?.items ?? []) as AdminUser[]);
      setError(null);
    } catch {
      setError("Network error. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }, [q, status]);

  React.useEffect(() => {
    const handle = window.setTimeout(load, q ? 250 : 0);
    return () => window.clearTimeout(handle);
  }, [load, q]);

  async function act(user: AdminUser, action: "verify" | "reject" | "ban" | "unban") {
    let reason: string | undefined;

    if (action === "reject" || action === "ban") {
      const prompt =
        action === "reject"
          ? `Why is ${user.name}'s ID being rejected? They will see this message.`
          : `Reason for banning ${user.name}? (optional)`;
      const answer = window.prompt(prompt) ?? "";
      if (action === "reject" && !answer.trim()) return;
      reason = answer.trim() || undefined;
    }

    setBusy(true);
    try {
      const res = await fetch(`/api/admin/users/${user.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action, reason }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(j?.error ?? "Action failed");
        return;
      }
      setError(null);
      if (detail?.user.id === user.id) await openDetail(user.id);
      await load();
    } catch {
      setError("Network error. Nothing was changed.");
    } finally {
      setBusy(false);
    }
  }

  async function remove(user: AdminUser) {
    const label = user.miuId ?? user.email;
    if (
      !confirm(
        `Permanently delete ${user.name} (${label})?\n\nTheir schedule, grades and attendance are deleted too. This cannot be undone.`
      )
    )
      return;

    setBusy(true);
    try {
      const res = await fetch(`/api/admin/users/${user.id}`, { method: "DELETE" });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(j?.error ?? "Delete failed");
        return;
      }
      setError(null);
      if (detail?.user.id === user.id) setDetail(null);
      await load();
    } catch {
      setError("Network error. Nothing was deleted.");
    } finally {
      setBusy(false);
    }
  }

  async function openDetail(id: string) {
    try {
      const res = await fetch(`/api/admin/users/${id}`);
      const j = await res.json().catch(() => null);
      if (!res.ok) {
        setError(j?.error ?? "Failed to load the account");
        return;
      }
      setDetail(j as Detail);
    } catch {
      setError("Network error while loading the account.");
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-5">
      <Card className="lg:col-span-3">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" />
            Accounts
          </CardTitle>
          <CardDescription>{items.length} shown</CardDescription>
        </CardHeader>

        <CardContent>
          <div className="flex flex-col gap-2 sm:flex-row">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-foreground/50" />
              <Input
                className="pl-9"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Name, ID, email or phone…"
              />
            </div>
            {!lockStatusFilter ? (
              <Select className="sm:w-44" value={status} onChange={(e) => setStatus(e.target.value as any)}>
                <option value="">All statuses</option>
                <option value="pending">Pending</option>
                <option value="active">Active</option>
                <option value="banned">Banned</option>
              </Select>
            ) : null}
            <Button variant="ghost" onClick={load} disabled={busy}>
              <RefreshCw className="h-4 w-4" /> Reload
            </Button>
          </div>

          {error ? <p className="mt-3 text-sm font-semibold text-risk">{error}</p> : null}

          <div className="mt-4 space-y-2">
            {loading ? (
              <p className="text-sm text-foreground/70">Loading…</p>
            ) : items.length === 0 ? (
              <p className="text-sm text-foreground/70">{emptyMessage}</p>
            ) : (
              items.map((u) => (
                <div key={u.id} className="rounded-2xl bg-background p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="flex items-center gap-2 truncate text-sm font-extrabold">
                        {u.name}
                        {u.role === "admin" ? <Badge tone="neutral">Admin</Badge> : null}
                      </p>
                      <p className="truncate text-xs text-foreground/70">
                        {u.miuId ?? "no student ID"} • {u.email}
                      </p>
                      <p className="truncate text-xs text-foreground/60">
                        {u.phone ?? "no phone"} • last seen {formatWhen(u.lastSeenAt)}
                      </p>
                    </div>
                    <Badge tone={statusTone(u.status)}>{u.status}</Badge>
                  </div>

                  {u.banReason ? (
                    <p className="mt-2 text-xs text-risk">Banned: {u.banReason}</p>
                  ) : null}
                  {u.rejectionReason && u.status === "pending" ? (
                    <p className="mt-2 text-xs text-warning-foreground/80">Rejected: {u.rejectionReason}</p>
                  ) : null}

                  <div className="mt-3 flex flex-wrap gap-1">
                    <Button size="sm" variant="ghost" onClick={() => openDetail(u.id)} disabled={busy}>
                      <Eye className="h-4 w-4" /> View
                    </Button>

                    {u.status !== "active" ? (
                      <Button size="sm" variant="ghost" onClick={() => act(u, "verify")} disabled={busy}>
                        <CheckCircle2 className="h-4 w-4" /> Verify
                      </Button>
                    ) : null}

                    {u.status === "pending" ? (
                      <Button size="sm" variant="ghost" onClick={() => act(u, "reject")} disabled={busy}>
                        <XCircle className="h-4 w-4" /> Reject
                      </Button>
                    ) : null}

                    {u.status === "banned" ? (
                      <Button size="sm" variant="ghost" onClick={() => act(u, "unban")} disabled={busy}>
                        <Undo2 className="h-4 w-4" /> Unban
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="hover:text-risk"
                        onClick={() => act(u, "ban")}
                        disabled={busy}
                      >
                        <Ban className="h-4 w-4" /> Ban
                      </Button>
                    )}

                    <Button
                      size="sm"
                      variant="ghost"
                      className="hover:text-risk"
                      onClick={() => remove(u)}
                      disabled={busy}
                    >
                      <Trash2 className="h-4 w-4" /> Delete
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle>Account detail</CardTitle>
          <CardDescription>
            {detail ? detail.user.name : "Pick an account to see its data and history."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!detail ? (
            <p className="text-sm text-foreground/70">Nothing selected.</p>
          ) : (
            <div className="space-y-4">
              <dl className="space-y-1.5 text-sm">
                {[
                  ["Student ID", detail.user.miuId ?? "—"],
                  ["Email", detail.user.email],
                  ["Phone", detail.user.phone ?? "—"],
                  ["Year", detail.user.academicYear ? `Year ${detail.user.academicYear}` : "—"],
                  ["Role", detail.user.role],
                  ["Status", detail.user.status],
                  ["Registered", formatWhen(detail.user.createdAt)],
                  ["Verified", formatWhen(detail.user.verifiedAt)],
                  ["Last seen", formatWhen(detail.user.lastSeenAt)],
                ].map(([label, value]) => (
                  <div key={label} className="flex justify-between gap-3">
                    <dt className="shrink-0 text-foreground/60">{label}</dt>
                    <dd className="truncate text-right font-semibold">{value}</dd>
                  </div>
                ))}
              </dl>

              <div className="grid grid-cols-3 gap-2 text-center">
                {[
                  ["Classes", detail.data.events],
                  ["Grades", detail.data.midterms],
                  ["Attendance", detail.data.attendance],
                ].map(([label, value]) => (
                  <div key={String(label)} className="rounded-xl bg-background p-3">
                    <p className="text-xl font-extrabold">{value as number}</p>
                    <p className="text-[11px] text-foreground/60">{label as string}</p>
                  </div>
                ))}
              </div>

              <div>
                <p className="mb-2 text-sm font-extrabold">Account activity</p>
                <ActivityFeed items={detail.logs} compact emptyMessage="Nothing recorded for this account yet." />
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
