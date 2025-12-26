import { z } from "zod";
import { connectToDatabase } from "@/server/db";
import { requireSession } from "@/server/security/requireSession";
import { enforceRateLimit } from "@/server/security/rateLimit";
import { MidtermGrade } from "@/server/models/MidtermGrade";

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

  return new Response(JSON.stringify({ items }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
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

  const normalized = parsed.data.items.map((i) => ({
    userId: session.user.id,
    subject: i.subject,
    midtermMark: i.midtermMark,
    creditHours: typeof i.creditHours === "number" && Number.isFinite(i.creditHours) ? i.creditHours : 3,
  }));

  await MidtermGrade.deleteMany({ userId: session.user.id });
  if (normalized.length) await MidtermGrade.insertMany(normalized);

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}
