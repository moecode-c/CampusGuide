"use client";

import * as React from "react";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowDown, ArrowUp, ExternalLink, Eye, EyeOff, Plus, Trash2, Video } from "lucide-react";
import { youtubeIdFromInput, youtubeThumbnail } from "@/lib/youtube";
import { MAX_LESSONS_PER_COURSE, lessonCountLabel, type VideoCourseDetail } from "@/lib/videoCourses";

/**
 * One editable row in the lesson list.
 *
 * `key` is local and never sent: it keeps React identity stable while rows move
 * around. `id` is the stored subdocument id, sent back on save so reordering
 * does not mint new ids and break links students have already shared.
 */
type LessonDraft = {
  key: string;
  id?: string;
  title: string;
  url: string;
  durationLabel: string;
  description: string;
};

type Draft = {
  title: string;
  slug: string;
  subject: string;
  academicYear: string;
  instructor: string;
  description: string;
  published: boolean;
  lessons: LessonDraft[];
};

let keyCounter = 0;
const nextKey = () => `l${(keyCounter += 1)}`;

/** Existing lessons are shown as watch links — recognisable, and they re-parse to the same id. */
function watchUrl(videoId: string) {
  return `https://www.youtube.com/watch?v=${videoId}`;
}

function toDraft(course: VideoCourseDetail): Draft {
  return {
    title: course.title,
    slug: course.slug,
    subject: course.subject ?? "",
    academicYear: course.academicYear ? String(course.academicYear) : "",
    instructor: course.instructor ?? "",
    description: course.description ?? "",
    published: course.published,
    lessons: course.lessons.map((l) => ({
      key: nextKey(),
      id: l.id,
      title: l.title,
      url: watchUrl(l.videoId),
      durationLabel: l.durationLabel ?? "",
      description: l.description ?? "",
    })),
  };
}

function emptyLesson(): LessonDraft {
  return { key: nextKey(), id: undefined, title: "", url: "", durationLabel: "", description: "" };
}

