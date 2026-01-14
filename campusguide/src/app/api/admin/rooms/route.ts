import { z } from "zod";
import { connectToDatabase } from "@/server/db";
import { Room } from "@/server/models/Room";
import { enforceRateLimit } from "@/server/security/rateLimit";
import { requireRole } from "@/server/security/requireRole";
import { invalidateRoomsCache } from "@/server/data/rooms";
import { jsonWithEtag, noStoreJson } from "@/server/httpCache";

const schema = z.object({
  roomCode: z.string().min(2).max(16).transform((v) => v.trim().toUpperCase()),
  building: z.string().min(1).max(8).transform((v) => v.trim().toUpperCase()),
  floor: z.number().int().min(-5).max(50),
  x: z.number().min(0).max(1),
  y: z.number().min(0).max(1),
});

export async function GET(req: Request) {
  const limited = await enforceRateLimit(req.headers, "admin:rooms:get");
  if (limited) return limited;

  const session = await requireRole("admin");
  if (!session) {
    return new Response(JSON.stringify({ error: "Forbidden" }), {
      status: 403,
      headers: { "content-type": "application/json" },
    });
  }

  await connectToDatabase();
  const items = await Room.find({}).sort({ building: 1, floor: 1, roomCode: 1 }).lean();
  const normalized = (items as unknown as Array<{ _id: unknown; roomCode: string; building: string; floor: number; x: number; y: number }>).map((r) => ({
    _id: String(r._id),
    roomCode: r.roomCode,
    building: r.building,
    floor: r.floor,
    x: r.x,
    y: r.y,
  }));
  return jsonWithEtag(req, { items: normalized }, { cacheControl: "private, max-age=10, stale-while-revalidate=60" });
}

export async function POST(req: Request) {
  const limited = await enforceRateLimit(req.headers, "admin:rooms:post");
  if (limited) return limited;

  const session = await requireRole("admin");
  if (!session) {
    return new Response(JSON.stringify({ error: "Forbidden" }), {
      status: 403,
      headers: { "content-type": "application/json" },
    });
  }

  const json = await req.json().catch(() => null);
  const parsed = schema.safeParse(json);
  if (!parsed.success) {
    return new Response(JSON.stringify({ error: "Invalid input" }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  }

  await connectToDatabase();
  const created = await Room.create(parsed.data);
  invalidateRoomsCache();

  return noStoreJson({ id: String(created._id) }, 201);
}
