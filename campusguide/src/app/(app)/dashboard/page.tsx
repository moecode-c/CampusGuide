import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/server/auth";
import { connectToDatabase } from "@/server/db";
import { MidtermGrade } from "@/server/models/MidtermGrade";
import { Event, EventTypes } from "@/server/models/Event";
import { Attendance } from "@/server/models/Attendance";
import { getSemesterTemplateForYear } from "@/server/data/semesterTemplates";
import { getResourcesCached } from "@/server/data/resources";
import { getGpaPlugin } from "@/lib/gpa";
import { RRule } from "rrule";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CalendarDays, GraduationCap, ClipboardCheck, Library, MapPin } from "lucide-react";

function inExcluded(date: Date, ranges: Array<{ start: Date; end: Date }>) {
  return ranges.some((r) => date >= r.start && date <= r.end);
}

function seriesKey(title: string, type: string) {
  return `${type}:${title.trim().toLowerCase()}`;
}

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  await connectToDatabase();

  const [midterms, tpl, attendanceDocs] = await Promise.all([
    MidtermGrade.find({ userId: session.user.id }).select({ subject: 1, midtermMark: 1, creditHours: 1 }).lean(),
    getSemesterTemplateForYear(session.user.academicYear),
    Attendance.find({ userId: session.user.id }).lean(),
  ]);

  const gpa = getGpaPlugin("midterm-only").compute(
    midterms.map((m: any) => ({ subject: m.subject, midtermMark: m.midtermMark, creditHours: m.creditHours ?? 3 }))
  );

  const now = new Date();
  const soon = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const upcoming = await Event.find({
    userId: session.user.id,
    start: { $gte: now, $lte: soon },
  })
    .sort({ start: 1 })
    .limit(6)
    .select({ title: 1, type: 1, start: 1, end: 1, roomCode: 1 })
    .lean();

  const resources = (await getResourcesCached()).slice(0, 6).map((r: any) => ({
    id: String(r._id),
    title: r.title,
    subject: r.subject,
    academicYear: r.academicYear,
    type: r.type,
  }));

  // Attendance summary
  let attendanceSummary: null | {
    status: "safe" | "warning" | "risk";
    totalSessions: number;
    missedSessions: number;
    daysRemaining: number | null;
  } = null;

  if (tpl) {
    const termStart = new Date(tpl.startDate);
    const termEnd = new Date(tpl.endDate);
    const excluded = (tpl.excludedRanges ?? []).map((r: any) => ({ start: new Date(r.start), end: new Date(r.end) }));

    const lectureLab = await Event.find({
      userId: session.user.id,
      type: { $in: [EventTypes.Lecture, EventTypes.Lab] },
    }).lean();

    const missedByKey = new Map(attendanceDocs.map((a: any) => [a.key, a.missedCount]));

    let totalSessions = 0;
    let missedSessions = 0;

    for (const e of lectureLab as any[]) {
      const key = seriesKey(e.title, e.type);
      const missed = missedByKey.get(key) ?? 0;

      let count = 0;
      if (e.isRecurring && e.rrule) {
        const dtstart = new Date(e.start);
        const parsed = RRule.fromString(e.rrule);
        const rule = new RRule({ ...parsed.origOptions, dtstart });
        const between = rule.between(termStart, termEnd, true);
        count = between.filter((d) => !inExcluded(d, excluded)).length;
      } else {
        const d = new Date(e.start);
        if (d >= termStart && d <= termEnd && !inExcluded(d, excluded)) count = 1;
      }

      totalSessions += count;
      missedSessions += missed;
    }

    const allowed = Math.floor((totalSessions * (tpl.maxAbsencePercent ?? 25)) / 100);
    const status = missedSessions > allowed ? "risk" : missedSessions > Math.floor(allowed * 0.6) ? "warning" : "safe";
    const daysRemaining = Math.max(0, Math.ceil((termEnd.getTime() - now.getTime()) / (24 * 60 * 60 * 1000)));

    attendanceSummary = { status, totalSessions, missedSessions, daysRemaining };
  }

  return (
    <div className="space-y-2">
      <h1 className="text-2xl font-extrabold tracking-tight">Dashboard</h1>
      <p className="text-sm text-foreground/70">Your midterm GPA, attendance, schedule, and latest resources.</p>

      <div className="grid gap-6 pt-4 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <GraduationCap className="h-5 w-5 text-primary" />
              GPA estimate
            </CardTitle>
            <CardDescription>Midterm-only, 4.0 scale.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between rounded-2xl bg-background p-4">
              <div>
                <p className="text-xs font-semibold text-foreground/70">Overall</p>
                <p className="text-3xl font-extrabold tracking-tight">{gpa.overallGpa.toFixed(2)}</p>
              </div>
              <Badge tone="neutral">{gpa.items.length} subjects</Badge>
            </div>
            <div className="mt-3">
              <Link href="/gpa/estimator" className="inline-flex">
                <Button variant="secondary">Open GPA Estimator</Button>
              </Link>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ClipboardCheck className="h-5 w-5 text-primary" />
              Attendance
            </CardTitle>
            <CardDescription>Calculated from your calendar schedule.</CardDescription>
          </CardHeader>
          <CardContent>
            {attendanceSummary ? (
              <>
                <div className="flex items-center justify-between rounded-2xl bg-background p-4">
                  <div>
                    <p className="text-xs font-semibold text-foreground/70">Status</p>
                    <p className="text-2xl font-extrabold">{attendanceSummary.status.toUpperCase()}</p>
                  </div>
                  <Badge tone={attendanceSummary.status === "safe" ? "success" : attendanceSummary.status === "warning" ? "warning" : "risk"}>
                    {attendanceSummary.missedSessions}/{attendanceSummary.totalSessions}
                  </Badge>
                </div>
                <div className="mt-3 flex items-center justify-between rounded-2xl bg-background p-4">
                  <p className="text-sm font-semibold">Days remaining in term</p>
                  <p className="text-lg font-extrabold">{attendanceSummary.daysRemaining}</p>
                </div>
              </>
            ) : (
              <p className="text-sm text-foreground/70">Admin must configure your semester template first.</p>
            )}
            <div className="mt-3">
              <Link href="/attendance" className="inline-flex">
                <Button variant="secondary">Open Attendance</Button>
              </Link>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CalendarDays className="h-5 w-5 text-primary" />
              Upcoming events
            </CardTitle>
            <CardDescription>Next 7 days.</CardDescription>
          </CardHeader>
          <CardContent>
            {upcoming.length === 0 ? (
              <p className="text-sm text-foreground/70">No upcoming events yet.</p>
            ) : (
              <div className="space-y-2">
                {upcoming.map((e: any) => (
                  <div key={String(e._id)} className="flex items-center justify-between rounded-xl bg-background p-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-extrabold">{e.title}</p>
                      <p className="text-xs text-foreground/70">{new Date(e.start).toLocaleString()}</p>
                    </div>
                    {e.roomCode ? (
                      <Link href={`/map?room=${encodeURIComponent(e.roomCode)}`} className="inline-flex">
                        <Button variant="ghost" className="h-9">
                          <MapPin className="h-4 w-4" />
                          {e.roomCode}
                        </Button>
                      </Link>
                    ) : (
                      <Badge tone="neutral">{e.type}</Badge>
                    )}
                  </div>
                ))}
              </div>
            )}
            <div className="mt-3">
              <Link href="/calendar" className="inline-flex">
                <Button variant="secondary">Open Calendar</Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 pt-2 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Library className="h-5 w-5 text-primary" />
              Recent resources
            </CardTitle>
            <CardDescription>Latest additions.</CardDescription>
          </CardHeader>
          <CardContent>
            {resources.length === 0 ? (
              <p className="text-sm text-foreground/70">No resources yet.</p>
            ) : (
              <div className="space-y-2">
                {resources.map((r) => (
                  <div key={r.id} className="flex items-center justify-between rounded-xl bg-background p-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-extrabold">{r.title}</p>
                      <p className="text-xs text-foreground/70">
                        {r.subject} • Year {r.academicYear}
                      </p>
                    </div>
                    <Badge tone="neutral">{r.type}</Badge>
                  </div>
                ))}
              </div>
            )}
            <div className="mt-3">
              <Link href="/resources" className="inline-flex">
                <Button variant="secondary">Open Resources</Button>
              </Link>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5 text-primary" />
              Campus navigation
            </CardTitle>
            <CardDescription>Search rooms and jump from your calendar.</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-foreground/70">
              Use “Find room on map” from Calendar events, or search by room code (e.g. C204).
            </p>
            <div className="mt-3">
              <Link href="/map" className="inline-flex">
                <Button variant="secondary">Open Map</Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
