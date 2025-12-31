"use client";

import * as React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CalendarClock, Plus } from "lucide-react";

type Template = {
  _id: string;
  academicYear: number;
  termName: string;
  startDate: string;
  endDate: string;
  maxAbsencePercent: number;
  excludedRanges: Array<{ start: string; end: string; label: string }>;
};

export default function AdminSemesterTemplatesPage() {
  const [items, setItems] = React.useState<Template[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const [academicYear, setAcademicYear] = React.useState("1");
  const [termName, setTermName] = React.useState("Fall");
  const [startDate, setStartDate] = React.useState("");
  const [endDate, setEndDate] = React.useState("");
  const [maxAbsencePercent, setMaxAbsencePercent] = React.useState("25");

  async function load() {
    setLoading(true);
    const res = await fetch("/api/admin/semester-templates");
    const j = await res.json().catch(() => null);
    if (!res.ok) {
      setError(j?.error ?? "Failed to load templates");
      setLoading(false);
      return;
    }
    setItems((j?.items ?? []) as Template[]);
    setError(null);
    setLoading(false);
  }

  React.useEffect(() => {
    load();
  }, []);

  async function create() {
    setError(null);
    const res = await fetch("/api/admin/semester-templates", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        academicYear: Number(academicYear),
        termName,
        startDate: new Date(startDate).toISOString(),
        endDate: new Date(endDate).toISOString(),
        maxAbsencePercent: Number(maxAbsencePercent),
        excludedRanges: [],
      }),
    });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(j.error ?? "Create failed");
      return;
    }
    await load();
  }

  return (
    <div className="space-y-2">
      <h1 className="text-2xl font-extrabold tracking-tight">Semester Templates</h1>
      <p className="text-sm text-foreground/70">Admin defines term dates and excluded ranges (midterm weeks, exam gaps).</p>

      <div className="grid gap-6 pt-4 lg:grid-cols-5">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Plus className="h-5 w-5 text-primary" />
              Create template
            </CardTitle>
            <CardDescription>Students inherit templates by academic year on sign-up.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
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
                <label className="text-sm font-semibold">Term name</label>
                <Input value={termName} onChange={(e) => setTermName(e.target.value)} placeholder="Fall" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label className="text-sm font-semibold">Start</label>
                  <Input value={startDate} onChange={(e) => setStartDate(e.target.value)} type="date" />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-semibold">End</label>
                  <Input value={endDate} onChange={(e) => setEndDate(e.target.value)} type="date" />
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-sm font-semibold">Max absence percent</label>
                <Input value={maxAbsencePercent} onChange={(e) => setMaxAbsencePercent(e.target.value)} type="number" min={0} max={100} />
              </div>

              {error ? <p className="text-sm font-semibold text-risk">{error}</p> : null}
              <Button type="button" onClick={create}>
                <CalendarClock className="h-4 w-4" /> Create
              </Button>

              <p className="text-xs text-foreground/70">
                Note: excluded ranges can be added via the API now; UI editing can be added next.
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle>Existing templates</CardTitle>
            <CardDescription>Cached for performance on student dashboards.</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-sm text-foreground/70">Loading…</p>
            ) : items.length === 0 ? (
              <p className="text-sm text-foreground/70">No templates yet.</p>
            ) : (
              <div className="space-y-3">
                {items.map((t) => (
                  <div key={t._id} className="rounded-2xl bg-background p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-extrabold">Year {t.academicYear} • {t.termName}</p>
                        <p className="text-xs text-foreground/70">
                          {new Date(t.startDate).toLocaleDateString()} → {new Date(t.endDate).toLocaleDateString()}
                        </p>
                      </div>
                      <Badge tone="neutral">Max {t.maxAbsencePercent}%</Badge>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {(t.excludedRanges ?? []).map((r) => (
                        <Badge key={r.label} tone="warning">
                          {r.label}
                        </Badge>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="mt-3">
              <Button type="button" variant="ghost" onClick={load}>Reload</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
