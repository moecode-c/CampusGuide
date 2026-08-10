import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { getServerSession } from "next-auth";
import { authOptions } from "@/server/auth";
import { AccountStatuses } from "@/server/models/User";
import { getAccountState, touchLastSeen } from "@/server/security/accountStatus";

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

  // The admin area runs its own sidebar shell and needs the full viewport; the
  // student pages stay in a readable centered column.
  const isAdminArea = pathname === "/admin" || pathname.startsWith("/admin/");

  return (
    <main className={isAdminArea ? "w-full" : "mx-auto w-full max-w-6xl px-4 py-6"}>{children}</main>
  );
}
