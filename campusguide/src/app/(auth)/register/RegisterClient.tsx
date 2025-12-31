"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { UserPlus } from "lucide-react";

export function RegisterClient() {
  const router = useRouter();

  const [name, setName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [academicYear, setAcademicYear] = React.useState("1");
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name,
        email,
        password,
        academicYear: Number(academicYear),
      }),
    });
    setLoading(false);
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setError(j.error ?? "Registration failed");
      return;
    }
    router.push("/login");
  }

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-10">
      <div className="mx-auto w-full max-w-md">
        <Card className="w-full border-foreground/10 bg-panel/40">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserPlus className="h-5 w-5 text-primary" />
              Create account
            </CardTitle>
            <CardDescription>Select your academic year to personalize your experience.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={onSubmit} className="space-y-3">
              <div className="space-y-1">
                <label className="text-sm font-semibold">Name</label>
                <Input value={name} onChange={(e) => setName(e.target.value)} required />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-semibold">Email</label>
                <Input value={email} onChange={(e) => setEmail(e.target.value)} type="email" required />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-semibold">Password</label>
                <Input value={password} onChange={(e) => setPassword(e.target.value)} type="password" required />
                <p className="text-xs text-foreground/60">Minimum 8 characters.</p>
              </div>
              <div className="space-y-1">
                <label className="text-sm font-semibold">Academic year</label>
                <Select value={academicYear} onChange={(e) => setAcademicYear(e.target.value)}>
                  <option value="1">Year 1</option>
                  <option value="2">Year 2</option>
                  <option value="3">Year 3</option>
                  <option value="4">Year 4</option>
                </Select>
              </div>

              {error ? <p className="text-sm font-semibold text-risk">{error}</p> : null}

              <Button type="submit" className="w-full" disabled={loading}>
                <UserPlus className="h-4 w-4" />
                {loading ? "Creating…" : "Create account"}
              </Button>
            </form>

            <div className="mt-4 text-sm text-foreground/80">
              Already have an account?{" "}
              <Link className="font-semibold text-primary hover:underline" href="/login">
                Sign in
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
