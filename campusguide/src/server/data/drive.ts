import mongoose from "mongoose";
import { connectToDatabase } from "@/server/db";
import { Folder } from "@/server/models/Folder";
import { Resource } from "@/server/models/Resource";

/**
 * Read helpers shared by the admin and student drive endpoints, so both sides
 * always agree on what a folder listing looks like.
 */

export type SerializedFolder = {
  id: string;
  name: string;
  path: string;
  parentId: string | null;
  createdAt: string | null;
};

export type SerializedFile = {
  id: string;
  kind: "file" | "link";
  title: string;
  folderId: string | null;
  fileName: string | null;
  fileUrl: string | null;
  fileSize: number | null;
  mimeType: string | null;
  externalUrl: string | null;
  subject: string | null;
  academicYear: number | null;
  type: "video" | "pdf" | "summary" | null;
  createdAt: string | null;
};

function toIso(value: unknown) {
  return value instanceof Date ? value.toISOString() : null;
}

export function serializeFolder(doc: any): SerializedFolder {
  return {
    id: String(doc._id),
    name: doc.name,
    path: doc.path,
    parentId: doc.parentId ? String(doc.parentId) : null,
    createdAt: toIso(doc.createdAt),
  };
}

export function serializeFile(doc: any): SerializedFile {
  return {
    id: String(doc._id),
    kind: doc.kind === "file" ? "file" : "link",
    title: doc.title,
    folderId: doc.folderId ? String(doc.folderId) : null,
    fileName: doc.fileName ?? null,
    fileUrl: doc.fileUrl ?? null,
    fileSize: typeof doc.fileSize === "number" ? doc.fileSize : null,
    mimeType: doc.mimeType ?? null,
    externalUrl: doc.externalUrl ?? null,
    subject: doc.subject ?? null,
    academicYear: typeof doc.academicYear === "number" ? doc.academicYear : null,
    type: doc.type ?? null,
    createdAt: toIso(doc.createdAt),
  };
}

/** Resolves a folder id from a query string. Returns `undefined` when the id is unusable. */
export async function resolveFolder(rawId: string | null) {
  if (!rawId || rawId === "root") return { folder: null as any, ok: true as const };
  if (!mongoose.isValidObjectId(rawId)) return { folder: null as any, ok: false as const };

  const folder = await Folder.findById(rawId).lean();
  if (!folder) return { folder: null as any, ok: false as const };

  return { folder, ok: true as const };
}

/** Root-first trail of `{ id, name }` for the folder header, excluding the folder itself. */
export async function getBreadcrumbs(folder: any): Promise<{ id: string; name: string }[]> {
  const ancestorIds: mongoose.Types.ObjectId[] = folder?.ancestors ?? [];
  if (!ancestorIds.length) return [];

  const ancestors = await Folder.find({ _id: { $in: ancestorIds } })
    .select("name")
    .lean();

  const byId = new Map(ancestors.map((a: any) => [String(a._id), a.name as string]));

  return ancestorIds
    .map((id) => ({ id: String(id), name: byId.get(String(id)) ?? "…" }))
    .filter((c) => byId.has(c.id));
}

/** One level of the tree: subfolders first, then the files sitting directly in it. */
export async function listFolderContents(folderId: mongoose.Types.ObjectId | null) {
  await connectToDatabase();

  const [folders, files] = await Promise.all([
    Folder.find({ parentId: folderId }).sort({ name: 1 }).lean(),
    Resource.find({ folderId }).sort({ createdAt: -1 }).lean(),
  ]);

  return {
    folders: folders.map(serializeFolder),
    files: files.map(serializeFile),
  };
}

/** The folder plus every folder beneath it. Used by recursive delete and move checks. */
export async function subtreeFolderIds(rootId: mongoose.Types.ObjectId) {
  const descendants = await Folder.find({ ancestors: rootId }).select("_id").lean();
  return [rootId, ...descendants.map((d: any) => d._id as mongoose.Types.ObjectId)];
}

/**
 * Maps every folder to the course it belongs to.
 *
 * The drive is `term / course / whatever`, so the course is the folder sitting
 * directly under a top-level term folder. A file in
 * `1st_term_freshman/Physics/past_exams` belongs to Physics; a file directly in
 * `1st_term_freshman/Physics` belongs to Physics too.
 *
 * Derived from the tree rather than stored on each resource: `subject` exists on
 * the model but is unset on all 426 files, so a filter built on it would list
 * one option called "no subject" and be useless. This needs no data entry and is
 * right the moment a folder is renamed.
 */
export type CourseIndex = {
  /** folder id -> course name */
  byFolder: Map<string, string>;
  /** every distinct course, sorted for a filter dropdown */
  courses: string[];
};

type FolderLike = { _id: unknown; name?: string | null; ancestors?: unknown[] | null };

export function buildCourseIndex(folders: FolderLike[]): CourseIndex {
  const byId = new Map(folders.map((f) => [String(f._id), f]));
  const byFolder = new Map<string, string>();

  for (const folder of folders) {
    const ancestors = folder.ancestors ?? [];

    // No ancestors: this *is* a term folder, and a term is not a course.
    if (ancestors.length === 0) continue;

    // One ancestor (the term): the folder itself is the course.
    // More: the course is the first folder below the term.
    const courseFolder = ancestors.length === 1 ? folder : byId.get(String(ancestors[1]));

    const name = courseFolder?.name;
    if (name) byFolder.set(String(folder._id), name);
  }

  return {
    byFolder,
    courses: [...new Set(byFolder.values())].sort((a, b) => a.localeCompare(b)),
  };
}

/** The course a file belongs to, or null when it sits loose at the drive root. */
export function courseForFolder(index: CourseIndex, folderId: unknown): string | null {
  if (!folderId) return null;
  return index.byFolder.get(String(folderId)) ?? null;
}
