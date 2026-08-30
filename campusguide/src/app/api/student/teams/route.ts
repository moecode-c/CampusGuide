import { z } from "zod";
import { connectToDatabase } from "@/server/db";
import { requireSession } from "@/server/security/requireSession";
import { enforceRateLimit } from "@/server/security/rateLimit";
import { TeamPost } from "@/server/models/TeamPost";
import { User } from "@/server/models/User";
import { noStoreJson } from "@/server/httpCache";
import { logActivity } from "@/server/activity";
import { ActivityActions } from "@/lib/activityActions";
import { normalizePhone, PHONE_HINT } from "@/lib/miu";
import {
  AT_POST_LIMIT_MESSAGE,
  MAX_OPEN_POSTS_PER_ACCOUNT,
  MAX_SKILLS,
  TeamDifficulties,
  TeamPostKinds,
  TeamPostStatuses,
} from "@/lib/teams";

const kindEnum = z.enum([TeamPostKinds.NeedsMembers, TeamPostKinds.NeedsTeam]);
const difficultyEnum = z.enum([
  TeamDifficulties.Easy,
  TeamDifficulties.Medium,
  TeamDifficulties.Hard,
]);
const statusEnum = z.enum([TeamPostStatuses.Open, TeamPostStatuses.Closed]);

const querySchema = z.object({
  q: z.string().max(120).optional(),
  subject: z.string().max(80).optional(),
  academicYear: z.coerce.number().int().min(1).max(4).optional(),
  kind: kindEnum.optional(),
  difficulty: difficultyEnum.optional(),
  status: statusEnum.optional(),
  mine: z.enum(["1"]).optional(),
});

export const createSchema = z
  .object({
    kind: kindEnum,
    title: z.string().min(3).max(120).transform((v) => v.trim()),
    subject: z.string().min(2).max(80).transform((v) => v.trim()),
    academicYear: z.number().int().min(1).max(4).optional(),
    projectName: z
      .string()
      .max(120)
      .optional()
      .transform((v) => (v?.trim() ? v.trim() : undefined)),
    description: z
      .string()
      .max(1000)
      .optional()
      .transform((v) => (v?.trim() ? v.trim() : undefined)),
    difficulty: difficultyEnum.default(TeamDifficulties.Medium),
    skillsNeeded: z.array(z.string().min(1).max(24)).max(MAX_SKILLS).optional().default([]),
    currentMembers: z.number().int().min(1).max(20).optional(),
    neededCount: z.number().int().min(1).max(20).optional(),
    // Length is deliberately loose here: normalizePhone() is the real check, and
    // routing a too-short number through it gets the caller the specific phone
    // hint instead of a generic "Invalid input".
    contactPhone: z.string().min(1).max(24),
    contactWhatsapp: z.boolean().optional().default(true),
  })
  .strict();

/**
 * Mongo has no regex escaping of its own, so a search for "c++" would otherwise
 * be compiled as a quantifier and either throw or match nothing.
 */
