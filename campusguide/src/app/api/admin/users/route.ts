import { z } from "zod";
import { connectToDatabase } from "@/server/db";
import { AccountStatuses, User } from "@/server/models/User";
import { enforceRateLimit } from "@/server/security/rateLimit";
import { requireRole } from "@/server/security/requireRole";
import { noStoreJson } from "@/server/httpCache";

const MAX_LIMIT = 100;

const querySchema = z.object({
  status: z.enum([AccountStatuses.Pending, AccountStatuses.Active, AccountStatuses.Banned]).optional(),
  q: z.string().max(80).optional(),
  limit: z.coerce.number().int().min(1).max(MAX_LIMIT).optional(),
});

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function serializeUser(doc: any) {
  return {
    id: String(doc._id),
    name: doc.name as string,
    email: doc.email as string,
    miuId: doc.miuId ?? null,
    phone: doc.phone ?? null,
    role: doc.role as string,
    // Accounts predating verification have no status; they are established users.
    status: (doc.status as string) ?? AccountStatuses.Active,
    academicYear: doc.academicYear ?? null,
    lastSeenAt: doc.lastSeenAt instanceof Date ? doc.lastSeenAt.toISOString() : null,
    verifiedAt: doc.verifiedAt instanceof Date ? doc.verifiedAt.toISOString() : null,
    bannedAt: doc.bannedAt instanceof Date ? doc.bannedAt.toISOString() : null,
    banReason: doc.banReason ?? null,
    rejectionReason: doc.rejectionReason ?? null,
    createdAt: doc.createdAt instanceof Date ? doc.createdAt.toISOString() : null,
  };
}

export async function GET(req: Request) {
  const limited = await enforceRateLimit(req.headers, "admin:users:get");
  if (limited) return limited;

  const session = await requireRole("admin");
  if (!session) return noStoreJson({ error: "Forbidden" }, 403);

  const url = new URL(req.url);
  const parsed = querySchema.safeParse({
    status: url.searchParams.get("status") ?? undefined,
    q: url.searchParams.get("q") ?? undefined,
    limit: url.searchParams.get("limit") ?? undefined,
  });

  if (!parsed.success) return noStoreJson({ error: "Invalid query" }, 400);

  const filter: Record<string, unknown> = {};

  if (parsed.data.status === AccountStatuses.Active) {
    // Legacy rows have no status field at all but are active in every real sense.
    filter.$or = [{ status: AccountStatuses.Active }, { status: { $exists: false } }];
  } else if (parsed.data.status) {
    filter.status = parsed.data.status;
  }

  const q = parsed.data.q?.trim();
  if (q) {
    const rx = new RegExp(escapeRegex(q), "i");
    const search = [{ name: rx }, { email: rx }, { miuId: rx }, { phone: rx }];
    // Don't clobber the status filter above.
    if (filter.$or) {
      filter.$and = [{ $or: filter.$or }, { $or: search }];
      delete filter.$or;
    } else {
      filter.$or = search;
    }
  }

  await connectToDatabase();
  const users = await User.find(filter)
    .sort({ createdAt: -1 })
    .limit(parsed.data.limit ?? 50)
    .lean();

  return noStoreJson({ items: users.map(serializeUser) });
}
