"use client";

import * as React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ExternalLink, Library, Search } from "lucide-react";

type Item = {
  id: string;
  title: string;
  subject: string;
  academicYear: number;
  type: "video" | "pdf" | "summary";
  externalUrl: string | null;
  hasFile: boolean;
  createdAt: string;
};

export default function ResourcesPage() {
  const [q, setQ] = React.useState("");
  const [subject, setSubject] = React.useState("");
  const [academicYear, setAcademicYear] = React.useState("");
  const [type, setType] = React.useState("");
  const [items, setItems] = React.useState<Item[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  async function load() {
    setLoading(true);
    const params = new URLSearchParams();
    if (q.trim()) params.set("q", q.trim());
    if (subject.trim()) params.set("subject", subject.trim());
    if (academicYear) params.set("academicYear", academicYear);
    if (type) params.set("type", type);

    const res = await fetch(`/api/student/resources?${params.toString()}`);
    const j = await res.json().catch(() => null);
    if (!res.ok) {
      setError(j?.error ?? "Failed to load resources");
      setLoading(false);
      return;
    }
    setItems((j?.items ?? []) as Item[]);
    setError(null);
    setLoading(false);
  }

  React.useEffect(() => {
    load();
  }, []);

  return (
    <div className="space-y-2">
      <h1 className="text-2xl font-extrabold tracking-tight">Resources</h1>
      <p className="text-sm text-foreground/70">Videos, past exams, and summaries organized by subject & academic year.</p>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Library className="h-5 w-5 text-primary" />
            Resource Hub
          </CardTitle>
          <CardDescription>Search and filter resources.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-4">
            <div className="md:col-span-2">
              <label className="text-sm font-semibold">Search</label>
              <div className="mt-1 flex flex-col gap-2 sm:flex-row">
                <Input className="sm:flex-1" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Title or subject…" />
                <Button className="w-full sm:w-auto" type="button" variant="secondary" onClick={load}>
                  <Search className="h-4 w-4" />
                  Search
                </Button>
              </div>
            </div>
            <div>
              <label className="text-sm font-semibold">Subject</label>
              <Input className="mt-1" value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="e.g. Calculus" />
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
                <option value="pdf">Past exam PDF</option>
                <option value="summary">Summary</option>
              </Select>
            </div>
          </div>

          {error ? <p className="mt-3 text-sm font-semibold text-risk">{error}</p> : null}

          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {loading ? (
              <p className="text-sm text-foreground/70">Loading…</p>
            ) : items.length === 0 ? (
              <p className="text-sm text-foreground/70">No resources found.</p>
            ) : (
              items.map((it) => (
                <div key={it.id} className="rounded-2xl bg-background p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-extrabold">{it.title}</p>
                      <p className="text-xs text-foreground/70">{it.subject} • Year {it.academicYear}</p>
                    </div>
                    <Badge tone="neutral">{it.type}</Badge>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2">
                    {it.externalUrl ? (
                      <a
                        href={it.externalUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-2 rounded-xl bg-secondary px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-secondary/90 transition"
                      >
                        <ExternalLink className="h-4 w-4" />
                        Open
                      </a>
                    ) : null}
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
