"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, Calculator } from "lucide-react";

type Row = { subject: string; gradeOrMark: string; creditHours: string };

const LETTERS = new Set(["A", "A-", "B+", "B", "B-", "C+", "C", "C-", "D", "F"]);

function normalizeSubject(s: string) {
  return s.trim().replace(/\s+/g, " ");
}

function letterToGpa(letter: string) {
  switch (letter) {
    case "A":
      return 4.0;
    case "A-":
      return 3.7;
    case "B+":
      return 3.3;
    case "B":
      return 3.0;
    case "B-":
      return 2.7;
    case "C+":
      return 2.3;
    case "C":
      return 2.0;
    case "C-":
      return 1.7;
    case "D":
      return 1.0;
    default:
      return 0.0;
  }
}

// 0–100 marks mapping as provided
function markToLetter(mark: number): string {
  if (!Number.isFinite(mark)) return "F";
  const m = Math.min(100, Math.max(0, mark));
  if (m >= 90) return "A";
  if (m >= 85) return "A-";
  if (m >= 80) return "B+";
  if (m >= 75) return "B";
  if (m >= 70) return "B-";
  if (m >= 65) return "C+";
  if (m >= 60) return "C";
  if (m >= 55) return "C-";
  if (m >= 50) return "D";
  return "F";
}

function parseGradeOrMark(raw: string): { ok: true; letter: string; gpa: number } | { ok: false } {
  const v = raw.trim().toUpperCase();
  if (!v) return { ok: false };

  if (LETTERS.has(v)) {
    return { ok: true, letter: v, gpa: letterToGpa(v) };
  }

  // Accept numeric marks
  const n = Number(v);
  if (!Number.isFinite(n)) return { ok: false };
  const letter = markToLetter(n);
  return { ok: true, letter, gpa: letterToGpa(letter) };
}

export function GpaCalculatorClient() {
  const [rows, setRows] = React.useState<Row[]>([{ subject: "", gradeOrMark: "", creditHours: "3" }]);

  const items = rows
    .map((r) => {
      const subject = normalizeSubject(r.subject);
      const parsed = parseGradeOrMark(r.gradeOrMark);
      if (!subject || !parsed.ok) return null;
      const creditHours = r.creditHours.trim() === "" ? 3 : Number(r.creditHours);
      if (!Number.isFinite(creditHours) || creditHours < 0) return null;
      return {
        subject,
        input: r.gradeOrMark,
        letter: parsed.letter,
        gpa: parsed.gpa,
        creditHours,
      };
    })
    .filter(Boolean) as Array<{ subject: string; input: string; letter: string; gpa: number; creditHours: number }>;

  const totalCredits = items.reduce((a, b) => a + b.creditHours, 0);
  const weighted = items.reduce((a, b) => a + b.gpa * b.creditHours, 0);
  const overallGpa = totalCredits <= 0 ? 0 : Math.round((weighted / totalCredits) * 100) / 100;

  return (
    <div className="grid gap-6 grid-cols-1 lg:grid-cols-5">
      <Card className="lg:col-span-3">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calculator className="h-5 w-5 text-primary" />
            Course Grades
          </CardTitle>
          <CardDescription>
            Enter a letter grade (A, A-, B+, …) or a mark (0–100). GPA uses your 90→50 thresholds.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="hidden sm:grid grid-cols-12 gap-2 text-xs font-semibold text-foreground/70">
              <div className="col-span-6">Subject</div>
              <div className="col-span-3">Grade / Mark</div>
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
                  />
                </div>
                <div className="flex gap-2 sm:col-span-4 sm:contents">
                  <div className="flex-1 sm:col-span-3">
                    <label className="mb-1 block text-xs font-semibold sm:hidden">Grade / Mark</label>
                    <Input
                      value={row.gradeOrMark}
                      onChange={(e) =>
                        setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, gradeOrMark: e.target.value } : r)))
                      }
                      placeholder="A- or 85"
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
                    />
                  </div>
                </div>
                <div className="flex justify-end sm:col-span-2">
                  <Button
                    type="button"
                    variant="ghost"
                    className="h-11 w-11 rounded-xl p-0 hover:bg-risk/10 hover:text-risk"
                    disabled={rows.length === 1}
                    onClick={() => setRows((prev) => prev.filter((_, i) => i !== idx))}
                    aria-label="Remove row"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}

            <div className="flex flex-wrap gap-2 pt-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setRows((prev) => [...prev, { subject: "", gradeOrMark: "", creditHours: "3" }])}
              >
                <Plus className="h-4 w-4" />
                Add subject
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle>GPA Summary</CardTitle>
          <CardDescription>Grade/mark → letter grade → GPA value.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-background p-4">
            <div className="min-w-0">
              <p className="text-xs font-semibold text-foreground/70">Overall GPA</p>
              <p className="text-2xl font-extrabold tracking-tight sm:text-3xl">{overallGpa.toFixed(2)}</p>
            </div>
            <Badge tone="neutral">4.0 scale</Badge>
          </div>

          <div className="mt-4 space-y-2">
            {items.length === 0 ? (
              <p className="text-sm text-foreground/70">Add grades to see results.</p>
            ) : (
              // Keyed by position: two rows may carry the same subject name, and
              // a duplicate key drops one of them from the summary.
              items.map((it, idx) => (
                <div key={idx} className="flex items-center justify-between rounded-xl bg-background p-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold">{it.subject}</p>
                    <p className="text-xs text-foreground/70">Input: {it.input} • Credits: {it.creditHours}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-extrabold text-primary">{it.letter}</p>
                    <p className="text-xs font-semibold text-foreground/70">{it.gpa.toFixed(1)}</p>
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
