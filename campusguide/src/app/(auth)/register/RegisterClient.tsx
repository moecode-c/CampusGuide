"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { UserPlus } from "lucide-react";
import { MIU_EMAIL_DOMAIN, PHONE_HINT, isValidPhone, validateMiuIdentity } from "@/lib/miu";

export function RegisterClient() {
  const router = useRouter();

  const [name, setName] = React.useState("");
  const [miuId, setMiuId] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [phone, setPhone] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [academicYear, setAcademicYear] = React.useState("1");
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);

  function validatePassword(pw: string) {
    if (pw.length < 8) return "Password must be at least 8 characters";
    if (!/[A-Z]/.test(pw)) return "Password must include at least 1 uppercase letter";
    if (!/[0-9]/.test(pw)) return "Password must include at least 1 number";
    return null;
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    // Same rules the API enforces, checked here so mistakes surface instantly.
    const identityError = validateMiuIdentity(miuId, email);
    if (identityError) {
      setError(identityError);
      return;
    }

    if (!isValidPhone(phone)) {
      setError(PHONE_HINT);
      return;
    }

    const pwError = validatePassword(password);
    if (pwError) {
      setError(pwError);
      return;
    }

    setLoading(true);
    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name,
        miuId,
        email,
        phone,
        password,
        academicYear: Number(academicYear),
      }),
    });

    if (!res.ok) {
      setLoading(false);
      const j = await res.json().catch(() => ({}));
      setError(j.error ?? "Registration failed");
      return;
    }

    // Sign them straight in so they land on the verification instructions
    // rather than a login form they'd have to fill in again.
    const signInResult = await signIn("credentials", { email, password, redirect: false });
    setLoading(false);

    router.push(signInResult?.ok ? "/pending" : "/login");
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
            <CardDescription>
              CampusGuide is for MIU students. Your account is checked against your student ID before it is activated.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={onSubmit} className="space-y-3">
              <div className="space-y-1">
                <label className="text-sm font-semibold">Name</label>
                <Input value={name} onChange={(e) => setName(e.target.value)} required />
              </div>

              <div className="space-y-1">
                <label className="text-sm font-semibold">Student ID</label>
                <Input
                  value={miuId}
                  onChange={(e) => setMiuId(e.target.value)}
                  placeholder="2024/15832"
                  inputMode="numeric"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="text-sm font-semibold">University email</label>
                <Input
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  type="email"
                  placeholder={`ahmed202415832@${MIU_EMAIL_DOMAIN}`}
                  required
                />
                <p className="text-xs text-foreground/60">
                  Your name followed by your ID digits, at {MIU_EMAIL_DOMAIN}.
                </p>
              </div>

              <div className="space-y-1">
                <label className="text-sm font-semibold">Phone number</label>
                <Input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  type="tel"
                  placeholder="01012345678"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="text-sm font-semibold">Password</label>
                <Input value={password} onChange={(e) => setPassword(e.target.value)} type="password" required />
                <p className="text-xs text-foreground/60">8+ chars, 1 uppercase letter, 1 number.</p>
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