export function VideoCourseManager() {
  const [courses, setCourses] = React.useState<VideoCourseDetail[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [notice, setNotice] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);

  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [draft, setDraft] = React.useState<Draft | null>(null);

  const [newTitle, setNewTitle] = React.useState("");
  const [creating, setCreating] = React.useState(false);

  const selected = courses.find((c) => c.id === selectedId) ?? null;

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/video-courses", { cache: "no-store" });
      const j = await res.json().catch(() => null);
      if (!res.ok) {
        setError(j?.error ?? "Failed to load courses");
        return;
      }
      setCourses((j?.items ?? []) as VideoCourseDetail[]);
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

  /** Selecting a course loads a fresh draft; unsaved edits to the previous one are dropped. */
  function select(course: VideoCourseDetail) {
    setSelectedId(course.id);
    setDraft(toDraft(course));
    setNotice(null);
    setError(null);
  }

  async function create() {
    const title = newTitle.trim();
    if (!title) return;

    setCreating(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/video-courses", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ title }),
      });
      const j = await res.json().catch(() => null);
      if (!res.ok) {
        setError(j?.error ?? "Could not create the course");
        return;
      }

      const created = j.item as VideoCourseDetail;
      setCourses((prev) => [created, ...prev]);
      setNewTitle("");
      select(created);
      setNotice(`"${created.title}" created as a draft. Add videos, then publish it.`);
    } catch {
      setError("Network error. Check your connection and try again.");
    } finally {
      setCreating(false);
    }
  }

  async function save() {
    if (!selectedId || !draft) return;

    const invalid = draft.lessons.find((l) => !youtubeIdFromInput(l.url));
    if (invalid) {
      setError(`"${invalid.title || "Untitled video"}" does not have a valid YouTube link.`);
      return;
    }
    const untitled = draft.lessons.find((l) => !l.title.trim());
    if (untitled) {
      setError("Every video needs a title.");
      return;
    }

    setSaving(true);
    setError(null);
    setNotice(null);

    try {
      const res = await fetch(`/api/admin/video-courses/${selectedId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          title: draft.title.trim(),
          slug: draft.slug.trim(),
          subject: draft.subject.trim(),
          instructor: draft.instructor.trim(),
          description: draft.description.trim(),
          // null clears it: a course with no year is general and shows to every student.
          academicYear: draft.academicYear ? Number(draft.academicYear) : null,
          published: draft.published,
          lessons: draft.lessons.map((l) => ({
            ...(l.id ? { id: l.id } : {}),
            title: l.title.trim(),
            url: l.url.trim(),
            durationLabel: l.durationLabel.trim(),
            description: l.description.trim(),
          })),
        }),
      });

      const j = await res.json().catch(() => null);
      if (!res.ok) {
        setError(j?.error ?? "Could not save the course");
        return;
      }

      const item = j.item as VideoCourseDetail;
      setCourses((prev) => prev.map((c) => (c.id === item.id ? item : c)));
      // Re-seed from the server so ids minted on this save are in hand for the next one.
      setDraft(toDraft(item));
      setNotice("Saved.");
    } catch {
      setError("Network error. Check your connection and try again.");
    } finally {
      setSaving(false);
    }
  }

  async function remove(course: VideoCourseDetail) {
    const ok = window.confirm(
      `Delete "${course.title}" and its ${lessonCountLabel(course.lessonCount)}? This cannot be undone.`
    );
    if (!ok) return;

    setError(null);
    try {
      const res = await fetch(`/api/admin/video-courses/${course.id}`, { method: "DELETE" });
      const j = await res.json().catch(() => null);
      if (!res.ok) {
        setError(j?.error ?? "Could not delete the course");
        return;
      }
      setCourses((prev) => prev.filter((c) => c.id !== course.id));
      if (selectedId === course.id) {
        setSelectedId(null);
        setDraft(null);
      }
      setNotice(`"${course.title}" deleted.`);
    } catch {
      setError("Network error. Check your connection and try again.");
    }
  }

  function patchDraft(patch: Partial<Draft>) {
    setDraft((d) => (d ? { ...d, ...patch } : d));
  }

  function patchLesson(key: string, patch: Partial<LessonDraft>) {
    setDraft((d) =>
      d ? { ...d, lessons: d.lessons.map((l) => (l.key === key ? { ...l, ...patch } : l)) } : d
    );
  }

  function moveLesson(index: number, delta: number) {
    setDraft((d) => {
      if (!d) return d;
      const target = index + delta;
      if (target < 0 || target >= d.lessons.length) return d;
      const lessons = [...d.lessons];
      [lessons[index], lessons[target]] = [lessons[target], lessons[index]];
      return { ...d, lessons };
    });
  }

  return (
    <div className="grid gap-4 xl:grid-cols-[22rem_minmax(0,1fr)]">
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Plus className="h-5 w-5 text-primary" />
              New course
            </CardTitle>
            <CardDescription>
              A course is a named playlist &mdash; &ldquo;Networks&rdquo;, &ldquo;Data Structures&rdquo;. It starts
              as a draft only admins can see.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Input
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") create();
              }}
              placeholder="Course name…"
            />
            <Button className="w-full" onClick={create} disabled={creating || !newTitle.trim()}>
              {creating ? "Creating…" : "Create course"}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Video className="h-5 w-5 text-primary" />
              Courses
            </CardTitle>
            <CardDescription>
              {courses.length} course{courses.length === 1 ? "" : "s"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-sm text-foreground/70">Loading…</p>
            ) : courses.length === 0 ? (
              <p className="text-sm text-foreground/70">Nothing yet. Create your first course above.</p>
            ) : (
              <ul className="space-y-2">
                {courses.map((course) => {
                  const active = course.id === selectedId;
                  return (
                    <li key={course.id}>
                      <button
                        type="button"
                        onClick={() => select(course)}
                        className={
                          "w-full rounded-2xl px-4 py-3 text-left transition-colors " +
                          (active ? "bg-primary text-white" : "bg-background hover:bg-panel/60")
                        }
                      >
                        <span className="flex items-center gap-2">
                          <span className="min-w-0 flex-1 truncate text-sm font-bold">{course.title}</span>
                          {course.published ? (
                            <Eye className={active ? "h-4 w-4 text-white/80" : "h-4 w-4 text-success"} />
                          ) : (
                            <EyeOff className={active ? "h-4 w-4 text-white/80" : "h-4 w-4 text-foreground/40"} />
                          )}
                        </span>
                        <span
                          className={
                            "mt-0.5 block truncate text-xs " +
                            (active ? "text-white/70" : "text-foreground/50")
                          }
                        >
                          {lessonCountLabel(course.lessonCount)}
                          {course.subject ? ` · ${course.subject}` : ""}
                          {course.published ? "" : " · draft"}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="space-y-4">
        {error ? (
          <p className="rounded-2xl bg-risk/10 px-4 py-3 text-sm font-semibold text-risk">{error}</p>
        ) : null}
        {notice ? (
          <p className="rounded-2xl bg-success/10 px-4 py-3 text-sm font-semibold text-success">{notice}</p>
        ) : null}

        {!selected || !draft ? (
          <Card>
            <CardContent className="py-16 text-center">
              <Video className="mx-auto h-10 w-10 text-foreground/25" />
              <p className="mt-3 text-sm font-extrabold">Pick a course to edit</p>
              <p className="mt-1 text-sm text-foreground/70">
                Or create one on the left. Videos are added by pasting a YouTube link.
              </p>
            </CardContent>
          </Card>
        ) : (
          <>
            <Card>
              <CardHeader>
                <CardTitle className="flex flex-wrap items-center gap-2">
                  Course details
                  {draft.published ? <Badge tone="success">Live</Badge> : <Badge tone="warning">Draft</Badge>}
                </CardTitle>
                <CardDescription className="flex flex-wrap items-center gap-2">
                  <span>Students open this at</span>
                  <Link
                    href={`/videos/${draft.slug}`}
                    target="_blank"
                    className="inline-flex items-center gap-1 font-semibold text-primary hover:underline"
                  >
                    /videos/{draft.slug}
                    <ExternalLink className="h-3.5 w-3.5" />
                  </Link>
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid gap-3 md:grid-cols-2">
                  <label className="block">
                    <span className="mb-1 block text-xs font-bold text-foreground/60">Title</span>
                    <Input value={draft.title} onChange={(e) => patchDraft({ title: e.target.value })} />
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-xs font-bold text-foreground/60">URL name</span>
                    <Input
                      value={draft.slug}
                      onChange={(e) => patchDraft({ slug: e.target.value })}
                      placeholder="networks"
                    />
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-xs font-bold text-foreground/60">Subject</span>
                    <Input
                      value={draft.subject}
                      onChange={(e) => patchDraft({ subject: e.target.value })}
                      placeholder="Networks"
                    />
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-xs font-bold text-foreground/60">Year</span>
                    <Select
                      value={draft.academicYear}
                      onChange={(e) => patchDraft({ academicYear: e.target.value })}
                    >
                      <option value="">All years</option>
                      <option value="1">Year 1</option>
                      <option value="2">Year 2</option>
                      <option value="3">Year 3</option>
                      <option value="4">Year 4</option>
                    </Select>
                  </label>
                  <label className="block md:col-span-2">
                    <span className="mb-1 block text-xs font-bold text-foreground/60">Instructor (optional)</span>
                    <Input
                      value={draft.instructor}
                      onChange={(e) => patchDraft({ instructor: e.target.value })}
                    />
                  </label>
                </div>

                <label className="block">
                  <span className="mb-1 block text-xs font-bold text-foreground/60">Description (optional)</span>
                  <textarea
                    value={draft.description}
                    onChange={(e) => patchDraft({ description: e.target.value })}
                    rows={3}
                    className="w-full rounded-xl border border-foreground/15 bg-background p-3 text-sm focus:outline-none focus:ring-4 focus:ring-accent/30"
                    placeholder="What this course covers…"
                  />
                </label>

                <label className="flex items-start gap-3 rounded-2xl bg-background p-4">
                  <input
                    type="checkbox"
                    checked={draft.published}
                    onChange={(e) => patchDraft({ published: e.target.checked })}
                    className="mt-0.5 h-5 w-5 shrink-0 accent-primary"
                  />
                  <span className="text-sm">
                    <span className="block font-bold">Visible to students</span>
                    <span className="block text-foreground/65">
                      Off keeps it a draft while you build it. Nothing shows on the Videos page until this is on.
                    </span>
                  </span>
                </label>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Video className="h-5 w-5 text-primary" />
                  Videos
                </CardTitle>
                <CardDescription>
                  {draft.lessons.length} in this course, played in this order. Paste any YouTube link &mdash; a
                  watch link, a share link, or the id on its own.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {draft.lessons.length === 0 ? (
                  <p className="rounded-2xl bg-background p-6 text-center text-sm text-foreground/70">
                    No videos yet. Add the first one below.
                  </p>
                ) : (
                  draft.lessons.map((lesson, index) => {
                    const videoId = youtubeIdFromInput(lesson.url);
                    const badLink = lesson.url.trim().length > 0 && !videoId;

                    return (
                      <div key={lesson.key} className="rounded-2xl bg-background p-3">
                        <div className="flex flex-col gap-3 sm:flex-row">
                          <div className="w-full shrink-0 overflow-hidden rounded-xl bg-foreground/5 sm:w-28">
                            <div className="aspect-video w-full">
                              {videoId ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                  src={youtubeThumbnail(videoId)}
                                  alt=""
                                  className="h-full w-full object-cover"
                                  loading="lazy"
                                />
                              ) : (
                                <div className="grid h-full w-full place-items-center text-xs text-foreground/40">
                                  {index + 1}
                                </div>
                              )}
                            </div>
                          </div>

                          <div className="min-w-0 flex-1 space-y-2">
                            <Input
                              value={lesson.title}
                              onChange={(e) => patchLesson(lesson.key, { title: e.target.value })}
                              placeholder={`Video ${index + 1} title…`}
                            />
                            <Input
                              value={lesson.url}
                              onChange={(e) => patchLesson(lesson.key, { url: e.target.value })}
                              placeholder="https://www.youtube.com/watch?v=…"
                              className={badLink ? "border-risk" : undefined}
                            />
                            {badLink ? (
                              <p className="text-xs font-semibold text-risk">
                                That is not a YouTube link. Only YouTube videos can be added.
                              </p>
                            ) : null}
                          </div>

                          <div className="flex shrink-0 flex-col gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => moveLesson(index, -1)}
                              disabled={index === 0}
                              aria-label="Move up"
                            >
                              <ArrowUp className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => moveLesson(index, 1)}
                              disabled={index === draft.lessons.length - 1}
                              aria-label="Move down"
                            >
                              <ArrowDown className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() =>
                                patchDraft({ lessons: draft.lessons.filter((l) => l.key !== lesson.key) })
                              }
                              aria-label="Remove video"
                            >
                              <Trash2 className="h-4 w-4 text-risk" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}

                <Button
                  variant="secondary"
                  onClick={() => patchDraft({ lessons: [...draft.lessons, emptyLesson()] })}
                  disabled={draft.lessons.length >= MAX_LESSONS_PER_COURSE}
                >
                  <Plus className="h-4 w-4" />
                  Add a video
                </Button>
              </CardContent>
            </Card>

            <div className="flex flex-wrap items-center gap-3">
              <Button onClick={save} disabled={saving}>
                {saving ? "Saving…" : "Save course"}
              </Button>
              <Button variant="ghost" onClick={() => setDraft(toDraft(selected))} disabled={saving}>
                Discard changes
              </Button>
              <Button variant="danger" className="ml-auto" onClick={() => remove(selected)} disabled={saving}>
                <Trash2 className="h-4 w-4" />
                Delete course
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
