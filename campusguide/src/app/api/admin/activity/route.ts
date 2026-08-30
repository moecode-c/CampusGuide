import mongoose from "mongoose";
import { connectToDatabase } from "@/server/db";
import { ActivityLog } from "@/server/models/ActivityLog";
import { enforceRateLimit } from "@/server/security/rateLimit";
import { requireRole } from "@/server/security/requireRole";
import { noStoreJson } from "@/server/httpCache";

const MAX_LIMIT = 100;

export function serializeActivity(doc: any) {
  return {
    id: String(doc._id),
    action: doc.action as string,
    actorId: doc.actorId ? String(doc.actorId) : null,
    actorName: doc.actorName ?? null,
    actorMiuId: doc.actorMiuId ?? null,
    targetId: doc.targetId ? String(doc.targetId) : null,
    targetType: doc.targetType ?? null,
    targetLabel: doc.targetLabel ?? null,
    meta: doc.meta ?? null,
    ip: doc.ip ?? null,
    createdAt: doc.createdAt instanceof Date ? doc.createdAt.toISOString() : null,
  };
}

/**
 * The activity feed. Without `userId` it is the whole site; with it, everything
 * that account did *and* everything admins did to that account.
 */
export async function GET(req: Request) {
  const limited = await enforceRateLimit(req.headers, "admin:activity:get");
  if (limited) return limited;

  const session = await requireRole("admin");
  if (!session) return noStoreJson({ error: "Forbidden" }, 403);

  const url = new URL(req.url);
  const userId = url.searchParams.get("userId");
  const action = url.searchParams.get("action");
  // Clamped at both ends: a negative limit reaches Mongo as a "single batch"
  // hint rather than a row count, so `?limit=-5` would quietly ignore the cap.
  const requestedLimit = Number(url.searchParams.get("limit") ?? 50) || 50;
  const limit = Math.min(Math.max(Math.floor(requestedLimit), 1), MAX_LIMIT);

  const filter: Record<string, unknown> = {};

  if (userId) {
    if (!mongoose.isValidObjectId(userId)) return noStoreJson({ error: "Invalid user id" }, 400);
    const id = new mongoose.Types.ObjectId(userId);
    filter.$or = [{ actorId: id }, { targetId: id }];
  }

  if (action) filter.action = action;

  await connectToDatabase();
  const items = await ActivityLog.find(filter).sort({ createdAt: -1 }).limit(limit).lean();

  return noStoreJson({ items: items.map(serializeActivity) });
}
