"use client";

import * as React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ExternalLink, PlayCircle, Search, Video } from "lucide-react";
import { youtubeEmbedUrl, youtubeVideoId } from "@/lib/youtube";

type Item = {
  id: string;
  title: string;
  subject: string | null;
  academicYear: number | null;
  externalUrl: string | null;
  fileUrl: string | null;
  kind: "file" | "link";
};

export default function VideosPage() {
  const [items, setItems] = React.useState<Item[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [q, setQ] = React.useState("");
  const [academicYear, setAcademicYear] = React.useState("");
  const [playing, setPlaying] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ type: "video" });
    if (academicYear) params.set("academicYear", academicYear);

    try {
      const res = await fetch(`/api/student/resources?${params.toString()}`);
      const j = await res.json().catch(() => null);
      if (!res.ok) {
        setError(j?.error ?? "Failed to load videos");
        return;
      }
      setItems((j?.items ?? []) as Item[]);
      setError(null);
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
  const filtered = query
    ? items.filter((i) => `${i.title} ${i.subject ?? ""}`.toLowerCase().includes(query))
    : items;

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
            {filtered.length} video{filtered.length === 1 ? "" : "s"}. YouTube links play inline.
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
                  placeholder="Title or subject…"
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
          ) : filtered.length === 0 ? (
            <div className="mt-5 rounded-2xl bg-background p-6 text-center">
              <PlayCircle className="mx-auto h-8 w-8 text-foreground/30" />
              <p className="mt-2 text-sm font-extrabold">No videos yet</p>
              <p className="mt-1 text-sm text-foreground/70">
                Videos come from the resources drive. In the admin file storage, add a link and set its type to
                “Video” — it will appear here automatically.
              </p>
            </div>
          ) : (
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              {filtered.map((item) => {
                const url = item.externalUrl ?? item.fileUrl;
                const videoId = url ? youtubeVideoId(url) : null;
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
                            src={`https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`}
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
          )}
        </CardContent>
      </Card>
    </div>
  );
}
