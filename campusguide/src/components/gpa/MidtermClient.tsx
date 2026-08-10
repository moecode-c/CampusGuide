"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getGpaPlugin } from "@/lib/gpa";
import { Plus, Save, Trash2, Calculator } from "lucide-react";

type Row = { subject: string; midtermMark: string; creditHours: string };

export function MidtermClient() {
  const [rows, setRows] = React.useState<Row[]>([{ subject: "", midtermMark: "", creditHours: "3" }]);
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [savedAt, setSavedAt] = React.useState<number | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const res = await fetch("/api/student/midterms");
        const json = await res.json().catch(() => null);
        if (cancelled) return;
        if (!res.ok) {
          setError(json?.error ?? "Failed to load");
          return;
        }
        const items = (json?.items ?? []) as Array<{ subject: string; midtermMark: number; creditHours?: number }>;
        setRows(
          items.length
            ? items.map((i) => ({
              subject: i.subject,
              midtermMark: String(i.midtermMark),
              creditHours: String(typeof i.creditHours === "number" ? i.creditHours : 3),
            }))
            : [{ subject: "", midtermMark: "", creditHours: "3" }]
        );
      } catch {
        if (!cancelled) setError("Network error. Check your connection and try again.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const bestPlugin = getGpaPlugin("midterm-40-best");
  const worstPlugin = getGpaPlugin("midterm-40-worst");
  const inputs = rows
    .map((r) => ({
      subject: r.subject,
      midtermMark: Number(r.midtermMark),
      creditHours: Number(r.creditHours),
    }))
    .filter((r) => r.subject.trim().length > 0 && Number.isFinite(r.midtermMark) && Number.isFinite(r.creditHours));

  const bestSummary = bestPlugin.compute(inputs);
  const worstSummary = worstPlugin.compute(inputs);
  const overallLow = Math.min(bestSummary.overallGpa, worstSummary.overallGpa);
  const overallHigh = Math.max(bestSummary.overallGpa, worstSummary.overallGpa);
  const overallAvg = Math.round(((overallLow + overallHigh) / 2) * 100) / 100;

  // `bestSummary`/`worstSummary` are rebuilt every render, so memoizing here
  // would never hit; build the lookups directly.
  const bestBySubject = new Map(bestSummary.items.map((it) => [it.subject, it]));
  const worstBySubject = new Map(worstSummary.items.map((it) => [it.subject, it]));

  async function save() {
    setError(null);
    setSavedAt(null);

    const items = rows
      .filter((r) => r.subject.trim().length > 0 && r.midtermMark !== "")
      .map((r) => ({
        subject: r.subject.trim(),
        midtermMark: Number(r.midtermMark),
        creditHours: r.creditHours === "" ? 3 : Number(r.creditHours),
      }));

    // The API rejects the whole payload on a bad number; say which row is wrong.
    const invalid = items.find(
      (i) =>
        !Number.isFinite(i.midtermMark) ||
        i.midtermMark < 0 ||
        i.midtermMark > 40 ||
        !Number.isFinite(i.creditHours) ||
        i.creditHours < 0 ||
        i.creditHours > 10
    );
    if (invalid) {
      setError(`"${invalid.subject}": mark must be 0–40 and credit hours 0–10.`);
      return;
    }

    const seen = new Set<string>();
    const duplicate = items.find((i) => {
      const key = i.subject.toLowerCase();
      if (seen.has(key)) return true;
      seen.add(key);
      return false;
    });
    if (duplicate) {
      setError(`"${duplicate.subject}" appears more than once. Subjects must be unique.`);
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/student/midterms", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ items }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(j.error ?? "Save failed");
        return;
      }
      setSavedAt(Date.now());
    } catch {
      setError("Network error. Your marks were not saved.");
    } finally {
      setSaving(false);
    }
  }

  const readOnly = false;

  return (
    <div className="grid gap-6 grid-cols-1 lg:grid-cols-5">
      <Card className="lg:col-span-3">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calculator className="h-5 w-5 text-primary" />
            Midterm Marks
          </CardTitle>
          <CardDescription>Enter midterm exam marks out of 40. We show both worst-case and best-case GPA.</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-foreground/70">Loading…</p>
          ) : (
            <div className="space-y-4">
              <div className="hidden sm:grid grid-cols-12 gap-2 text-xs font-semibold text-foreground/70">
                <div className="col-span-6">Subject</div>
                <div className="col-span-3">Midterm mark</div>
                <div className="col-span-1">CH</div>
                <div className="col-span-2 text-right">Action</div>
              </div>

              {rows.map((row, idx) => (
                <div key={idx} className="flex flex-col gap-2 rounded-xl border border-foreground/5 bg-panel/50 p-3 sm:grid sm:grid-cols-12 sm:border-none sm:bg-transparent sm:p-0">
                  <div className="sm:col-span-6">
                    <label className="mb-1 block text-xs font-semibold sm:hidden">Subject</label>
                    <Input
                      value={row.subject}
                      onChange={(e) =>
                        setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, subject: e.target.value } : r)))
                      }
                      placeholder="e.g. Calculus"
                      disabled={readOnly}
                    />
                  </div>
                  <div className="flex gap-2 sm:col-span-4 sm:contents">
                    <div className="flex-1 sm:col-span-3">
                      <label className="mb-1 block text-xs font-semibold sm:hidden">Mark (0-40)</label>
                      <Input
                        value={row.midtermMark}
                        onChange={(e) =>
                          setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, midtermMark: e.target.value } : r)))
                        }
                        placeholder="0-40"
                        inputMode="numeric"
                        disabled={readOnly}
                      />
                    </div>
                    <div className="w-20 sm:col-span-1 sm:w-auto">
                      <label className="mb-1 block text-xs font-semibold sm:hidden">CH</label>
                      <Input
                        value={row.creditHours}
                        onChange={(e) =>
                          setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, creditHours: e.target.value } : r)))
                        }
                        placeholder="3"
                        inputMode="numeric"
                        disabled={readOnly}
                      />
                    </div>
                  </div>
                  <div className="flex justify-end sm:col-span-2">
                    <Button
                      type="button"
                      variant="ghost"
                      className="h-11 w-11 rounded-xl p-0 hover:bg-risk/10 hover:text-risk"
                      disabled={readOnly || rows.length === 1}
                      onClick={() => setRows((prev) => prev.filter((_, i) => i !== idx))}
                      aria-label="Remove row"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}

              {!readOnly ? (
                <div className="flex flex-wrap gap-2 pt-2">
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => setRows((prev) => [...prev, { subject: "", midtermMark: "", creditHours: "3" }])}
                  >
                    <Plus className="h-4 w-4" />
                    Add subject
                  </Button>
                  <Button type="button" variant="secondary" onClick={save} disabled={saving}>
                    <Save className="h-4 w-4" />
                    {saving ? "Saving…" : "Save"}
                  </Button>
                </div>
              ) : null}

              {error ? <p className="text-sm font-semibold text-risk">{error}</p> : null}
              {!error && savedAt ? <p className="text-sm font-semibold text-success">Saved.</p> : null}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle>GPA Summary</CardTitle>
          <CardDescription>Worst-case GPA – Best-case GPA (4.0 scale).</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between rounded-2xl bg-background p-4">
            <div>
              <p className="text-xs font-semibold text-foreground/70">Overall GPA (worst–best)</p>
              <p className="text-3xl font-extrabold tracking-tight">
                {overallLow.toFixed(2)}–{overallHigh.toFixed(2)}
              </p>
            </div>
            <Badge tone="neutral">4.0 scale</Badge>
          </div>

          <div className="mt-3 flex items-center justify-between rounded-2xl bg-background p-4">
            <div>
              <p className="text-xs font-semibold text-foreground/70">Average GPA</p>
              <p className="text-2xl font-extrabold tracking-tight">{overallAvg.toFixed(2)}</p>
            </div>
            <Badge tone="neutral">(worst+best)/2</Badge>
          </div>

          <div className="mt-4 space-y-2">
            {bestSummary.items.length === 0 ? (
              <p className="text-sm text-foreground/70">Add midterm marks to see results.</p>
            ) : (
              bestSummary.items.map((it) => {
                const worst = worstBySubject.get(it.subject);
                const best = bestBySubject.get(it.subject);
                return (
                  <div key={it.subject} className="flex items-center justify-between rounded-xl bg-background p-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold">{it.subject}</p>
                      <p className="text-xs text-foreground/70">
                        Midterm: {it.midtermMark} • Credits: {it.creditHours}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-semibold text-foreground/70">Worst</p>
                      <p className="text-sm font-extrabold text-foreground">{worst?.letter ?? "—"}</p>
                      <p className="text-xs font-semibold text-foreground/70">{(worst?.gpa ?? 0).toFixed(1)}</p>
                      <div className="h-2" />
                      <p className="text-xs font-semibold text-foreground/70">Best</p>
                      <p className="text-sm font-extrabold text-primary">{best?.letter ?? "—"}</p>
                      <p className="text-xs font-semibold text-foreground/70">{(best?.gpa ?? 0).toFixed(1)}</p>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
