import mongoose from "mongoose";
import { NextRequest } from "next/server";
import { connectToDatabase } from "@/server/db";
import { BlockedIp } from "@/server/models/BlockedIp";
import { enforceRateLimit } from "@/server/security/rateLimit";
import { requireRole } from "@/server/security/requireRole";
import { invalidateIpBlockCache } from "@/server/security/ipBlock";
import { logActivity } from "@/server/activity";
import { ActivityActions } from "@/server/models/ActivityLog";
import { noStoreJson } from "@/server/httpCache";

/**
 * Lifting a block deletes the row.
 *
 * The activity log keeps the history of both the block and the unblock, so the
 * audit trail survives even though the record does not.
 */
export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const limited = await enforceRateLimit(req.headers, "admin:ip-blocks:delete");
  if (limited) return limited;

  const session = await requireRole("admin");
  if (!session) return noStoreJson({ error: "Forbidden" }, 403);

  const { id } = await ctx.params;
  if (!mongoose.isValidObjectId(id)) return noStoreJson({ error: "Invalid id" }, 400);

  await connectToDatabase();

  const doomed = await BlockedIp.findById(id).lean();
  if (!doomed) return noStoreJson({ error: "Not found" }, 404);

  await BlockedIp.deleteOne({ _id: id });
  invalidateIpBlockCache();

  void logActivity({
    action: ActivityActions.IpUnblocked,
    actor: { id: session.user?.id, name: session.user?.name },
    targetType: "ip",
    targetLabel: String(doomed.ip),
    headers: req.headers,
  });

  return noStoreJson({ ok: true });
}
