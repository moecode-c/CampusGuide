import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/server/auth";
import { connectToDatabase } from "@/server/db";
import { MidtermGrade } from "@/server/models/MidtermGrade";
import { Event, EventTypes } from "@/server/models/Event";
import { getResourcesCached } from "@/server/data/resources";
import { getGpaPlugin } from "@/lib/gpa";
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

  const [midterms] = await Promise.all([
    MidtermGrade.find({ userId: session.user.id }).select({ subject: 1, midtermMark: 1, creditHours: 1 }).lean(),
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

  // Fetch "Up Next" event (Lecture/Lab ONLY)
  const nextClass = await Event.findOne({
    userId: session.user.id,
    start: { $gte: now },
    type: { $in: [EventTypes.Lecture, EventTypes.Lab] },
  })
    .sort({ start: 1 })
    .select({ title: 1, type: 1, start: 1, end: 1, roomCode: 1, professor: 1 })
    .lean();

  const resources = (await getResourcesCached()).slice(0, 6).map((r: any) => ({
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
                  <p className="text-2xl font-extrabold tracking-tight">{(nextClass as any).title}</p>
                  <div className="flex items-center gap-2 text-sm text-foreground/70 mt-1">
                    <span className="font-semibold text-foreground">{(nextClass as any).type === "lab" ? "Lab" : "Lecture"}</span>
                    <span>•</span>
                    <span>{new Date((nextClass as any).start).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  {(nextClass as any).roomCode && (
                    <Link href={`/map?room=${encodeURIComponent((nextClass as any).roomCode)}`}>
                      <Button size="sm" variant="secondary" className="h-8 gap-1.5">
                        <MapPin className="h-3.5 w-3.5" />
                        {(nextClass as any).roomCode}
                      </Button>
                    </Link>
                  )}
                  {(nextClass as any).professor && (
                    <div className="text-xs font-medium px-2 py-1 bg-background rounded-md border border-foreground/10">
                      👨‍🏫 {(nextClass as any).professor}
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
