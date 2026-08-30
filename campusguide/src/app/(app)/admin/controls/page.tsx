"use client";

import * as React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { AlertTriangle, Loader2, Lock, Unlock } from "lucide-react";
import { FLAG_CATALOG, type FlagKey, type FlagMap } from "@/lib/flags";

export default function AdminControlsPage() {
  const [flags, setFlags] = React.useState<FlagMap | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [busy, setBusy] = React.useState<FlagKey | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [drafts, setDrafts] = React.useState<Record<string, string>>({});

  const load = React.useCallback(async () => {
    try {
      const res = await fetch("/api/admin/flags");
      const j = await res.json().catch(() => null);
      if (!res.ok) {
        setError(j?.error ?? "Failed to load controls");
        return;
      }
      setFlags(j.flags as FlagMap);
      setError(null);
    } catch {
      setError("Network error. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void load();
  }, [load]);

  async function toggle(key: FlagKey, enabled: boolean) {
    setBusy(key);
    setError(null);
    try {
      const res = await fetch("/api/admin/flags", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ key, enabled, message: drafts[key] || undefined }),
      });
      const j = await res.json().catch(() => null);
      if (!res.ok) {
        setError(j?.error ?? "Could not update that switch");
        return;
      }
      setFlags(j.flags as FlagMap);
    } catch {
      setError("Network error. Check your connection and try again.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-2">
      <h1 className="text-2xl font-extrabold tracking-tight">Controls</h1>
      <p className="text-sm text-foreground/70">
        Take part of the site offline for students while you fix it. You keep full access to
        anything locked here.
      </p>

      {error ? (
        <p className="mt-4 rounded-xl border border-risk/25 bg-risk/10 px-4 py-3 text-sm font-semibold text-risk">
          {error}
        </p>
      ) : null}

      {loading ? (
        <div className="flex items-center gap-2 py-10 text-sm text-foreground/60">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading controls…
        </div>
      ) : (
        <div className="mt-4 space-y-4">
          {FLAG_CATALOG.map((meta) => {
            const state = flags?.[meta.key];
            const on = Boolean(state?.enabled);

            return (
              <Card key={meta.key}>
                <CardHeader>
                  <div className="flex flex-wrap items-center gap-2">
                    <CardTitle>{meta.label}</CardTitle>
                    <Badge tone={on ? "risk" : "success"}>{on ? "Locked" : "Open"}</Badge>
                  </div>
                  <CardDescription>{meta.description}</CardDescription>
                </CardHeader>

                <CardContent className="space-y-4">
                  {on ? (
                    <div className="flex items-start gap-2 rounded-xl border border-warning/25 bg-warning/10 px-3 py-2.5">
                      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
                      <p className="text-sm">
                        Students currently see:{" "}
                        <span className="font-semibold">{state?.message ?? meta.defaultMessage}</span>
                      </p>
                    </div>
                  ) : null}

                  <label className="block space-y-1.5">
                    <span className="text-sm font-semibold">
                      Message for students{" "}
                      <span className="font-normal text-foreground/50">(optional)</span>
                    </span>
                    <Input
                      value={drafts[meta.key] ?? state?.message ?? ""}
                      onChange={(e) => setDrafts((d) => ({ ...d, [meta.key]: e.target.value }))}
                      placeholder={meta.defaultMessage}
                      maxLength={300}
                    />
                  </label>

                  <div className="flex flex-wrap items-center gap-3">
                    <Button
                      variant={on ? "secondary" : "danger"}
                      disabled={busy === meta.key}
                      onClick={() => toggle(meta.key, !on)}
                    >
                      {busy === meta.key ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : on ? (
                        <Unlock className="h-4 w-4" />
                      ) : (
                        <Lock className="h-4 w-4" />
                      )}
                      {on ? "Unlock for students" : "Lock for students"}
                    </Button>

                    {state?.updatedAt ? (
                      <p className="text-xs text-foreground/55">
                        Last changed {new Date(state.updatedAt).toLocaleString()}
                        {state.updatedBy ? ` by ${state.updatedBy}` : ""}
                      </p>
                    ) : null}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
