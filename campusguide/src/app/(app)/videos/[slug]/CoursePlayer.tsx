"use client";

import * as React from "react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ChevronLeft, ChevronRight, PlayCircle, User } from "lucide-react";
import { youtubeEmbedUrl, youtubeThumbnail } from "@/lib/youtube";
import { lessonCountLabel, type VideoCourseDetail } from "@/lib/videoCourses";

type Props = {
  slug: string;
  /** From `?lesson=`, so a link to a specific video in the course opens on it. */
  initialLessonId: string | null;
};

export function CoursePlayer({ slug, initialLessonId }: Props) {
  const [course, setCourse] = React.useState<VideoCourseDetail | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [activeId, setActiveId] = React.useState<string | null>(initialLessonId);

  React.useEffect(() => {
    let cancelled = false;

    (async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/student/video-courses?slug=${encodeURIComponent(slug)}`);
        const j = await res.json().catch(() => null);
        if (cancelled) return;

        if (!res.ok) {
          setError(res.status === 404 ? "That course does not exist, or is not published yet." : j?.error ?? "Failed to load the course");
          return;
        }
        setCourse(j.item as VideoCourseDetail);
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
  }, [slug]);

  const lessons = course?.lessons ?? [];
  // A `?lesson=` pointing at a video that has since been removed falls back to
  // the first rather than showing an empty player.
  const activeIndex = Math.max(
    0,
    lessons.findIndex((l) => l.id === activeId)
  );
  const active = lessons[activeIndex] ?? null;

  function play(lessonId: string) {
    setActiveId(lessonId);
    // replaceState rather than the router: this only needs to make the URL
    // shareable, and a navigation would re-fetch the whole course.
    if (typeof window !== "undefined") {
      window.history.replaceState(null, "", `/videos/${slug}?lesson=${lessonId}`);
    }
  }

  if (loading) {
    return <p className="text-sm text-foreground/70">Loading…</p>;
  }

  if (error || !course) {
    return (
      <Card>
        <CardContent className="py-16 text-center">
          <PlayCircle className="mx-auto h-10 w-10 text-foreground/25" />
          <p className="mt-3 text-sm font-extrabold">{error ?? "Course not found"}</p>
          <Link
            href="/videos"
            className="mt-3 inline-block text-sm font-semibold text-primary underline-offset-4 hover:underline"
          >
            Back to all videos
          </Link>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <Link
          href="/videos"
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-foreground/60 transition hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          All videos
        </Link>

        <h1 className="mt-2 text-2xl font-extrabold tracking-tight">{course.title}</h1>

        <div className="mt-2 flex flex-wrap items-center gap-2">
          <Badge tone="neutral">{lessonCountLabel(course.lessonCount)}</Badge>
          {course.subject ? <Badge tone="neutral">{course.subject}</Badge> : null}
          {course.academicYear ? <Badge tone="neutral">Year {course.academicYear}</Badge> : null}
          {course.instructor ? (
            <span className="inline-flex items-center gap-1.5 text-sm text-foreground/65">
              <User className="h-4 w-4" />
              {course.instructor}
            </span>
          ) : null}
        </div>

        {course.description ? (
          <p className="mt-3 max-w-3xl text-sm text-foreground/70">{course.description}</p>
        ) : null}
      </div>

      {lessons.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <PlayCircle className="mx-auto h-10 w-10 text-foreground/25" />
            <p className="mt-3 text-sm font-extrabold">This course has no videos yet</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_22rem]">
          <div className="space-y-3">
            <div className="overflow-hidden rounded-2xl bg-black">
              <div className="aspect-video w-full">
                {active ? (
                  <iframe
                    key={active.id}
                    className="h-full w-full"
                    src={youtubeEmbedUrl(active.videoId)}
                    title={active.title}
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />
                ) : null}
              </div>
            </div>

            {active ? (
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-foreground/45">
                  Video {activeIndex + 1} of {lessons.length}
                </p>
                <h2 className="mt-1 text-lg font-extrabold">{active.title}</h2>
                {active.description ? (
                  <p className="mt-2 text-sm text-foreground/70">{active.description}</p>
                ) : null}
              </div>
            ) : null}

            <div className="flex flex-wrap items-center gap-3">
              <Button
                variant="secondary"
                onClick={() => play(lessons[activeIndex - 1].id)}
                disabled={activeIndex <= 0}
              >
                <ChevronLeft className="h-4 w-4" />
                Previous
              </Button>
              <Button
                onClick={() => play(lessons[activeIndex + 1].id)}
                disabled={activeIndex >= lessons.length - 1}
              >
                Next
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <Card className="h-fit">
            <CardContent className="p-3">
              <p className="px-2 pb-2 pt-1 text-xs font-extrabold uppercase tracking-wider text-foreground/45">
                In this course
              </p>

              <ol className="max-h-[32rem] space-y-1 overflow-y-auto">
                {lessons.map((lesson, index) => {
                  const isActive = lesson.id === active?.id;
                  return (
                    <li key={lesson.id}>
                      <button
                        type="button"
                        onClick={() => play(lesson.id)}
                        aria-current={isActive ? "true" : undefined}
                        className={
                          "flex w-full items-center gap-3 rounded-xl p-2 text-left transition-colors " +
                          (isActive ? "bg-primary text-white" : "hover:bg-background")
                        }
                      >
                        <span className="relative w-20 shrink-0 overflow-hidden rounded-lg bg-foreground/5">
                          <span className="block aspect-video w-full">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={youtubeThumbnail(lesson.videoId)}
                              alt=""
                              className="h-full w-full object-cover"
                              loading="lazy"
                            />
                          </span>
                        </span>

                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-bold">{lesson.title}</span>
                          <span
                            className={
                              "block text-xs " + (isActive ? "text-white/70" : "text-foreground/50")
                            }
                          >
                            Video {index + 1}
                            {lesson.durationLabel ? ` · ${lesson.durationLabel}` : ""}
                          </span>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ol>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
