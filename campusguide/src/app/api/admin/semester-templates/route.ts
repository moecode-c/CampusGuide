import { z } from "zod";
import { connectToDatabase } from "@/server/db";
import { SemesterTemplate } from "@/server/models/SemesterTemplate";
import { enforceRateLimit } from "@/server/security/rateLimit";
import { requireRole } from "@/server/security/requireRole";
import { invalidateSemesterTemplateCache } from "@/server/data/semesterTemplates";

const schema = z.object({
  academicYear: z.number().int().min(1).max(4),
  termName: z.string().min(1).max(40).trim(),
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
  maxAbsencePercent: z.number().min(0).max(100).optional(),
  excludedRanges: z
    .array(
      z.object({
        start: z.string().datetime(),
        end: z.string().datetime(),
        label: z.string().min(1).max(40).trim(),
      })
    )
    .optional(),
});

export async function GET(req: Request) {
  const limited = await enforceRateLimit(req.headers, "admin:templates:get");
  if (limited) return limited;

  const session = await requireRole("admin");
  if (!session) {
    return new Response(JSON.stringify({ error: "Forbidden" }), {
      status: 403,
      headers: { "content-type": "application/json" },
    });
  }

  await connectToDatabase();
  const items = await SemesterTemplate.find({}).sort({ academicYear: 1, termName: 1 }).lean();
  return new Response(JSON.stringify({ items }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

export async function POST(req: Request) {
  const limited = await enforceRateLimit(req.headers, "admin:templates:post");
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

  const startDate = new Date(parsed.data.startDate);
  const endDate = new Date(parsed.data.endDate);
  if (!(startDate < endDate)) {
    return new Response(JSON.stringify({ error: "endDate must be after startDate" }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  }

  await connectToDatabase();
  const created = await SemesterTemplate.create({
    academicYear: parsed.data.academicYear,
    termName: parsed.data.termName,
    startDate,
    endDate,
    maxAbsencePercent: parsed.data.maxAbsencePercent ?? 25,
    excludedRanges:
      parsed.data.excludedRanges?.map((r) => ({ start: new Date(r.start), end: new Date(r.end), label: r.label })) ?? [],
  });

  invalidateSemesterTemplateCache(parsed.data.academicYear);

  return new Response(JSON.stringify({ id: String(created._id) }), {
    status: 201,
    headers: { "content-type": "application/json" },
  });
}
