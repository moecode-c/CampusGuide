import mongoose from "mongoose";
import { z } from "zod";
import { connectToDatabase } from "@/server/db";
import { Folder } from "@/server/models/Folder";
import { Resource, ResourceKinds, ResourceTypes } from "@/server/models/Resource";
import { enforceRateLimit } from "@/server/security/rateLimit";
import { requireRole } from "@/server/security/requireRole";
import { invalidateResourcesCache } from "@/server/data/resources";
import { serializeFile } from "@/server/data/drive";
import { logActivity } from "@/server/activity";
import { ActivityActions } from "@/server/models/ActivityLog";
import { jsonWithEtag, noStoreJson } from "@/server/httpCache";
import { normalizeExternalUrl } from "@/lib/url";
import {
  MAX_UPLOAD_BYTES,
  StorageNotConfiguredError,
  deleteObject,
  headObject,
  publicUrlFor,
  sanitizeFileName,
} from "@/server/storage/r2";

const shared = {
  title: z.string().min(1).max(140).trim().optional(),
  folderId: z.string().nullable().optional(),
  subject: z.string().min(1).max(80).trim().optional(),
  academicYear: z.number().int().min(1).max(4).optional(),
  type: z.enum([ResourceTypes.Video, ResourceTypes.Pdf, ResourceTypes.Summary]).optional(),
};

const linkSchema = z
  .object({
    ...shared,
    kind: z.literal(ResourceKinds.Link),
    title: z.string().min(1).max(140).trim(),
    // Bare hosts like "google.com" are accepted and normalized to an absolute https URL.
    externalUrl: z
      .string()
      .min(3)
      .transform((v, ctx) => {
        const normalized = normalizeExternalUrl(v);
        if (!normalized) {
          ctx.addIssue({ code: "custom", message: "Enter a valid http(s) link" });
          return z.NEVER;
        }
        return normalized;
      }),
  })
  .strict();

const fileSchema = z
  .object({
    ...shared,
    kind: z.literal(ResourceKinds.File),
    // Returned by POST /api/admin/resources/upload-url.
    objectKey: z.string().min(1).max(400),
  })
  .strict();

// `kind` was added with the file store; older callers only ever sent links.
const schema = z.preprocess((value) => {
  if (value && typeof value === "object" && !("kind" in value)) {
    return { ...(value as Record<string, unknown>), kind: ResourceKinds.Link };
  }
  return value;
}, z.discriminatedUnion("kind", [linkSchema, fileSchema]));

async function resolveFolderId(rawId: string | null | undefined) {
  if (!rawId || rawId === "root") return { ok: true as const, id: null };
  if (!mongoose.isValidObjectId(rawId)) return { ok: false as const, error: "Invalid folder id" };

  const folder = await Folder.findById(rawId).select("_id").lean();
  if (!folder) return { ok: false as const, error: "Folder not found" };

  return { ok: true as const, id: folder._id as mongoose.Types.ObjectId };
}

export async function GET(req: Request) {
  const limited = await enforceRateLimit(req.headers, "admin:resources:get");
  if (limited) return limited;

  const session = await requireRole("admin");
  if (!session) return noStoreJson({ error: "Forbidden" }, 403);

  await connectToDatabase();
  const items = await Resource.find({}).sort({ createdAt: -1 }).lean();
  return jsonWithEtag(req, { items }, { cacheControl: "private, max-age=30, stale-while-revalidate=300" });
}

export async function POST(req: Request) {
  const limited = await enforceRateLimit(req.headers, "admin:resources:post");
  if (limited) return limited;

  const session = await requireRole("admin");
  if (!session) return noStoreJson({ error: "Forbidden" }, 403);

  const json = await req.json().catch(() => null);
  const parsed = schema.safeParse(json);
  if (!parsed.success) {
    return noStoreJson({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, 400);
  }

  await connectToDatabase();

  const folder = await resolveFolderId(parsed.data.folderId);
  if (!folder.ok) return noStoreJson({ error: folder.error }, 400);

  const base = {
    folderId: folder.id,
    subject: parsed.data.subject,
    academicYear: parsed.data.academicYear,
    type: parsed.data.type,
    createdBy: session.user.id,
  };

  if (parsed.data.kind === ResourceKinds.Link) {
    const created = await Resource.create({
      ...base,
      kind: ResourceKinds.Link,
      title: parsed.data.title,
      externalUrl: parsed.data.externalUrl,
    });

    invalidateResourcesCache();
    await logActivity({
      action: ActivityActions.ResourceCreate,
      actor: { id: session.user.id, name: session.user.name },
      targetId: String(created._id),
      targetType: "resource",
      targetLabel: created.title,
      meta: { kind: "link" },
      headers: req.headers,
    });

    return noStoreJson({ id: String(created._id), resource: serializeFile(created.toObject()) }, 201);
  }

  const objectKey = parsed.data.objectKey;

  let head;
  try {
    head = await headObject(objectKey);
  } catch (err) {
    if (err instanceof StorageNotConfiguredError) return noStoreJson({ error: err.message }, 503);
    throw err;
  }

  // Guards against a resource row pointing at an upload that never finished.
  if (!head) {
    return noStoreJson({ error: "Upload not found in storage. Please try uploading again." }, 400);
  }

  if (head.size > MAX_UPLOAD_BYTES) {
    await deleteObject(objectKey).catch(() => undefined);
    return noStoreJson(
      { error: `File is too large. Maximum is ${Math.floor(MAX_UPLOAD_BYTES / (1024 * 1024))} MB.` },
      413
    );
  }

  const fileName = sanitizeFileName(decodeURIComponent(objectKey.split("/").pop() ?? "file"));

  const created = await Resource.create({
    ...base,
    kind: ResourceKinds.File,
    title: parsed.data.title?.trim() || fileName,
    objectKey,
    fileUrl: publicUrlFor(objectKey),
    fileName,
    fileSize: head.size,
    mimeType: head.contentType ?? undefined,
  });

  invalidateResourcesCache();
  await logActivity({
    action: ActivityActions.ResourceCreate,
    actor: { id: session.user.id, name: session.user.name },
    targetId: String(created._id),
    targetType: "resource",
    targetLabel: created.title,
    meta: { kind: "file", fileName, fileSize: head.size },
    headers: req.headers,
  });

  return noStoreJson({ id: String(created._id), resource: serializeFile(created.toObject()) }, 201);
}
