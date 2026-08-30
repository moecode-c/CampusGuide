import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/server/auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AboutHero } from "@/components/dashboard/AboutHero";

export default async function Home() {
  const session = await getServerSession(authOptions);
  if (session?.user?.id) redirect("/dashboard");

  return (
    <main className="mx-auto w-full min-w-0 max-w-6xl px-3 py-8 sm:px-4 sm:py-10">
      <div className="pb-10">
        <AboutHero />
      </div>

      <section className="grid items-center gap-10 lg:grid-cols-2">
        <div className="space-y-6">
          <div className="space-y-3">
            <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl md:text-5xl">
              CampusGuide
            </h1>
            <p className="max-w-prose text-base text-foreground/75">
              Your student hub for GPA tools, attendance tracking, a calendar you can actually use, and an
              interactive campus map that can highlight where your lectures are.
            </p>
            <p className="max-w-prose text-sm text-foreground/70">
              How it works: create an account, manage your schedule and calendar, track attendance, use GPA tools, and
              open the campus map to quickly find rooms. Admins publish resources (PDF links, summaries, and videos), and
              students browse them instantly.
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <Link href="/register" className="w-full sm:w-auto">
              <Button className="w-full">Create account</Button>
            </Link>
            <Link href="/login" className="w-full sm:w-auto">
              <Button variant="secondary" className="w-full">
                Sign in
              </Button>
            </Link>
            <a
              href="https://moeportfoliov2.vercel.app"
              target="_blank"
              rel="noreferrer"
              className="w-full sm:w-auto"
            >
              <Button variant="outline" className="w-full">
                View portfolio
              </Button>
            </a>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-foreground/10 bg-panel/40 p-4">
              <div className="text-sm font-semibold">Schedule → Map</div>
              <div className="mt-1 text-sm text-foreground/75">
                Upload your timetable and jump straight to rooms on the map.
              </div>
            </div>
            <div className="rounded-2xl border border-foreground/10 bg-panel/40 p-4">
              <div className="text-sm font-semibold">Locked down</div>
              <div className="mt-1 text-sm text-foreground/75">
                Role-based access control for student and admin features.
              </div>
            </div>
          </div>
        </div>

        <div className="grid gap-4">
          <Card className="border-foreground/10 bg-panel/40">
            <CardHeader>
              <CardTitle>What you can do</CardTitle>
              <CardDescription>Everything you need, in one place.</CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm text-foreground/80">
                <li className="flex items-start gap-2">
                  <span className="mt-1 h-1.5 w-1.5 rounded-full bg-primary" />
                  Midterm-only GPA estimator and full GPA calculator
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-1 h-1.5 w-1.5 rounded-full bg-primary" />
                  Calendar with recurring lectures/labs and room codes
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-1 h-1.5 w-1.5 rounded-full bg-primary" />
                  Map search + deep links like /map?room=C204
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-1 h-1.5 w-1.5 rounded-full bg-primary" />
                  Resources hub (admin upload only)
                </li>
              </ul>
            </CardContent>
          </Card>

          <Card className="border-foreground/10 bg-panel/40">
            <CardHeader>
              <CardTitle>Get started</CardTitle>
              <CardDescription>Sign in to access student pages.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-2 sm:grid-cols-2">
              <Link href="/login" className="w-full">
                <Button className="w-full">Sign in</Button>
              </Link>
              <Link href="/register" className="w-full">
                <Button variant="secondary" className="w-full">
                  Create account
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </section>
    </main>
  );
}
