import type { Session } from "next-auth";
import { isLocked } from "@/server/flags";
import { FlagKeys } from "@/lib/flags";
import { Roles } from "@/server/roles";
import { noStoreJson } from "@/server/httpCache";

/**
 * Enforces the drive kill switch on the API, not just the page.
 *
 * Without this the lock would be cosmetic: the page would hide the drive while
 * `/api/student/resources` happily kept serving it to anyone with a fetch call.
 *
 * Returns a 503 to block, or null to let the request through. Admins always
 * pass, so they can keep working on a drive that students cannot see.
 */
export async function blockedByDriveLock(session: Session | null) {
  if (session?.user?.role === Roles.Admin) return null;
  if (!(await isLocked(FlagKeys.ResourcesLocked))) return null;

  // 503 rather than 403: this is a deliberate, temporary outage, and it tells
  // any client the difference between "not allowed" and "not right now".
  return noStoreJson({ error: "The resource drive is temporarily unavailable.", locked: true }, 503);
}
