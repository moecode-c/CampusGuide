"use client";

import * as React from "react";
import { usePathname, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";

/**
 * Sends a not-yet-verified student to /pending, on every navigation.
 *
 * The `(app)` server layout already checks account status, but a shared layout
 * is not re-rendered when you move between pages inside it. So the check only
 * ran on a full page load: a pending student who landed on /pending and then
 * tapped a navbar link arrived at Resources with no redirect, saw the page
 * frame, and got "Unauthorized" where the files should have been — because the
 * API correctly refused them while the page had already rendered.
 *
 * This runs in the client layout, which does re-render on navigation, so the
 * gap is closed without weakening the server-side check. Both stay: the server
 * one is the guard, this one is the one that catches client-side hops.
 */
export function AccountGuard() {
  const { status: sessionStatus } = useSession();
  const pathname = usePathname();
  const router = useRouter();

  React.useEffect(() => {
    // Only for signed-in students; a signed-out visitor is the proxy's business.
    if (sessionStatus !== "authenticated") return;

    // The pending screen is the destination — never bounce it off itself.
    if (pathname?.startsWith("/pending")) return;

    let cancelled = false;

    (async () => {
      try {
        const res = await fetch("/api/student/flags", { cache: "no-store" });
        if (!res.ok || cancelled) return;

        const json = await res.json().catch(() => null);
        const accountStatus = json?.status;

        // A null status means the endpoint could not say — leave them alone
        // rather than bouncing someone out on a bad response.
        if (!accountStatus || accountStatus === "active") return;

        router.replace("/pending");
      } catch {
        // A dropped request must not eject a legitimate student. The server
        // layout and the API guards both still hold.
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [pathname, router, sessionStatus]);

  return null;
}
