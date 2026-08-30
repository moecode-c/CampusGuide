import { connectToDatabase } from "@/server/db";
import { VideoCourse } from "@/server/models/VideoCourse";
import { enforceRateLimit } from "@/server/security/rateLimit";
import { requireSession } from "@/server/security/requireSession";
import { jsonWithEtag } from "@/server/httpCache";
import { serializeCourseDetail, serializeCourseSummary } from "@/server/data/videoCourses";

/**
 * The student-facing library: published courses only.
 *
 * `?slug=` returns one course with its lessons — that is the course page. The
 * bare list returns summaries, so the index does not ship every lesson title on
 * a page that only renders cards.
 */
export async function GET(req: Request) {
  const limited = await enforceRateLimit(req.headers, "student:video-courses");
  if (limited) return limited;

  const session = await requireSession();
  if (!session) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "content-type": "application/json" },
    });
  }

  const url = new URL(req.url);
  const slug = url.searchParams.get("slug");
  const academicYear = url.searchParams.get("academicYear");

  await connectToDatabase();

  if (slug) {
    const course = await VideoCourse.findOne({ slug, published: true }).lean();
    if (!course) {
      return new Response(JSON.stringify({ error: "Not found" }), {
        status: 404,
        headers: { "content-type": "application/json" },
      });
    }
    return jsonWithEtag(req, { item: serializeCourseDetail(course) });
  }

  const filter: Record<string, unknown> = { published: true };
  const year = Number(academicYear);
  if (Number.isInteger(year) && year >= 1 && year <= 4) {
    // A course with no year set is general and shows to everyone.
    filter.$or = [{ academicYear: year }, { academicYear: { $exists: false } }, { academicYear: null }];
  }

  const items = await VideoCourse.find(filter).sort({ updatedAt: -1 }).lean();

  return jsonWithEtag(req, { items: items.map(serializeCourseSummary) });
}
