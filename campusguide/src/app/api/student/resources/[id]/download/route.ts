import mongoose from "mongoose";
import { connectToDatabase } from "@/server/db";
import { Resource } from "@/server/models/Resource";
import { enforceRateLimit } from "@/server/security/rateLimit";
import { requireSession } from "@/server/security/requireSession";
import { noStoreJson } from "@/server/httpCache";
import { blockedByDriveLock } from "@/server/security/driveLock";

/**
 * Stable in-app link for a resource. The R2 bucket is public, so this is a
 * redirect rather than a proxy — it exists so the app can link to a resource by
 * id without knowing (or caching) the bucket URL.
 */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const limited = await enforceRateLimit(req.headers, "student:resources:download");
  if (limited) return limited;

  const session = await requireSession();
  if (!session) return noStoreJson({ error: "Unauthorized" }, 401);

  // Otherwise a saved link would still pull files straight out of a locked drive.
  const locked = await blockedByDriveLock(session);
  if (locked) return locked;

  const { id } = await params;
  if (!mongoose.isValidObjectId(id)) return noStoreJson({ error: "Invalid id" }, 400);

  await connectToDatabase();
  const resource = await Resource.findById(id).select("fileUrl externalUrl").lean();
  if (!resource) return noStoreJson({ error: "Not found" }, 404);

  const target = resource.fileUrl ?? resource.externalUrl;
  if (!target) return noStoreJson({ error: "This resource has no file or link" }, 404);

  // Links have been normalized to http(s) since normalizeExternalUrl landed, but
  // rows predating it were stored raw. Response.redirect throws on a malformed
  // URL (a 500), and a `javascript:` value must never reach a Location header.
  let parsed: URL;
  try {
    parsed = new URL(target);
  } catch {
    return noStoreJson({ error: "This resource has an unusable link" }, 404);
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return noStoreJson({ error: "This resource has an unusable link" }, 404);
  }

  // Fire-and-forget, and after every other check has passed: this counts real
  // handovers, not 404s or lock rejections. An atomic $inc rather than a
  // read-modify-write, so two students clicking at once cannot lose a tick — and
  // a failed counter write must never turn a working download into a 500.
  void Resource.updateOne(
    { _id: id },
    { $inc: { downloadCount: 1 }, $set: { lastDownloadedAt: new Date() } }
  ).catch((err) => {
    console.error("download counter update failed", err);
  });

  return Response.redirect(parsed.toString(), 302);
}
