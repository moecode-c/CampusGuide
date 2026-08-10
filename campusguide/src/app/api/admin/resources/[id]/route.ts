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
import { noStoreJson } from "@/server/httpCache";
import { normalizeExternalUrl } from "@/lib/url";
import {
    MAX_UPLOAD_BYTES,
    StorageNotConfiguredError,
    deleteObject,
    headObject,
    publicUrlFor,
    sanitizeFileName,
} from "@/server/storage/r2";

const updateSchema = z
    .object({
        title: z.string().min(1).max(140).trim().optional(),
        // null / "root" moves the resource to the drive root.
        folderId: z.string().nullable().optional(),
        subject: z.string().min(1).max(80).trim().optional(),
        academicYear: z.number().int().min(1).max(4).optional(),
        type: z.enum([ResourceTypes.Video, ResourceTypes.Pdf, ResourceTypes.Summary]).optional(),
        externalUrl: z.string().min(3).optional(),
        // Set to swap in a freshly uploaded object; the previous one is removed from R2.
        objectKey: z.string().min(1).max(400).optional(),
    })
    .strict();

async function resolveFolderId(rawId: string | null | undefined) {
    if (!rawId || rawId === "root") return { ok: true as const, id: null };
    if (!mongoose.isValidObjectId(rawId)) return { ok: false as const, error: "Invalid folder id" };

    const folder = await Folder.findById(rawId).select("_id").lean();
    if (!folder) return { ok: false as const, error: "Folder not found" };

    return { ok: true as const, id: folder._id as mongoose.Types.ObjectId };
}

export async function DELETE(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const limited = await enforceRateLimit(req.headers, "admin:resources:delete");
    if (limited) return limited;

    const session = await requireRole("admin");
    if (!session) return noStoreJson({ error: "Forbidden" }, 403);

    const { id } = await params;
    // findByIdAndDelete throws a CastError (500) on a malformed id.
    if (!mongoose.isValidObjectId(id)) return noStoreJson({ error: "Invalid id" }, 400);

    await connectToDatabase();
    const resource = await Resource.findById(id);
    if (!resource) return noStoreJson({ error: "Not found" }, 404);

    // Purge the object before the row: a failed R2 delete leaves the resource in
    // place so it can be retried, instead of stranding a file nobody can reach.
    if (resource.kind === ResourceKinds.File && resource.objectKey) {
        try {
            const { failed } = await deleteObject(resource.objectKey);
            if (failed.length) {
                return noStoreJson({ error: "Cloudflare rejected the file deletion. Nothing was deleted." }, 502);
            }
        } catch (err) {
            if (err instanceof StorageNotConfiguredError) return noStoreJson({ error: err.message }, 503);
            throw err;
        }
    }

    const deletedTitle = resource.title;
    await resource.deleteOne();

    invalidateResourcesCache();
    await logActivity({
        action: ActivityActions.ResourceDelete,
        actor: { id: session.user.id, name: session.user.name },
        targetId: id,
        targetType: "resource",
        targetLabel: deletedTitle,
        headers: req.headers,
    });

    return noStoreJson({ success: true }, 200);
}

export async function PATCH(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const limited = await enforceRateLimit(req.headers, "admin:resources:patch");
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

    if (Object.keys(parsed.data).length === 0) {
        return noStoreJson({ error: "No fields to update" }, 400);
    }

    await connectToDatabase();

    const resource = await Resource.findById(id);
    if (!resource) return noStoreJson({ error: "Not found" }, 404);

    if (parsed.data.title !== undefined) resource.title = parsed.data.title;
    if (parsed.data.subject !== undefined) resource.subject = parsed.data.subject;
    if (parsed.data.academicYear !== undefined) resource.academicYear = parsed.data.academicYear;
    if (parsed.data.type !== undefined) resource.type = parsed.data.type;

    if (parsed.data.folderId !== undefined) {
        const folder = await resolveFolderId(parsed.data.folderId);
        if (!folder.ok) return noStoreJson({ error: folder.error }, 400);
        resource.folderId = folder.id;
    }

    if (parsed.data.externalUrl !== undefined) {
        if (resource.kind === ResourceKinds.File) {
            return noStoreJson({ error: "This resource is an uploaded file. Replace the file instead." }, 400);
        }

        const normalized = normalizeExternalUrl(parsed.data.externalUrl);
        if (!normalized) return noStoreJson({ error: "Enter a valid http(s) link" }, 400);
        resource.externalUrl = normalized;
    }

    // Replacing the file: verify the new object, point the row at it, then drop the old one.
    const previousKey =
        parsed.data.objectKey && parsed.data.objectKey !== resource.objectKey ? resource.objectKey : null;

    if (parsed.data.objectKey && parsed.data.objectKey !== resource.objectKey) {
        const objectKey = parsed.data.objectKey;

        let head;
        try {
            head = await headObject(objectKey);
        } catch (err) {
            if (err instanceof StorageNotConfiguredError) return noStoreJson({ error: err.message }, 503);
            throw err;
        }

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

        resource.kind = ResourceKinds.File;
        resource.objectKey = objectKey;
        resource.fileUrl = publicUrlFor(objectKey);
        resource.fileName = fileName;
        resource.fileSize = head.size;
        resource.mimeType = head.contentType ?? undefined;
        // A link that gained a file is now a file.
        resource.externalUrl = undefined;
        if (!resource.title) resource.title = fileName;
    }

    await resource.save();

    // Only after the row points at the new object — otherwise a failure here
    // would leave the resource referencing something already gone.
    let staleObjectWarning: string | undefined;
    if (previousKey) {
        try {
            const { failed } = await deleteObject(previousKey);
            if (failed.length) staleObjectWarning = "The previous file could not be removed from Cloudflare.";
        } catch {
            staleObjectWarning = "The previous file could not be removed from Cloudflare.";
        }
    }

    invalidateResourcesCache();

    await logActivity({
        action: previousKey ? ActivityActions.ResourceReplace : ActivityActions.ResourceUpdate,
        actor: { id: session.user.id, name: session.user.name },
        targetId: id,
        targetType: "resource",
        targetLabel: resource.title,
        headers: req.headers,
    });

    return noStoreJson({
        id: String(resource._id),
        resource: serializeFile(resource.toObject()),
        ...(staleObjectWarning ? { warning: staleObjectWarning } : {}),
    });
}
