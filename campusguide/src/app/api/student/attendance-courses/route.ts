import { z } from "zod";
import { connectToDatabase } from "@/server/db";
import { requireSession } from "@/server/security/requireSession";
import { enforceRateLimit } from "@/server/security/rateLimit";
import { AttendanceCourse } from "@/server/models/AttendanceCourse";
import { noStoreJson } from "@/server/httpCache";
import { LIMITS, normalizeCourse, type AttendanceCourse as Course } from "@/lib/attendance";

/**
 * Manually tracked attendance courses.
 *
 * Every response and every write runs through `normalizeCourse`, so what the
 * client receives and what the database holds are both guaranteed to satisfy
 * the invariants in lib/attendance.ts — sorted, deduplicated session indices
 * that exist within the course.
 */

function serialize(doc: {
  _id: unknown;
  name: string;
  weeks: number;
  lecturesPerWeek: number;
  hasLab?: boolean | null;
  labsPerWeek?: number | null;
  missedLectures?: number[] | null;
  missedLabs?: number[] | null;
}): Course {
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

const upsertSchema = z
  .object({
    name: z.string().min(1).max(LIMITS.nameMax).transform((v) => v.trim()),
    weeks: z.number().int().min(LIMITS.weeks.min).max(LIMITS.weeks.max),
    lecturesPerWeek: z.number().int().min(LIMITS.perWeek.min).max(LIMITS.perWeek.max),
    hasLab: z.boolean().optional().default(false),
    labsPerWeek: z.number().int().min(LIMITS.perWeek.min).max(LIMITS.perWeek.max).optional().default(0),
    // Accepted so the one-off migration from localStorage can carry existing
    // ticks across; normal creates simply omit them.
    missedLectures: z.array(z.number()).max(500).optional(),
    missedLabs: z.array(z.number()).max(500).optional(),
  })
  .strict();

export async function GET(req: Request) {
  const session = await requireSession();
  if (!session) return noStoreJson({ error: "Unauthorized" }, 401);

  const limited = await enforceRateLimit(req.headers, "student:attendance-courses:get", {
    points: 120,
    duration: 60,
    identity: session.user.id,
  });
  if (limited) return limited;

  await connectToDatabase();
  const rows = await AttendanceCourse.find({ userId: session.user.id }).sort({ createdAt: -1 }).lean();

  return noStoreJson({ courses: rows.map((r) => serialize(r as never)) }, 200);
}

export async function POST(req: Request) {
  const session = await requireSession();
  if (!session) return noStoreJson({ error: "Unauthorized" }, 401);

  const limited = await enforceRateLimit(req.headers, "student:attendance-courses:post", {
    points: 60,
    duration: 60,
    identity: session.user.id,
  });
  if (limited) return limited;

  const json = await req.json().catch(() => null);
  const parsed = upsertSchema.safeParse(json);
  if (!parsed.success) return noStoreJson({ error: "Invalid input" }, 400);

  await connectToDatabase();

  // Normalize before writing so the stored ticks can never reference a session
  // the course does not have.
  const clean = normalizeCourse({ id: "pending", ...parsed.data });

  try {
    const saved = await AttendanceCourse.findOneAndUpdate(
      { userId: session.user.id, name: clean.name },
      {
        $set: {
          name: clean.name,
          weeks: clean.weeks,
          lecturesPerWeek: clean.lecturesPerWeek,
          hasLab: clean.hasLab,
          labsPerWeek: clean.labsPerWeek,
          missedLectures: clean.missedLectures,
          missedLabs: clean.missedLabs,
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    ).lean();

    return noStoreJson({ course: serialize(saved as never) }, 200);
  } catch (err) {
    // The unique (userId, name) index can race two saves of the same name.
    if ((err as { code?: number })?.code === 11000) {
      const existing = await AttendanceCourse.findOne({
        userId: session.user.id,
        name: clean.name,
      }).lean();
      if (existing) return noStoreJson({ course: serialize(existing as never) }, 200);
    }
    throw err;
  }
}
