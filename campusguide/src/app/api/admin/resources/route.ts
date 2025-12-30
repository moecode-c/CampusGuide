import { z } from "zod";
import { connectToDatabase } from "@/server/db";
import { Resource, ResourceTypes } from "@/server/models/Resource";
import { enforceRateLimit } from "@/server/security/rateLimit";
import { requireRole } from "@/server/security/requireRole";
import { invalidateResourcesCache } from "@/server/data/resources";

const schema = z
  .object({
    title: z.string().min(1).max(140).trim(),
    subject: z.string().min(1).max(80).trim(),
    academicYear: z.number().int().min(1).max(4),
    type: z.enum([ResourceTypes.Video, ResourceTypes.Pdf, ResourceTypes.Summary]),
    // Relax URL validation to allow "google.com" or just require https
    externalUrl: z.string().min(3),
  })
  .strict();

export async function GET(req: Request) {
  const limited = await enforceRateLimit(req.headers, "admin:resources:get");
  if (limited) return limited;

  const session = await requireRole("admin");
  if (!session) {
    return new Response(JSON.stringify({ error: "Forbidden" }), {
      status: 403,
      headers: { "content-type": "application/json" },
    });
  }

  await connectToDatabase();
  const items = await Resource.find({}).sort({ createdAt: -1 }).lean();
  return new Response(JSON.stringify({ items }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

export async function POST(req: Request) {
  const limited = await enforceRateLimit(req.headers, "admin:resources:post");
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
  const created = await Resource.create({
    title: parsed.data.title,
    subject: parsed.data.subject,
    academicYear: parsed.data.academicYear,
    type: parsed.data.type,
    externalUrl: parsed.data.externalUrl,
    createdBy: session.user.id,
  });

  invalidateResourcesCache();

  return new Response(JSON.stringify({ id: String(created._id) }), {
    status: 201,
    headers: { "content-type": "application/json" },
  });
}
