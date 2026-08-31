import mongoose from "mongoose";
import { z } from "zod";
import { connectToDatabase } from "@/server/db";
import { AccountStatuses, User } from "@/server/models/User";
import { ActivityActions, ActivityLog } from "@/server/models/ActivityLog";
import { Event } from "@/server/models/Event";
import { MidtermGrade } from "@/server/models/MidtermGrade";
import { Attendance } from "@/server/models/Attendance";
import { enforceRateLimit } from "@/server/security/rateLimit";
import { requireRole } from "@/server/security/requireRole";
import { invalidateAccountState } from "@/server/security/accountStatus";
import { logActivity } from "@/server/activity";
import { noStoreJson } from "@/server/httpCache";
import { Roles } from "@/server/roles";
import { isDuplicateKeyError } from "@/server/mongoErrors";
import { PHONE_HINT, isValidPhone, normalizePhone, validateMiuIdentity } from "@/lib/miu";
import { serializeUser } from "../route";
import { serializeActivity } from "../../activity/route";

const actionSchema = z
  .object({
    action: z.enum(["verify", "reject", "ban", "unban"]),
    reason: z.string().trim().max(300).optional(),
  })
  .strict();

/**
 * Direct edits to an account, for fixing a typo'd ID or promoting someone.
 *
 * Every field is optional; only what is sent gets written. The identity fields
 * are still cross-checked against each other, because an email and a student ID
 * that disagree is exactly what registration refuses to create.
 */
const fieldsSchema = z
  .object({
    name: z.string().min(2).max(60).trim().optional(),
    email: z.string().max(320).trim().optional(),
    miuId: z.string().max(20).trim().optional(),
    phone: z.string().max(24).trim().optional(),
    academicYear: z.number().int().min(1).max(4).optional(),
    role: z.enum([Roles.Student, Roles.Admin]).optional(),
    status: z.enum([AccountStatuses.Pending, AccountStatuses.Active, AccountStatuses.Banned]).optional(),
  })
  .strict()
  .refine((v) => Object.keys(v).length > 0, { message: "Nothing to change" });

/** Full profile, their own data counts, and their activity trail. */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const limited = await enforceRateLimit(req.headers, "admin:users:detail");
  if (limited) return limited;

  const session = await requireRole("admin");
  if (!session) return noStoreJson({ error: "Forbidden" }, 403);

  const { id } = await params;
  if (!mongoose.isValidObjectId(id)) return noStoreJson({ error: "Invalid id" }, 400);

  await connectToDatabase();

  const user = await User.findById(id).lean();
  if (!user) return noStoreJson({ error: "Not found" }, 404);

  const objectId = new mongoose.Types.ObjectId(id);

  const [events, midterms, attendance, logs] = await Promise.all([
    Event.countDocuments({ userId: objectId }),
    MidtermGrade.countDocuments({ userId: objectId }),
    Attendance.countDocuments({ userId: objectId }),
    ActivityLog.find({ $or: [{ actorId: objectId }, { targetId: objectId }] })
      .sort({ createdAt: -1 })
      .limit(100)
      .lean(),
  ]);

  return noStoreJson({
    user: serializeUser(user),
    data: { events, midterms, attendance },
    logs: logs.map(serializeActivity),
  });
}

