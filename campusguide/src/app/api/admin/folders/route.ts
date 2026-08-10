import mongoose from "mongoose";
import { z } from "zod";
import { connectToDatabase } from "@/server/db";
import { Folder, buildFolderPath } from "@/server/models/Folder";
import { enforceRateLimit } from "@/server/security/rateLimit";
import { requireRole } from "@/server/security/requireRole";
import { noStoreJson } from "@/server/httpCache";
import { isDuplicateKeyError } from "@/server/mongoErrors";
import { serializeFolder } from "@/server/data/drive";
import { logActivity } from "@/server/activity";
import { ActivityActions } from "@/server/models/ActivityLog";

const createSchema = z
  .object({
    // Slashes would make the display path ambiguous.
    name: z
      .string()
      .trim()
      .min(1, "Folder name is required")
      .max(120, "Folder name is too long")
      .refine((v) => !v.includes("/") && !v.includes("\\"), "Folder name cannot contain slashes"),
    parentId: z.string().nullable().optional(),
  })
  .strict();

/** Flat, path-sorted list of every folder — backs the "Move to…" picker. */
export async function GET(req: Request) {
  const limited = await enforceRateLimit(req.headers, "admin:folders:get");
  if (limited) return limited;

  const session = await requireRole("admin");
  if (!session) return noStoreJson({ error: "Forbidden" }, 403);

  await connectToDatabase();
  const folders = await Folder.find({}).sort({ path: 1 }).lean();

  return noStoreJson({ folders: folders.map(serializeFolder) });
}

export async function POST(req: Request) {
  const limited = await enforceRateLimit(req.headers, "admin:folders:post");
  if (limited) return limited;

  const session = await requireRole("admin");
  if (!session) return noStoreJson({ error: "Forbidden" }, 403);

  const json = await req.json().catch(() => null);
  const parsed = createSchema.safeParse(json);
  if (!parsed.success) {
    return noStoreJson({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, 400);
  }

  await connectToDatabase();

  const rawParentId = parsed.data.parentId ?? null;
  let parent: any = null;

  if (rawParentId && rawParentId !== "root") {
    if (!mongoose.isValidObjectId(rawParentId)) return noStoreJson({ error: "Invalid parent id" }, 400);
    parent = await Folder.findById(rawParentId).lean();
    if (!parent) return noStoreJson({ error: "Parent folder not found" }, 404);
  }

  try {
    const created = await Folder.create({
      name: parsed.data.name,
      parentId: parent ? parent._id : null,
      ancestors: parent ? [...(parent.ancestors ?? []), parent._id] : [],
      path: buildFolderPath(parent ? parent.path : null, parsed.data.name),
      createdBy: session.user.id,
    });

    await logActivity({
      action: ActivityActions.FolderCreate,
      actor: { id: session.user.id, name: session.user.name },
      targetId: String(created._id),
      targetType: "folder",
      targetLabel: created.path,
      headers: req.headers,
    });

    return noStoreJson({ folder: serializeFolder(created.toObject()) }, 201);
  } catch (err) {
    if (isDuplicateKeyError(err)) {
      return noStoreJson({ error: "A folder with that name already exists here" }, 409);
    }
    throw err;
  }
}
