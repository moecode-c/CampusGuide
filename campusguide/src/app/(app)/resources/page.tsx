"use client";

import * as React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  ChevronRight,
  ExternalLink,
  File as FileIcon,
  FileText,
  Folder as FolderIcon,
  Home,
  Library,
  PlayCircle,
  Search,
} from "lucide-react";
import { formatBytes } from "@/lib/bytes";

type DriveFolder = { id: string; name: string; path: string };

type Item = {
  id: string;
  kind: "file" | "link";
  title: string;
  fileName: string | null;
  fileUrl: string | null;
  fileSize: number | null;
  mimeType: string | null;
  externalUrl: string | null;
  subject: string | null;
  academicYear: number | null;
  type: "video" | "pdf" | "summary" | null;
  createdAt: string | null;
};

type DriveResponse = {
  mode: "browse" | "search";
  folder: DriveFolder | null;
  breadcrumbs: { id: string; name: string }[];
  folders: DriveFolder[];
  items: Item[];
};

function iconFor(item: Item) {
  if (item.kind === "link") return <ExternalLink className="h-5 w-5 text-primary" />;
  const hint = `${item.fileName ?? ""} ${item.mimeType ?? ""} ${item.type ?? ""}`.toLowerCase();
  if (hint.includes("pdf")) return <FileText className="h-5 w-5 text-risk" />;
  if (hint.includes("video") || hint.includes("mp4")) return <PlayCircle className="h-5 w-5 text-primary" />;
  return <FileIcon className="h-5 w-5 text-foreground/60" />;
}

export default function ResourcesPage() {
  const [q, setQ] = React.useState("");
  const [academicYear, setAcademicYear] = React.useState("");
  const [type, setType] = React.useState("");
  const [folderId, setFolderId] = React.useState<string | null>(null);
  const [data, setData] = React.useState<DriveResponse | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (q.trim()) params.set("q", q.trim());
    if (academicYear) params.set("academicYear", academicYear);
    if (type) params.set("type", type);
    // Filters search the whole drive; the folder only matters while browsing.
    if (!q.trim() && !academicYear && !type && folderId) params.set("folderId", folderId);

    try {
      const res = await fetch(`/api/student/resources?${params.toString()}`);
      const j = await res.json().catch(() => null);
      if (!res.ok) {
        setError(j?.error ?? "Failed to load resources");
        return;
      }
      setData(j as DriveResponse);
      setError(null);
    } catch {
      setError("Network error. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }, [academicYear, folderId, q, type]);

  // Auto-search: debounce typing, instant on select changes.
  React.useEffect(() => {
    const handle = window.setTimeout(load, 250);
    return () => window.clearTimeout(handle);
  }, [load]);

  const searching = data?.mode === "search";
  const crumbs = data?.breadcrumbs ?? [];

  return (
    <div className="space-y-2">
      <h1 className="text-2xl font-extrabold tracking-tight">Resources</h1>
      <p className="text-sm text-foreground/70">
        Lectures, past exams and summaries, organized in folders by your department.
      </p>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Library className="h-5 w-5 text-primary" />
            {data?.folder ? data.folder.name : "Resource Hub"}
          </CardTitle>
          <CardDescription>
            {searching ? "Showing matches from every folder." : data?.folder?.path ?? "Browse or search the shared drive."}
          </CardDescription>
        </CardHeader>

        <CardContent>
          <div className="grid gap-3 md:grid-cols-4">
            <div className="md:col-span-2">
              <label className="text-sm font-semibold">Search</label>
              <div className="relative mt-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-foreground/50" />
                <Input className="pl-9" value={q} onChange={(e) => setQ(e.target.value)} placeholder="File, title or subject…" />
              </div>
            </div>
            <div>
              <label className="text-sm font-semibold">Academic year</label>
              <Select className="mt-1" value={academicYear} onChange={(e) => setAcademicYear(e.target.value)}>
                <option value="">All</option>
                <option value="1">Year 1</option>
                <option value="2">Year 2</option>
                <option value="3">Year 3</option>
                <option value="4">Year 4</option>
              </Select>
            </div>
            <div>
              <label className="text-sm font-semibold">Type</label>
              <Select className="mt-1" value={type} onChange={(e) => setType(e.target.value)}>
                <option value="">All</option>
                <option value="video">Video</option>
                <option value="pdf">PDF</option>
                <option value="summary">Summary</option>
              </Select>
            </div>
          </div>

          {!searching ? (
            <nav className="mt-4 flex flex-wrap items-center gap-1 text-sm">
              <button
                type="button"
                className="inline-flex items-center gap-1 rounded-lg px-2 py-1 font-semibold hover:bg-panel/60"
                onClick={() => setFolderId(null)}
              >
                <Home className="h-4 w-4" /> All files
              </button>
              {crumbs.map((c) => (
                <React.Fragment key={c.id}>
                  <ChevronRight className="h-4 w-4 text-foreground/40" />
                  <button
                    type="button"
                    className="rounded-lg px-2 py-1 font-semibold hover:bg-panel/60"
                    onClick={() => setFolderId(c.id)}
                  >
                    {c.name}
                  </button>
                </React.Fragment>
              ))}
              {data?.folder ? (
                <>
                  <ChevronRight className="h-4 w-4 text-foreground/40" />
                  <span className="rounded-lg px-2 py-1 font-extrabold">{data.folder.name}</span>
                </>
              ) : null}
            </nav>
          ) : null}

          {error ? <p className="mt-3 text-sm font-semibold text-risk">{error}</p> : null}

          <div className="mt-4 space-y-2">
            {loading ? (
              <p className="text-sm text-foreground/70">Loading…</p>
            ) : !data || (data.folders.length === 0 && data.items.length === 0) ? (
              <p className="text-sm text-foreground/70">
                {searching ? "No resources matched your search." : "This folder is empty."}
              </p>
            ) : (
              <>
                {data.folders.map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    className="flex w-full items-center gap-3 rounded-2xl bg-background p-4 text-left transition hover:bg-panel/60"
                    onClick={() => {
                      setQ("");
                      setAcademicYear("");
                      setType("");
                      setFolderId(f.id);
                    }}
                  >
                    <FolderIcon className="h-5 w-5 shrink-0 text-primary" />
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-extrabold">{f.name}</span>
                      {searching ? (
                        <span className="block truncate text-[11px] text-foreground/50">{f.path}</span>
                      ) : null}
                    </span>
                  </button>
                ))}

                {data.items.map((it) => {
                  const href = it.kind === "file" ? it.fileUrl : it.externalUrl;
                  const meta = [
                    it.kind === "file" ? it.fileName : null,
                    it.kind === "file" ? formatBytes(it.fileSize) : null,
                    it.subject,
                    it.academicYear ? `Year ${it.academicYear}` : null,
                  ]
                    .filter(Boolean)
                    .join(" • ");

                  return (
                    <div key={it.id} className="flex items-center justify-between gap-3 rounded-2xl bg-background p-4">
                      <div className="flex min-w-0 flex-1 items-center gap-3">
                        {iconFor(it)}
                        <div className="min-w-0">
                          <p className="truncate text-sm font-extrabold">{it.title}</p>
                          {meta ? <p className="truncate text-xs text-foreground/70">{meta}</p> : null}
                        </div>
                      </div>

                      <div className="flex shrink-0 items-center gap-2">
                        <Badge tone="neutral">{it.kind === "file" ? "File" : "Link"}</Badge>
                        {href ? (
                          <a
                            href={href}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-2 rounded-xl bg-secondary px-3 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-secondary/90"
                          >
                            <ExternalLink className="h-4 w-4" />
                            Open
                          </a>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
