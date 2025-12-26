"use client";

import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ClipboardCheck, Save } from "lucide-react";

type Data = {
  summary: {
    totalSessions: number;
    missedSessions: number;
    allowedAbsences: number;
    remainingAllowed: number;
    status: "safe" | "warning" | "risk";
    maxAbsencePercent: number;
  };
  series: Array<{ key: string; title: string; type: string; total: number; missed: number }>;
};

function tone(status: Data["summary"]["status"]) {
  if (status === "safe") return "success" as const;
  if (status === "warning") return "warning" as const;
  return "risk" as const;
}

export default function AttendancePage() {
  const [data, setData] = React.useState<Data | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [savingKey, setSavingKey] = React.useState<string | null>(null);

  async function load() {
    setLoading(true);
    const res = await fetch("/api/student/attendance", { cache: "no-store" });
    const j = await res.json().catch(() => null);
    if (!res.ok) {
      setError(j?.error ?? "Failed to load attendance");
      setLoading(false);
      return;
    }
    setData(j as Data);
    setError(null);
    setLoading(false);
  }

  React.useEffect(() => {
    load();
  }, []);

  async function saveMissed(key: string, missedCount: number) {
    setSavingKey(key);
    await fetch("/api/student/attendance", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ key, missedCount }),
    });
    setSavingKey(null);
    await load();
  }

  return (
    <div className="space-y-2">
      <h1 className="text-2xl font-extrabold tracking-tight">Attendance</h1>
      <p className="text-sm text-foreground/70">Calculated from your actual calendar and excludes midterm/exam gaps.</p>

      {loading ? (
        <p className="pt-4 text-sm text-foreground/70">Loading…</p>
      ) : error ? (
        <p className="pt-4 text-sm font-semibold text-risk">{error}</p>
      ) : data ? (
        <div className="grid gap-6 pt-4 grid-cols-1 lg:grid-cols-5">
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ClipboardCheck className="h-5 w-5 text-primary" />
                Summary
              </CardTitle>
              <CardDescription>Safe / Warning / Risk is based on allowed absence policy.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3">
                <div className="flex items-center justify-between rounded-2xl bg-background p-4">
                  <div>
                    <p className="text-xs font-semibold text-foreground/70">Status</p>
                    <Badge tone={tone(data.summary.status)} className="mt-1">
                      {data.summary.status.toUpperCase()}
                    </Badge>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-semibold text-foreground/70">Max absence</p>
                    <p className="text-lg font-extrabold">{data.summary.maxAbsencePercent}%</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-2xl bg-background p-4">
                    <p className="text-xs font-semibold text-foreground/70">Total sessions</p>
                    <p className="text-2xl font-extrabold">{data.summary.totalSessions}</p>
                  </div>
                  <div className="rounded-2xl bg-background p-4">
                    <p className="text-xs font-semibold text-foreground/70">Missed</p>
                    <p className="text-2xl font-extrabold text-risk">{data.summary.missedSessions}</p>
                  </div>
                  <div className="rounded-2xl bg-background p-4">
                    <p className="text-xs font-semibold text-foreground/70">Allowed</p>
                    <p className="text-2xl font-extrabold">{data.summary.allowedAbsences}</p>
                  </div>
                  <div className="rounded-2xl bg-background p-4">
                    <p className="text-xs font-semibold text-foreground/70">Remaining</p>
                    <p className="text-2xl font-extrabold text-success">{data.summary.remainingAllowed}</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="lg:col-span-3">
            <CardHeader>
              <CardTitle>Track missed sessions</CardTitle>
              <CardDescription>Update missed lectures/labs per series (uses your calendar schedule).</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {data.series.length === 0 ? (
                  <p className="text-sm text-foreground/70">Add lecture/lab events in Calendar to start tracking.</p>
                ) : (
                  data.series.map((s) => (
                    <div key={s.key} className="rounded-2xl bg-background p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-extrabold">{s.title}</p>
                          <p className="text-xs text-foreground/70">
                            {s.type.toUpperCase()} • Total sessions: {s.total}
                          </p>
                        </div>
                        <Badge tone={s.type === "lecture" ? "neutral" : "warning"}>{s.type}</Badge>
                      </div>
                      <div className="mt-3 flex items-center gap-2">
                        <Input
                          type="number"
                          min={0}
                          value={s.missed}
                          onChange={(e) =>
                            setData((prev) =>
                              prev
                                ? {
                                  ...prev,
                                  series: prev.series.map((x) => (x.key === s.key ? { ...x, missed: Number(e.target.value) } : x)),
                                }
                                : prev
                            )
                          }
                        />
                        <Button type="button" variant="secondary" onClick={() => saveMissed(s.key, s.missed)} disabled={savingKey === s.key}>
                          <Save className="h-4 w-4" />
                          {savingKey === s.key ? "Saving…" : "Save"}
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      ) : null}
    </div>
  );
}
