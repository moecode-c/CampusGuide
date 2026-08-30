import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/server/auth";
import { connectToDatabase } from "@/server/db";
import { MidtermGrade } from "@/server/models/MidtermGrade";
import { Event, EventTypes } from "@/server/models/Event";
import { Resource } from "@/server/models/Resource";
import { getGpaPlugin } from "@/lib/gpa";
import { expandOccurrences } from "@/server/calendar/recurrence";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CalendarDays, GraduationCap, ClipboardCheck, Library, MapPin } from "lucide-react";
import { AboutHero } from "@/components/dashboard/AboutHero";

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  await connectToDatabase();

  const now = new Date();
  const soon = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  // These three are independent. Awaited one at a time they cost three database
  // round trips; in parallel the page waits for the slowest one only.
  const [midterms, scheduled, resources] = await Promise.all([
    MidtermGrade.find({ userId: session.user.id }).select({ subject: 1, midtermMark: 1, creditHours: 1 }).lean(),

    // Imported classes are weekly series anchored to their first occurrence, so a
    // plain `start >= now` query stops matching after week one. Recurring events
    // have to come back whole and be expanded; one-off events can be bounded here.
    Event.find({
      userId: session.user.id,
      $or: [{ isRecurring: true }, { end: { $gte: now } }],
    })
      .select({ title: 1, type: 1, start: 1, end: 1, roomCode: 1, professor: 1, isRecurring: 1, rrule: 1 })
      .lean(),

    // Six rows off the createdAt index, rather than loading the whole drive to
    // slice six off the end of it.
    Resource.find({}).sort({ createdAt: -1 }).limit(6).select({ title: 1, subject: 1, academicYear: 1, type: 1 }).lean(),
  ]);

  // Marks are stored out of 40, so the 0–100 "midterm-only" scale would grade
  // every student an F. Use the same 0–40 range the estimator shows.
  const gpaInputs = midterms.map((m: any) => ({
    subject: m.subject,
    midtermMark: m.midtermMark,
    creditHours: m.creditHours ?? 3,
  }));
  const gpaBest = getGpaPlugin("midterm-40-best").compute(gpaInputs);
  const gpaWorst = getGpaPlugin("midterm-40-worst").compute(gpaInputs);
  const gpaLow = Math.min(gpaBest.overallGpa, gpaWorst.overallGpa);
  const gpaHigh = Math.max(gpaBest.overallGpa, gpaWorst.overallGpa);
  const subjectCount = gpaBest.items.length;

  const occurrences = (scheduled as any[])
    .flatMap((e) =>
      expandOccurrences(e, now, soon).map((occ) => ({
        id: `${String(e._id)}:${occ.start.toISOString()}`,
        title: e.title as string,
        type: e.type as string,
        start: occ.start,
        roomCode: (e.roomCode ?? null) as string | null,
        professor: (e.professor ?? null) as string | null,
      }))
    )
    .sort((a, b) => a.start.getTime() - b.start.getTime());

  const upcoming = occurrences.slice(0, 6);
  const nextClass =
    occurrences.find((o) => o.type === EventTypes.Lecture || o.type === EventTypes.Lab) ?? null;

  const recentResources = (resources as any[]).map((r) => ({
    id: String(r._id),
    title: r.title,
    subject: r.subject,
    academicYear: r.academicYear,
    type: r.type,
  }));

  return (
    <div className="space-y-2">
      <h1 className="text-2xl font-extrabold tracking-tight">Dashboard</h1>
      <p className="text-sm text-foreground/70">Your midterm GPA, attendance, schedule, and latest resources.</p>

      <div className="pt-4">
        <AboutHero />
      </div>

      <div className="grid gap-6 pt-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
        {/* Up Next Card - Prominent */}
        <Card className="border-primary/20 shadow-primary/5 bg-primary/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-primary">
              <CalendarDays className="h-5 w-5" />
              Up Next
            </CardTitle>
            <CardDescription>Your immediate next class.</CardDescription>
          </CardHeader>
          <CardContent>
            {nextClass ? (
              <div className="space-y-4">
                <div>
                  <p className="break-words text-xl font-extrabold tracking-tight sm:text-2xl">{nextClass.title}</p>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-foreground/70">
                    <span className="font-semibold text-foreground">{nextClass.type === "lab" ? "Lab" : "Lecture"}</span>
                    <span>•</span>
                    <span>{nextClass.start.toLocaleString([], { weekday: "short", hour: "2-digit", minute: "2-digit" })}</span>
                  </div>
                </div>

            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              {nextClass.roomCode && (
                    <Link href={`/map?room=${encodeURIComponent(nextClass.roomCode)}`}>
                      <Button size="sm" variant="secondary" className="h-8 gap-1.5">
                        <MapPin className="h-3.5 w-3.5" />
                        {nextClass.roomCode}
                      </Button>
                    </Link>
                  )}
                  {nextClass.professor && (
                    <div className="text-xs font-medium px-2 py-1 bg-background rounded-md border border-foreground/10">
                      👨‍🏫 {nextClass.professor}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="py-6 text-center">
                <p className="text-sm font-semibold">No upcoming classes.</p>
                <p className="text-xs text-foreground/60">Enjoy your free time!</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <GraduationCap className="h-5 w-5 text-primary" />
              GPA estimate
            </CardTitle>
            <CardDescription>Midterm marks out of 40, 4.0 scale.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-background p-4">
              <div className="min-w-0">
                <p className="text-xs font-semibold text-foreground/70">Overall (worst–best)</p>
                <p className="text-xl font-extrabold tracking-tight sm:text-3xl">
                  {gpaLow.toFixed(2)}–{gpaHigh.toFixed(2)}
                </p>
              </div>
              <Badge tone="neutral">{subjectCount} subjects</Badge>
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
            <CardDescription>Track how many lectures/labs you can miss.</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-foreground/70">
              Save each course, mark missed sessions, and see the remaining allowed absences based on the 25% rule.
            </p>
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
                {upcoming.map((e) => (
                  <div key={e.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-background p-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-extrabold">{e.title}</p>
                      <p className="text-xs text-foreground/70">{e.start.toLocaleString()}</p>
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

      <div className="grid gap-6 pt-2 grid-cols-1 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Library className="h-5 w-5 text-primary" />
              Recent resources
            </CardTitle>
            <CardDescription>Latest additions.</CardDescription>
          </CardHeader>
          <CardContent>
            {recentResources.length === 0 ? (
              <p className="text-sm text-foreground/70">No resources yet.</p>
            ) : (
              <div className="space-y-2">
                {recentResources.map((r) => (
                  <div key={r.id} className="flex min-w-0 items-center justify-between gap-2 rounded-xl bg-background p-3">
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
