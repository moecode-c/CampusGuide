import { connectToDatabase } from "@/server/db";
import { TeamPost } from "@/server/models/TeamPost";
import { enforceRateLimit } from "@/server/security/rateLimit";
import { requireRole } from "@/server/security/requireRole";
import { noStoreJson } from "@/server/httpCache";
import { STALE_POST_DAYS, TeamPostStatuses, isPostStale } from "@/lib/teams";

/**
 * Every post on the board, for the admin dashboard.
 *
 * Unlike the student feed this hides nothing — closed posts included — because
 * the point is to see what is actually sitting in the collection.
 */

const MAX_ROWS = 500;

export async function GET(req: Request) {
  const limited = await enforceRateLimit(req.headers, "admin:teams:get");
  if (limited) return limited;

  const session = await requireRole("admin");
  if (!session) return noStoreJson({ error: "Forbidden" }, 403);

  await connectToDatabase();

  const rows = await TeamPost.find({}).sort({ createdAt: -1 }).limit(MAX_ROWS).lean();

  const now = new Date();

  const posts = rows.map((p) => {
    const createdAt = p.createdAt ? new Date(p.createdAt).toISOString() : null;

    return {
      id: String(p._id),
      title: p.title,
      kind: p.kind,
      subject: p.subject,
      academicYear: p.academicYear ?? null,
      projectName: p.projectName ?? null,
      difficulty: p.difficulty,
      status: p.status,
      ownerId: p.ownerId ? String(p.ownerId) : null,
      ownerName: p.ownerName ?? null,
      contactPhone: p.contactPhone ?? null,
      createdAt,
      // Computed server-side so the dashboard and the delete button agree on
      // what "flagged" means — the client never decides this.
      flagged: isPostStale(createdAt, now),
    };
  });

  const flaggedCount = posts.filter((p) => p.flagged).length;

  return noStoreJson({
    posts,
    counts: {
      total: posts.length,
      open: posts.filter((p) => p.status === TeamPostStatuses.Open).length,
      closed: posts.filter((p) => p.status === TeamPostStatuses.Closed).length,
      flagged: flaggedCount,
    },
    staleAfterDays: STALE_POST_DAYS,
    // True when the board is bigger than one page of results, so the dashboard
    // can say the totals describe what it fetched rather than everything.
    truncated: rows.length === MAX_ROWS,
  });
}