function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export async function GET(req: Request) {
  const session = await requireSession();
  if (!session) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "content-type": "application/json" },
    });
  }

  // Typing in the search box fires a request every 250ms. Budget per-user
  // rather than per-IP so a lecture hall on one Wi-Fi doesn't share a bucket.
  const limited = await enforceRateLimit(req.headers, "student:teams:get", {
    points: 300,
    duration: 60,
    identity: session.user.id,
  });
  if (limited) return limited;

  const url = new URL(req.url);
  const parsed = querySchema.safeParse({
    q: url.searchParams.get("q") ?? undefined,
    subject: url.searchParams.get("subject") ?? undefined,
    academicYear: url.searchParams.get("academicYear") || undefined,
    kind: url.searchParams.get("kind") || undefined,
    difficulty: url.searchParams.get("difficulty") || undefined,
    status: url.searchParams.get("status") || undefined,
    mine: url.searchParams.get("mine") || undefined,
  });

  if (!parsed.success) {
    return new Response(JSON.stringify({ error: "Invalid query" }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  }

  const { q, subject, academicYear, kind, difficulty, status, mine } = parsed.data;

  await connectToDatabase();

  const filter: Record<string, unknown> = {};

  if (mine) {
    // Your own board shows closed posts too — you need to see them to reopen
    // or delete them.
    filter.ownerId = session.user.id;
    if (status) filter.status = status;
  } else {
    // The public feed defaults to open posts; a closed one is noise to everyone
    // except its owner.
    filter.status = status ?? TeamPostStatuses.Open;
  }

  if (kind) filter.kind = kind;
  if (difficulty) filter.difficulty = difficulty;
  if (academicYear) filter.academicYear = academicYear;
  if (subject) filter.subject = new RegExp(escapeRegex(subject), "i");

  if (q?.trim()) {
    const rx = new RegExp(escapeRegex(q.trim()), "i");
    filter.$or = [{ title: rx }, { subject: rx }, { projectName: rx }, { description: rx }];
  }

  const items = await TeamPost.find(filter)
    .sort({ createdAt: -1 })
    // A board this size never needs paging, but an unbounded find() is one
    // spam run away from becoming a very large response.
    .limit(200)
    .lean();

  const posts = items.map((p) => ({
    id: String(p._id),
    kind: p.kind,
    title: p.title,
    subject: p.subject,
    academicYear: p.academicYear ?? null,
    projectName: p.projectName ?? null,
    description: p.description ?? null,
    difficulty: p.difficulty,
    skillsNeeded: p.skillsNeeded ?? [],
    currentMembers: p.currentMembers ?? 1,
    neededCount: p.neededCount ?? null,
    contactPhone: p.contactPhone,
    contactWhatsapp: p.contactWhatsapp ?? true,
    status: p.status,
    // Name only. The board never exposes an email address.
    ownerName: p.ownerName,
    isOwner: String(p.ownerId) === session.user.id,
    createdAt: p.createdAt ? new Date(p.createdAt).toISOString() : null,
  }));

  // Prefill values for the create form. Carried on the feed response so the
  // page doesn't need a second round trip — the phone is not on the JWT, and
  // widening the session token to hold it would leave every existing session
  // stale until it expired.
  const [me, openPosts] = await Promise.all([
    User.findById(session.user.id).select("name phone academicYear").lean(),
    // Independent of the feed filter above: "mine" or not, the form needs to
    // know how many slots this account is using.
    TeamPost.countDocuments({ ownerId: session.user.id, status: TeamPostStatuses.Open }),
  ]);

  return noStoreJson(
    {
      posts,
      defaults: {
        name: me?.name ?? null,
        phone: me?.phone ?? null,
        academicYear: me?.academicYear ?? null,
      },
      quota: { openPosts, max: MAX_OPEN_POSTS_PER_ACCOUNT },
    },
    200
  );
}

export async function POST(req: Request) {
  const session = await requireSession();
  if (!session) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "content-type": "application/json" },
    });
  }

  // Deliberately tight: a post is a broadcast to every student on campus, and
  // ten an hour is already far more than anyone legitimately needs.
  const limited = await enforceRateLimit(req.headers, "student:teams:post", {
    points: 10,
    duration: 3600,
    identity: session.user.id,
  });
  if (limited) return limited;

  const json = await req.json().catch(() => null);
  const parsed = createSchema.safeParse(json);
  if (!parsed.success) {
    return new Response(JSON.stringify({ error: "Invalid input" }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  }

  const phone = normalizePhone(parsed.data.contactPhone);
  if (!phone) {
    return new Response(JSON.stringify({ error: PHONE_HINT }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  }

  await connectToDatabase();

  // ownerName is denormalized onto the post, so read it from the account rather
  // than trusting a display name the client could have edited.
  const owner = await User.findById(session.user.id).select("name academicYear").lean();
  if (!owner) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "content-type": "application/json" },
    });
  }

  // Cheap pre-check so the common rejection costs one count and no write.
  // It is not the guard that makes the cap correct — see the recount below.
  const openPosts = await TeamPost.countDocuments({
    ownerId: session.user.id,
    status: TeamPostStatuses.Open,
  });

  if (openPosts >= MAX_OPEN_POSTS_PER_ACCOUNT) {
    return new Response(JSON.stringify({ error: AT_POST_LIMIT_MESSAGE, openPosts }), {
      status: 409,
      headers: { "content-type": "application/json" },
    });
  }

  const created = await TeamPost.create({
    ownerId: session.user.id,
    ownerName: owner.name,
    kind: parsed.data.kind,
    title: parsed.data.title,
    subject: parsed.data.subject,
    academicYear: parsed.data.academicYear ?? owner.academicYear,
    projectName: parsed.data.projectName,
    description: parsed.data.description,
    difficulty: parsed.data.difficulty,
    skillsNeeded: parsed.data.skillsNeeded,
    currentMembers: parsed.data.currentMembers ?? 1,
    // Spots-left is meaningless on a post from someone who has no team yet.
    neededCount:
      parsed.data.kind === TeamPostKinds.NeedsMembers ? parsed.data.neededCount : undefined,
    contactPhone: phone,
    contactWhatsapp: parsed.data.contactWhatsapp,
    status: TeamPostStatuses.Open,
  });

  // The check above is not enough on its own: two submissions a millisecond
  // apart both count 4, both insert, and the account lands on 6. Double-clicking
  // the button is enough to hit it — it was reproduced before this was added.
  //
  // So the row goes in first and the cap is settled afterwards, counting only
  // posts that were already there when this one arrived. ObjectIds are a total
  // order, so in a tie exactly one insert sees a full board and rolls itself
  // back; the other keeps its slot. No transaction, and it can never settle
  // above the cap.
  const olderOpenPosts = await TeamPost.countDocuments({
    ownerId: session.user.id,
    status: TeamPostStatuses.Open,
    _id: { $lt: created._id },
  });

  if (olderOpenPosts >= MAX_OPEN_POSTS_PER_ACCOUNT) {
    try {
      await TeamPost.deleteOne({ _id: created._id });
    } catch (err) {
      // Losing the rollback is the one way to end up over the cap. Loud, because
      // nothing else will notice.
      console.error("failed to roll back an over-cap team post", created._id, err);
    }

    return new Response(
      JSON.stringify({ error: AT_POST_LIMIT_MESSAGE, openPosts: olderOpenPosts }),
      { status: 409, headers: { "content-type": "application/json" } }
    );
  }

  void logActivity({
    action: ActivityActions.TeamPostCreate,
    actor: { id: session.user.id, name: owner.name },
    targetId: String(created._id),
    targetType: "teamPost",
    targetLabel: parsed.data.title,
    headers: req.headers,
  });

  return noStoreJson({ id: String(created._id) }, 201);
}
