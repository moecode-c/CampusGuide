"use client";

import * as React from "react";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Lock, UserRound } from "lucide-react";

type Profile = {
  id: string;
  name: string;
  email: string;
  miuId: string | null;
  phone: string | null;
  academicYear: number | null;
  role: string;
  status: string;
  createdAt: string | null;
};

function ReadOnlyField({ label, value, why }: { label: string; value: string; why: string }) {
  return (
    <label className="block">
      <span className="mb-1 flex items-center gap-1.5 text-xs font-bold text-foreground/60">
        <Lock className="h-3.5 w-3.5" />
        {label}
      </span>
      <Input value={value} readOnly disabled className="opacity-70" />
      <span className="mt-1 block text-xs text-foreground/45">{why}</span>
    </label>
  );
}

export default function ProfilePage() {
  const [profile, setProfile] = React.useState<Profile | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [notice, setNotice] = React.useState<string | null>(null);

  const [name, setName] = React.useState("");
  const [phone, setPhone] = React.useState("");
  const [academicYear, setAcademicYear] = React.useState("");

  const seed = React.useCallback((p: Profile) => {
    setProfile(p);
    setName(p.name ?? "");
    setPhone(p.phone ?? "");
    setAcademicYear(p.academicYear ? String(p.academicYear) : "");
  }, []);

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/student/profile", { cache: "no-store" });
      const j = await res.json().catch(() => null);
      if (!res.ok) {
        setError(j?.error ?? "Could not load your profile");
        return;
      }
      seed(j.profile as Profile);
      setError(null);
    } catch {
      setError("Network error. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }, [seed]);

  React.useEffect(() => {
    void load();
  }, [load]);

  // Only what actually changed goes to the server, so an untouched field is
  // never revalidated against rules it already satisfies.
  const changes = React.useMemo(() => {
    if (!profile) return {};

    const body: Record<string, unknown> = {};
    if (name.trim() !== (profile.name ?? "")) body.name = name.trim();
    if (phone.trim() !== (profile.phone ?? "")) body.phone = phone.trim();

    const nextYear = academicYear ? Number(academicYear) : null;
    if (nextYear !== profile.academicYear && nextYear !== null) body.academicYear = nextYear;

    return body;
  }, [academicYear, name, phone, profile]);

  const dirty = Object.keys(changes).length > 0;

  async function save() {
    if (!dirty) return;

    setSaving(true);
    setError(null);
    setNotice(null);

    try {
      const res = await fetch("/api/student/profile", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(changes),
      });
      const j = await res.json().catch(() => null);

      if (!res.ok) {
        setError(j?.error ?? "Could not save your changes");
        return;
      }

      seed(j.profile as Profile);
      setNotice("Saved.");
    } catch {
      setError("Network error. Check your connection and try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-2">
      <h1 className="text-2xl font-extrabold tracking-tight">My profile</h1>
      <p className="text-sm text-foreground/70">Your account details, and what you can change.</p>

      {error ? (
        <p className="mt-4 rounded-2xl bg-risk/10 px-4 py-3 text-sm font-semibold text-risk">{error}</p>
      ) : null}
      {notice ? (
        <p className="mt-4 rounded-2xl bg-success/10 px-4 py-3 text-sm font-semibold text-success">
          {notice}
        </p>
      ) : null}

      {loading ? (
        <p className="mt-4 text-sm text-foreground/70">Loading…</p>
      ) : !profile ? null : (
        <Card className="mt-4">
          <CardHeader>
            <CardTitle className="flex flex-wrap items-center gap-2">
              <UserRound className="h-5 w-5 text-primary" />
              {profile.name}
              {profile.role === "admin" ? <Badge tone="success">Admin</Badge> : null}
              {profile.status !== "active" ? <Badge tone="warning">{profile.status}</Badge> : null}
            </CardTitle>
            <CardDescription>
              Member since{" "}
              {profile.createdAt
                ? new Date(profile.createdAt).toLocaleDateString(undefined, {
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  })
                : "—"}
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <ReadOnlyField
                label="Student ID"
                value={profile.miuId ?? "—"}
                why="Fixed — an admin checked this against your ID card."
              />
              <ReadOnlyField
                label="University email"
                value={profile.email}
                why="Fixed — it has to match your student ID."
              />
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1 block text-xs font-bold text-foreground/60">Name</span>
                <Input value={name} onChange={(e) => setName(e.target.value)} />
              </label>

              <label className="block">
                <span className="mb-1 block text-xs font-bold text-foreground/60">Phone</span>
                <Input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  inputMode="tel"
                  placeholder="01012345678"
                />
              </label>

              <label className="block">
                <span className="mb-1 block text-xs font-bold text-foreground/60">Academic year</span>
                <Select value={academicYear} onChange={(e) => setAcademicYear(e.target.value)}>
                  <option value="">Not set</option>
                  {[1, 2, 3, 4].map((y) => (
                    <option key={y} value={y}>
                      Year {y}
                    </option>
                  ))}
                </Select>
              </label>
            </div>

            <p className="text-xs text-foreground/50">
              Need your student ID or email corrected? Ask an admin — see the{" "}
              <Link href="/faq" className="font-semibold text-primary underline-offset-4 hover:underline">
                FAQ
              </Link>
              .
            </p>

            <div className="flex flex-wrap items-center gap-3">
              <Button onClick={save} disabled={!dirty || saving}>
                {saving ? "Saving…" : "Save changes"}
              </Button>
              <Button
                variant="ghost"
                disabled={!dirty || saving}
                onClick={() => profile && seed(profile)}
              >
                Discard
              </Button>
              {!dirty ? <span className="text-xs text-foreground/45">Nothing to save yet.</span> : null}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
