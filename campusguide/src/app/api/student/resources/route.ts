import { z } from "zod";
import { enforceRateLimit } from "@/server/security/rateLimit";
import { requireSession } from "@/server/security/requireSession";
import { getResourcesCached } from "@/server/data/resources";

const querySchema = z.object({
  q: z.string().max(80).optional(),
  subject: z.string().max(80).optional(),
  academicYear: z.coerce.number().int().min(1).max(4).optional(),
  type: z.enum(["video", "pdf", "summary"]).optional(),
});

export async function GET(req: Request) {
  const limited = await enforceRateLimit(req.headers, "student:resources:get");
  if (limited) return limited;

  const session = await requireSession();
  if (!session) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "content-type": "application/json" },
    });
  }

  const url = new URL(req.url);
  const parsed = querySchema.safeParse({
    q: url.searchParams.get("q") ?? undefined,
    subject: url.searchParams.get("subject") ?? undefined,
    academicYear: url.searchParams.get("academicYear") ?? undefined,
    type: url.searchParams.get("type") ?? undefined,
  });

  if (!parsed.success) {
    return new Response(JSON.stringify({ error: "Invalid query" }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  }

  const all = await getResourcesCached();

  const q = parsed.data.q?.trim().toLowerCase();
  const subject = parsed.data.subject?.trim().toLowerCase();

  const items = all
    .filter((r: any) => {
      if (parsed.data.academicYear && r.academicYear !== parsed.data.academicYear) return false;
      if (parsed.data.type && r.type !== parsed.data.type) return false;
      if (subject && String(r.subject ?? "").toLowerCase() !== subject) return false;
      if (q) {
        const hay = `${r.title ?? ""} ${r.subject ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    })
    .map((r: any) => ({
      id: String(r._id),
      title: r.title,
      subject: r.subject,
      academicYear: r.academicYear,
      type: r.type,
      externalUrl: r.externalUrl ?? null,
      hasFile: Boolean(r.objectKey),
      createdAt: r.createdAt,
    }));

  return new Response(JSON.stringify({ items }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}
