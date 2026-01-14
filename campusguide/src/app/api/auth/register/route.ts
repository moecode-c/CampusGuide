import { z } from "zod";
import bcrypt from "bcrypt";
import { connectToDatabase } from "@/server/db";
import { User } from "@/server/models/User";
import { enforceRateLimit } from "@/server/security/rateLimit";

const schema = z.object({
  name: z.string().min(2).max(60).trim(),
  email: z.string().email().max(320).transform((v) => v.toLowerCase()),
  password: z
    .string()
    .min(8)
    .max(200)
    .regex(/[A-Z]/, "Password must include at least 1 uppercase letter")
    .regex(/[0-9]/, "Password must include at least 1 number"),
  academicYear: z.number().int().min(1).max(4),
});

export async function POST(req: Request) {
  // Stricter limits for spam-prone endpoint
  const limited = await enforceRateLimit(req.headers, "auth:register", { points: 5, duration: 60 });
  if (limited) return limited;

  const json = await req.json().catch(() => null);
  const parsed = schema.safeParse(json);
  if (!parsed.success) {
    const message = parsed.error.issues?.[0]?.message ?? "Invalid input";
    return new Response(JSON.stringify({ error: message }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  }

  // Additional limiter keyed by email to slow down repeated attempts.
  const limitedEmail = await enforceRateLimit(req.headers, "auth:register:email", {
    points: 3,
    duration: 60,
    identity: parsed.data.email,
  });
  if (limitedEmail) return limitedEmail;

  try {
    await connectToDatabase();
  } catch (err) {
    const message =
      process.env.NODE_ENV === "production"
        ? "Database unavailable"
        : `Database unavailable: ${(err as any)?.message ?? "connection failed"}`;

    return new Response(JSON.stringify({ error: message }), {
      status: 503,
      headers: { "content-type": "application/json" },
    });
  }

  const exists = await User.findOne({ email: parsed.data.email }).lean();
  if (exists) {
    return new Response(JSON.stringify({ error: "Email already in use" }), {
      status: 409,
      headers: { "content-type": "application/json" },
    });
  }

  const passwordHash = await bcrypt.hash(parsed.data.password, 12);

  await User.create({
    email: parsed.data.email,
    name: parsed.data.name,
    passwordHash,
    role: "student",
    academicYear: parsed.data.academicYear,
  });

  return new Response(JSON.stringify({ ok: true }), {
    status: 201,
    headers: { "content-type": "application/json" },
  });
}
