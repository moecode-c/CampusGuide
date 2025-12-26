"use client";

import * as React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FileUp, Link2, Plus, RefreshCw } from "lucide-react";

type Resource = {
  _id: string;
  title: string;
  subject: string;
  academicYear: number;
  type: "video" | "pdf" | "summary";
  externalUrl?: string;
  objectKey?: string;
  createdAt: string;
};

export default function AdminResourcesPage() {
  const [items, setItems] = React.useState<Resource[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const [title, setTitle] = React.useState("");
  const [subject, setSubject] = React.useState("");
  const [academicYear, setAcademicYear] = React.useState("1");
  const [type, setType] = React.useState<Resource["type"]>("pdf");
  const [externalUrl, setExternalUrl] = React.useState("");
  const [file, setFile] = React.useState<File | null>(null);
  const [busy, setBusy] = React.useState(false);

  async function load() {
    setLoading(true);
    const res = await fetch("/api/admin/resources", { cache: "no-store" });
    const j = await res.json().catch(() => null);
    if (!res.ok) {
      setError(j?.error ?? "Failed to load resources");
      setLoading(false);
      return;
    }
    setItems((j?.items ?? []) as Resource[]);
    setError(null);
    setLoading(false);
  }

  React.useEffect(() => {
    load();
  }, []);

  async function createVideo() {
    setBusy(true);
    setError(null);
    const res = await fetch("/api/admin/resources", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        title,
        subject,
        academicYear: Number(academicYear),
        type: "video",
        externalUrl,
      }),
    });
    const j = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setError(j.error ?? "Create failed");
      return;
    }
    setTitle("");
    setExternalUrl("");
    await load();
  }

  async function uploadFileAndCreate() {
    if (!file) return;
    setBusy(true);
    setError(null);

    const presign = await fetch("/api/admin/resources/presign", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ mimeType: file.type || "application/octet-stream", sizeBytes: file.size }),
    });
    const p = await presign.json().catch(() => ({}));
    if (!presign.ok) {
      setBusy(false);
      setError(p.error ?? "Presign failed");
      return;
    }

    const put = await fetch(p.url, {
      method: "PUT",
      headers: { "content-type": file.type || "application/octet-stream" },
      body: file,
    });
    if (!put.ok) {
      setBusy(false);
      setError("Upload to storage failed");
      return;
    }

    const res = await fetch("/api/admin/resources", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        title,
        subject,
        academicYear: Number(academicYear),
        type,
        objectKey: p.objectKey,
        mimeType: file.type || "application/octet-stream",
        sizeBytes: file.size,
      }),
    });
    const j = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setError(j.error ?? "Create failed");
      return;
    }

    setTitle("");
    setFile(null);
    await load();
  }

  return (
    <div className="space-y-2">
      <h1 className="text-2xl font-extrabold tracking-tight">Resources (Admin)</h1>
      <p className="text-sm text-foreground/70">Upload PDFs/summaries to Cloudflare R2 or add external video links.</p>

      <div className="grid gap-6 pt-4 lg:grid-cols-5">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Plus className="h-5 w-5 text-primary" />
              Add resource
            </CardTitle>
            <CardDescription>Admin upload only. Students can only view/download.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="space-y-1">
                <label className="text-sm font-semibold">Title</label>
                <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Past Exam - Calculus" />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-semibold">Subject</label>
                <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Calculus" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label className="text-sm font-semibold">Academic year</label>
                  <Select value={academicYear} onChange={(e) => setAcademicYear(e.target.value)}>
                    <option value="1">Year 1</option>
                    <option value="2">Year 2</option>
                    <option value="3">Year 3</option>
                    <option value="4">Year 4</option>
                  </Select>
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-semibold">Type</label>
                  <Select value={type} onChange={(e) => setType(e.target.value as any)}>
                    <option value="pdf">Past exam PDF</option>
                    <option value="summary">Summary</option>
                    <option value="video">Video (external link)</option>
                  </Select>
                </div>
              </div>

              {type === "video" ? (
                <div className="space-y-1">
                  <label className="text-sm font-semibold">Video URL</label>
                  <Input value={externalUrl} onChange={(e) => setExternalUrl(e.target.value)} placeholder="https://…" />
                </div>
              ) : (
                <div className="space-y-1">
                  <label className="text-sm font-semibold">File</label>
                  <input
                    type="file"
                    className="block w-full text-sm"
                    onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                    accept={type === "pdf" ? "application/pdf" : undefined}
                  />
                  <p className="text-xs text-foreground/70">Stored in R2 via signed upload URL.</p>
                </div>
              )}

              {error ? <p className="text-sm font-semibold text-risk">{error}</p> : null}

              {type === "video" ? (
                <Button type="button" variant="secondary" onClick={createVideo} disabled={busy}>
                  <Link2 className="h-4 w-4" /> {busy ? "Saving…" : "Add video"}
                </Button>
              ) : (
                <Button type="button" variant="secondary" onClick={uploadFileAndCreate} disabled={busy || !file}>
                  <FileUp className="h-4 w-4" /> {busy ? "Uploading…" : "Upload & publish"}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle>Published resources</CardTitle>
            <CardDescription>Cached for faster student browsing.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="mb-3">
              <Button type="button" variant="ghost" onClick={load}>
                <RefreshCw className="h-4 w-4" /> Reload
              </Button>
            </div>

            {loading ? (
              <p className="text-sm text-foreground/70">Loading…</p>
            ) : items.length === 0 ? (
              <p className="text-sm text-foreground/70">No resources yet.</p>
            ) : (
              <div className="space-y-2">
                {items.map((it) => (
                  <div key={it._id} className="flex items-center justify-between rounded-2xl bg-background p-4">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-extrabold">{it.title}</p>
                      <p className="text-xs text-foreground/70">
                        {it.subject} • Year {it.academicYear}
                      </p>
                      <p className="truncate text-[11px] text-foreground/60">
                        {it.externalUrl ? it.externalUrl : it.objectKey}
                      </p>
                    </div>
                    <Badge tone="neutral">{it.type}</Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
