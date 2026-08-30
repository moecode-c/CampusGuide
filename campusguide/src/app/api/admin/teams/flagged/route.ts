import { connectToDatabase } from "@/server/db";
import { TeamPost } from "@/server/models/TeamPost";
import { enforceRateLimit } from "@/server/security/rateLimit";
import { requireRole } from "@/server/security/requireRole";
import { logActivity } from "@/server/activity";
import { ActivityActions } from "@/server/models/ActivityLog";
import { noStoreJson } from "@/server/httpCache";
import { STALE_POST_DAYS, stalePostCutoff } from "@/lib/teams";

/**
 * Removes every flagged post in one go.
 *
 * Manual by design — nothing expires posts on a timer. This only ever runs
 * because an admin pressed the button.
 */
export async function DELETE(req: Request) {
  const limited = await enforceRateLimit(req.headers, "admin:teams:purge", {
    points: 10,
    duration: 60,
  });
  if (limited) return limited;

  const session = await requireRole("admin");
  if (!session) return noStoreJson({ error: "Forbidden" }, 403);

  await connectToDatabase();

  /**
   * The cutoff is recomputed here rather than taking a list of ids from the
   * browser. A stale page, a doctored request or a post that was edited since
   * the page loaded would otherwise decide what gets deleted — and this is a
   * bulk, irreversible write.
   *
   * The cutoff comes from stalePostCutoff(), the same function that decides the
   * badge on screen. Computing it here independently is what made an earlier
   * version delete a post the dashboard had shown as safe.
   */
  const cutoff = stalePostCutoff();

  const doomed = await TeamPost.find({ createdAt: { $lte: cutoff } })
    .select("title ownerName createdAt")
    .lean();

  if (doomed.length === 0) {
    return noStoreJson({ deleted: 0, message: "Nothing is old enough to remove." });
  }

  const result = await TeamPost.deleteMany({ _id: { $in: doomed.map((p) => p._id) } });

  // One entry for the whole sweep, using the purge action rather than the
  // per-post delete one. See the note on ActivityActions.TeamPostPurge: logging
  // twenty individual deletes would raise a mass-deletion security alert against
  // the admin who deliberately pressed the button.
  void logActivity({
    action: ActivityActions.TeamPostPurge,
    actor: { id: session.user?.id, name: session.user?.name },
    targetType: "teamPost",
    targetLabel: `${result.deletedCount} stale post${result.deletedCount === 1 ? "" : "s"}`,
    meta: {
      deleted: result.deletedCount,
      olderThanDays: STALE_POST_DAYS,
      // The titles are the only record left once the rows are gone.
      titles: doomed.slice(0, 50).map((p) => p.title),
    },
    headers: req.headers,
  });

  return noStoreJson({ deleted: result.deletedCount });
}
