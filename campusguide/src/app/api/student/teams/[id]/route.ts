import mongoose from "mongoose";
import { NextRequest } from "next/server";
import { z } from "zod";
import { connectToDatabase } from "@/server/db";
import { requireSession } from "@/server/security/requireSession";
import { enforceRateLimit } from "@/server/security/rateLimit";
import { getAccountState } from "@/server/security/accountStatus";
import { TeamPost } from "@/server/models/TeamPost";
import { noStoreJson } from "@/server/httpCache";
import { logActivity } from "@/server/activity";
import { ActivityActions } from "@/lib/activityActions";
import { Roles } from "@/server/roles";
import { normalizePhone, PHONE_HINT } from "@/lib/miu";
import {
  AT_POST_LIMIT_MESSAGE,
  MAX_OPEN_POSTS_PER_ACCOUNT,
  MAX_SKILLS,
  TeamDifficulties,
  TeamPostKinds,
  TeamPostStatuses,
} from "@/lib/teams";

const patchSchema = z
  .object({
    kind: z.enum([TeamPostKinds.NeedsMembers, TeamPostKinds.NeedsTeam]).optional(),
    title: z.string().min(3).max(120).transform((v) => v.trim()).optional(),
    subject: z.string().min(2).max(80).transform((v) => v.trim()).optional(),
    academicYear: z.number().int().min(1).max(4).optional(),
    projectName: z.string().max(120).optional(),
    description: z.string().max(1000).optional(),
    difficulty: z
      .enum([TeamDifficulties.Easy, TeamDifficulties.Medium, TeamDifficulties.Hard])
      .optional(),
    skillsNeeded: z.array(z.string().min(1).max(24)).max(MAX_SKILLS).optional(),
    currentMembers: z.number().int().min(1).max(20).optional(),
    neededCount: z.number().int().min(1).max(20).optional(),
    // Loose on purpose — normalizePhone() below is the real check, and it
    // returns the specific hint rather than a generic "Invalid input".
    contactPhone: z.string().min(1).max(24).optional(),
    contactWhatsapp: z.boolean().optional(),
    status: z.enum([TeamPostStatuses.Open, TeamPostStatuses.Closed]).optional(),
  })
  .strict();

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const session = await requireSession();
  if (!session) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "content-type": "application/json" },
    });
  }

  const limited = await enforceRateLimit(req.headers, "student:teams:patch", {
    points: 60,
    duration: 60,
    identity: session.user.id,
  });
  if (limited) return limited;

  const { id } = await ctx.params;
  if (!mongoose.isValidObjectId(id)) {
    return new Response(JSON.stringify({ error: "Invalid id" }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  }

  const json = await req.json().catch(() => null);
  const parsed = patchSchema.safeParse(json);
  if (!parsed.success) {
    return new Response(JSON.stringify({ error: "Invalid input" }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  }

  await connectToDatabase();

  // Scoped by owner, so a guessed id edits nothing rather than someone else's post.
  const found = await TeamPost.findOne({ _id: id, ownerId: session.user.id });
  if (!found) {
    return new Response(JSON.stringify({ error: "Not found" }), {
      status: 404,
      headers: { "content-type": "application/json" },
    });
  }

  // Reopening is a second door into the board, so the cap has to be checked here
  // too. Without this, closing a post and reopening it would walk straight past
  // the limit the create route enforces.
  const reopening =
    parsed.data.status === TeamPostStatuses.Open && found.status !== TeamPostStatuses.Open;

  if (reopening) {
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
  }

  const update: Record<string, unknown> = { ...parsed.data };

  if (parsed.data.contactPhone !== undefined) {
    const phone = normalizePhone(parsed.data.contactPhone);
    if (!phone) {
      return new Response(JSON.stringify({ error: PHONE_HINT }), {
        status: 400,
        headers: { "content-type": "application/json" },
      });
    }
    update.contactPhone = phone;
  }

  // An empty string means "clear this"; storing "" would render a blank line
  // where the project name goes.
  for (const field of ["projectName", "description"] as const) {
    if (update[field] === "") {
      found.set(field, undefined);
      delete update[field];
    } else if (typeof update[field] === "string") {
      update[field] = (update[field] as string).trim();
    }
  }

  // Switching a post to "looking for a team" drops the spots-left count with
  // it, otherwise the card claims open spots on a team that doesn't exist.
  const nextKind = parsed.data.kind ?? found.kind;
  if (nextKind === TeamPostKinds.NeedsTeam) {
    found.set("neededCount", undefined);
    delete update.neededCount;
  }

  Object.assign(found, update);
  await found.save();

  // Same race as the create route: two reopens can both pass the check above.
  // Recount once the flip is committed and put this one back if the board is
  // over the cap. Unlike create there is no id ordering to break the tie — both
  // simultaneous reopens revert, which errs to the safe side and the student
  // just clicks again.
  if (reopening) {
    const openPosts = await TeamPost.countDocuments({
      ownerId: session.user.id,
      status: TeamPostStatuses.Open,
    });

    if (openPosts > MAX_OPEN_POSTS_PER_ACCOUNT) {
      found.set("status", TeamPostStatuses.Closed);
      try {
        await found.save();
      } catch (err) {
        console.error("failed to re-close an over-cap team post", found._id, err);
      }

      return new Response(
        JSON.stringify({ error: AT_POST_LIMIT_MESSAGE, openPosts: openPosts - 1 }),
        { status: 409, headers: { "content-type": "application/json" } }
      );
    }
  }

  return noStoreJson({ ok: true }, 200);
}

export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const session = await requireSession();
  if (!session) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "content-type": "application/json" },
    });
  }

  const limited = await enforceRateLimit(req.headers, "student:teams:delete", {
    points: 60,
    duration: 60,
    identity: session.user.id,
  });
  if (limited) return limited;

  const { id } = await ctx.params;
  if (!mongoose.isValidObjectId(id)) {
    return new Response(JSON.stringify({ error: "Invalid id" }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  }

  await connectToDatabase();

  // Admins can take down a post they don't own — the board is public to the
  // whole campus and needs someone able to remove abuse.
  const state = await getAccountState(session.user.id);
  const isAdmin = state?.role === Roles.Admin;

  const filter = isAdmin ? { _id: id } : { _id: id, ownerId: session.user.id };
  const post = await TeamPost.findOne(filter).select("title ownerId").lean();
  if (!post) {
    return new Response(JSON.stringify({ error: "Not found" }), {
      status: 404,
      headers: { "content-type": "application/json" },
    });
  }

  await TeamPost.deleteOne({ _id: post._id });

  void logActivity({
    action: ActivityActions.TeamPostDelete,
    actor: { id: session.user.id, name: state?.name, miuId: state?.miuId },
    targetId: String(post._id),
    targetType: "teamPost",
    targetLabel: post.title,
    meta: { byAdmin: isAdmin && String(post.ownerId) !== session.user.id },
    headers: req.headers,
  });

  return noStoreJson({ ok: true }, 200);
}
