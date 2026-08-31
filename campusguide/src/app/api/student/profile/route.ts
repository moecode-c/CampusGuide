import { z } from "zod";
import { connectToDatabase } from "@/server/db";
import { User } from "@/server/models/User";
import { enforceRateLimit } from "@/server/security/rateLimit";
import { requireSession } from "@/server/security/requireSession";
import { invalidateAccountState } from "@/server/security/accountStatus";
import { noStoreJson } from "@/server/httpCache";
import { PHONE_HINT, isValidPhone, normalizePhone } from "@/lib/miu";

/**
 * A student's own account.
 *
 * Deliberately narrow. The student ID and university email are the pair the
 * whole identity model rests on — they are cross-checked at registration and an
 * admin verifies a physical ID card against them. Letting a student rewrite
 * either would make that verification meaningless, so they are read-only here
 * and only an admin can change them.
 *
 * Role and status are absent for the obvious reason.
 */

function serialize(u: {
  _id: unknown;
  name?: string | null;
  email?: string | null;
  miuId?: string | null;
  phone?: string | null;
  academicYear?: number | null;
  role?: string | null;
  status?: string | null;
  createdAt?: Date | null;
}) {
  return {
    id: String(u._id),
    name: u.name ?? "",
    email: u.email ?? "",
    miuId: u.miuId ?? null,
    phone: u.phone ?? null,
    academicYear: u.academicYear ?? null,
    role: u.role ?? "student",
    status: u.status ?? "active",
    createdAt: u.createdAt ? new Date(u.createdAt).toISOString() : null,
  };
}

export async function GET(req: Request) {
  const session = await requireSession();
  if (!session) return noStoreJson({ error: "Unauthorized" }, 401);

  const limited = await enforceRateLimit(req.headers, "student:profile:get", {
    points: 120,
    duration: 60,
    identity: session.user.id,
  });
  if (limited) return limited;

  await connectToDatabase();

  const user = await User.findById(session.user.id)
    .select("name email miuId phone academicYear role status createdAt")
    .lean();

  if (!user) return noStoreJson({ error: "Not found" }, 404);

  return noStoreJson({ profile: serialize(user) });
}

const patchSchema = z
  .object({
    name: z.string().min(2, "Name must be at least 2 characters").max(60).trim().optional(),
    phone: z.string().max(24).trim().optional(),
    academicYear: z.number().int().min(1).max(4).optional(),
  })
  .strict()
  .refine((v) => Object.keys(v).length > 0, { message: "Nothing to change" });

export async function PATCH(req: Request) {
  const session = await requireSession();
  if (!session) return noStoreJson({ error: "Unauthorized" }, 401);

  const limited = await enforceRateLimit(req.headers, "student:profile:patch", {
    points: 20,
    duration: 60,
    identity: session.user.id,
  });
  if (limited) return limited;

  const json = await req.json().catch(() => null);
  const parsed = patchSchema.safeParse(json);
  if (!parsed.success) {
    return noStoreJson({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, 400);
  }

  await connectToDatabase();

  const user = await User.findById(session.user.id);
  if (!user) return noStoreJson({ error: "Not found" }, 404);

  const { name, phone, academicYear } = parsed.data;

  if (phone !== undefined) {
    if (!isValidPhone(phone)) return noStoreJson({ error: PHONE_HINT }, 400);
    user.phone = normalizePhone(phone) ?? phone;
  }
  if (name !== undefined) user.name = name;
  if (academicYear !== undefined) user.academicYear = academicYear;

  await user.save();

  // The name is carried on the cached account state that guards read on every
  // request; a stale entry would show the old one until the TTL lapsed.
  invalidateAccountState(session.user.id);

  return noStoreJson({ profile: serialize(user.toObject()) });
}
