import { requireSession } from "@/server/security/requireSession";
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
  const session = await requireSession();
  if (!session) return noStoreJson({ error: "Unauthorized" }, 401);

  const limited = await enforceRateLimit(req.headers, "student:flags:get", {
    points: 120,
    duration: 60,
    identity: session.user.id,
  });
  if (limited) return limited;

  const flags = await getFlags();
  const locked = Object.fromEntries(
    Object.entries(flags).map(([key, state]) => [key, state.enabled])
  );

  return noStoreJson({ locked }, 200);
}
