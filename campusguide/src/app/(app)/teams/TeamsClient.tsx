"use client";

import * as React from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  CheckCircle2,
  Loader2,
  MessageCircle,
  Phone,
  Plus,
  Search,
  Trash2,
  Users,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { MIN_SEARCH_LENGTH, SEARCH_DEBOUNCE_MS, searchTerm } from "@/lib/search";
import {
  DIFFICULTY_HINTS,
  DIFFICULTY_LABELS,
  DIFFICULTY_TONES,
  KIND_LABELS,
  MAX_OPEN_POSTS_PER_ACCOUNT,
  MAX_SKILLS,
  TeamDifficulties,
  TeamPostKinds,
  TeamPostStatuses,
  formatPhone,
  isAtPostLimit,
  parseSkills,
  remainingPostsLabel,
  whatsappNumber,
  type TeamDifficulty,
  type TeamPostKind,
} from "@/lib/teams";

type Post = {
  id: string;
  kind: TeamPostKind;
  title: string;
  subject: string;
  academicYear: number | null;
  projectName: string | null;
  description: string | null;
  difficulty: TeamDifficulty;
  skillsNeeded: string[];
  currentMembers: number;
  neededCount: number | null;
  contactPhone: string;
  contactWhatsapp: boolean;
  status: "open" | "closed";
  ownerName: string;
  isOwner: boolean;
  /** Owner or admin. Sent by the server so the card never reasons about roles. */
  canDelete: boolean;
  createdAt: string | null;
};

type FeedResponse = {
  posts: Post[];
  defaults: { name: string | null; phone: string | null; academicYear: number | null };
  /** How many of this account's posts are live, and the ceiling. */
  quota?: { openPosts: number; max: number };
};

const DIFFICULTY_ORDER = [
  TeamDifficulties.Easy,
  TeamDifficulties.Medium,
  TeamDifficulties.Hard,
] as const;

function relative(iso: string | null) {
  if (!iso) return "";
  const seconds = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
  if (seconds < 60) return "just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
  return new Date(iso).toLocaleDateString();
}

/**
 * The number is revealed on click rather than rendered into every card.
 * Everyone signed in can still get it in one tap; what it stops is one page
 * load handing over every phone number on the board at once.
 */
