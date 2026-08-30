import mongoose from "mongoose";
import { NextRequest } from "next/server";
import { z } from "zod";
import { connectToDatabase } from "@/server/db";
import { requireSession } from "@/server/security/requireSession";
import { enforceRateLimit } from "@/server/security/rateLimit";
import { AttendanceCourse } from "@/server/models/AttendanceCourse";
import { noStoreJson } from "@/server/httpCache";
import {
  LIMITS,
  normalizeCourse,
  totalSessions,
  type AttendanceCourse as Course,
} from "@/lib/attendance";

function serialize(doc: any): Course {
  return normalizeCourse({
    id: String(doc._id),
    name: doc.name,
    weeks: doc.weeks,
    lecturesPerWeek: doc.lecturesPerWeek,
    hasLab: Boolean(doc.hasLab),
    labsPerWeek: doc.labsPerWeek ?? 0,
    missedLectures: doc.missedLectures ?? [],
    missedLabs: doc.missedLabs ?? [],
  });
}

const patchSchema = z
  .object({
    /**
     * Record one session as absent or present. The client sends the state it
     * wants, not "flip it".
     *
     * This is deliberate. A "toggle" forces the server to read the current set,
     * flip a bit and write the whole array back — a read-modify-write whose
     * window loses a tick if two arrive together. `absent` maps onto a single
     * atomic $addToSet/$pull, which cannot lose anything and is idempotent, so
     * a retried or duplicated request is harmless.
     */
    set: z
      .object({
        kind: z.enum(["lecture", "lab"]),
        index: z.number().int().min(0).max(999),
        absent: z.boolean(),
      })
      .optional(),
    // Editing the course shape.
    weeks: z.number().int().min(LIMITS.weeks.min).max(LIMITS.weeks.max).optional(),
    lecturesPerWeek: z.number().int().min(LIMITS.perWeek.min).max(LIMITS.perWeek.max).optional(),
    hasLab: z.boolean().optional(),
    labsPerWeek: z.number().int().min(LIMITS.perWeek.min).max(LIMITS.perWeek.max).optional(),
    /** Untick everything for one kind. */
    clear: z.enum(["lecture", "lab", "both"]).optional(),
  })
  .strict();

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const session = await requireSession();
  if (!session) return noStoreJson({ error: "Unauthorized" }, 401);

  // Ticking boxes is a rapid activity; budget generously but not unboundedly.
  const limited = await enforceRateLimit(req.headers, "student:attendance-courses:patch", {
    points: 300,
    duration: 60,
    identity: session.user.id,
  });
  if (limited) return limited;

  const { id } = await ctx.params;
  if (!mongoose.isValidObjectId(id)) return noStoreJson({ error: "Invalid id" }, 400);

  const json = await req.json().catch(() => null);
  const parsed = patchSchema.safeParse(json);
  if (!parsed.success) return noStoreJson({ error: "Invalid input" }, 400);

  await connectToDatabase();

  const found = await AttendanceCourse.findOne({ _id: id, userId: session.user.id });
  if (!found) return noStoreJson({ error: "Not found" }, 404);

  // Ticking a box takes the atomic path and returns immediately. It never
  // rewrites the whole array, so concurrent ticks cannot overwrite each other.
  if (parsed.data.set) {
    const { kind, index, absent } = parsed.data.set;
    const shape = serialize(found);

    const total =
      kind === "lecture"
        ? totalSessions(shape.weeks, shape.lecturesPerWeek)
        : shape.hasLab
          ? totalSessions(shape.weeks, shape.labsPerWeek)
          : 0;

    if (index >= total) {
      return noStoreJson({ error: "That session does not exist in this course." }, 400);
    }

    const field = kind === "lecture" ? "missedLectures" : "missedLabs";
    const updated = await AttendanceCourse.findOneAndUpdate(
      { _id: id, userId: session.user.id },
      absent ? { $addToSet: { [field]: index } } : { $pull: { [field]: index } },
      { new: true }
    ).lean();

    if (!updated) return noStoreJson({ error: "Not found" }, 404);
    return noStoreJson({ course: serialize(updated) }, 200);
  }

  // Work from the normalized current state, apply the change, then normalize
  // again. Read-modify-write on the document (rather than a bare $push) is what
  // lets the session sets be re-pruned when the course shape changes in the
  // same request.
  const current = serialize(found);
  const next: Course = { ...current };

  if (parsed.data.weeks !== undefined) next.weeks = parsed.data.weeks;
  if (parsed.data.lecturesPerWeek !== undefined) next.lecturesPerWeek = parsed.data.lecturesPerWeek;
  if (parsed.data.hasLab !== undefined) next.hasLab = parsed.data.hasLab;
  if (parsed.data.labsPerWeek !== undefined) next.labsPerWeek = parsed.data.labsPerWeek;

  if (parsed.data.clear === "lecture" || parsed.data.clear === "both") next.missedLectures = [];
  if (parsed.data.clear === "lab" || parsed.data.clear === "both") next.missedLabs = [];

  // Re-prune: shrinking the course in this same request may have orphaned ticks.
  const clean = normalizeCourse({ ...next, id: current.id });

  found.set({
    weeks: clean.weeks,
    lecturesPerWeek: clean.lecturesPerWeek,
    hasLab: clean.hasLab,
    labsPerWeek: clean.labsPerWeek,
    missedLectures: clean.missedLectures,
    missedLabs: clean.missedLabs,
  });
  await found.save();

  // Return the authoritative state so the client can reconcile rather than
  // assume its optimistic guess was right.
  return noStoreJson({ course: serialize(found) }, 200);
}

export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const session = await requireSession();
  if (!session) return noStoreJson({ error: "Unauthorized" }, 401);

  const limited = await enforceRateLimit(req.headers, "student:attendance-courses:delete", {
    points: 60,
    duration: 60,
    identity: session.user.id,
  });
  if (limited) return limited;

  const { id } = await ctx.params;
  if (!mongoose.isValidObjectId(id)) return noStoreJson({ error: "Invalid id" }, 400);

  const res = await connectToDatabase().then(() =>
    AttendanceCourse.deleteOne({ _id: id, userId: session.user.id })
  );
  if (!res.deletedCount) return noStoreJson({ error: "Not found" }, 404);

  return noStoreJson({ ok: true }, 200);
}
