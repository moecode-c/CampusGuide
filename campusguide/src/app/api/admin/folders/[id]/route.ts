import mongoose from "mongoose";
import { z } from "zod";
import { connectToDatabase } from "@/server/db";
import { Folder, buildFolderPath } from "@/server/models/Folder";
import { Resource, ResourceKinds } from "@/server/models/Resource";
import { enforceRateLimit } from "@/server/security/rateLimit";
import { requireRole } from "@/server/security/requireRole";
import { noStoreJson } from "@/server/httpCache";
import { isDuplicateKeyError } from "@/server/mongoErrors";
import { invalidateResourcesCache } from "@/server/data/resources";
import { serializeFolder, subtreeFolderIds } from "@/server/data/drive";
import { logActivity } from "@/server/activity";
import { ActivityActions } from "@/server/models/ActivityLog";
import { StorageNotConfiguredError, deleteObjects } from "@/server/storage/r2";

const updateSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1, "Folder name is required")
      .max(120, "Folder name is too long")
      .refine((v) => !v.includes("/") && !v.includes("\\"), "Folder name cannot contain slashes")
      .optional(),
    // "root" or null moves the folder to the top level.
    parentId: z.string().nullable().optional(),
  })
  .strict();

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const limited = await enforceRateLimit(req.headers, "admin:folders:patch");
  if (limited) return limited;

  const session = await requireRole("admin");
  if (!session) return noStoreJson({ error: "Forbidden" }, 403);

  const { id } = await params;
  if (!mongoose.isValidObjectId(id)) return noStoreJson({ error: "Invalid id" }, 400);

  const json = await req.json().catch(() => null);
  const parsed = updateSchema.safeParse(json);
  if (!parsed.success) {
    return noStoreJson({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, 400);
  }

  const movingParent = parsed.data.parentId !== undefined;
  if (parsed.data.name === undefined && !movingParent) {
    return noStoreJson({ error: "No fields to update" }, 400);
  }

  await connectToDatabase();

  const folder = await Folder.findById(id);
  if (!folder) return noStoreJson({ error: "Not found" }, 404);

  const oldPath = folder.path;
  const name = parsed.data.name ?? folder.name;

  let parent: any = null;
  if (movingParent) {
    const rawParentId = parsed.data.parentId;
    if (rawParentId && rawParentId !== "root") {
      if (!mongoose.isValidObjectId(rawParentId)) return noStoreJson({ error: "Invalid parent id" }, 400);
      if (String(rawParentId) === String(folder._id)) {
        return noStoreJson({ error: "A folder cannot be moved into itself" }, 400);
      }

      parent = await Folder.findById(rawParentId).lean();
      if (!parent) return noStoreJson({ error: "Parent folder not found" }, 404);

      // Moving a folder under its own descendant would detach the whole subtree.
      const parentAncestors = (parent.ancestors ?? []).map((a: any) => String(a));
      if (parentAncestors.includes(String(folder._id))) {
        return noStoreJson({ error: "A folder cannot be moved into one of its own subfolders" }, 400);
      }
    }
  } else if (folder.parentId) {
    parent = await Folder.findById(folder.parentId).lean();
  }

  const newAncestors: mongoose.Types.ObjectId[] = parent ? [...(parent.ancestors ?? []), parent._id] : [];
  const newPath = buildFolderPath(parent ? parent.path : null, name);

  folder.name = name;
  folder.parentId = parent ? parent._id : null;
  folder.ancestors = newAncestors;
  folder.path = newPath;

  try {
    await folder.save();
  } catch (err) {
    if (isDuplicateKeyError(err)) {
      return noStoreJson({ error: "A folder with that name already exists there" }, 409);
    }
    throw err;
  }

  // Rewrite the cached path/ancestors of everything underneath.
  if (newPath !== oldPath) {
    const descendants = await Folder.find({ ancestors: folder._id }).select("path ancestors").lean();

    if (descendants.length) {
      const ops = descendants.map((d: any) => {
        const idx = (d.ancestors ?? []).findIndex((a: any) => String(a) === String(folder._id));
        const below = idx === -1 ? [] : d.ancestors.slice(idx + 1);

        return {
          updateOne: {
            filter: { _id: d._id },
            update: {
              $set: {
                ancestors: [...newAncestors, folder._id, ...below],
                path: newPath + String(d.path).slice(oldPath.length),
              },
            },
          },
        };
      });

      await Folder.bulkWrite(ops);
    }
  }

  await logActivity({
    action: ActivityActions.FolderUpdate,
    actor: { id: session.user.id, name: session.user.name },
    targetId: id,
    targetType: "folder",
    targetLabel: newPath,
    meta: oldPath === newPath ? undefined : { from: oldPath },
    headers: req.headers,
  });

  return noStoreJson({ folder: serializeFolder(folder.toObject()) });
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const limited = await enforceRateLimit(req.headers, "admin:folders:delete");
  if (limited) return limited;

  const session = await requireRole("admin");
  if (!session) return noStoreJson({ error: "Forbidden" }, 403);

  const { id } = await params;
  if (!mongoose.isValidObjectId(id)) return noStoreJson({ error: "Invalid id" }, 400);

  await connectToDatabase();

  const folder = await Folder.findById(id);
  if (!folder) return noStoreJson({ error: "Not found" }, 404);

  const folderIds = await subtreeFolderIds(folder._id);

  const stored = await Resource.find({ folderId: { $in: folderIds }, kind: ResourceKinds.File })
    .select("objectKey")
    .lean();

  const keys = stored.map((r: any) => r.objectKey).filter(Boolean) as string[];

  // R2 first: if the bucket cleanup fails we keep the database untouched so the
  // admin can retry, rather than orphaning paid-for objects with no way back.
  if (keys.length) {
    try {
      const { failed } = await deleteObjects(keys);
      if (failed.length) {
        return noStoreJson(
          { error: `Cloudflare rejected ${failed.length} file deletion(s). Nothing was deleted.` },
          502
        );
      }
    } catch (err) {
      if (err instanceof StorageNotConfiguredError) {
        return noStoreJson({ error: err.message }, 503);
      }
      throw err;
    }
  }

  const removedFiles = await Resource.deleteMany({ folderId: { $in: folderIds } });
  await Folder.deleteMany({ _id: { $in: folderIds } });

  invalidateResourcesCache();

  await logActivity({
    action: ActivityActions.FolderDelete,
    actor: { id: session.user.id, name: session.user.name },
    targetId: id,
    targetType: "folder",
    targetLabel: folder.path,
    meta: { folders: folderIds.length, files: removedFiles.deletedCount ?? 0 },
    headers: req.headers,
  });

  return noStoreJson({
    success: true,
    deletedFolders: folderIds.length,
    deletedFiles: removedFiles.deletedCount ?? 0,
  });
}
