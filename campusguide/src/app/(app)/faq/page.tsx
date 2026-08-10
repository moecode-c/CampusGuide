"use client";

import * as React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ChevronDown, HelpCircle, Search } from "lucide-react";

type Faq = { question: string; answer: string; category: string };

/**
 * Placeholder content — replace the copy with the real answers. The page itself
 * needs no changes; it groups, searches and renders whatever is in this list.
 */
const FAQS: Faq[] = [
  {
    category: "Attendance",
    question: "How many lectures can I miss before I'm barred from the exam?",
    answer:
      "The rule of thumb is 25% of the sessions for a course. Miss more than that and you risk being denied entry to the final. The Attendance page works this out per course, so you can see exactly how many absences you have left.",
  },
  {
    category: "Attendance",
    question: "Does a medical excuse remove an absence?",
    answer:
      "A stamped medical report submitted to student affairs within a week of the absence is normally accepted. Keep a copy — the absence often stays on the system until the paperwork is processed.",
  },
  {
    category: "Grades",
    question: "How is the GPA calculated?",
    answer:
      "Each course grade maps to a point value, which is weighted by the course's credit hours. The GPA Calculator does the full version; the GPA Estimator projects a range from midterm marks alone, before finals exist.",
  },
  {
    category: "Grades",
    question: "My midterm is out of 40 — why does the estimator show a range?",
    answer:
      "Because the rest of the marks aren't in yet. The estimator shows a best case and a worst case for the remaining assessment, so the real result should land between the two figures.",
  },
  {
    category: "Grades",
    question: "Can I retake a course to improve my grade?",
    answer:
      "Yes, and in most faculties the higher of the two attempts is the one that counts toward the GPA. The failed or lower attempt usually still appears on the transcript.",
  },
  {
    category: "Registration",
    question: "How do I add or drop a course?",
    answer:
      "Course changes happen through the student portal during the add/drop window at the start of each term. After the window closes, dropping a course is recorded as a withdrawal.",
  },
  {
    category: "Registration",
    question: "What is the maximum number of credit hours per semester?",
    answer:
      "Typically 18 credit hours for students in good standing, and fewer if your GPA is below the threshold. Overloading beyond that needs academic advisor approval.",
  },
  {
    category: "Campus",
    question: "Where is room RB4?",
    answer:
      "R building, second floor. Use the Map page and search the room code — it highlights the room, and any class in your calendar links straight to its location.",
  },
  {
    category: "Campus",
    question: "What are the library opening hours?",
    answer:
      "Sunday to Thursday during term time, with shorter hours in the exam period and over the summer break. Check the noticeboard at the entrance for the current schedule.",
  },
  {
    category: "CampusGuide",
    question: "Why does my account say it's awaiting verification?",
    answer:
      "CampusGuide is limited to MIU students. After registering you need to send a photo of your student ID on WhatsApp to the number shown on your pending screen. Once it's approved, everything unlocks.",
  },
  {
    category: "CampusGuide",
    question: "Can I upload my own summaries to the resources section?",
    answer:
      "Not directly — uploads are administrator-only so the material stays organized and trustworthy. Send anything worth sharing to the admin and it can be added to the right folder.",
  },
  {
    category: "CampusGuide",
    question: "How do I import my timetable?",
    answer:
      "Open the Calendar page and use the schedule import. Your classes are stored as weekly recurring events, so they keep appearing every week without re-entering them.",
  },
];

function FaqRow({ item, defaultOpen }: { item: Faq; defaultOpen: boolean }) {
  const [open, setOpen] = React.useState(defaultOpen);

  return (
    <div className="rounded-2xl bg-background">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-3 p-4 text-left"
        aria-expanded={open}
      >
        <span className="min-w-0">
          <span className="block text-sm font-extrabold">{item.question}</span>
          <span className="mt-0.5 block text-[11px] font-semibold uppercase tracking-wide text-primary/80">
            {item.category}
          </span>
        </span>
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-foreground/50 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open ? <p className="px-4 pb-4 text-sm text-foreground/80">{item.answer}</p> : null}
    </div>
  );
}

export default function FaqPage() {
  const [q, setQ] = React.useState("");

  const query = q.trim().toLowerCase();
  const filtered = query
    ? FAQS.filter((f) => `${f.question} ${f.answer} ${f.category}`.toLowerCase().includes(query))
    : FAQS;

  const categories = Array.from(new Set(filtered.map((f) => f.category)));

  return (
    <div className="space-y-2">
      <h1 className="text-2xl font-extrabold tracking-tight">FAQ</h1>
      <p className="text-sm text-foreground/70">The questions MIU students ask most often.</p>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <HelpCircle className="h-5 w-5 text-primary" />
            Common questions
          </CardTitle>
          <CardDescription>
            {filtered.length} answer{filtered.length === 1 ? "" : "s"}
            {query ? ` matching "${q.trim()}"` : ""}
          </CardDescription>
        </CardHeader>

        <CardContent>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-foreground/50" />
            <Input
              className="pl-9"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search the questions…"
            />
          </div>

          {filtered.length === 0 ? (
            <p className="mt-4 text-sm text-foreground/70">
              Nothing matched. Try a different word, or ask the admin directly.
            </p>
          ) : (
            <div className="mt-5 space-y-6">
              {categories.map((category) => (
                <section key={category}>
                  <div className="mb-2 flex items-center gap-2">
                    <Badge tone="neutral">{category}</Badge>
                  </div>
                  <div className="space-y-2">
                    {filtered
                      .filter((f) => f.category === category)
                      .map((item) => (
                        // Searching implies you want to read the hit, not click it open.
                        <FaqRow key={item.question} item={item} defaultOpen={Boolean(query)} />
                      ))}
                  </div>
                </section>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
