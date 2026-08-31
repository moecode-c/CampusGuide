"use client";

import * as React from "react";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ExternalLink, Layers, PlayCircle, Search, Video } from "lucide-react";
import { youtubeEmbedUrl, youtubeThumbnail, youtubeVideoId } from "@/lib/youtube";
import { lessonCountLabel, type VideoCourseSummary } from "@/lib/videoCourses";

/**
 * A loose video from the resources drive — a link whose type is "video".
 *
 * Predates courses and still works: not everything worth posting belongs to a
 * series. Courses are the headline, these sit underneath.
 */
type DriveVideo = {
  id: string;
  title: string;
  subject: string | null;
  academicYear: number | null;
  externalUrl: string | null;
  fileUrl: string | null;
  kind: "file" | "link";
};

export default function VideosPage() {
  const [courses, setCourses] = React.useState<VideoCourseSummary[]>([]);
  const [loose, setLoose] = React.useState<DriveVideo[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [q, setQ] = React.useState("");
  const [academicYear, setAcademicYear] = React.useState("");
  const [playing, setPlaying] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    setLoading(true);

    const courseParams = new URLSearchParams();
    const looseParams = new URLSearchParams({ type: "video" });
    if (academicYear) {
      courseParams.set("academicYear", academicYear);
      looseParams.set("academicYear", academicYear);
    }

    try {
      // One failing half should not blank the other, so both are settled rather
      // than awaited in sequence.
      const [courseRes, looseRes] = await Promise.allSettled([
        fetch(`/api/student/video-courses?${courseParams.toString()}`),
        fetch(`/api/student/resources?${looseParams.toString()}`),
      ]);

      let failed = false;

      if (courseRes.status === "fulfilled" && courseRes.value.ok) {
        const j = await courseRes.value.json().catch(() => null);
        setCourses((j?.items ?? []) as VideoCourseSummary[]);
      } else {
        failed = true;
      }

      if (looseRes.status === "fulfilled" && looseRes.value.ok) {
        const j = await looseRes.value.json().catch(() => null);
        setLoose((j?.items ?? []) as DriveVideo[]);
      } else {
        setLoose([]);
      }

      setError(failed ? "Some videos could not be loaded. Try again in a moment." : null);
    } catch {
      setError("Network error. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }, [academicYear]);

  React.useEffect(() => {
    load();
  }, [load]);

  const query = q.trim().toLowerCase();

  // Memoized because the search box re-renders this component on every
  // keystroke, and both of these walk the whole library building a lowercased
  // haystack per row. Without it a student typing "networks" rebuilds two full
  // strings per course per character.
  const filteredCourses = React.useMemo(
    () =>
      query
        ? courses.filter((c) =>
            `${c.title} ${c.subject ?? ""} ${c.instructor ?? ""}`.toLowerCase().includes(query)
          )
        : courses,
    [courses, query]
  );

  const filteredLoose = React.useMemo(
    () =>
      query ? loose.filter((i) => `${i.title} ${i.subject ?? ""}`.toLowerCase().includes(query)) : loose,
    [loose, query]
  );

  const nothingAtAll = !loading && filteredCourses.length === 0 && filteredLoose.length === 0;

  return (
    <div className="space-y-2">
      <h1 className="text-2xl font-extrabold tracking-tight">Videos</h1>
      <p className="text-sm text-foreground/70">Recorded explanations, walkthroughs and revision sessions.</p>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Video className="h-5 w-5 text-primary" />
            Video library
          </CardTitle>
          <CardDescription>
            {filteredCourses.length} course{filteredCourses.length === 1 ? "" : "s"}
            {filteredLoose.length > 0
              ? ` · ${filteredLoose.length} single video${filteredLoose.length === 1 ? "" : "s"}`
              : ""}
          </CardDescription>
        </CardHeader>

        <CardContent>
          <div className="grid gap-3 md:grid-cols-4">
            <div className="md:col-span-3">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-foreground/50" />
                <Input
                  className="pl-9"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Course, title or subject…"
                />
              </div>
            </div>
            <Select value={academicYear} onChange={(e) => setAcademicYear(e.target.value)}>
              <option value="">All years</option>
              <option value="1">Year 1</option>
              <option value="2">Year 2</option>
              <option value="3">Year 3</option>
              <option value="4">Year 4</option>
            </Select>
          </div>

          {error ? <p className="mt-3 text-sm font-semibold text-risk">{error}</p> : null}

          {loading ? (
            <p className="mt-4 text-sm text-foreground/70">Loading…</p>
          ) : nothingAtAll ? (
            <div className="mt-5 rounded-2xl bg-background p-6 text-center">
              <PlayCircle className="mx-auto h-8 w-8 text-foreground/30" />
              <p className="mt-2 text-sm font-extrabold">No videos yet</p>
              <p className="mt-1 text-sm text-foreground/70">
                Courses are put together in the admin console. Check back soon.
              </p>
            </div>
          ) : (
            <>
              {filteredCourses.length > 0 ? (
                <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {filteredCourses.map((course) => (
                    <Link
                      key={course.id}
                      href={`/videos/${course.slug}`}
                      className="group overflow-hidden rounded-2xl bg-background transition hover:shadow-lg hover:shadow-primary/10"
                    >
                      <div className="relative aspect-video w-full bg-foreground/5">
                        {course.coverVideoId ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={youtubeThumbnail(course.coverVideoId)}
                            alt=""
                            className="h-full w-full object-cover transition group-hover:scale-[1.02]"
                            loading="lazy"
                          />
                        ) : (
                          <div className="grid h-full w-full place-items-center">
                            <Layers className="h-10 w-10 text-foreground/25" />
                          </div>
                        )}
                        <span className="absolute bottom-2 right-2 rounded-full bg-black/70 px-2.5 py-1 text-xs font-bold text-white">
                          {lessonCountLabel(course.lessonCount)}
                        </span>
                      </div>

                      <div className="p-4">
                        <p className="truncate text-sm font-extrabold">{course.title}</p>
                        {course.description ? (
                          <p className="mt-1 line-clamp-2 text-xs text-foreground/65">{course.description}</p>
                        ) : null}
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          {course.subject ? <Badge tone="neutral">{course.subject}</Badge> : null}
                          {course.academicYear ? <Badge tone="neutral">Year {course.academicYear}</Badge> : null}
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              ) : null}

              {filteredLoose.length > 0 ? (
                <div className="mt-8">
                  <h2 className="text-sm font-extrabold uppercase tracking-wider text-foreground/50">
                    Single videos
                  </h2>
                  <p className="mt-1 text-xs text-foreground/60">
                    One-offs from the resources drive, not part of a course.
                  </p>

                  <div className="mt-4 grid gap-4 sm:grid-cols-2">
                    {filteredLoose.map((item) => {
                      // The YouTube id is read from the real link, but a
                      // drive-hosted file is opened through the download route
                      // so it is counted — same reason as the resources page.
                      const source = item.externalUrl ?? item.fileUrl;
                      const videoId = source ? youtubeVideoId(source) : null;
                      const url =
                        item.kind === "file"
                          ? `/api/student/resources/${item.id}/download`
                          : source;
                      const isPlaying = playing === item.id;

                      return (
                        <div key={item.id} className="overflow-hidden rounded-2xl bg-background">
                          <div className="aspect-video w-full bg-foreground/5">
                            {videoId && isPlaying ? (
                              <iframe
                                className="h-full w-full"
                                src={`${youtubeEmbedUrl(videoId)}?autoplay=1`}
                                title={item.title}
                                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                allowFullScreen
                              />
                            ) : videoId ? (
                              // Thumbnail first: embedding a dozen iframes up front makes
                              // the page crawl and lets YouTube track every visit.
                              <button
                                type="button"
                                onClick={() => setPlaying(item.id)}
                                className="group relative h-full w-full"
                                aria-label={`Play ${item.title}`}
                              >
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                  src={youtubeThumbnail(videoId)}
                                  alt=""
                                  className="h-full w-full object-cover"
                                  loading="lazy"
                                />
                                <span className="absolute inset-0 grid place-items-center bg-black/25 transition group-hover:bg-black/40">
                                  <PlayCircle className="h-14 w-14 text-white drop-shadow" />
                                </span>
                              </button>
                            ) : (
                              <div className="grid h-full w-full place-items-center">
                                <PlayCircle className="h-10 w-10 text-foreground/30" />
                              </div>
                            )}
                          </div>

                          <div className="p-4">
                            <p className="truncate text-sm font-extrabold">{item.title}</p>
                            <div className="mt-1 flex flex-wrap items-center gap-2">
                              {item.subject ? <Badge tone="neutral">{item.subject}</Badge> : null}
                              {item.academicYear ? <Badge tone="neutral">Year {item.academicYear}</Badge> : null}
                            </div>

                            {url && !videoId ? (
                              <a
                                href={url}
                                target="_blank"
                                rel="noreferrer"
                                className="mt-3 inline-flex items-center gap-2 rounded-xl bg-secondary px-3 py-2 text-sm font-semibold text-white transition hover:bg-secondary/90"
                              >
                                <ExternalLink className="h-4 w-4" />
                                Watch
                              </a>
                            ) : null}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : null}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