/** Verify, reject, ban or unban. */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const limited = await enforceRateLimit(req.headers, "admin:users:patch");
  if (limited) return limited;

  const session = await requireRole("admin");
  if (!session) return noStoreJson({ error: "Forbidden" }, 403);

  const { id } = await params;
  if (!mongoose.isValidObjectId(id)) return noStoreJson({ error: "Invalid id" }, 400);

  const json = await req.json().catch(() => null);

  // Two shapes on one endpoint: the existing one-word actions, and a direct
  // field edit. An `action` key picks the first; anything else is an edit.
  const isFieldEdit = Boolean(json && typeof json === "object" && !("action" in json));
  if (isFieldEdit) return patchFields(req, id, json, session);

  const parsed = actionSchema.safeParse(json);
  if (!parsed.success) {
    return noStoreJson({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, 400);
  }

  // Locking yourself out of the admin panel is never the intent.
  if (id === session.user.id && (parsed.data.action === "ban" || parsed.data.action === "reject")) {
    return noStoreJson({ error: "You cannot ban or reject your own account" }, 400);
  }

  await connectToDatabase();
  const user = await User.findById(id);
  if (!user) return noStoreJson({ error: "Not found" }, 404);

  const now = new Date();
  let logAction: (typeof ActivityActions)[keyof typeof ActivityActions];

  switch (parsed.data.action) {
    case "verify":
      user.status = AccountStatuses.Active;
      user.verifiedAt = now;
      user.verifiedBy = new mongoose.Types.ObjectId(session.user.id);
      user.rejectionReason = undefined;
      user.bannedAt = undefined;
      user.banReason = undefined;
      logAction = ActivityActions.VerifyApprove;
      break;

    case "reject":
      // Back to pending with a reason, so they can fix it and resubmit rather
      // than being permanently locked out by a mistaken rejection.
      user.status = AccountStatuses.Pending;
      user.rejectionReason = parsed.data.reason ?? "Your ID photo could not be verified";
      user.verifiedAt = undefined;
      logAction = ActivityActions.VerifyReject;
      break;

    case "ban":
      user.status = AccountStatuses.Banned;
      user.bannedAt = now;
      user.banReason = parsed.data.reason ?? undefined;
      logAction = ActivityActions.UserBan;
      break;

    case "unban":
      user.status = user.verifiedAt ? AccountStatuses.Active : AccountStatuses.Pending;
      user.bannedAt = undefined;
      user.banReason = undefined;
      logAction = ActivityActions.UserUnban;
      break;
  }

  await user.save();

  // The guard caches account state for 30s; drop it so the change lands now.
  invalidateAccountState(id);

  await logActivity({
    action: logAction,
    actor: { id: session.user.id, name: session.user.name },
    targetId: id,
    targetType: "user",
    targetLabel: user.miuId ?? user.email,
    meta: parsed.data.reason ? { reason: parsed.data.reason } : undefined,
    headers: req.headers,
  });

  return noStoreJson({ user: serializeUser(user.toObject()) });
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const limited = await enforceRateLimit(req.headers, "admin:users:delete");
  if (limited) return limited;

  const session = await requireRole("admin");
  if (!session) return noStoreJson({ error: "Forbidden" }, 403);

  const { id } = await params;
  if (!mongoose.isValidObjectId(id)) return noStoreJson({ error: "Invalid id" }, 400);
  if (id === session.user.id) return noStoreJson({ error: "You cannot delete your own account" }, 400);

  await connectToDatabase();
  const user = await User.findById(id);
  if (!user) return noStoreJson({ error: "Not found" }, 404);

  const objectId = new mongoose.Types.ObjectId(id);
  const label = user.miuId ?? user.email;

  // Their personal data goes with them; the activity log deliberately stays, so
  // the record of who was removed and by whom survives the deletion.
  await Promise.all([
    Event.deleteMany({ userId: objectId }),
    MidtermGrade.deleteMany({ userId: objectId }),
    Attendance.deleteMany({ userId: objectId }),
  ]);

  await user.deleteOne();
  invalidateAccountState(id);

  await logActivity({
    action: ActivityActions.UserDelete,
    actor: { id: session.user.id, name: session.user.name },
    targetId: id,
    targetType: "user",
    targetLabel: label,
    headers: req.headers,
  });

  return noStoreJson({ success: true });
}


/**
 * Writes edited fields onto an account.
 *
 * Split out rather than folded into the switch above because the guards are
 * different: an action is a state change with its own rules, this is arbitrary
 * data that still has to satisfy the same validation registration does.
 */
async function patchFields(
  req: Request,
  id: string,
  json: unknown,
  session: { user: { id: string; name?: string | null } }
) {
  const parsed = fieldsSchema.safeParse(json);
  if (!parsed.success) {
    return noStoreJson({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, 400);
  }

  const data = parsed.data;

  await connectToDatabase();
  const user = await User.findById(id);
  if (!user) return noStoreJson({ error: "Not found" }, 404);

  const editingSelf = id === session.user.id;

  /**
   * The last-admin problem. Demoting or suspending yourself leaves the console
   * with nobody able to open it, and no way back in through the UI.
   */
  if (editingSelf && data.role && data.role !== Roles.Admin) {
    return noStoreJson({ error: "You cannot remove your own admin role" }, 400);
  }
  if (editingSelf && data.status && data.status !== AccountStatuses.Active) {
    return noStoreJson({ error: "You cannot suspend your own account" }, 400);
  }

  // Identity fields are checked as a pair against whatever the account will hold
  // after the edit, not just against what was sent.
  if (data.email !== undefined || data.miuId !== undefined) {
    const nextEmail = (data.email ?? user.email ?? "").toLowerCase();
    const nextMiuId = data.miuId ?? user.miuId ?? "";

    const identityError = validateMiuIdentity(nextMiuId, nextEmail);
    if (identityError) return noStoreJson({ error: identityError }, 400);

    if (data.email !== undefined) user.email = nextEmail;
    if (data.miuId !== undefined) user.miuId = nextMiuId;
  }

  if (data.phone !== undefined) {
    if (!isValidPhone(data.phone)) return noStoreJson({ error: PHONE_HINT }, 400);
    user.phone = normalizePhone(data.phone) ?? data.phone;
  }

  if (data.name !== undefined) user.name = data.name;
  if (data.academicYear !== undefined) user.academicYear = data.academicYear;
  if (data.role !== undefined) user.role = data.role;
  if (data.status !== undefined) user.status = data.status;

  try {
    await user.save();
  } catch (err) {
    if (isDuplicateKeyError(err)) {
      return noStoreJson({ error: "That email or student ID already belongs to another account" }, 409);
    }
    throw err;
  }

  // Status and role are read from a short-lived cache by every guard; a stale
  // entry would leave the change not taking effect for up to its TTL.
  invalidateAccountState(id);

  void logActivity({
    action: ActivityActions.UserUpdate,
    actor: { id: session.user.id, name: session.user.name },
    targetId: id,
    targetType: "user",
    targetLabel: user.name,
    // Which fields moved is the useful part; the values are on the account.
    meta: { fields: Object.keys(data) },
    headers: req.headers,
  });

  return noStoreJson({ user: serializeUser(user.toObject()) }, 200);
}
