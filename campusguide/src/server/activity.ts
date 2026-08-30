import { ActivityLog, type ActivityAction } from "@/server/models/ActivityLog";
import { getRequestIp } from "@/server/security/rateLimit";
import { ActivityActions } from "@/lib/activityActions";

/** Actions that count toward the mass-deletion rule. */
const DELETE_ACTIONS = new Set<ActivityAction>([
  ActivityActions.ResourceDelete,
  ActivityActions.FolderDelete,
  ActivityActions.UserDelete,
  ActivityActions.TeamPostDelete,
  ActivityActions.VideoCourseDelete,
]);

type LogInput = {
  action: ActivityAction;
  actor?: { id?: string | null; name?: string | null; miuId?: string | null } | null;
  targetId?: string | null;
  targetType?: string;
  targetLabel?: string;
  meta?: Record<string, unknown>;
  headers?: Headers;
};

/**
 * Records an action for the admin activity feed.
 *
 * Never throws: a failed write here must not turn a successful upload or
 * verification into a 500. Callers can fire-and-forget.
 */
export async function logActivity(input: LogInput) {
  try {
    await ActivityLog.create({
      actorId: input.actor?.id ?? undefined,
      actorName: input.actor?.name ?? undefined,
      actorMiuId: input.actor?.miuId ?? undefined,
      action: input.action,
      targetId: input.targetId ?? undefined,
      targetType: input.targetType,
      targetLabel: input.targetLabel,
      meta: input.meta,
      ip: input.headers ? getRequestIp(input.headers) : undefined,
      createdAt: new Date(),
    });

    // Deletion bursts are detected here rather than at each delete route, so a
    // new kind of delete is covered the moment it logs itself.
    if (DELETE_ACTIONS.has(input.action) && input.actor?.id) {
      const { recordDeletion } = await import("@/server/security/alerts");
      void recordDeletion({ actorId: input.actor.id, actorName: input.actor.name });
    }
  } catch (err) {
    console.error("activity log write failed", err);
  }
}