function ContactBlock({ post }: { post: Post }) {
  const [shown, setShown] = React.useState(false);
  const wa = whatsappNumber(post.contactPhone);

  if (!shown) {
    return (
      <Button variant="secondary" className="w-full" onClick={() => setShown(true)}>
        <Phone className="h-4 w-4" />
        Show contact
      </Button>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <a
        href={`tel:${post.contactPhone}`}
        className="flex items-center justify-center gap-2 rounded-xl border border-foreground/15 bg-background px-3 py-2.5 text-sm font-semibold tracking-wide hover:border-foreground/30"
      >
        <Phone className="h-4 w-4 text-primary" />
        {formatPhone(post.contactPhone)}
      </a>
      {post.contactWhatsapp && wa ? (
        <a
          href={`https://wa.me/${wa}?text=${encodeURIComponent(
            `Hi! I saw your CampusGuide post "${post.title}".`
          )}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-2 rounded-xl bg-success/15 px-3 py-2.5 text-sm font-semibold text-success hover:bg-success/25"
        >
          <MessageCircle className="h-4 w-4" />
          Message on WhatsApp
        </a>
      ) : null}
    </div>
  );
}

function PostCard({
  post,
  onClose,
  onReopen,
  onDelete,
  busy,
}: {
  post: Post;
  onClose: (id: string) => void;
  onReopen: (id: string) => void;
  onDelete: (id: string) => void;
  busy: boolean;
}) {
  const closed = post.status === TeamPostStatuses.Closed;
  const spotsLeft = post.kind === TeamPostKinds.NeedsMembers ? post.neededCount : null;

  return (
    <Card className={cn("flex flex-col", closed && "opacity-60")}>
      <CardHeader className="space-y-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge tone={post.kind === TeamPostKinds.NeedsMembers ? "neutral" : "success"}>
            {KIND_LABELS[post.kind]}
          </Badge>
          <Badge tone={DIFFICULTY_TONES[post.difficulty]}>
            {DIFFICULTY_LABELS[post.difficulty]}
          </Badge>
          {closed ? <Badge tone="risk">Closed</Badge> : null}
        </div>

        <CardTitle className="leading-snug">{post.title}</CardTitle>

        <CardDescription>
          {post.subject}
          {post.academicYear ? ` · Year ${post.academicYear}` : ""}
          {post.projectName ? ` · ${post.projectName}` : ""}
        </CardDescription>
      </CardHeader>

      <CardContent className="flex flex-1 flex-col gap-3">
        {post.description ? (
          <p className="whitespace-pre-line text-sm text-foreground/80">{post.description}</p>
        ) : null}

        {post.skillsNeeded.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {post.skillsNeeded.map((s) => (
              <span
                key={s}
                className="rounded-full border border-foreground/10 bg-accent/10 px-2.5 py-1 text-xs font-semibold text-foreground/80"
              >
                {s}
              </span>
            ))}
          </div>
        ) : null}

        <div className="flex items-center gap-2 text-xs font-semibold text-foreground/60">
          <Users className="h-3.5 w-3.5" />
          {post.kind === TeamPostKinds.NeedsMembers ? (
            <span>
              {post.currentMembers} in the team
              {spotsLeft ? ` · ${spotsLeft} ${spotsLeft === 1 ? "spot" : "spots"} left` : ""}
            </span>
          ) : (
            <span>Solo — wants to join a team</span>
          )}
        </div>

        {/* mt-auto pins the contact block to the bottom so cards of different
            description lengths still line up in the grid. */}
        <div className="mt-auto space-y-2 pt-2">
          <p className="text-xs text-foreground/55">
            Posted by <span className="font-semibold text-foreground/75">{post.ownerName}</span>
            {post.createdAt ? ` · ${relative(post.createdAt)}` : ""}
          </p>

          {closed ? null : <ContactBlock post={post} />}

          {post.isOwner || post.canDelete ? (
            <div className="flex gap-2">
              {post.isOwner ? (closed ? (
                <Button
                  variant="ghost"
                  size="sm"
                  className="flex-1"
                  disabled={busy}
                  onClick={() => onReopen(post.id)}
                >
                  Reopen
                </Button>
              ) : (
                <Button
                  variant="ghost"
                  size="sm"
                  className="flex-1"
                  disabled={busy}
                  onClick={() => onClose(post.id)}
                >
                  <CheckCircle2 className="h-4 w-4" />
                  Mark filled
                </Button>
              )) : null}
              {/* Closing and reopening stay with the owner; removing is also an
                  admin's job, which is what canDelete carries. */}
              {post.canDelete ? (
                <Button
                  variant="danger"
                  size="sm"
                  disabled={busy}
                  onClick={() => onDelete(post.id)}
                  aria-label="Delete post"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              ) : null}
            </div>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}

const EMPTY_FORM = {
  kind: TeamPostKinds.NeedsMembers as TeamPostKind,
  title: "",
  subject: "",
  academicYear: "",
  projectName: "",
  description: "",
  difficulty: TeamDifficulties.Medium as TeamDifficulty,
  skills: "",
  currentMembers: "1",
  neededCount: "1",
  contactPhone: "",
  contactWhatsapp: true,
};

export function TeamsClient() {
  const [tab, setTab] = React.useState<"browse" | "mine">("browse");
  const [q, setQ] = React.useState("");
  const [kind, setKind] = React.useState("");
  const [difficulty, setDifficulty] = React.useState("");
  const [academicYear, setAcademicYear] = React.useState("");

  const [data, setData] = React.useState<FeedResponse | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [busyId, setBusyId] = React.useState<string | null>(null);

  const [open, setOpen] = React.useState(false);
  const [form, setForm] = React.useState(EMPTY_FORM);
  const [submitting, setSubmitting] = React.useState(false);
  const [formError, setFormError] = React.useState<string | null>(null);

  // Debouncing narrows the race but doesn't close it: a slow request for "ab"
  // can still land after a fast one for "abc". Only the newest may write state.
  const requestSeq = React.useRef(0);

  // Depending on the derived term rather than the raw input means the first
  // character typed leaves this unchanged, so `load` keeps its identity and the
  // effect below never fires for it.
  const term = searchTerm(q);

  const load = React.useCallback(async () => {
    const seq = ++requestSeq.current;
    setLoading(true);

    const params = new URLSearchParams();
    if (term) params.set("q", term);
    if (kind) params.set("kind", kind);
    if (difficulty) params.set("difficulty", difficulty);
    if (academicYear) params.set("academicYear", academicYear);
    if (tab === "mine") params.set("mine", "1");

    try {
      const res = await fetch(`/api/student/teams?${params.toString()}`);
      const j = await res.json().catch(() => null);
      if (seq !== requestSeq.current) return;
      if (!res.ok) {
        setError(j?.error ?? "Failed to load teams");
        return;
      }
      setData(j as FeedResponse);
      setError(null);
    } catch {
      if (seq === requestSeq.current) setError("Network error. Check your connection and try again.");
    } finally {
      if (seq === requestSeq.current) setLoading(false);
    }
  }, [academicYear, difficulty, kind, tab, term]);

  React.useEffect(() => {
    const handle = window.setTimeout(load, SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(handle);
  }, [load]);

  const defaults = data?.defaults;

  const openPosts = data?.quota?.openPosts ?? 0;
  const atLimit = isAtPostLimit(openPosts);

  // Prefill the contact number from the account once the feed has loaded, but
  // never overwrite something the user has already typed.
  const openCreate = React.useCallback(() => {
    setForm({
      ...EMPTY_FORM,
      contactPhone: defaults?.phone ?? "",
      academicYear: defaults?.academicYear ? String(defaults.academicYear) : "",
    });
    setFormError(null);
    setOpen(true);
  }, [defaults]);

  const submit = async () => {
    if (!form.title.trim() || !form.subject.trim()) {
      setFormError("Title and subject are both required.");
      return;
    }
    if (!form.contactPhone.trim()) {
      setFormError("A contact number is required — that's how people reach you.");
      return;
    }

    setSubmitting(true);
    setFormError(null);

    const isNeedsMembers = form.kind === TeamPostKinds.NeedsMembers;

    try {
      const res = await fetch("/api/student/teams", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          kind: form.kind,
          title: form.title.trim(),
          subject: form.subject.trim(),
          academicYear: form.academicYear ? Number(form.academicYear) : undefined,
          projectName: form.projectName.trim() || undefined,
          description: form.description.trim() || undefined,
          difficulty: form.difficulty,
          skillsNeeded: parseSkills(form.skills),
          currentMembers: isNeedsMembers ? Number(form.currentMembers) || 1 : 1,
          neededCount: isNeedsMembers ? Number(form.neededCount) || 1 : undefined,
          contactPhone: form.contactPhone.trim(),
          contactWhatsapp: form.contactWhatsapp,
        }),
      });

      const j = await res.json().catch(() => null);
      if (!res.ok) {
        setFormError(
          res.status === 429
            ? "You've posted a lot recently. Try again in a little while."
            : j?.error ?? "Could not post. Check the form and try again."
        );
        return;
      }

      setOpen(false);
      setForm(EMPTY_FORM);
      // Jump to your own board so the new post is visible immediately.
      setTab("mine");
    } catch {
      setFormError("Network error. Check your connection and try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const patch = async (id: string, body: Record<string, unknown>) => {
    setBusyId(id);
    try {
      const res = await fetch(`/api/student/teams/${id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        // The post cap answers here on a reopen, and its message is the whole
        // point — a bare "could not update" would leave the student guessing.
        const j = await res.json().catch(() => null);
        setError(j?.error ?? "Could not update that post.");
        return;
      }
      await load();
    } catch {
      setError("Network error. Check your connection and try again.");
    } finally {
      setBusyId(null);
    }
  };

  const remove = async (id: string) => {
    if (!window.confirm("Delete this post? This can't be undone.")) return;
    setBusyId(id);
    try {
      const res = await fetch(`/api/student/teams/${id}`, { method: "DELETE" });
      if (!res.ok) {
        setError("Could not delete that post.");
        return;
      }
      await load();
    } catch {
      setError("Network error. Check your connection and try again.");
    } finally {
      setBusyId(null);
    }
  };

  const posts = data?.posts ?? [];
  const isNeedsMembers = form.kind === TeamPostKinds.NeedsMembers;

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">Project Teams</h1>
          <p className="text-sm text-foreground/70">
            Post the spots your team still needs, or put your name up and let a team find you.
          </p>
        </div>
        <div className="flex w-full flex-col items-stretch gap-1 sm:w-auto sm:items-end">
          <Button className="w-full sm:w-auto" onClick={openCreate} disabled={atLimit}>
            <Plus className="h-4 w-4" />
            Post a team
          </Button>
          <p className={cn("text-xs", atLimit ? "font-semibold text-warning" : "text-foreground/50")}>
            {openPosts} of {MAX_OPEN_POSTS_PER_ACCOUNT} posts live
            {atLimit ? " — close one to post again" : ` · ${remainingPostsLabel(openPosts)}`}
          </p>
        </div>
      </div>

      <div className="mt-4 flex gap-1 rounded-2xl border border-foreground/10 bg-panel p-1">
        {(
          [
            ["browse", "Browse board"],
            ["mine", "My posts"],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            onClick={() => setTab(value)}
            aria-pressed={tab === value}
            className={cn(
              "flex-1 rounded-xl px-3 py-2 text-sm font-semibold transition-colors",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
              tab === value
                ? "bg-primary text-white"
                : "text-foreground/70 hover:bg-background/60 hover:text-foreground"
            )}
          >
            {label}
          </button>
        ))}
      </div>

      <Card className="mt-4">
        <CardContent className="pt-5">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="relative sm:col-span-2 lg:col-span-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-foreground/40" />
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search subject, title, project…"
                className="pl-9"
                aria-label="Search team posts"
              />
              {/* Without this, one typed character looks like a broken search
                  rather than a deliberate floor. */}
              {q.trim().length > 0 && q.trim().length < MIN_SEARCH_LENGTH ? (
                <p className="mt-1 text-xs text-foreground/50">
                  Keep typing — search starts at {MIN_SEARCH_LENGTH} characters.
                </p>
              ) : null}
            </div>

            <Select value={kind} onChange={(e) => setKind(e.target.value)} aria-label="Post type">
              <option value="">Everyone</option>
              <option value={TeamPostKinds.NeedsMembers}>Teams looking for members</option>
              <option value={TeamPostKinds.NeedsTeam}>Students looking for a team</option>
            </Select>

            <Select
              value={difficulty}
              onChange={(e) => setDifficulty(e.target.value)}
              aria-label="Project difficulty"
            >
              <option value="">Any difficulty</option>
              {DIFFICULTY_ORDER.map((d) => (
                <option key={d} value={d}>
                  {DIFFICULTY_LABELS[d]} — {DIFFICULTY_HINTS[d]}
                </option>
              ))}
            </Select>

            <Select
              value={academicYear}
              onChange={(e) => setAcademicYear(e.target.value)}
              aria-label="Academic year"
            >
              <option value="">Any year</option>
              {[1, 2, 3, 4].map((y) => (
                <option key={y} value={y}>
                  Year {y}
                </option>
              ))}
            </Select>
          </div>
        </CardContent>
      </Card>

      {error ? (
        <p className="mt-4 rounded-xl border border-risk/25 bg-risk/10 px-4 py-3 text-sm font-semibold text-risk">
          {error}
        </p>
      ) : null}

      <div className="mt-4">
        {loading && posts.length === 0 ? (
          <div className="flex items-center gap-2 py-10 text-sm text-foreground/60">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading the board…
          </div>
        ) : posts.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
              <Users className="h-8 w-8 text-foreground/30" />
              <p className="text-sm font-semibold text-foreground/80">
                {tab === "mine" ? "You haven't posted anything yet." : "Nothing on the board yet."}
              </p>
              <p className="max-w-sm text-sm text-foreground/60">
                {tab === "mine"
                  ? "Post a team and students looking for one will be able to reach you."
                  : "Be the first — post the spots your team needs, or put your name up."}
              </p>
              <Button onClick={openCreate} disabled={atLimit}>
                <Plus className="h-4 w-4" />
                Post a team
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {posts.map((p) => (
              <PostCard
                key={p.id}
                post={p}
                busy={busyId === p.id}
                onClose={(id) => patch(id, { status: TeamPostStatuses.Closed })}
                onReopen={(id) => patch(id, { status: TeamPostStatuses.Open })}
                onDelete={remove}
              />
            ))}
          </div>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Post to the team board</DialogTitle>
            <DialogDescription>
              Your name and number are shown to signed-in students so they can reach you.
            </DialogDescription>
          </DialogHeader>

          <div className="mt-4 space-y-4">
            <div className="grid grid-cols-2 gap-2">
              {(
                [
                  [TeamPostKinds.NeedsMembers, "I have a team", "We need more people"],
                  [TeamPostKinds.NeedsTeam, "I need a team", "Looking to join one"],
                ] as const
              ).map(([value, label, hint]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, kind: value }))}
                  aria-pressed={form.kind === value}
                  className={cn(
                    "rounded-xl border p-3 text-left transition-colors",
                    form.kind === value
                      ? "border-primary bg-primary/10"
                      : "border-foreground/15 hover:border-foreground/30"
                  )}
                >
                  <span className="block text-sm font-bold">{label}</span>
                  <span className="block text-xs text-foreground/60">{hint}</span>
                </button>
              ))}
            </div>

            <label className="block space-y-1.5">
              <span className="text-sm font-semibold">Title</span>
              <Input
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                placeholder="Need 2 people for the Software Engineering project"
                maxLength={120}
              />
            </label>

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block space-y-1.5">
                <span className="text-sm font-semibold">Subject</span>
                <Input
                  value={form.subject}
                  onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value }))}
                  placeholder="Software Engineering"
                  maxLength={80}
                />
              </label>

              <label className="block space-y-1.5">
                <span className="text-sm font-semibold">
                  Project name <span className="font-normal text-foreground/50">(optional)</span>
                </span>
                <Input
                  value={form.projectName}
                  onChange={(e) => setForm((f) => ({ ...f, projectName: e.target.value }))}
                  placeholder="Library management system"
                  maxLength={120}
                />
              </label>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block space-y-1.5">
                <span className="text-sm font-semibold">Difficulty you want</span>
                <Select
                  value={form.difficulty}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, difficulty: e.target.value as TeamDifficulty }))
                  }
                >
                  {DIFFICULTY_ORDER.map((d) => (
                    <option key={d} value={d}>
                      {DIFFICULTY_LABELS[d]} — {DIFFICULTY_HINTS[d]}
                    </option>
                  ))}
                </Select>
              </label>

              <label className="block space-y-1.5">
                <span className="text-sm font-semibold">Year</span>
                <Select
                  value={form.academicYear}
                  onChange={(e) => setForm((f) => ({ ...f, academicYear: e.target.value }))}
                >
                  <option value="">Not specified</option>
                  {[1, 2, 3, 4].map((y) => (
                    <option key={y} value={y}>
                      Year {y}
                    </option>
                  ))}
                </Select>
              </label>
            </div>

            {isNeedsMembers ? (
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block space-y-1.5">
                  <span className="text-sm font-semibold">People already in the team</span>
                  <Input
                    type="number"
                    min={1}
                    max={20}
                    value={form.currentMembers}
                    onChange={(e) => setForm((f) => ({ ...f, currentMembers: e.target.value }))}
                  />
                </label>
                <label className="block space-y-1.5">
                  <span className="text-sm font-semibold">Spots still open</span>
                  <Input
                    type="number"
                    min={1}
                    max={20}
                    value={form.neededCount}
                    onChange={(e) => setForm((f) => ({ ...f, neededCount: e.target.value }))}
                  />
                </label>
              </div>
            ) : null}

            <label className="block space-y-1.5">
              <span className="text-sm font-semibold">
                Skills or roles <span className="font-normal text-foreground/50">(optional, comma separated)</span>
              </span>
              <Input
                value={form.skills}
                onChange={(e) => setForm((f) => ({ ...f, skills: e.target.value }))}
                placeholder="frontend, design, presentation"
              />
              <span className="block text-xs text-foreground/50">Up to {MAX_SKILLS} tags.</span>
            </label>

            <label className="block space-y-1.5">
              <span className="text-sm font-semibold">
                Details <span className="font-normal text-foreground/50">(optional)</span>
              </span>
              <textarea
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                rows={3}
                maxLength={1000}
                placeholder="What the project is, when you plan to meet, anything else worth knowing."
                className="w-full rounded-xl border border-foreground/15 bg-background px-3 py-2.5 text-sm placeholder:text-foreground/50 focus:outline-none focus:ring-4 focus:ring-accent/30"
              />
            </label>

            <label className="block space-y-1.5">
              <span className="text-sm font-semibold">Contact number</span>
              <Input
                value={form.contactPhone}
                onChange={(e) => setForm((f) => ({ ...f, contactPhone: e.target.value }))}
                placeholder="01012345678"
                inputMode="tel"
                maxLength={20}
              />
            </label>

            <label className="flex items-center gap-2.5 text-sm font-semibold">
              <input
                type="checkbox"
                checked={form.contactWhatsapp}
                onChange={(e) => setForm((f) => ({ ...f, contactWhatsapp: e.target.checked }))}
                className="h-4 w-4 rounded border-foreground/25 bg-background accent-primary"
              />
              This number is on WhatsApp
            </label>

            {formError ? (
              <p className="rounded-xl border border-risk/25 bg-risk/10 px-3 py-2 text-sm font-semibold text-risk">
                {formError}
              </p>
            ) : null}
          </div>

          <DialogFooter className="mt-5 gap-2">
            <Button variant="ghost" onClick={() => setOpen(false)} disabled={submitting}>
              Cancel
            </Button>
            <Button onClick={submit} disabled={submitting}>
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              {submitting ? "Posting…" : "Post it"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
