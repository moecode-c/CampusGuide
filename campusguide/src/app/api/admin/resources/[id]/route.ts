import { z } from "zod";
import { connectToDatabase } from "@/server/db";
import { Resource, ResourceTypes } from "@/server/models/Resource";
import { enforceRateLimit } from "@/server/security/rateLimit";
import { requireRole } from "@/server/security/requireRole";
import { invalidateResourcesCache } from "@/server/data/resources";
import { noStoreJson } from "@/server/httpCache";

const updateSchema = z
    .object({
        title: z.string().min(1).max(140).trim().optional(),
        subject: z.string().min(1).max(80).trim().optional(),
        academicYear: z.number().int().min(1).max(4).optional(),
        type: z.enum([ResourceTypes.Video, ResourceTypes.Pdf, ResourceTypes.Summary]).optional(),
        externalUrl: z.string().min(3).optional(),
    })
    .strict();

export async function DELETE(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const limited = await enforceRateLimit(req.headers, "admin:resources:delete");
    if (limited) return limited;

    const session = await requireRole("admin");
    if (!session) {
        return new Response(JSON.stringify({ error: "Forbidden" }), {
            status: 403,
            headers: { "content-type": "application/json" },
        });
    }

    const { id } = await params;
    if (!id) {
        return new Response(JSON.stringify({ error: "Missing ID" }), {
            status: 400,
            headers: { "content-type": "application/json" },
        });
    }

    await connectToDatabase();
    const deleted = await Resource.findByIdAndDelete(id);

    if (!deleted) {
        return new Response(JSON.stringify({ error: "Not found" }), {
            status: 404,
            headers: { "content-type": "application/json" },
        });
    }

    invalidateResourcesCache();

    return noStoreJson({ success: true }, 200);
}

export async function PATCH(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const limited = await enforceRateLimit(req.headers, "admin:resources:patch");
    if (limited) return limited;

    const session = await requireRole("admin");
    if (!session) {
        return new Response(JSON.stringify({ error: "Forbidden" }), {
            status: 403,
            headers: { "content-type": "application/json" },
        });
    }

    const { id } = await params;
    const json = await req.json().catch(() => null);
    const parsed = updateSchema.safeParse(json);

    if (!parsed.success) {
        return new Response(JSON.stringify({ error: "Invalid input" }), {
            status: 400,
            headers: { "content-type": "application/json" },
        });
    }

    await connectToDatabase();
    const updated = await Resource.findByIdAndUpdate(
        id,
        { $set: parsed.data },
        { new: true }
    );

    if (!updated) {
        return new Response(JSON.stringify({ error: "Not found" }), {
            status: 404,
            headers: { "content-type": "application/json" },
        });
    }

    invalidateResourcesCache();

    return noStoreJson({ id: String(updated._id) }, 200);
}
