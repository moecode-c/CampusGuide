import mongoose from "mongoose";
import { NextRequest } from "next/server";
import { z } from "zod";
import { connectToDatabase } from "@/server/db";
import { requireSession } from "@/server/security/requireSession";
import { enforceRateLimit } from "@/server/security/rateLimit";
import { Event, EventTypes } from "@/server/models/Event";

const isoDate = z.string().datetime();

const patchSchema = z
  .object({
    title: z.string().min(1).max(120).transform((v) => v.trim()).optional(),
    type: z.enum([EventTypes.Lecture, EventTypes.Lab, EventTypes.Midterm, EventTypes.Assignment]).optional(),
    start: isoDate.optional(),
    end: isoDate.optional(),
    roomCode: z
      .string()
      .max(16)
      .optional()
      .transform((v) => (v ? v.trim().toUpperCase() : v)),
    building: z
      .string()
      .max(8)
      .optional()
      .transform((v) => (v ? v.trim().toUpperCase() : v)),
    isRecurring: z.boolean().optional(),
    rrule: z.string().max(500).optional(),
  })
  .strict();

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const limited = await enforceRateLimit(req.headers, "student:events:patch");
  if (limited) return limited;

  const session = await requireSession();
  if (!session) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "content-type": "application/json" },
    });
  }

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

  const update: any = { ...parsed.data };
  if (update.start) update.start = new Date(update.start);
  if (update.end) update.end = new Date(update.end);

  if (update.start && update.end && !(update.start < update.end)) {
    return new Response(JSON.stringify({ error: "End must be after start" }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  }

  await connectToDatabase();
  const found = await Event.findOne({ _id: id, userId: session.user.id });
  if (!found) {
    return new Response(JSON.stringify({ error: "Not found" }), {
      status: 404,
      headers: { "content-type": "application/json" },
    });
  }

  Object.assign(found, update);
  await found.save();

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const limited = await enforceRateLimit(req.headers, "student:events:delete");
  if (limited) return limited;

  const session = await requireSession();
  if (!session) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "content-type": "application/json" },
    });
  }

  const { id } = await ctx.params;
  if (!mongoose.isValidObjectId(id)) {
    return new Response(JSON.stringify({ error: "Invalid id" }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  }

  await connectToDatabase();
  const deleted = await Event.deleteOne({ _id: id, userId: session.user.id });
  if (!deleted.deletedCount) {
    return new Response(JSON.stringify({ error: "Not found" }), {
      status: 404,
      headers: { "content-type": "application/json" },
    });
  }

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}
