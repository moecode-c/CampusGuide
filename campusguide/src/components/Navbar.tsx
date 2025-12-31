"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import {
  CalendarDays,
  ClipboardCheck,
  GraduationCap,
  LayoutDashboard,
  MapPin,
  Library,
  Shield,
  ChevronDown,
  LogIn,
  UserPlus,
  LogOut,
  Menu,
  X,
} from "lucide-react";
import * as React from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";

function NavLink({
  href,
  icon,
  label,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
}) {
  const pathname = usePathname();
  const active = pathname === href;
  return (
    <Link
      href={href}
      className={cn(
        "flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold transition-colors",
        active
          ? "bg-primary text-white"
          : "text-foreground/80 hover:bg-panel/60 hover:text-foreground"
      )}
    >
      <span className="text-foreground/80">{icon}</span>
      <span>{label}</span>
    </Link>
  );
}

export function Navbar() {
  const { data } = useSession();
  const [openGpa, setOpenGpa] = React.useState(false);
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const pathname = usePathname();
  const authed = Boolean(data?.user);

  React.useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  React.useEffect(() => {
    if (!mobileOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [mobileOpen]);

  return (
    <header className="sticky top-0 z-40 border-b border-foreground/10 bg-nav">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
        <Link href="/" className="flex min-w-0 items-center gap-2">
          <span className="grid h-10 w-10 place-items-center rounded-2xl bg-primary text-white shadow-sm">
            <GraduationCap className="h-5 w-5" />
          </span>
          <span className="min-w-0 truncate text-base font-extrabold tracking-tight text-foreground">CampusGuide</span>
        </Link>

        <div className="flex items-center gap-2 lg:hidden">
          <Button
            type="button"
            variant="secondary"
            className="h-10 w-10 rounded-2xl p-0"
            onClick={() => setMobileOpen(true)}
            aria-label="Open menu"
          >
            <Menu className="h-5 w-5" />
          </Button>
        </div>

        <nav className="hidden items-center gap-2 lg:flex">
          {authed ? (
            <>
              <NavLink href="/dashboard" icon={<LayoutDashboard className="h-4 w-4" />} label="Dashboard" />

              <div className="relative">
                <button
                  type="button"
                  onClick={() => setOpenGpa((v) => !v)}
                  onBlur={() => setTimeout(() => setOpenGpa(false), 120)}
                  className={cn(
                    "flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold transition-colors",
                    "text-foreground/80 hover:bg-panel/60 hover:text-foreground"
                  )}
                >
                  <GraduationCap className="h-4 w-4" />
                  GPA
                  <ChevronDown className="h-4 w-4" />
                </button>
                {openGpa ? (
                  <div className="absolute right-0 mt-2 w-52 overflow-hidden rounded-2xl border border-foreground/10 bg-nav shadow-lg">
                    <Link
                      className="flex items-center gap-2 px-4 py-3 text-sm font-semibold text-foreground/85 hover:bg-panel/60"
                      href="/gpa/estimator"
                    >
                      <GraduationCap className="h-4 w-4" />
                      GPA Estimator
                    </Link>
                    <Link
                      className="flex items-center gap-2 px-4 py-3 text-sm font-semibold text-foreground/85 hover:bg-panel/60"
                      href="/gpa/calculator"
                    >
                      <GraduationCap className="h-4 w-4" />
                      GPA Calculator
                    </Link>
                  </div>
                ) : null}
              </div>

              <NavLink href="/attendance" icon={<ClipboardCheck className="h-4 w-4" />} label="Attendance" />
              <NavLink href="/calendar" icon={<CalendarDays className="h-4 w-4" />} label="Calendar" />
              <NavLink href="/resources" icon={<Library className="h-4 w-4" />} label="Resources" />
              <NavLink href="/map" icon={<MapPin className="h-4 w-4" />} label="Map" />
              {data?.user?.role === "admin" ? (
                <NavLink href="/admin" icon={<Shield className="h-4 w-4" />} label="Admin" />
              ) : null}
            </>
          ) : (
            <>
              <NavLink href="/" icon={<LayoutDashboard className="h-4 w-4" />} label="Home" />
              <NavLink href="/login" icon={<LogIn className="h-4 w-4" />} label="Login" />
              <NavLink href="/register" icon={<UserPlus className="h-4 w-4" />} label="Register" />
            </>
          )}
        </nav>

        <div className="hidden items-center gap-2 lg:flex">
          {!authed ? (
            <>
              <Link href="/login" className="hidden sm:block">
                <Button variant="ghost">Sign in</Button>
              </Link>
              <Link href="/register" className="hidden sm:block">
                <Button variant="secondary">Create account</Button>
              </Link>
            </>
          ) : (
            <Button
              variant="secondary"
              className="h-10"
              onClick={() => signOut({ callbackUrl: "/" })}
            >
              <LogOut className="h-4 w-4" />
              Sign out
            </Button>
          )}
        </div>
      </div>

      {mobileOpen ? (
        <div className="lg:hidden">
          <button
            type="button"
            className="fixed inset-0 z-50 bg-background/70 backdrop-blur-sm"
            aria-label="Close menu"
            onClick={() => setMobileOpen(false)}
          />
          <aside
            role="dialog"
            aria-modal="true"
            className="fixed left-0 top-0 z-60 h-dvh w-[min(88vw,22rem)] border-r border-foreground/10 bg-nav"
          >
            <div className="flex items-center justify-between border-b border-foreground/10 px-4 py-3">
              <div className="flex items-center gap-2">
                <span className="grid h-10 w-10 place-items-center rounded-2xl bg-primary text-white shadow-sm">
                  <GraduationCap className="h-5 w-5" />
                </span>
                <span className="text-base font-extrabold tracking-tight text-foreground">CampusGuide</span>
              </div>
              <Button
                type="button"
                variant="ghost"
                className="h-10 w-10 rounded-2xl p-0"
                onClick={() => setMobileOpen(false)}
                aria-label="Close menu"
              >
                <X className="h-5 w-5" />
              </Button>
            </div>

            <div className="flex h-[calc(100dvh-64px)] flex-col gap-2 overflow-auto p-3">
              {authed ? (
                <>
                  <NavLink href="/dashboard" icon={<LayoutDashboard className="h-4 w-4" />} label="Dashboard" />

                  <div className="px-3 pt-2 text-xs font-extrabold uppercase tracking-wide text-foreground/60">GPA</div>
                  <NavLink href="/gpa/estimator" icon={<GraduationCap className="h-4 w-4" />} label="GPA Estimator" />
                  <NavLink href="/gpa/calculator" icon={<GraduationCap className="h-4 w-4" />} label="GPA Calculator" />

                  <NavLink href="/attendance" icon={<ClipboardCheck className="h-4 w-4" />} label="Attendance" />
                  <NavLink href="/calendar" icon={<CalendarDays className="h-4 w-4" />} label="Calendar" />
                  <NavLink href="/resources" icon={<Library className="h-4 w-4" />} label="Resources" />
                  <NavLink href="/map" icon={<MapPin className="h-4 w-4" />} label="Map" />
                  {data?.user?.role === "admin" ? (
                    <NavLink href="/admin" icon={<Shield className="h-4 w-4" />} label="Admin" />
                  ) : null}

                  <div className="mt-2 border-t border-foreground/10 pt-3">
                    <Button
                      type="button"
                      variant="secondary"
                      className="h-11 w-full justify-start"
                      onClick={() => signOut({ callbackUrl: "/" })}
                    >
                      <LogOut className="h-4 w-4" />
                      Sign out
                    </Button>
                  </div>
                </>
              ) : (
                <>
                  <NavLink href="/" icon={<LayoutDashboard className="h-4 w-4" />} label="Home" />
                  <NavLink href="/login" icon={<LogIn className="h-4 w-4" />} label="Login" />
                  <NavLink href="/register" icon={<UserPlus className="h-4 w-4" />} label="Register" />
                </>
              )}
            </div>
          </aside>
        </div>
      ) : null}
    </header>
  );
}
