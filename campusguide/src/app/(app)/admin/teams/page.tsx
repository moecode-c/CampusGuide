"use client";

import * as React from "react";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Pagination, usePaged } from "@/components/ui/pagination";
import { AlertTriangle, Ban, RefreshCw, Search, Trash2, Users } from "lucide-react";
import {
  DIFFICULTY_LABELS,
  KIND_LABELS,
  STALE_POST_DAYS,
  TeamPostStatuses,
  postAgeLabel,
  type TeamDifficulty,
  type TeamPostKind,
} from "@/lib/teams";

type AdminPost = {
  id: string;
  title: string;
  kind: TeamPostKind;
  subject: string;
  academicYear: number | null;
  projectName: string | null;
  difficulty: TeamDifficulty;
  status: string;
  ownerId: string | null;
  ownerName: string | null;
  contactPhone: string | null;
  createdAt: string | null;
  flagged: boolean;
};

type Counts = { total: number; open: number; closed: number; flagged: number };

function StatTile({
  label,
  value,
  hint,
  accent,
}: {
  label: string;
  value: number | string;
  hint?: string;
  accent?: "primary" | "warning" | "success";
}) {
  const tone =
    accent === "warning" ? "text-warning" : accent === "success" ? "text-success" : "text-primary";

  return (
    <div className="rounded-2xl border border-foreground/10 bg-background p-5">
      <p className="truncate text-sm font-semibold text-foreground/60">{label}</p>
      <p className={`mt-2 text-3xl font-extrabold leading-none tracking-tight ${tone}`}>{value}</p>
      {hint ? <p className="mt-2 text-xs text-foreground/45">{hint}</p> : null}
    </div>
  );
}

