import { connectToDatabase } from "@/server/db";
import { Folder } from "@/server/models/Folder";
import { Resource } from "@/server/models/Resource";
import { enforceRateLimit } from "@/server/security/rateLimit";
import { requireRole } from "@/server/security/requireRole";
import { noStoreJson } from "@/server/httpCache";
import {
  getBreadcrumbs,
  listFolderContents,
  resolveFolder,
  serializeFile,
  serializeFolder,
} from "@/server/data/drive";
import { isStorageConfigured } from "@/server/storage/r2";

const SEARCH_LIMIT = 100;

/** Escapes user input before it reaches a `$regex`, so `(` or `*` can't blow up the query. */
function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export async function GET(req: Request) {
  const limited = await enforceRateLimit(req.headers, "admin:drive:get");
  if (limited) return limited;

  const session = await requireRole("admin");
  if (!session) return noStoreJson({ error: "Forbidden" }, 403);

  await connectToDatabase();

  const url = new URL(req.url);
  const q = (url.searchParams.get("q") ?? "").trim().slice(0, 80);

  // Search ignores the current folder and looks at the whole drive, like Drive does.
  if (q) {
    const rx = new RegExp(escapeRegex(q), "i");
    const [folders, files] = await Promise.all([
      Folder.find({ name: rx }).sort({ name: 1 }).limit(SEARCH_LIMIT).lean(),
      Resource.find({ $or: [{ title: rx }, { fileName: rx }, { subject: rx }] })
        .sort({ createdAt: -1 })
        .limit(SEARCH_LIMIT)
        .lean(),
    ]);

    return noStoreJson({
      mode: "search",
      query: q,
      folder: null,
      breadcrumbs: [],
      folders: folders.map(serializeFolder),
      files: files.map(serializeFile),
      storageConfigured: isStorageConfigured(),
    });
  }

  const resolved = await resolveFolder(url.searchParams.get("folderId"));
  if (!resolved.ok) return noStoreJson({ error: "Folder not found" }, 404);

  const folder = resolved.folder;
  const [contents, breadcrumbs] = await Promise.all([
    listFolderContents(folder ? folder._id : null),
    folder ? getBreadcrumbs(folder) : Promise.resolve([]),
  ]);

  return noStoreJson({
    mode: "browse",
    query: "",
    folder: folder ? serializeFolder(folder) : null,
    breadcrumbs,
    folders: contents.folders,
    files: contents.files,
    storageConfigured: isStorageConfigured(),
  });
}
