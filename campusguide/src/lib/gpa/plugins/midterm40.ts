import type { GpaPlugin } from "@/lib/gpa/types";

function clampMidterm40(mark: number) {
  if (!Number.isFinite(mark)) return 0;
  return Math.min(40, Math.max(0, mark));
}

function normalizeSubject(s: string) {
  return s.trim().replace(/\s+/g, " ");
}

function normalizeCredits(n: number) {
  if (!Number.isFinite(n)) return 3;
  const v = Math.max(0, n);
  // Clamp to something reasonable so a typo doesn't dominate the GPA.
  return Math.min(10, v);
}

function pointsFromLetter(letter: string) {
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

// Best-case mapping (0–40)
function bestCaseLetter(mark40: number): string {
  const m = clampMidterm40(mark40);
  if (m >= 34) return "A";
  if (m >= 28) return "A-";
  if (m >= 24) return "B+";
  if (m >= 21) return "B";
  if (m >= 20) return "B-";
  if (m >= 19) return "C+";
  if (m >= 18) return "C";
  if (m >= 16) return "C-";
  if (m >= 13) return "D";
  return "F";
}

// Worst-case mapping (0–40)
function worstCaseLetter(mark40: number): string {
  const m = clampMidterm40(mark40);
  if (m >= 36) return "A";
  if (m >= 33) return "A-";
  if (m >= 29) return "B+";
  if (m >= 26) return "B";
  if (m >= 25) return "B-";
  if (m >= 24) return "C+";
  if (m >= 23) return "C";
  if (m >= 21) return "C-";
  if (m >= 15) return "D";
  return "F";
}

function computeFromLetterFn(
  letterFn: (mark: number) => string,
  inputs: Array<{ subject: string; midtermMark: number; creditHours: number }>
) {
  const cleaned = inputs
    .map((i) => ({ subject: normalizeSubject(i.subject), midtermMark: i.midtermMark, creditHours: normalizeCredits(i.creditHours) }))
    .filter((i) => i.subject.length > 0);

  const items = cleaned.map((i) => {
    const mark = clampMidterm40(i.midtermMark);
    const letter = letterFn(mark);
    const gpa = pointsFromLetter(letter);
    return { subject: i.subject, midtermMark: mark, creditHours: i.creditHours, letter, gpa };
  });

  const totalCredits = items.reduce((a, b) => a + b.creditHours, 0);
  const weighted = items.reduce((a, b) => a + b.gpa * b.creditHours, 0);
  const overallGpa = totalCredits <= 0 ? 0 : Math.round((weighted / totalCredits) * 100) / 100;

  return { items, overallGpa };
}

export const midterm40BestPlugin: GpaPlugin = {
  id: "midterm-40-best",
  name: "Midterm 0–40 (Best-case)",
  compute(inputs) {
    return computeFromLetterFn(bestCaseLetter, inputs);
  },
};

export const midterm40WorstPlugin: GpaPlugin = {
  id: "midterm-40-worst",
  name: "Midterm 0–40 (Worst-case)",
  compute(inputs) {
    return computeFromLetterFn(worstCaseLetter, inputs);
  },
};
