import { z } from "zod";
import { enforceRateLimit } from "@/server/security/rateLimit";
import { requireRole } from "@/server/security/requireRole";
import { noStoreJson } from "@/server/httpCache";
import {
  MAX_UPLOAD_BYTES,
  StorageNotConfiguredError,
  buildObjectKey,
  createUploadUrl,
} from "@/server/storage/r2";

const schema = z
  .object({
    fileName: z.string().trim().min(1, "File name is required").max(255, "File name is too long"),
    contentType: z.string().trim().min(1).max(255).optional(),
    // Advisory only — the real size is verified with a HEAD once the upload lands.
    size: z.number().int().nonnegative().optional(),
  })
  .strict();

/**
 * Hands the browser a short-lived presigned PUT so the file goes straight to R2.
 * Nothing is written to MongoDB here; the follow-up POST /api/admin/resources
 * call is what turns an uploaded object into a visible resource.
 */
export async function POST(req: Request) {
  const limited = await enforceRateLimit(req.headers, "admin:resources:upload-url", {
    points: 60,
    duration: 60,
  });
  if (limited) return limited;

  const session = await requireRole("admin");
  if (!session) return noStoreJson({ error: "Forbidden" }, 403);

  const json = await req.json().catch(() => null);
  const parsed = schema.safeParse(json);
  if (!parsed.success) {
    return noStoreJson({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, 400);
  }

  if (parsed.data.size !== undefined && parsed.data.size > MAX_UPLOAD_BYTES) {
    return noStoreJson(
      { error: `File is too large. Maximum is ${Math.floor(MAX_UPLOAD_BYTES / (1024 * 1024))} MB.` },
      413
    );
  }

  const key = buildObjectKey(parsed.data.fileName);
  const contentType = parsed.data.contentType || "application/octet-stream";

  try {
    const { uploadUrl, expiresIn } = await createUploadUrl({ key, contentType });
    return noStoreJson({ key, uploadUrl, contentType, expiresIn });
  } catch (err) {
    if (err instanceof StorageNotConfiguredError) {
      return noStoreJson({ error: err.message }, 503);
    }
    throw err;
  }
}
