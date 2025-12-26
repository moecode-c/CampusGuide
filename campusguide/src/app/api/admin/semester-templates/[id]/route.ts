import mongoose from "mongoose";
import { z } from "zod";
import { NextRequest } from "next/server";
import { connectToDatabase } from "@/server/db";
import { SemesterTemplate } from "@/server/models/SemesterTemplate";
import { enforceRateLimit } from "@/server/security/rateLimit";
import { requireRole } from "@/server/security/requireRole";
import { invalidateSemesterTemplateCache } from "@/server/data/semesterTemplates";

const patchSchema = z
  .object({
    termName: z.string().min(1).max(40).trim().optional(),
    startDate: z.string().datetime().optional(),
    endDate: z.string().datetime().optional(),
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
  })
  .strict();

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const limited = await enforceRateLimit(req.headers, "admin:templates:patch");
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

  await connectToDatabase();
  const tpl: any = await SemesterTemplate.findById(id);
  if (!tpl) {
    return new Response(JSON.stringify({ error: "Not found" }), {
      status: 404,
      headers: { "content-type": "application/json" },
    });
  }

  if (parsed.data.termName) tpl.termName = parsed.data.termName;
  if (parsed.data.startDate) tpl.startDate = new Date(parsed.data.startDate);
  if (parsed.data.endDate) tpl.endDate = new Date(parsed.data.endDate);
  if (typeof parsed.data.maxAbsencePercent === "number") tpl.maxAbsencePercent = parsed.data.maxAbsencePercent;
  if (parsed.data.excludedRanges) {
    tpl.excludedRanges = parsed.data.excludedRanges.map((r) => ({ start: new Date(r.start), end: new Date(r.end), label: r.label }));
  }

  if (!(new Date(tpl.startDate) < new Date(tpl.endDate))) {
    return new Response(JSON.stringify({ error: "endDate must be after startDate" }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  }

  await tpl.save();
  invalidateSemesterTemplateCache(tpl.academicYear);

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const limited = await enforceRateLimit(req.headers, "admin:templates:delete");
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
  const doc: any = await SemesterTemplate.findById(id).lean();
  if (!doc) {
    return new Response(JSON.stringify({ error: "Not found" }), {
      status: 404,
      headers: { "content-type": "application/json" },
    });
  }
  await SemesterTemplate.deleteOne({ _id: id });
  invalidateSemesterTemplateCache(doc.academicYear);

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}