function when(iso: string | null) {
  if (!iso) return "unknown";
  return new Date(iso).toLocaleString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function AdminTeamsPage() {
  const [posts, setPosts] = React.useState<AdminPost[]>([]);
  const [counts, setCounts] = React.useState<Counts>({ total: 0, open: 0, closed: 0, flagged: 0 });
  const [truncated, setTruncated] = React.useState(false);

  const [view, setView] = React.useState<"all" | "flagged" | "open" | "closed">("all");
  const [query, setQuery] = React.useState("");

  const [loading, setLoading] = React.useState(true);
  const [purging, setPurging] = React.useState(false);
  const [deletingId, setDeletingId] = React.useState<string | null>(null);
  const [banningId, setBanningId] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [notice, setNotice] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/teams", { cache: "no-store" });
      const j = await res.json().catch(() => null);
      if (!res.ok) {
        setError(j?.error ?? "Failed to load the board");
        return;
      }
      setPosts((j?.posts ?? []) as AdminPost[]);
      setCounts(j?.counts ?? { total: 0, open: 0, closed: 0, flagged: 0 });
      setTruncated(Boolean(j?.truncated));
      setError(null);
    } catch {
      setError("Network error. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void load();
  }, [load]);

  async function removeFlagged() {
    const ok = window.confirm(
      `Remove all ${counts.flagged} post${counts.flagged === 1 ? "" : "s"} older than ${STALE_POST_DAYS} days?\n\n` +
        "This deletes them permanently and cannot be undone."
    );
    if (!ok) return;

    setPurging(true);
    setError(null);
    setNotice(null);

    try {
      const res = await fetch("/api/admin/teams/flagged", { method: "DELETE" });
      const j = await res.json().catch(() => null);
      if (!res.ok) {
        setError(j?.error ?? "Could not remove the flagged posts");
        return;
      }

      const deleted = Number(j?.deleted ?? 0);
      setNotice(
        deleted === 0
          ? "Nothing was old enough to remove."
          : `Removed ${deleted} post${deleted === 1 ? "" : "s"}.`
      );
      await load();
    } catch {
      setError("Network error. Check your connection and try again.");
    } finally {
      setPurging(false);
    }
  }

  async function removeOne(post: AdminPost) {
    const ok = window.confirm(
      `Delete "${post.title}" by ${post.ownerName ?? "a deleted account"}?

This cannot be undone.`
    );
    if (!ok) return;

    setDeletingId(post.id);
    setError(null);
    setNotice(null);

    try {
      // The student route already lets an admin remove anyone's post, and it
      // logs the deletion against the right target. No second endpoint needed.
      const res = await fetch(`/api/student/teams/${post.id}`, { method: "DELETE" });
      if (!res.ok) {
        const j = await res.json().catch(() => null);
        setError(j?.error ?? "Could not delete that post");
        return;
      }
      setNotice(`Removed "${post.title}".`);
      await load();
    } catch {
      setError("Network error. Check your connection and try again.");
    } finally {
      setDeletingId(null);
    }
  }

  /**
   * Bans the account behind a post, without leaving the board.
   *
   * Uses the same endpoint and payload the Users page does, rather than a
   * second route: banning is one behaviour and it should log, guard and read
   * identically wherever it is triggered from. The server refuses a self-ban,
   * so that case needs no handling here.
   *
   * The post itself is left alone. Removing someone's account and silently
   * deleting what they wrote are two decisions, and the delete button for this
   * row is right next to this one.
   */
  async function banOwner(post: AdminPost) {
    if (!post.ownerId) {
      setError("That post has no account attached — it was written by a deleted user.");
      return;
    }

    const who = post.ownerName ?? "this student";
    const ok = window.confirm(
      `Ban ${who} over "${post.title}"?

` +
        "They lose access immediately and cannot sign back in. The post itself stays up — delete it separately if you want it gone."
    );
    if (!ok) return;

    const answer = window.prompt(`Reason for banning ${who}? (optional)`) ?? "";

    setBanningId(post.id);
    setError(null);
    setNotice(null);

    try {
      const res = await fetch(`/api/admin/users/${post.ownerId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "ban", reason: answer.trim() || undefined }),
      });
      const j = await res.json().catch(() => null);

      if (!res.ok) {
        setError(j?.error ?? "Could not ban that account");
        return;
      }

      setNotice(`Banned ${who}. Their post is still on the board.`);
      await load();
    } catch {
      setError("Network error. Check your connection and try again.");
    } finally {
      setBanningId(null);
    }
  }

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();

    return posts.filter((p) => {
      if (view === "flagged" && !p.flagged) return false;
      if (view === "open" && p.status !== TeamPostStatuses.Open) return false;
      if (view === "closed" && p.status !== TeamPostStatuses.Closed) return false;

      if (!q) return true;
      return `${p.title} ${p.subject} ${p.ownerName ?? ""} ${p.projectName ?? ""}`
        .toLowerCase()
        .includes(q);
    });
  }, [posts, query, view]);

  const paged = usePaged(filtered, 25);

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">Teams board</h1>
          <p className="text-sm text-foreground/70">
            Every post, who put it up and when. Anything older than {STALE_POST_DAYS} days is flagged.
          </p>
        </div>
        <Button variant="ghost" onClick={load} disabled={loading}>
          <RefreshCw className={loading ? "h-4 w-4 animate-spin" : "h-4 w-4"} />
          Reload
        </Button>
      </div>

      {error ? (
        <p className="mt-3 rounded-2xl bg-risk/10 px-4 py-3 text-sm font-semibold text-risk">{error}</p>
      ) : null}
      {notice ? (
        <p className="mt-3 rounded-2xl bg-success/10 px-4 py-3 text-sm font-semibold text-success">
          {notice}
        </p>
      ) : null}

      <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile label="Posts on the board" value={counts.total} />
        <StatTile label="Open" value={counts.open} accent="success" />
        <StatTile label="Closed" value={counts.closed} />
        <StatTile
          label="Flagged as old"
          value={counts.flagged}
          hint={`Older than ${STALE_POST_DAYS} days`}
          accent="warning"
        />
      </div>

      {truncated ? (
        <p className="mt-3 text-xs text-foreground/50">
          Showing the newest 500 posts. The counts describe those, not the whole collection.
        </p>
      ) : null}

      {counts.flagged > 0 ? (
        <Card className="mt-4 border-warning/25">
          <CardContent className="flex flex-wrap items-center gap-4 p-5">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-warning/15 text-warning">
              <AlertTriangle className="h-6 w-6" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-extrabold">
                {counts.flagged} post{counts.flagged === 1 ? " has" : "s have"} been up for more than{" "}
                {STALE_POST_DAYS} days
              </p>
              <p className="mt-1 text-sm text-foreground/70">
                Nothing is removed on a timer. They stay until you clear them here.
              </p>
            </div>
            <Button variant="danger" onClick={removeFlagged} disabled={purging}>
              <Trash2 className="h-4 w-4" />
              {purging ? "Removing…" : `Remove all ${counts.flagged} flagged`}
            </Button>
          </CardContent>
        </Card>
      ) : null}

      <Card className="mt-4">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Users className="h-5 w-5 text-primary" />
            {loading ? "Loading…" : `${filtered.length} post${filtered.length === 1 ? "" : "s"}`}
          </CardTitle>
          <CardDescription>Newest first.</CardDescription>
        </CardHeader>

        <CardContent className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_12rem]">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-foreground/50" />
              <Input
                className="pl-9"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Title, subject or who posted it…"
              />
            </div>
            <Select value={view} onChange={(e) => setView(e.target.value as typeof view)}>
              <option value="all">Everything</option>
              <option value="flagged">Flagged only</option>
              <option value="open">Open only</option>
              <option value="closed">Closed only</option>
            </Select>
          </div>

          {!loading && filtered.length === 0 ? (
            <p className="rounded-2xl bg-background p-8 text-center text-sm text-foreground/70">
              {counts.total === 0 ? "Nothing has been posted yet." : "Nothing matches those filters."}
            </p>
          ) : (
            <ul className="space-y-2">
              {paged.pageItems.map((post) => (
                <li
                  key={post.id}
                  className={
                    "rounded-2xl p-4 " + (post.flagged ? "bg-warning/10" : "bg-background")
                  }
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-extrabold">{post.title}</span>
                        {post.flagged ? <Badge tone="warning">Flagged</Badge> : null}
                        {post.status === TeamPostStatuses.Open ? (
                          <Badge tone="success">Open</Badge>
                        ) : (
                          <Badge tone="neutral">Closed</Badge>
                        )}
                      </div>

                      <p className="mt-1 text-sm text-foreground/70">
                        {KIND_LABELS[post.kind]} · {post.subject}
                        {post.academicYear ? ` · Year ${post.academicYear}` : ""} ·{" "}
                        {DIFFICULTY_LABELS[post.difficulty]}
                        {post.projectName ? ` · ${post.projectName}` : ""}
                      </p>

                      <p className="mt-1 text-xs text-foreground/55">
                        Posted by{" "}
                        {/*
                          Deep-links into the account drawer on the Users page,
                          the same route the security alerts use. Admin-only by
                          construction: this page lives under /admin, and the
                          student board renders the poster's name as plain text.
                        */}
                        {post.ownerId ? (
                          <Link
                            href={`/admin/users?user=${post.ownerId}`}
                            className="font-semibold text-primary underline-offset-2 hover:underline"
                            title={`Open ${post.ownerName ?? "this account"}`}
                          >
                            {post.ownerName ?? "this account"}
                          </Link>
                        ) : (
                          <span className="font-semibold">a deleted account</span>
                        )}
                        {" · "}
                        {when(post.createdAt)}
                      </p>
                    </div>

                    <span className="flex shrink-0 items-center gap-2">
                      <span
                        className={
                          "text-xs font-bold " +
                          (post.flagged ? "text-warning" : "text-foreground/45")
                        }
                      >
                        {postAgeLabel(post.createdAt)}
                      </span>
                      {post.ownerId ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => banOwner(post)}
                          disabled={banningId === post.id}
                          aria-label={`Ban ${post.ownerName ?? "the poster"}`}
                          title={`Ban ${post.ownerName ?? "the poster"}`}
                        >
                          <Ban className="h-4 w-4 text-risk" />
                        </Button>
                      ) : null}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeOne(post)}
                        disabled={deletingId === post.id}
                        aria-label={`Delete ${post.title}`}
                        title={`Delete ${post.title}`}
                      >
                        <Trash2 className="h-4 w-4 text-risk" />
                      </Button>
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}

          <Pagination paged={paged} noun="posts" />
        </CardContent>
      </Card>
    </div>
  );
}
