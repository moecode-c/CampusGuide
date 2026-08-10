import { z } from "zod";
import { connectToDatabase } from "@/server/db";
import { requireSession } from "@/server/security/requireSession";
import { enforceRateLimit } from "@/server/security/rateLimit";
import { MidtermGrade } from "@/server/models/MidtermGrade";
import { jsonWithEtag, noStoreJson } from "@/server/httpCache";

const itemSchema = z.object({
  subject: z.string().min(1).max(80).transform((v) => v.trim()),
  midtermMark: z.number().min(0).max(40),
  creditHours: z.number().min(0).max(10).optional(),
});

const upsertSchema = z.object({
  items: z.array(itemSchema).max(50),
});

export async function GET(req: Request) {
  const limited = await enforceRateLimit(req.headers, "student:midterms:get");
  if (limited) return limited;

  const session = await requireSession();
  if (!session) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "content-type": "application/json" },
    });
  }

  await connectToDatabase();
  const items = await MidtermGrade.find({ userId: session.user.id })
    .sort({ subject: 1 })
    .select({ subject: 1, midtermMark: 1, creditHours: 1 })
    .lean();

  return jsonWithEtag(req, { items }, { cacheControl: "private, max-age=30, stale-while-revalidate=300" });
}

export async function PUT(req: Request) {
  const limited = await enforceRateLimit(req.headers, "student:midterms:put");
  if (limited) return limited;

  const session = await requireSession();
  if (!session) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "content-type": "application/json" },
    });
  }

  const json = await req.json().catch(() => null);
  const parsed = upsertSchema.safeParse(json);
  if (!parsed.success) {
    return new Response(JSON.stringify({ error: "Invalid input" }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  }

  await connectToDatabase();

  // `subject` is unique per user. Sending the same subject twice used to blow up
  // insertMany *after* the delete, wiping every saved grade — keep the last one.
  const bySubject = new Map<string, { userId: string; subject: string; midtermMark: number; creditHours: number }>();
  for (const i of parsed.data.items) {
    bySubject.set(i.subject.toLowerCase(), {
      userId: session.user.id,
      subject: i.subject,
      midtermMark: i.midtermMark,
      creditHours: typeof i.creditHours === "number" && Number.isFinite(i.creditHours) ? i.creditHours : 3,
    });
  }
  const normalized = Array.from(bySubject.values());

  await MidtermGrade.deleteMany({ userId: session.user.id });
  if (normalized.length) await MidtermGrade.insertMany(normalized);

  return noStoreJson({ ok: true, saved: normalized.length }, 200);
}
