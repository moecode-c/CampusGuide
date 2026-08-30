"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Button } from "@/components/ui/button";
import { TERMS_CONSENT_LABEL } from "@/lib/terms";
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
  const [acceptTerms, setAcceptTerms] = React.useState(false);
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

    if (!acceptTerms) {
      setError("You must accept the rules and conditions to create an account");
      return;
    }

    setLoading(true);

    // Without a try/catch a dropped request leaves the button disabled forever
    // with no explanation.
    try {
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
          acceptTerms,
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

      // ?new=1 makes the pending screen greet them with a confirmation rather
      // than looking like a wall they hit for no reason.
      router.push(signInResult?.ok ? "/pending?new=1" : "/login");
    } catch {
      setLoading(false);
      setError("Network error. Check your connection and try again.");
    }
  }

  return (
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
                <PasswordInput value={password} onChange={(e) => setPassword(e.target.value)} required />
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

              <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-foreground/15 bg-background p-4">
                <input
                  type="checkbox"
                  className="mt-0.5 h-4 w-4 shrink-0 accent-primary"
                  checked={acceptTerms}
                  onChange={(e) => setAcceptTerms(e.target.checked)}
                  aria-describedby="terms-consent"
                />
                <span id="terms-consent" className="text-xs leading-relaxed text-foreground/80">
                  {TERMS_CONSENT_LABEL}{" "}
                  <Link
                    href="/terms"
                    target="_blank"
                    className="font-bold text-primary underline underline-offset-2"
                  >
                    Read the full rules and conditions
                  </Link>
                  .
                </span>
              </label>

              {error ? <p className="text-sm font-semibold text-risk">{error}</p> : null}

              {/* Disabled until it is ticked, so the requirement is obvious
                  before the form is submitted rather than after. */}
              <Button type="submit" className="w-full" disabled={loading || !acceptTerms}>
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
  );
}
