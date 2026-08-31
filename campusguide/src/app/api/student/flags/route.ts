import { requireSession } from "@/server/security/requireSession";
import { getAccountState } from "@/server/security/accountStatus";
import { enforceRateLimit } from "@/server/security/rateLimit";
import { getFlags } from "@/server/flags";
import { noStoreJson } from "@/server/httpCache";

/**
 * Read-only lock state for the student navbar, so a locked area's link can be
 * hidden rather than leading to a wall.
 *
 * Deliberately thin: booleans and notice text only, never who changed them or
 * when. That detail is admin business.
 */
export async function GET(req: Request) {
  // allowAnyStatus, because a pending student needs an answer here too: this is
  // what tells the client to send them to /pending. Refusing them a 401 is what
  // left them looking at a page full of "Unauthorized".
  const session = await requireSession({ allowAnyStatus: true });
  if (!session) return noStoreJson({ error: "Unauthorized" }, 401);

  const limited = await enforceRateLimit(req.headers, "student:flags:get", {
    points: 120,
    duration: 60,
    identity: session.user.id,
  });
  if (limited) return limited;

  const [flags, state] = await Promise.all([getFlags(), getAccountState(session.user.id)]);

  const locked = Object.fromEntries(
    Object.entries(flags).map(([key, state]) => [key, state.enabled])
  );

  /**
   * The account's real status, read fresh (from a short-lived cache) rather than
   * taken from the JWT, which stays stale for the life of the session.
   *
   * The (app) layout also checks this, but a shared server layout is not
   * re-rendered when you navigate between pages inside it — so a pending student
   * who landed on /pending and then tapped a navbar link reached the page with
   * no redirect at all. The client guard uses this to catch that case.
   */
  return noStoreJson({ locked, status: state?.status ?? null }, 200);
}
