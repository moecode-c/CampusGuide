import mongoose from "mongoose";
import { z } from "zod";
import { NextRequest } from "next/server";
import { connectToDatabase } from "@/server/db";
import { Room } from "@/server/models/Room";
import { enforceRateLimit } from "@/server/security/rateLimit";
import { requireRole } from "@/server/security/requireRole";
import { invalidateRoomsCache } from "@/server/data/rooms";
import { noStoreJson } from "@/server/httpCache";
import { isDuplicateKeyError } from "@/server/mongoErrors";

const patchSchema = z
  .object({
    roomCode: z.string().min(2).max(16).transform((v) => v.trim().toUpperCase()).optional(),
    building: z.string().min(1).max(8).transform((v) => v.trim().toUpperCase()).optional(),
    floor: z.number().int().min(-5).max(50).optional(),
    x: z.number().min(0).max(1).optional(),
    y: z.number().min(0).max(1).optional(),
  })
  .strict();

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const limited = await enforceRateLimit(req.headers, "admin:rooms:patch");
  if (limited) return limited;

  const session = await requireRole("admin");
  if (!session) {
    return new Response(JSON.stringify({ error: "Forbidden" }), {
      status: 403,
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

  // MongoDB rejects an empty `$set`, which would surface as a 500.
  if (Object.keys(parsed.data).length === 0) {
    return new Response(JSON.stringify({ error: "No fields to update" }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  }

  await connectToDatabase();

  let updated;
  try {
    updated = await Room.findOneAndUpdate(
      { _id: id },
      { $set: parsed.data },
      { new: true, runValidators: true }
    ).lean();
  } catch (err) {
    if (isDuplicateKeyError(err)) {
      return new Response(JSON.stringify({ error: "Room code already exists" }), {
        status: 409,
        headers: { "content-type": "application/json" },
      });
    }
    throw err;
  }

  if (!updated) {
    return new Response(JSON.stringify({ error: "Not found" }), {
      status: 404,
      headers: { "content-type": "application/json" },
    });
  }

  invalidateRoomsCache();

  return noStoreJson({ ok: true, item: { ...updated, _id: String((updated as any)._id) } }, 200);
}

export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const limited = await enforceRateLimit(req.headers, "admin:rooms:delete");
  if (limited) return limited;

  const session = await requireRole("admin");
  if (!session) {
    return new Response(JSON.stringify({ error: "Forbidden" }), {
      status: 403,
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
  const deleted = await Room.deleteOne({ _id: id });
  if (!deleted.deletedCount) {
    return new Response(JSON.stringify({ error: "Not found" }), {
      status: 404,
      headers: { "content-type": "application/json" },
    });
  }
  invalidateRoomsCache();

  return noStoreJson({ ok: true }, 200);
}
