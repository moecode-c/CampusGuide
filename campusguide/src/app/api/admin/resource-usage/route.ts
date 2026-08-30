import { connectToDatabase } from "@/server/db";
import { Folder } from "@/server/models/Folder";
import { Resource } from "@/server/models/Resource";
import { enforceRateLimit } from "@/server/security/rateLimit";
import { requireRole } from "@/server/security/requireRole";
import { jsonWithEtag } from "@/server/httpCache";
import { cacheGet, cacheSet } from "@/server/cache/cache";
import type { ResourceUsage, UsageGroup, UsageRow } from "@/lib/usage";

/**
 * What students actually open.
 *
 * Every panel on the usage page comes from this one route: six aggregations
 * against a collection of a few hundred documents, run together and held for a
 * minute. One admin refreshing a dashboard should not fan out to Atlas on every
 * paint — the pool is capped at 5 and these numbers do not need to be
 * second-fresh.
 */

const CACHE_KEY = "admin:resource-usage";
const CACHE_TTL_MS = 60_000;

const ROW_FIELDS = "title subject academicYear type kind downloadCount lastDownloadedAt createdAt";

type LeanRow = {
  _id: unknown;
  title?: string | null;
  subject?: string | null;
  academicYear?: number | null;
  type?: string | null;
  kind?: string | null;
  downloadCount?: number | null;
  lastDownloadedAt?: Date | null;
  createdAt?: Date | null;
};

function toRow(doc: LeanRow): UsageRow {
  return {
    id: String(doc._id),
    title: doc.title ?? "Untitled",
    subject: doc.subject ?? null,
    academicYear: doc.academicYear ?? null,
    type: doc.type ?? null,
    kind: doc.kind === "file" ? "file" : "link",
    downloadCount: doc.downloadCount ?? 0,
    lastDownloadedAt: doc.lastDownloadedAt ? doc.lastDownloadedAt.toISOString() : null,
    createdAt: doc.createdAt ? doc.createdAt.toISOString() : null,
  };
}

/** Files predating the counter have no `downloadCount` at all, so treat missing as zero. */
const COUNT = { $ifNull: ["$downloadCount", 0] };

function toGroups(rows: Array<{ _id: unknown; files: number; downloads: number }>): UsageGroup[] {
  return rows.map((r) => ({
    key: r._id === null || r._id === undefined || r._id === "" ? null : String(r._id),
    files: r.files,
    downloads: r.downloads,
  }));
}

type FolderLike = { _id: unknown; name?: string | null; ancestors?: unknown[] | null };

/**
 * Groups resource counts by the top-level folder they live under.
 *
 * The drive is organised as term folders with lecture folders inside, so a
 * per-folder breakdown would be 94 rows of noise. Rolling each folder up to
 * `ancestors[0]` — or itself, when it is already top level — gives the handful
 * of buckets that actually mean something.
 */
function rollUpToTopFolder(
  rows: Array<{ _id: unknown; files: number; downloads: number }>,
  folders: FolderLike[]
): UsageGroup[] {
  const byId = new Map(folders.map((f) => [String(f._id), f]));

  const totals = new Map<string | null, { files: number; downloads: number }>();

  for (const row of rows) {
    // A resource sitting at the drive root has no folder at all.
    const folder = row._id ? byId.get(String(row._id)) : undefined;

    let key: string | null = null;
    if (folder) {
      const rootId = folder.ancestors?.[0];
      const root = rootId ? byId.get(String(rootId)) : folder;
      key = root?.name ?? folder.name ?? null;
    }

    const bucket = totals.get(key) ?? { files: 0, downloads: 0 };
    bucket.files += row.files;
    bucket.downloads += row.downloads;
    totals.set(key, bucket);
  }

  return [...totals.entries()]
    .map(([key, v]) => ({ key, ...v }))
    .sort((a, b) => b.downloads - a.downloads || b.files - a.files);
}

export async function GET(req: Request) {
  const limited = await enforceRateLimit(req.headers, "admin:resource-usage");
  if (limited) return limited;

  const session = await requireRole("admin");
  if (!session) {
    return new Response(JSON.stringify({ error: "Forbidden" }), {
      status: 403,
      headers: { "content-type": "application/json" },
    });
  }

  const cached = cacheGet<ResourceUsage>(CACHE_KEY);
  if (cached) return jsonWithEtag(req, cached);

  await connectToDatabase();

  const neverFilter = { $or: [{ downloadCount: { $lte: 0 } }, { downloadCount: { $exists: false } }] };

  const [totalsAgg, top, neverOpened, recent, byFolderAgg, byYearAgg, firstRecorded, folders] =
    await Promise.all([
      Resource.aggregate<{ files: number; downloads: number; opened: number }>([
        {
          $group: {
            _id: null,
            files: { $sum: 1 },
            downloads: { $sum: COUNT },
            opened: { $sum: { $cond: [{ $gt: [COUNT, 0] }, 1, 0] } },
          },
        },
      ]),

      Resource.find({ downloadCount: { $gt: 0 } })
        .select(ROW_FIELDS)
        .sort({ downloadCount: -1 })
        .limit(20)
        .lean(),

      // Oldest first: something added last week has not had its chance yet, but
      // a file that has sat there since term one and never been opened has.
      Resource.find(neverFilter).select(ROW_FIELDS).sort({ createdAt: 1 }).limit(20).lean(),

      Resource.find({ lastDownloadedAt: { $ne: null } })
        .select(ROW_FIELDS)
        .sort({ lastDownloadedAt: -1 })
        .limit(10)
        .lean(),

      Resource.aggregate<{ _id: unknown; files: number; downloads: number }>([
        { $group: { _id: "$folderId", files: { $sum: 1 }, downloads: { $sum: COUNT } } },
      ]),

      Resource.aggregate<{ _id: unknown; files: number; downloads: number }>([
        { $group: { _id: "$academicYear", files: { $sum: 1 }, downloads: { $sum: COUNT } } },
        { $sort: { _id: 1 } },
      ]),

      Resource.find({ lastDownloadedAt: { $ne: null } })
        .select("lastDownloadedAt")
        .sort({ lastDownloadedAt: 1 })
        .limit(1)
        .lean(),

      // Under a hundred folders, so rolling the tree up in JS beats a $lookup
      // plus a $graphLookup for the ancestor chain.
      Folder.find({}).select("name ancestors").lean(),
    ]);

  const totals = totalsAgg[0] ?? { files: 0, downloads: 0, opened: 0 };

  const payload: ResourceUsage = {
    totals: {
      files: totals.files,
      downloads: totals.downloads,
      opened: totals.opened,
      neverOpened: Math.max(0, totals.files - totals.opened),
    },
    top: (top as LeanRow[]).map(toRow),
    neverOpened: (neverOpened as LeanRow[]).map(toRow),
    recent: (recent as LeanRow[]).map(toRow),
    byFolder: rollUpToTopFolder(byFolderAgg, folders as FolderLike[]),
    byYear: toGroups(byYearAgg),
    firstRecordedAt: firstRecorded[0]?.lastDownloadedAt
      ? new Date(firstRecorded[0].lastDownloadedAt as Date).toISOString()
      : null,
  };

  cacheSet(CACHE_KEY, payload, CACHE_TTL_MS);

  return jsonWithEtag(req, payload);
}
