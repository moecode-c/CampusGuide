import mongoose from "mongoose";
import { connectToDatabase } from "@/server/db";
import { Resource } from "@/server/models/Resource";
import { enforceRateLimit } from "@/server/security/rateLimit";
import { requireSession } from "@/server/security/requireSession";
import { noStoreJson } from "@/server/httpCache";

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

  const { id } = await params;
  if (!mongoose.isValidObjectId(id)) return noStoreJson({ error: "Invalid id" }, 400);

  await connectToDatabase();
  const resource = await Resource.findById(id).select("fileUrl externalUrl").lean();
  if (!resource) return noStoreJson({ error: "Not found" }, 404);

  const target = resource.fileUrl ?? resource.externalUrl;
  if (!target) return noStoreJson({ error: "This resource has no file or link" }, 404);

  return Response.redirect(target, 302);
}
