import mongoose from "mongoose";
import { z } from "zod";
import { NextRequest } from "next/server";
import { connectToDatabase } from "@/server/db";
import { VideoCourse } from "@/server/models/VideoCourse";
import { enforceRateLimit } from "@/server/security/rateLimit";
import { requireRole } from "@/server/security/requireRole";
import { logActivity } from "@/server/activity";
import { ActivityActions } from "@/server/models/ActivityLog";
import { noStoreJson } from "@/server/httpCache";
import { isDuplicateKeyError } from "@/server/mongoErrors";
import { lessonArraySchema, serializeCourseDetail } from "@/server/data/videoCourses";
import { isValidSlug } from "@/lib/videoCourses";

const json = (body: unknown, status: number) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

const patchSchema = z
  .object({
    title: z.string().min(1).max(160).trim().optional(),
    slug: z
      .string()
      .min(1)
      .max(80)
      .trim()
      .transform((v, ctx) => {
        const lower = v.toLowerCase();
        if (!isValidSlug(lower)) {
          ctx.addIssue({ code: "custom", message: "Use lowercase letters, numbers and dashes only" });
          return z.NEVER;
        }
        return lower;
      })
      .optional(),
    description: z.string().max(2000).trim().optional(),
    subject: z.string().max(120).trim().optional(),
    academicYear: z.number().int().min(1).max(4).nullable().optional(),
    instructor: z.string().max(120).trim().optional(),
    published: z.boolean().optional(),
    /**
     * The whole ordered list, every time. Reordering, inserting and removing are
     * all the same write, which is why this is a replace rather than a set of
     * per-lesson endpoints. Single-admin console, so the lost-update risk that
     * would rule this out on a student-facing route does not apply.
     */
    lessons: lessonArraySchema.optional(),
  })
  .strict();

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const limited = await enforceRateLimit(req.headers, "admin:video-courses:patch");
  if (limited) return limited;

  const session = await requireRole("admin");
  if (!session) return json({ error: "Forbidden" }, 403);

  const { id } = await ctx.params;
  if (!mongoose.isValidObjectId(id)) return json({ error: "Invalid id" }, 400);

  const body = await req.json().catch(() => null);
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, 400);
  }

  // MongoDB rejects an empty `$set`, which would surface as a 500.
  if (Object.keys(parsed.data).length === 0) return json({ error: "No fields to update" }, 400);

  await connectToDatabase();

  let updated;
  try {
    updated = await VideoCourse.findOneAndUpdate(
      { _id: id },
      { $set: parsed.data },
      { new: true, runValidators: true }
    ).lean();
  } catch (err) {
    if (isDuplicateKeyError(err)) return json({ error: "That URL is already taken" }, 409);
    throw err;
  }

  if (!updated) return json({ error: "Not found" }, 404);

  void logActivity({
    action: ActivityActions.VideoCourseUpdate,
    actor: { id: session.user?.id, name: session.user?.name },
    targetId: id,
    targetType: "videoCourse",
    targetLabel: updated.title,
    // Which fields moved is the useful part of the log; the values are in the doc.
    meta: { fields: Object.keys(parsed.data), lessons: updated.lessons.length },
    headers: req.headers,
  });

  return noStoreJson({ item: serializeCourseDetail(updated) });
}

export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const limited = await enforceRateLimit(req.headers, "admin:video-courses:delete");
  if (limited) return limited;

  const session = await requireRole("admin");
  if (!session) return json({ error: "Forbidden" }, 403);

  const { id } = await ctx.params;
  if (!mongoose.isValidObjectId(id)) return json({ error: "Invalid id" }, 400);

  await connectToDatabase();

  // Read first so the log can name what went, rather than just an id.
  const doomed = await VideoCourse.findById(id).lean();
  if (!doomed) return json({ error: "Not found" }, 404);

  await VideoCourse.deleteOne({ _id: id });

  void logActivity({
    action: ActivityActions.VideoCourseDelete,
    actor: { id: session.user?.id, name: session.user?.name },
    targetId: id,
    targetType: "videoCourse",
    targetLabel: doomed.title,
    meta: { lessons: doomed.lessons.length },
    headers: req.headers,
  });

  return noStoreJson({ ok: true });
}
