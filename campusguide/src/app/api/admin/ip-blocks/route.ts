import { z } from "zod";
import { connectToDatabase } from "@/server/db";
import { BlockedIp } from "@/server/models/BlockedIp";
import { enforceRateLimit, getRequestIp } from "@/server/security/rateLimit";
import { requireRole } from "@/server/security/requireRole";
import { invalidateIpBlockCache } from "@/server/security/ipBlock";
import { logActivity } from "@/server/activity";
import { ActivityActions } from "@/server/models/ActivityLog";
import { noStoreJson } from "@/server/httpCache";
import { isDuplicateKeyError } from "@/server/mongoErrors";
import {
  BLOCK_REASONS,
  isBlockActive,
  isBlockableIp,
  normalizeIp,
  type BlockReason,
  type BlockedIpRow,
} from "@/lib/ipBlocks";

const forbidden = () => noStoreJson({ error: "Forbidden" }, 403);

const createSchema = z
  .object({
    ip: z.string().min(3).max(64),
    reason: z.enum(BLOCK_REASONS as [string, ...string[]]),
    note: z.string().max(500).trim().optional(),
    /** Null or omitted means permanent. */
    hours: z.number().int().min(1).max(24 * 365).nullable().optional(),
  })
  .strict();

function serialize(doc: {
  _id: unknown;
  ip?: string | null;
  reason?: string | null;
  note?: string | null;
  createdByName?: string | null;
  createdAt?: Date | null;
  expiresAt?: Date | null;
}): BlockedIpRow {
  const expiresAt = doc.expiresAt ? doc.expiresAt.toISOString() : null;

  return {
    id: String(doc._id),
    ip: doc.ip ?? "",
    reason: (doc.reason ?? "other") as BlockReason,
    note: doc.note ?? null,
    createdByName: doc.createdByName ?? null,
    createdAt: doc.createdAt ? doc.createdAt.toISOString() : null,
    expiresAt,
    active: isBlockActive(expiresAt),
  };
}

export async function GET(req: Request) {
  const limited = await enforceRateLimit(req.headers, "admin:ip-blocks:get");
  if (limited) return limited;

  const session = await requireRole("admin");
  if (!session) return forbidden();

  await connectToDatabase();
  const items = await BlockedIp.find({}).sort({ createdAt: -1 }).limit(200).lean();

  // Handed back so the UI can warn before an admin blocks the address they are
  // sitting on — see the self-block guard in POST.
  return noStoreJson({ items: items.map(serialize), yourIp: getRequestIp(req.headers) });
}

export async function POST(req: Request) {
  const limited = await enforceRateLimit(req.headers, "admin:ip-blocks:post");
  if (limited) return limited;

  const session = await requireRole("admin");
  if (!session) return forbidden();

  const json = await req.json().catch(() => null);
  const parsed = createSchema.safeParse(json);
  if (!parsed.success) return noStoreJson({ error: "Invalid input" }, 400);

  const ip = normalizeIp(parsed.data.ip);

  // Rejects free text, and rejects the "unknown" placeholder that every request
  // carries when there is no forwarding header — blocking that would 403 the
  // entire site, admin included.
  if (!isBlockableIp(ip)) {
    return noStoreJson({ error: "That is not an address that can be blocked" }, 400);
  }

  // The one guard that makes this feature safe to use: blocking your own address
  // would lock you out of the console you would need to undo it.
  if (ip === normalizeIp(getRequestIp(req.headers))) {
    return noStoreJson({ error: "That is your own address — blocking it would lock you out" }, 400);
  }

  const expiresAt = parsed.data.hours
    ? new Date(Date.now() + parsed.data.hours * 60 * 60 * 1000)
    : null;

  await connectToDatabase();

  let created;
  try {
    created = await BlockedIp.create({
      ip,
      reason: parsed.data.reason,
      note: parsed.data.note || undefined,
      expiresAt,
      createdById: session.user?.id,
      createdByName: session.user?.name,
    });
  } catch (err) {
    if (isDuplicateKeyError(err)) {
      // Re-blocking an address already on the list refreshes it rather than
      // failing: the common case is extending a block that lapsed.
      const updated = await BlockedIp.findOneAndUpdate(
        { ip },
        {
          $set: {
            reason: parsed.data.reason,
            note: parsed.data.note || undefined,
            expiresAt,
            createdById: session.user?.id,
            createdByName: session.user?.name,
          },
        },
        { new: true }
      ).lean();

      invalidateIpBlockCache();

      void logActivity({
        action: ActivityActions.IpBlocked,
        actor: { id: session.user?.id, name: session.user?.name },
        targetType: "ip",
        targetLabel: ip,
        meta: { reason: parsed.data.reason, expiresAt, refreshed: true },
        headers: req.headers,
      });

      return noStoreJson({ item: updated ? serialize(updated) : null }, 200);
    }
    throw err;
  }

  invalidateIpBlockCache();

  void logActivity({
    action: ActivityActions.IpBlocked,
    actor: { id: session.user?.id, name: session.user?.name },
    targetType: "ip",
    targetLabel: ip,
    meta: { reason: parsed.data.reason, expiresAt },
    headers: req.headers,
  });

  return noStoreJson({ item: serialize(created.toObject()) }, 201);
}
