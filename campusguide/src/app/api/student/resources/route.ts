import { z } from "zod";
import { connectToDatabase } from "@/server/db";
import { Folder } from "@/server/models/Folder";
import { enforceRateLimit } from "@/server/security/rateLimit";
import { requireSession } from "@/server/security/requireSession";
import { getResourcesCached } from "@/server/data/resources";
import {
  getBreadcrumbs,
  listFolderContents,
  resolveFolder,
  serializeFile,
  serializeFolder,
} from "@/server/data/drive";
import { jsonWithEtag } from "@/server/httpCache";

const querySchema = z.object({
  q: z.string().max(80).optional(),
  folderId: z.string().max(40).optional(),
  subject: z.string().max(80).optional(),
  academicYear: z.coerce.number().int().min(1).max(4).optional(),
  type: z.enum(["video", "pdf", "summary"]).optional(),
});

const SEARCH_LIMIT = 100;

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Read-only view of the resources drive.
 *  - no filters  -> browse one folder (subfolders + files inside it)
 *  - any filter  -> search the whole drive, folder structure ignored
 */
export async function GET(req: Request) {
  const limited = await enforceRateLimit(req.headers, "student:resources:get");
  if (limited) return limited;

  const session = await requireSession();
  if (!session) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "content-type": "application/json" },
    });
  }

  const url = new URL(req.url);
  const parsed = querySchema.safeParse({
    q: url.searchParams.get("q") ?? undefined,
    folderId: url.searchParams.get("folderId") ?? undefined,
    subject: url.searchParams.get("subject") ?? undefined,
    academicYear: url.searchParams.get("academicYear") ?? undefined,
    type: url.searchParams.get("type") ?? undefined,
  });

  if (!parsed.success) {
    return new Response(JSON.stringify({ error: "Invalid query" }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  }

  await connectToDatabase();

  const q = parsed.data.q?.trim().toLowerCase();
  const subject = parsed.data.subject?.trim().toLowerCase();
  const searching = Boolean(q || subject || parsed.data.academicYear || parsed.data.type);

  if (searching) {
    const all = await getResourcesCached();

    const items = all
      .filter((r: any) => {
        if (parsed.data.academicYear && r.academicYear !== parsed.data.academicYear) return false;
        if (parsed.data.type && r.type !== parsed.data.type) return false;
        if (subject && String(r.subject ?? "").toLowerCase() !== subject) return false;
        if (q) {
          const hay = `${r.title ?? ""} ${r.subject ?? ""} ${r.fileName ?? ""}`.toLowerCase();
          if (!hay.includes(q)) return false;
        }
        return true;
      })
      .slice(0, SEARCH_LIMIT)
      .map(serializeFile);

    const folders = q
      ? (await Folder.find({ name: new RegExp(escapeRegex(q), "i") })
          .sort({ name: 1 })
          .limit(SEARCH_LIMIT)
          .lean()).map(serializeFolder)
      : [];

    return jsonWithEtag(
      req,
      { mode: "search", folder: null, breadcrumbs: [], folders, items },
      { cacheControl: "private, max-age=30, stale-while-revalidate=300" }
    );
  }

  const resolved = await resolveFolder(parsed.data.folderId ?? null);
  if (!resolved.ok) {
    return new Response(JSON.stringify({ error: "Folder not found" }), {
      status: 404,
      headers: { "content-type": "application/json" },
    });
  }

  const folder = resolved.folder;
  const [contents, breadcrumbs] = await Promise.all([
    listFolderContents(folder ? folder._id : null),
    folder ? getBreadcrumbs(folder) : Promise.resolve([]),
  ]);

  return jsonWithEtag(
    req,
    {
      mode: "browse",
      folder: folder ? serializeFolder(folder) : null,
      breadcrumbs,
      folders: contents.folders,
      items: contents.files,
    },
    { cacheControl: "private, max-age=30, stale-while-revalidate=300" }
  );
}
