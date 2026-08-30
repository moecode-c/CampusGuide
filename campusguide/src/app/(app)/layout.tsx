import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { getServerSession } from "next-auth";
import { authOptions } from "@/server/auth";
import { AccountStatuses } from "@/server/models/User";
import { getAccountState, touchLastSeen } from "@/server/security/accountStatus";
import { AppMain } from "@/components/AppMain";

/**
 * Central status gate for every signed-in page.
 *
 * The middleware can only read the JWT, which is stale for up to a session
 * lifetime after a ban. This runs on the server with the real account state, so
 * a banned or unverified student is redirected on their very next navigation.
 */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);
  const pathname = (await headers()).get("x-pathname") ?? "";

  if (session?.user?.id) {
    const state = await getAccountState(session.user.id);

    // The pending screen is the one place a non-active account is allowed.
    if (!pathname.startsWith("/pending")) {
      if (!state) redirect("/login");
      if (state.status !== AccountStatuses.Active) redirect("/pending");
    }

    if (state?.status === AccountStatuses.Active) void touchLastSeen(session.user.id);
  }

  // The width decision lives in AppMain, a client component. This layout is
  // shared by /admin and the student pages, and a shared layout is preserved
  // across navigations between them rather than re-rendered — so deciding it
  // here from `pathname` froze the value at whichever page was loaded first,
  // and a client-side hop from /admin to /calendar left the student page with
  // the admin's full-bleed width and no padding.
  return <AppMain>{children}</AppMain>;
}
