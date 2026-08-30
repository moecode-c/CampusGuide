"use client";

import * as React from "react";
import { signIn } from "next-auth/react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Button } from "@/components/ui/button";
import { LogIn } from "lucide-react";
import { SESSION_DEFAULT_DAYS, SESSION_REMEMBER_DAYS } from "@/lib/session";

export function LoginClient() {
  const search = useSearchParams();
  const next = search.get("next") ?? "/dashboard";

  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [rememberMe, setRememberMe] = React.useState(true);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    // Without a try/finally a dropped request leaves the button disabled forever.
    let res;
    try {
      res = await signIn("credentials", {
        email,
        password,
        // Credentials cross the wire as strings; the server compares to "true".
        rememberMe: String(rememberMe),
        redirect: false,
        callbackUrl: next,
      });
    } catch {
      setLoading(false);
      setError("Network error. Check your connection and try again.");
      return;
    }

    setLoading(false);
    if (!res?.ok) {
      setError("Invalid student ID/email or password");
      return;
    }
    window.location.href = res.url ?? next;
  }

  return (
    <Card className="w-full border-foreground/10 bg-panel/40">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <LogIn className="h-5 w-5 text-primary" />
          Sign in
        </CardTitle>
        <CardDescription>Access your GPA, attendance, calendar, resources, and map.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="space-y-3">
          <div className="space-y-1">
            <label className="text-sm font-semibold">Student ID or university email</label>
            {/* Not type="email": the API accepts a student ID too, and the
                browser's email validation would refuse to submit "2024/15832". */}
            <Input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              type="text"
              autoComplete="username"
              placeholder="2024/15832"
              required
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-semibold">Password</label>
            <PasswordInput value={password} onChange={(e) => setPassword(e.target.value)} required />
          </div>
          <label className="flex items-start gap-3 rounded-2xl bg-background p-3">
            <input
              type="checkbox"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
              className="mt-0.5 h-5 w-5 shrink-0 accent-primary"
            />
            <span className="text-sm">
              <span className="block font-bold">Remember me for {SESSION_REMEMBER_DAYS} days</span>
              <span className="block text-foreground/60">
                Leave it off and you stay signed in for {SESSION_DEFAULT_DAYS} days instead. Use a shorter
                session on a shared computer.
              </span>
            </span>
          </label>

          {error ? <p className="text-sm font-semibold text-risk">{error}</p> : null}
          <Button type="submit" className="w-full" disabled={loading}>
            <LogIn className="h-4 w-4" />
            {loading ? "Signing in…" : "Sign in"}
          </Button>
        </form>

        <div className="mt-4 text-sm text-foreground/80">
          New student?{" "}
          <Link className="font-semibold text-primary hover:underline" href="/register">
            Create an account
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
