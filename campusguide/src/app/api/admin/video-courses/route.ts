import { z } from "zod";
import { connectToDatabase } from "@/server/db";
import { VideoCourse } from "@/server/models/VideoCourse";
import { enforceRateLimit } from "@/server/security/rateLimit";
import { requireRole } from "@/server/security/requireRole";
import { logActivity } from "@/server/activity";
import { ActivityActions } from "@/server/models/ActivityLog";
import { noStoreJson } from "@/server/httpCache";
import { isDuplicateKeyError } from "@/server/mongoErrors";
import { lessonArraySchema, serializeCourseDetail } from "@/server/data/videoCourses";
import { slugify } from "@/lib/videoCourses";

const forbidden = () =>
  new Response(JSON.stringify({ error: "Forbidden" }), {
    status: 403,
    headers: { "content-type": "application/json" },
  });

const createSchema = z
  .object({
    title: z.string().min(1).max(160).trim(),
    description: z.string().max(2000).trim().optional(),
    subject: z.string().max(120).trim().optional(),
    academicYear: z.number().int().min(1).max(4).optional(),
    instructor: z.string().max(120).trim().optional(),
    published: z.boolean().optional(),
    lessons: lessonArraySchema.optional(),
  })
  .strict();

/**
 * Slugs are derived, not typed, so two courses called "Networks" would collide.
 * A handful of numbered attempts is plenty and avoids a findOne race — the
 * unique index is what actually enforces it.
 */
async function createWithUniqueSlug(
  base: string,
  build: (slug: string) => Record<string, unknown>
) {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const slug = attempt === 0 ? base : `${base}-${attempt + 1}`;
    try {
      return await VideoCourse.create(build(slug));
    } catch (err) {
      if (!isDuplicateKeyError(err)) throw err;
    }
  }
  return null;
}

export async function GET(req: Request) {
  const limited = await enforceRateLimit(req.headers, "admin:video-courses:get");
  if (limited) return limited;

  const session = await requireRole("admin");
  if (!session) return forbidden();

  await connectToDatabase();

  // Drafts included, and lessons come with the list: an admin edits in place,
  // and the whole library is a few dozen documents.
  const items = await VideoCourse.find({}).sort({ updatedAt: -1 }).lean();

  return noStoreJson({ items: items.map(serializeCourseDetail) });
}

export async function POST(req: Request) {
  const limited = await enforceRateLimit(req.headers, "admin:video-courses:post");
  if (limited) return limited;

  const session = await requireRole("admin");
  if (!session) return forbidden();

  const json = await req.json().catch(() => null);
  const parsed = createSchema.safeParse(json);
  if (!parsed.success) {
    return new Response(
      JSON.stringify({ error: parsed.error.issues[0]?.message ?? "Invalid input" }),
      { status: 400, headers: { "content-type": "application/json" } }
    );
  }

  const { title, lessons, ...rest } = parsed.data;

  await connectToDatabase();

  const created = await createWithUniqueSlug(slugify(title), (slug) => ({
    ...rest,
    title,
    slug,
    lessons: lessons ?? [],
    createdById: session.user?.id,
    createdByName: session.user?.name,
  }));

  if (!created) {
    return new Response(JSON.stringify({ error: "Could not find a free URL for that title" }), {
      status: 409,
      headers: { "content-type": "application/json" },
    });
  }

  void logActivity({
    action: ActivityActions.VideoCourseCreate,
    actor: { id: session.user?.id, name: session.user?.name },
    targetId: String(created._id),
    targetType: "videoCourse",
    targetLabel: created.title,
    meta: { lessons: created.lessons.length, published: created.published },
    headers: req.headers,
  });

  return noStoreJson({ item: serializeCourseDetail(created.toObject()) }, 201);
}
