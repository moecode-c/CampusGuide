import { z } from "zod";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { env } from "@/env";
import { enforceRateLimit } from "@/server/security/rateLimit";
import { requireRole } from "@/server/security/requireRole";
import { getR2Client } from "@/server/r2/client";
import { randomUUID } from "crypto";

const schema = z.object({
  mimeType: z.string().min(1).max(120),
  sizeBytes: z.number().int().min(1).max(50 * 1024 * 1024),
});

export async function POST(req: Request) {
  const limited = await enforceRateLimit(req.headers, "admin:resources:presign");
  if (limited) return limited;

  const session = await requireRole("admin");
  if (!session) {
    return new Response(JSON.stringify({ error: "Forbidden" }), {
      status: 403,
      headers: { "content-type": "application/json" },
    });
  }

  if (!env.R2_BUCKET) {
    return new Response(JSON.stringify({ error: "Storage not configured" }), {
      status: 500,
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

  const objectKey = `resources/${new Date().toISOString().slice(0, 10)}/${randomUUID()}`;

  const client = getR2Client();
  const url = await getSignedUrl(
    client,
    new PutObjectCommand({
      Bucket: env.R2_BUCKET,
      Key: objectKey,
      ContentType: parsed.data.mimeType,
    }),
    { expiresIn: 60 }
  );

  return new Response(JSON.stringify({ url, objectKey }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}
