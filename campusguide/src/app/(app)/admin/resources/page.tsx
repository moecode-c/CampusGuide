"use client";

import * as React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FileUp, Link2, Plus, RefreshCw, Pen, Trash2 } from "lucide-react";

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
  const [editingId, setEditingId] = React.useState<string | null>(null);
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

  async function deleteResource(id: string) {
    if (!confirm("Are you sure you want to delete this resource?")) return;
    setBusy(true);
    const res = await fetch(`/api/admin/resources/${id}`, { method: "DELETE" });
    setBusy(false);
    if (res.ok) {
      await load();
    } else {
      alert("Failed to delete");
    }
  }

  function startEdit(item: Resource) {
    setEditingId(item._id);
    setTitle(item.title);
    setSubject(item.subject);
    setAcademicYear(String(item.academicYear));
    setType(item.type);
    setExternalUrl(item.externalUrl ?? "");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function cancelEdit() {
    setEditingId(null);
    setTitle("");
    setSubject("");
    setAcademicYear("1");
    setType("pdf");
    setExternalUrl("");
  }

  async function saveResource() {
    setBusy(true);
    setError(null);

    const payload = {
      title,
      subject,
      academicYear: Number(academicYear),
      type,
      externalUrl,
    };

    let res;
    if (editingId) {
      res = await fetch(`/api/admin/resources/${editingId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
    } else {
      res = await fetch("/api/admin/resources", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
    }

    const j = await res.json().catch(() => ({}));
    setBusy(false);

    if (!res.ok) {
      setError(j.error ?? "Save failed");
      return;
    }

    if (editingId) {
      setEditingId(null);
    }

    setTitle("");
    setExternalUrl("");
    await load();
  }

  return (
    <div className="space-y-2">
      <h1 className="text-2xl font-extrabold tracking-tight">Resources (Admin)</h1>
      <p className="text-sm text-foreground/70">Add links to external study materials (PDFs, videos, summaries).</p>

      <div className="grid gap-6 pt-4 lg:grid-cols-5">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {editingId ? <RefreshCw className="h-5 w-5 text-primary" /> : <Plus className="h-5 w-5 text-primary" />}
              {editingId ? "Edit resource" : "Add resource"}
            </CardTitle>
            <CardDescription>Admin upload only. Students can only view.</CardDescription>
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
                    <option value="pdf">Past exam (PDF Link)</option>
                    <option value="summary">Summary (Link)</option>
                    <option value="video">Video (YouTube/Link)</option>
                  </Select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-sm font-semibold">External URL</label>
                <Input value={externalUrl} onChange={(e) => setExternalUrl(e.target.value)} placeholder="https://drive.google.com/..." />
              </div>

              {error ? <p className="text-sm font-semibold text-risk">{error}</p> : null}

              <div className="flex gap-2">
                <Button type="button" variant="secondary" onClick={saveResource} disabled={busy || !title || !externalUrl} className="flex-1">
                  <Link2 className="h-4 w-4" /> {busy ? "Saving…" : editingId ? "Update Link" : "Publish Link"}
                </Button>
                {editingId && (
                  <Button type="button" variant="ghost" onClick={cancelEdit} disabled={busy}>
                    Cancel
                  </Button>
                )}
              </div>
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
                    <div className="min-w-0 flex-1 mr-4">
                      <p className="truncate text-sm font-extrabold">{it.title}</p>
                      <p className="text-xs text-foreground/70">
                        {it.subject} • Year {it.academicYear} • <span className="font-semibold text-primary">{it.type}</span>
                      </p>
                      <a href={it.externalUrl} target="_blank" rel="noreferrer" className="truncate text-[11px] text-foreground/50 hover:underline block mt-0.5">
                        {it.externalUrl}
                      </a>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 w-8 p-0"
                        onClick={() => startEdit(it)}
                      >
                        <Pen className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 w-8 p-0 hover:text-risk"
                        onClick={() => deleteResource(it._id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
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
