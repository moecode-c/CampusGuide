import type { GpaPlugin, MidtermInput } from "@/lib/gpa/types";

function letterAndPoints(mark: number): { letter: string; gpa: number } {
  if (mark >= 90) return { letter: "A", gpa: 4.0 };
  if (mark >= 85) return { letter: "A-", gpa: 3.7 };
  if (mark >= 80) return { letter: "B+", gpa: 3.3 };
  if (mark >= 75) return { letter: "B", gpa: 3.0 };
  if (mark >= 70) return { letter: "B-", gpa: 2.7 };
  if (mark >= 65) return { letter: "C+", gpa: 2.3 };
  if (mark >= 60) return { letter: "C", gpa: 2.0 };
  if (mark >= 55) return { letter: "C-", gpa: 1.7 };
  if (mark >= 50) return { letter: "D", gpa: 1.0 };
  return { letter: "F", gpa: 0.0 };
}

function normalizeSubject(s: string) {
  return s.trim().replace(/\s+/g, " ");
}

function normalizeCredits(n: number) {
  if (!Number.isFinite(n)) return 3;
  const v = Math.max(0, n);
  return Math.min(10, v);
}

export const midtermOnlyPlugin: GpaPlugin = {
  id: "midterm-only",
  name: "Midterm-only (4.0 scale)",
  compute(inputs) {
    const cleaned = inputs
      .map((i) => ({
        subject: normalizeSubject(i.subject),
        midtermMark: i.midtermMark,
        creditHours: normalizeCredits((i as MidtermInput).creditHours),
      }))
      .filter((i) => i.subject.length > 0);

    const items = cleaned.map((i) => {
      const { letter, gpa } = letterAndPoints(i.midtermMark);
      return { subject: i.subject, midtermMark: i.midtermMark, creditHours: i.creditHours, letter, gpa };
    });

    const totalCredits = items.reduce((a, b) => a + b.creditHours, 0);
    const weighted = items.reduce((a, b) => a + b.gpa * b.creditHours, 0);
    const overallGpa = totalCredits <= 0 ? 0 : Math.round((weighted / totalCredits) * 100) / 100;

    return { items, overallGpa };
  },
};
