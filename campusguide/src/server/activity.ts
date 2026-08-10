import { ActivityLog, type ActivityAction } from "@/server/models/ActivityLog";
import { getRequestIp } from "@/server/security/rateLimit";

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
  } catch (err) {
    console.error("activity log write failed", err);
  }
}
