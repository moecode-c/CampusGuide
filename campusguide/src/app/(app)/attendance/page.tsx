"use client";

import * as React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

function toInt(value: string) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.floor(n));
}

type CourseAttendance = {
  id: string;
  name: string;
  weeks: number;
  lecturesPerWeek: number;
  hasLab: boolean;
  labsPerWeek: number;
  missedLectures: number;
  missedLabs: number;
  createdAt: number;
  updatedAt: number;
};

const STORAGE_KEY = "cg:attendance:courses:v1";

function computeAllowed(total: number, maxAbsencePercent: number) {
  return Math.floor((total * maxAbsencePercent) / 100);
}

export default function AttendancePage() {
  const MAX_ABSENCE_PERCENT = 25;

  const [courseName, setCourseName] = React.useState("");
  const [weeks, setWeeks] = React.useState("10");
  const [lecturesPerWeek, setLecturesPerWeek] = React.useState("2");
  const [hasLab, setHasLab] = React.useState(true);
  const [labsPerWeek, setLabsPerWeek] = React.useState("1");

  const [courses, setCourses] = React.useState<CourseAttendance[]>([]);

  React.useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as CourseAttendance[];
      if (Array.isArray(parsed)) setCourses(parsed);
    } catch {
      // ignore
    }
  }, []);

  React.useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(courses));
    } catch {
      // ignore
    }
  }, [courses]);

  const weeksN = toInt(weeks);
  const lecturesPerWeekN = toInt(lecturesPerWeek);
  const labsPerWeekN = hasLab ? toInt(labsPerWeek) : 0;

  const previewTotalLectures = weeksN * lecturesPerWeekN;
  const previewTotalLabs = weeksN * labsPerWeekN;

  const previewAllowedMissedLectures = computeAllowed(previewTotalLectures, MAX_ABSENCE_PERCENT);
  const previewAllowedMissedLabs = computeAllowed(previewTotalLabs, MAX_ABSENCE_PERCENT);

  function upsertCourse() {
    const name = courseName.trim();
    if (!name) return;

    const now = Date.now();
    setCourses((prev) => {
      const existing = prev.find((c) => c.name.toLowerCase() === name.toLowerCase());
      if (existing) {
        return prev.map((c) =>
          c.id === existing.id
            ? {
                ...c,
                name,
                weeks: weeksN,
                lecturesPerWeek: lecturesPerWeekN,
                hasLab,
                labsPerWeek: labsPerWeekN,
                updatedAt: now,
              }
            : c
        );
      }

      const id = (globalThis.crypto?.randomUUID?.() as string | undefined) ?? `${now}-${Math.random().toString(16).slice(2)}`;
      const next: CourseAttendance = {
        id,
        name,
        weeks: weeksN,
        lecturesPerWeek: lecturesPerWeekN,
        hasLab,
        labsPerWeek: labsPerWeekN,
        missedLectures: 0,
        missedLabs: 0,
        createdAt: now,
        updatedAt: now,
      };
      return [next, ...prev];
    });
  }

  function removeCourse(id: string) {
    setCourses((prev) => prev.filter((c) => c.id !== id));
  }

  function adjustMissed(id: string, kind: "lecture" | "lab", delta: number) {
    const now = Date.now();
    setCourses((prev) =>
      prev.map((c) => {
        if (c.id !== id) return c;
        if (kind === "lecture") {
          const missedLectures = Math.max(0, (c.missedLectures ?? 0) + delta);
          return { ...c, missedLectures, updatedAt: now };
        }
        const missedLabs = Math.max(0, (c.missedLabs ?? 0) + delta);
        return { ...c, missedLabs, updatedAt: now };
      })
    );
  }

  function loadCourseIntoForm(c: CourseAttendance) {
    setCourseName(c.name);
    setWeeks(String(c.weeks));
    setLecturesPerWeek(String(c.lecturesPerWeek));
    setHasLab(Boolean(c.hasLab));
    setLabsPerWeek(String(c.labsPerWeek ?? 0));
  }

  return (
    <div className="space-y-2">
      <h1 className="text-2xl font-extrabold tracking-tight">Attendance</h1>
      <p className="text-sm text-foreground/70">
        Calculates how many lectures/labs you can miss before exceeding {MAX_ABSENCE_PERCENT}% absence (automatic fail). Fractions are rounded down.
      </p>

      <div className="grid gap-6 pt-4 grid-cols-1 lg:grid-cols-5">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Course inputs</CardTitle>
            <CardDescription>Create a course and track missed lectures/labs.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="text-xs font-semibold text-foreground/70">Course name</div>
              <Input value={courseName} onChange={(e) => setCourseName(e.target.value)} placeholder="e.g., CS101" />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <div className="text-xs font-semibold text-foreground/70">Weeks</div>
                <Input type="number" min={0} value={weeks} onChange={(e) => setWeeks(e.target.value)} />
              </div>
              <div className="space-y-2">
                <div className="text-xs font-semibold text-foreground/70">Lectures / week</div>
                <Input type="number" min={0} value={lecturesPerWeek} onChange={(e) => setLecturesPerWeek(e.target.value)} />
              </div>
            </div>

            <div className="flex items-center gap-3">
              <label className="flex cursor-pointer items-center gap-2 text-sm font-semibold text-foreground/80">
                <span className="text-primary">
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-current"
                    checked={hasLab}
                    onChange={(e) => setHasLab(e.target.checked)}
                  />
                </span>
                Has lab
              </label>

              {hasLab ? (
                <div className="flex-1">
                  <div className="text-xs font-semibold text-foreground/70">Labs / week</div>
                  <Input type="number" min={0} value={labsPerWeek} onChange={(e) => setLabsPerWeek(e.target.value)} />
                </div>
              ) : null}
            </div>

            <div className="grid grid-cols-2 gap-2">
              <Button type="button" variant="secondary" onClick={upsertCourse} disabled={!courseName.trim()}>
                Save course
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setCourseName("");
                  setWeeks("10");
                  setLecturesPerWeek("2");
                  setHasLab(true);
                  setLabsPerWeek("1");
                }}
              >
                Reset
              </Button>
            </div>

            <div className="rounded-2xl bg-background p-4">
              <div className="text-xs font-semibold text-foreground/70">Preview (25% rule)</div>
              <div className="mt-2 space-y-1 text-sm text-foreground/75">
                <div>
                  Total lectures: <span className="font-extrabold text-foreground">{previewTotalLectures}</span> • Max missed: <span className="font-extrabold text-foreground">{previewAllowedMissedLectures}</span>
                </div>
                {hasLab ? (
                  <div>
                    Total labs: <span className="font-extrabold text-foreground">{previewTotalLabs}</span> • Max missed: <span className="font-extrabold text-foreground">{previewAllowedMissedLabs}</span>
                  </div>
                ) : (
                  <div className="text-foreground/60">No labs for this course.</div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle>Saved courses</CardTitle>
            <CardDescription>Track missed lectures/labs and see what you still can miss.</CardDescription>
          </CardHeader>
          <CardContent>
            {courses.length === 0 ? (
              <div className="text-sm text-foreground/70">No saved courses yet. Add one on the left.</div>
            ) : (
              <div className="grid gap-3 md:grid-cols-2">
                {courses.map((c) => {
                  const totalLectures = (c.weeks ?? 0) * (c.lecturesPerWeek ?? 0);
                  const totalLabs = (c.weeks ?? 0) * (c.labsPerWeek ?? 0);

                  const allowedLectures = computeAllowed(totalLectures, MAX_ABSENCE_PERCENT);
                  const allowedLabs = computeAllowed(totalLabs, MAX_ABSENCE_PERCENT);

                  const remainingLectures = Math.max(0, allowedLectures - (c.missedLectures ?? 0));
                  const remainingLabs = Math.max(0, allowedLabs - (c.missedLabs ?? 0));

                  return (
                    <div key={c.id} className="rounded-2xl bg-background p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="truncate text-sm font-extrabold text-foreground">{c.name}</div>
                          <div className="text-xs text-foreground/70">
                            {c.weeks} weeks • {c.lecturesPerWeek}/wk lectures{c.hasLab ? ` • ${c.labsPerWeek}/wk labs` : ""}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button type="button" variant="ghost" className="h-8 px-2" onClick={() => loadCourseIntoForm(c)}>
                            Edit
                          </Button>
                          <Button type="button" variant="ghost" className="h-8 px-2 text-risk" onClick={() => removeCourse(c.id)}>
                            Delete
                          </Button>
                        </div>
                      </div>

                      <div className="mt-3 grid gap-2">
                        <div className="rounded-xl border border-foreground/10 bg-nav p-3">
                          <div className="flex items-center justify-between gap-2">
                            <div>
                              <div className="text-xs font-semibold text-foreground/70">Lectures</div>
                              <div className="text-sm text-foreground/80">
                                Total: <span className="font-extrabold text-foreground">{totalLectures}</span> • Allowed missed: <span className="font-extrabold text-foreground">{allowedLectures}</span>
                              </div>
                              <div className="text-sm text-foreground/80">
                                Missed: <span className="font-extrabold text-foreground">{c.missedLectures ?? 0}</span> • Remaining: <span className="font-extrabold text-success">{remainingLectures}</span>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <Button type="button" variant="secondary" className="h-9 px-3" onClick={() => adjustMissed(c.id, "lecture", +1)}>
                                Miss +1
                              </Button>
                              <Button type="button" variant="ghost" className="h-9 px-3" onClick={() => adjustMissed(c.id, "lecture", -1)} disabled={(c.missedLectures ?? 0) === 0}>
                                Undo
                              </Button>
                            </div>
                          </div>
                        </div>

                        {c.hasLab ? (
                          <div className="rounded-xl border border-foreground/10 bg-nav p-3">
                            <div className="flex items-center justify-between gap-2">
                              <div>
                                <div className="text-xs font-semibold text-foreground/70">Labs</div>
                                <div className="text-sm text-foreground/80">
                                  Total: <span className="font-extrabold text-foreground">{totalLabs}</span> • Allowed missed: <span className="font-extrabold text-foreground">{allowedLabs}</span>
                                </div>
                                <div className="text-sm text-foreground/80">
                                  Missed: <span className="font-extrabold text-foreground">{c.missedLabs ?? 0}</span> • Remaining: <span className="font-extrabold text-success">{remainingLabs}</span>
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <Button type="button" variant="secondary" className="h-9 px-3" onClick={() => adjustMissed(c.id, "lab", +1)}>
                                  Miss +1
                                </Button>
                                <Button type="button" variant="ghost" className="h-9 px-3" onClick={() => adjustMissed(c.id, "lab", -1)} disabled={(c.missedLabs ?? 0) === 0}>
                                  Undo
                                </Button>
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div className="rounded-xl border border-foreground/10 bg-nav p-3 text-sm text-foreground/70">
                            This course has no labs.
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
