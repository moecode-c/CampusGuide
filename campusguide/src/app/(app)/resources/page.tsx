import Link from "next/link";
import { Lock, ShieldCheck } from "lucide-react";
import { getServerSession } from "next-auth";
import { authOptions } from "@/server/auth";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { lockState } from "@/server/flags";
import { FlagKeys, flagMeta } from "@/lib/flags";
import { Roles } from "@/server/roles";
import { ResourcesClient } from "./ResourcesClient";

/**
 * The drive, behind its admin kill switch.
 *
 * A server component so the lock is decided before any drive markup is sent —
 * a client-side check would ship the whole page and then hide it. Admins render
 * the real thing with a banner, because the reason to lock it is usually to fix
 * something, and you cannot fix what you cannot see.
 */
export default async function ResourcesPage() {
  const [session, lock] = await Promise.all([
    getServerSession(authOptions),
    lockState(FlagKeys.ResourcesLocked),
  ]);

  const isAdmin = session?.user?.role === Roles.Admin;

  if (lock.enabled && !isAdmin) {
    return (
      <div className="space-y-2">
        <h1 className="text-2xl font-extrabold tracking-tight">Resources</h1>

        <Card className="mt-4">
          <CardContent className="flex flex-col items-center gap-4 py-14 text-center">
            <span className="grid h-14 w-14 place-items-center rounded-2xl bg-warning/15 text-warning">
              <Lock className="h-7 w-7" />
            </span>

            <div className="space-y-2">
              <p className="text-lg font-extrabold">Temporarily unavailable</p>
              <p className="mx-auto max-w-md text-sm text-foreground/70">
                {lock.message ?? flagMeta(FlagKeys.ResourcesLocked).defaultMessage}
              </p>
            </div>

            <Link
              href="/dashboard"
              className="text-sm font-semibold text-primary underline-offset-4 hover:underline"
            >
              Back to dashboard
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <>
      {lock.enabled && isAdmin ? (
        <div className="mb-4 flex flex-wrap items-center gap-3 rounded-2xl border border-warning/25 bg-warning/10 px-4 py-3">
          <ShieldCheck className="h-5 w-5 shrink-0 text-warning" />
          <p className="min-w-0 flex-1 text-sm font-semibold">
            The drive is locked for students right now. You can see it because you are an admin.
          </p>
          <Badge tone="warning">Admin view</Badge>
          <Link
            href="/admin/controls"
            className="text-sm font-bold text-primary underline-offset-4 hover:underline"
          >
            Unlock
          </Link>
        </div>
      ) : null}

      <ResourcesClient />
    </>
  );
}
