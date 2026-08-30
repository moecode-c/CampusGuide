"use client";

import * as React from "react";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PasswordInput } from "@/components/ui/password-input";
import {
  Ban,
  CheckCircle2,
  Eye,
  RefreshCw,
  Search,
  Trash2,
  UserPlus,
  X,
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
  openUserId,
}: {
  defaultStatus?: "" | "pending" | "active" | "banned";
  emptyMessage?: string;
  lockStatusFilter?: boolean;
  /** Opened on mount — lets a security alert deep-link straight to the account. */
  openUserId?: string | null;
}) {
  const [status, setStatus] = React.useState(defaultStatus);
  const [q, setQ] = React.useState("");
  const [items, setItems] = React.useState<AdminUser[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [detail, setDetail] = React.useState<Detail | null>(null);

  // Create-user form. Kept local to the manager so the Users page stays a
  // one-line wrapper.
  const [creating, setCreating] = React.useState(false);
  const [createErr, setCreateErr] = React.useState<string | null>(null);
  const [form, setForm] = React.useState({
    name: "", email: "", password: "", role: "student",
    academicYear: "1", miuId: "", phone: "", status: "active",
  });

  // Debouncing narrows the window but does not close it: a slow request for
  // "ah" can still land after a fast one for "ahmed" and repaint the older
  // results under the newer query. Only the newest request may write state.
  const requestSeq = React.useRef(0);

  const load = React.useCallback(async () => {
    const seq = ++requestSeq.current;
    setLoading(true);
    const params = new URLSearchParams();
    if (status) params.set("status", status);
    if (q.trim()) params.set("q", q.trim());

    try {
      const res = await fetch(`/api/admin/users?${params.toString()}`);
      const j = await res.json().catch(() => null);
      if (seq !== requestSeq.current) return;
      if (!res.ok) {
        setError(j?.error ?? "Failed to load accounts");
        return;
      }
      setItems((j?.items ?? []) as AdminUser[]);
      setError(null);
    } catch {
      if (seq === requestSeq.current) setError("Network error. Check your connection and try again.");
    } finally {
      if (seq === requestSeq.current) setLoading(false);
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

  // Arriving from a security alert's "Inspect" link: open that account straight
  // away rather than making the admin search for a name they were just shown.
  const openedRef = React.useRef<string | null>(null);
  React.useEffect(() => {
    if (!openUserId || openedRef.current === openUserId) return;
    openedRef.current = openUserId;
    void openDetail(openUserId);
    // Guarded by openedRef so this fires once per id, not on every render.
  }, [openUserId]);

  async function createUser() {
    setBusy(true);
    setCreateErr(null);
    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim(),
          email: form.email.trim(),
          password: form.password,
          role: form.role,
          academicYear: Number(form.academicYear),
          status: form.status,
          // Optional: staff and test accounts legitimately have neither.
          miuId: form.miuId.trim() || undefined,
          phone: form.phone.trim() || undefined,
        }),
      });
      const j = await res.json().catch(() => null);
      if (!res.ok) {
        setCreateErr(j?.error ?? "Could not create that account");
        return;
      }
      setCreating(false);
      setForm({ name: "", email: "", password: "", role: "student", academicYear: "1", miuId: "", phone: "", status: "active" });
      await load();
    } catch {
      setCreateErr("Network error. The account was not created.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      {/* No wrapper card. The account rows are the content of this page, so they
          sit directly on it — a card around a list of cards was three levels of
          padding squeezing everything into the middle third of the screen. */}
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-foreground/50" />
          <Input
            className="h-12 pl-11"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Name, ID, email or phone…"
          />
        </div>
        {!lockStatusFilter ? (
          <Select
            className="h-12 sm:w-52"
            value={status}
            onChange={(e) => setStatus(e.target.value as any)}
          >
            <option value="">All statuses</option>
            <option value="pending">Pending</option>
            <option value="active">Active</option>
            <option value="banned">Banned</option>
          </Select>
        ) : null}
        <Button variant="ghost" className="h-12 w-full sm:w-auto" onClick={load} disabled={busy}>
          <RefreshCw className="h-4 w-4" /> Reload
        </Button>
        <Button className="h-12 w-full sm:w-auto" onClick={() => { setCreating(true); setCreateErr(null); }}>
          <UserPlus className="h-4 w-4" /> New user
        </Button>
      </div>

      {creating ? (
        <div className="rounded-2xl border border-primary/30 bg-panel p-6">
          <h2 className="text-lg font-extrabold">Create an account</h2>
          <p className="mt-1 text-sm text-foreground/60">
            Created accounts are active immediately — you are vouching for them, so they skip the
            ID-photo queue. Student ID and phone are optional, for staff or test accounts.
          </p>

          <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <label className="space-y-1.5">
              <span className="text-sm font-semibold">Full name</span>
              <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
            </label>
            <label className="space-y-1.5">
              <span className="text-sm font-semibold">Email</span>
              <Input type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
            </label>
            <label className="space-y-1.5">
              <span className="text-sm font-semibold">Password</span>
              <PasswordInput value={form.password} onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))} />
              <span className="block text-xs text-foreground/55">8+ chars, 1 uppercase, 1 number.</span>
            </label>

            <label className="space-y-1.5">
              <span className="text-sm font-semibold">Role</span>
              <Select value={form.role} onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}>
                <option value="student">Student</option>
                <option value="admin">Admin — full access to this console</option>
              </Select>
            </label>
            <label className="space-y-1.5">
              <span className="text-sm font-semibold">Academic year</span>
              <Select value={form.academicYear} onChange={(e) => setForm((f) => ({ ...f, academicYear: e.target.value }))}>
                {[1, 2, 3, 4].map((y) => <option key={y} value={y}>Year {y}</option>)}
              </Select>
            </label>
            <label className="space-y-1.5">
              <span className="text-sm font-semibold">Status</span>
              <Select value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}>
                <option value="active">Active — can sign in now</option>
                <option value="pending">Pending — must be verified first</option>
                <option value="banned">Banned</option>
              </Select>
            </label>

            <label className="space-y-1.5">
              <span className="text-sm font-semibold">
                Student ID <span className="font-normal text-foreground/50">(optional)</span>
              </span>
              <Input placeholder="2024/15832" value={form.miuId} onChange={(e) => setForm((f) => ({ ...f, miuId: e.target.value }))} />
            </label>
            <label className="space-y-1.5">
              <span className="text-sm font-semibold">
                Phone <span className="font-normal text-foreground/50">(optional)</span>
              </span>
              <Input placeholder="01012345678" value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} />
            </label>
          </div>

          {form.role === "admin" ? (
            <p className="mt-4 rounded-xl border border-warning/30 bg-warning/10 px-4 py-3 text-sm font-semibold">
              An admin can see every account, delete content, and lock areas of the site. Only do
              this for someone you trust with all of it.
            </p>
          ) : null}

          {createErr ? (
            <p className="mt-4 rounded-xl border border-risk/30 bg-risk/10 px-4 py-3 text-sm font-bold text-risk">
              {createErr}
            </p>
          ) : null}

          <div className="mt-5 flex flex-wrap gap-2">
            <Button
              onClick={createUser}
              disabled={busy || !form.name.trim() || !form.email.trim() || form.password.length < 8}
            >
              <UserPlus className="h-4 w-4" /> Create account
            </Button>
            <Button variant="ghost" onClick={() => setCreating(false)} disabled={busy}>
              Cancel
            </Button>
          </div>
        </div>
      ) : null}

      <p className="text-sm text-foreground/55">
        {items.length} account{items.length === 1 ? "" : "s"}
      </p>

      {error ? <p className="text-sm font-semibold text-risk">{error}</p> : null}

      {loading ? (
        <p className="py-10 text-sm text-foreground/70">Loading…</p>
      ) : items.length === 0 ? (
        <p className="py-10 text-sm text-foreground/70">{emptyMessage}</p>
      ) : (
        <div className="space-y-3">
          {items.map((u) => (
            // One full-width row per account: identity left, contact in the
            // middle, actions right — all on one line once there is room.
            <div
              key={u.id}
              className="rounded-2xl border border-foreground/10 bg-panel p-5 transition-colors hover:border-foreground/20 xl:flex xl:items-center xl:gap-8"
            >
              <div className="min-w-0 xl:w-72 xl:shrink-0">
                <p className="flex flex-wrap items-center gap-2 text-base font-extrabold">
                  <span className="truncate">{u.name}</span>
                  {u.role === "admin" ? <Badge tone="neutral">Admin</Badge> : null}
                  <Badge tone={statusTone(u.status)}>{u.status}</Badge>
                </p>
                <p className="mt-1 text-sm text-foreground/60">{u.miuId ?? "no student ID"}</p>
              </div>

              {/* With real width these stop truncating, which was the whole
                  point — an admin needs to be able to read the address. */}
              <div className="mt-3 min-w-0 flex-1 space-y-1 xl:mt-0">
                <p className="break-all text-sm text-foreground/80">{u.email}</p>
                <p className="text-sm text-foreground/55">
                  {u.phone ?? "no phone"} · last seen {formatWhen(u.lastSeenAt)}
                </p>
                {u.banReason ? <p className="text-sm text-risk">Banned: {u.banReason}</p> : null}
                {u.rejectionReason && u.status === "pending" ? (
                  <p className="text-sm text-warning">Rejected: {u.rejectionReason}</p>
                ) : null}
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-2 xl:mt-0 xl:shrink-0">
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
          ))}
        </div>
      )}

      {/* The detail is an overlay now. As a permanent column it reserved a third
          of the page to say "Nothing selected" until somebody clicked something. */}
      {detail ? (
        <div
          className="fixed inset-0 z-50 flex justify-end bg-black/50 backdrop-blur-sm"
          role="presentation"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setDetail(null);
          }}
        >
          <aside
            role="dialog"
            aria-modal="true"
            aria-label={`Account detail for ${detail.user.name}`}
            className="h-dvh w-full max-w-2xl overflow-y-auto border-l border-foreground/10 bg-nav p-5 shadow-2xl sm:p-8"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <h2 className="text-2xl font-extrabold tracking-tight">{detail.user.name}</h2>
                <p className="mt-1 break-all text-sm text-foreground/60">{detail.user.email}</p>
              </div>
              <Button variant="ghost" onClick={() => setDetail(null)} aria-label="Close detail">
                <X className="h-5 w-5" />
              </Button>
            </div>

            <dl className="mt-8 grid gap-x-8 gap-y-5 sm:grid-cols-2">
              {[
                ["Student ID", detail.user.miuId ?? "—"],
                ["Phone", detail.user.phone ?? "—"],
                ["Year", detail.user.academicYear ? `Year ${detail.user.academicYear}` : "—"],
                ["Role", detail.user.role],
                ["Status", detail.user.status],
                ["Registered", formatWhen(detail.user.createdAt)],
                ["Verified", formatWhen(detail.user.verifiedAt)],
                ["Last seen", formatWhen(detail.user.lastSeenAt)],
              ].map(([label, value]) => (
                <div key={label}>
                  <dt className="text-xs font-semibold uppercase tracking-wide text-foreground/45">
                    {label}
                  </dt>
                  <dd className="mt-1 break-words text-sm font-semibold">{value}</dd>
                </div>
              ))}
            </dl>

            <div className="mt-8 grid grid-cols-3 gap-2 text-center sm:gap-3">
              {[
                ["Classes", detail.data.events],
                ["Grades", detail.data.midterms],
                ["Attendance", detail.data.attendance],
              ].map(([label, value]) => (
                <div key={String(label)} className="rounded-2xl bg-background p-3 sm:p-5">
                  <p className="text-xl font-extrabold sm:text-3xl">{value as number}</p>
                  <p className="mt-1 text-xs text-foreground/60">{label as string}</p>
                </div>
              ))}
            </div>

            <div className="mt-8">
              <p className="mb-3 text-sm font-extrabold">Account activity</p>
              <ActivityFeed
                items={detail.logs}
                compact
                emptyMessage="Nothing recorded for this account yet."
              />
            </div>
          </aside>
        </div>
      ) : null}
    </div>
  );
}
