/**
 * Bulk-imports a local folder tree into the resources drive.
 *
 *   npm run import:drive -- --dir "C:\Myfiles\MIU File Storage"
 *   npm run import:drive -- --dir "..." --dry
 *
 * Mirrors the directory structure as Folder records, uploads every file to R2,
 * and creates the matching Resource records — the same end state as uploading
 * each file through the admin panel, without doing it 431 times by hand.
 *
 * Safe to re-run. A file already present in the drive (same folder, same name,
 * same byte size) is skipped, so this doubles as the "add the new files I just
 * dropped in" tool. Nothing is ever overwritten or deleted.
 */
import path from "node:path";
import fs from "node:fs";
import crypto from "node:crypto";
import dotenv from "dotenv";
import mongoose from "mongoose";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

import { ensureSrvDns } from "../src/server/dns";
import { Folder, buildFolderPath } from "../src/server/models/Folder";
import { Resource, ResourceKinds } from "../src/server/models/Resource";
import { User } from "../src/server/models/User";
import { Roles } from "../src/server/roles";
import { buildObjectKey, publicUrlFor } from "../src/server/storage/r2";
import { S3Client, PutObjectCommand, HeadObjectCommand } from "@aws-sdk/client-s3";

function arg(name: string, fallback?: string) {
  const i = process.argv.findIndex((a) => a === name || a.startsWith(`${name}=`));
  if (i === -1) return fallback;
  const raw = process.argv[i];
  return raw.includes("=") ? raw.split("=").slice(1).join("=") : process.argv[i + 1];
}

const DRY = process.argv.includes("--dry");
const ROOT = arg("--dir");

/** Extensions the drive knows how to present, mapped to a content type. */
const MIME: Record<string, string> = {
  ".pdf": "application/pdf",
  ".ppt": "application/vnd.ms-powerpoint",
  ".pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  ".ppsx": "application/vnd.openxmlformats-officedocument.presentationml.slideshow",
  ".doc": "application/msword",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".xls": "application/vnd.ms-excel",
  ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ".zip": "application/zip",
  ".csv": "text/csv",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".txt": "text/plain",
  ".cpp": "text/plain",
  ".h": "text/plain",
};

/**
 * Which academic year a file belongs to, taken from its top-level folder.
 *
 * This is what the drive's "Academic year" filter reads. Left unset, every
 * resource is invisible to that filter — picking "Year 1" returns nothing at
 * all, which is exactly what it did before this existed.
 *
 * Electives deliberately get no year: they are open to any year, and pinning
 * them to one would hide them from everybody else.
 */
function academicYearFor(topFolder: string | undefined): number | undefined {
  if (!topFolder) return undefined;
  const f = topFolder.toLowerCase();
  if (f.includes("freshman")) return 1;
  if (f.includes("sophomore")) return 2;
  if (f.includes("junior")) return 3;
  if (f.includes("senior")) return 4;
  return undefined;
}

/** Maps the drive's "type" facet, which drives the icons and the type filter. */
function resourceType(ext: string) {
  if (ext === ".pdf") return "pdf" as const;
  if ([".ppt", ".pptx", ".ppsx"].includes(ext)) return "summary" as const;
  return undefined;
}

type Walked = { abs: string; relDir: string[]; name: string; size: number };

function walk(dir: string, rel: string[] = [], out: Walked[] = []): Walked[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const abs = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(abs, [...rel, entry.name], out);
    // Hidden/system leftovers are never content.
    else if (!entry.name.startsWith(".")) {
      out.push({ abs, relDir: rel, name: entry.name, size: fs.statSync(abs).size });
    }
  }
  return out;
}

async function main() {
  if (!ROOT) throw new Error('Pass the folder: --dir "C:\\Myfiles\\MIU File Storage"');
  if (!fs.existsSync(ROOT)) throw new Error(`No such folder: ${ROOT}`);

  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("MONGODB_URI is not set.");
  ensureSrvDns(uri);
  await mongoose.connect(uri, { dbName: "campusguide", serverSelectionTimeoutMS: 30_000 });

  // Everything is attributed to an admin, the same as a panel upload.
  const admin = await User.findOne({ role: Roles.Admin }).select("_id name").lean();
  if (!admin) throw new Error("No admin account exists. Create one first.");

  const s3 = new S3Client({
    region: "auto",
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID!,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
    },
  });
  const bucket = process.env.R2_BUCKET!;

  const files = walk(ROOT);
  const totalBytes = files.reduce((s, f) => s + f.size, 0);
  console.log(`${files.length} files, ${(totalBytes / 1048576).toFixed(1)} MB`);
  console.log(DRY ? "DRY RUN — nothing will be written\n" : "");

  // Create the folder tree first, so every file has somewhere to land.
  const folderIds = new Map<string, mongoose.Types.ObjectId | null>([["", null]]);
  const folderPaths = new Map<string, string | null>([["", null]]);

  // Every ancestor, not just the folders that directly contain a file. Taking
  // only the leaf directories leaves gaps: a folder that holds nothing but
  // subfolders is never created, and its children then fall back to parentId
  // null and pile up at the root of the drive.
  const dirSet = new Set<string>();
  for (const f of files) {
    for (let i = 1; i <= f.relDir.length; i++) {
      dirSet.add(f.relDir.slice(0, i).join("/"));
    }
  }
  // Shallowest first, so a parent always exists before its child is created.
  const allDirs = [...dirSet].sort(
    (a, b) => a.split("/").length - b.split("/").length || a.localeCompare(b)
  );

  let foldersMade = 0;
  for (const dirKey of allDirs) {
    const parts = dirKey.split("/");
    const name = parts[parts.length - 1];
    const parentKey = parts.slice(0, -1).join("");
    const parentKeyFull = parts.slice(0, -1).join("/");
    const parentId = folderIds.get(parentKeyFull) ?? null;
    const parentPath = folderPaths.get(parentKeyFull) ?? null;

    if (DRY) {
      folderIds.set(dirKey, null);
      folderPaths.set(dirKey, buildFolderPath(parentPath, name));
      continue;
    }

    let doc = await Folder.findOne({ parentId, name });
    if (!doc) {
      const ancestors = parentId
        ? [...((await Folder.findById(parentId).select("ancestors").lean())?.ancestors ?? []), parentId]
        : [];
      doc = await Folder.create({
        name,
        parentId,
        ancestors,
        path: buildFolderPath(parentPath, name),
        createdBy: admin._id,
      });
      foldersMade++;
    }
    folderIds.set(dirKey, doc._id as mongoose.Types.ObjectId);
    folderPaths.set(dirKey, doc.path);
    void parentKey;
  }

  console.log(`folders: ${allDirs.length} in tree, ${foldersMade} newly created\n`);

  let uploaded = 0, skipped = 0, failed = 0, bytes = 0;

  for (const [i, f] of files.entries()) {
    const dirKey = f.relDir.join("/");
    const folderId = folderIds.get(dirKey) ?? null;
    const label = `${dirKey}/${f.name}`.replace(/^\//, "");

    // Resume support: same folder, same name, same size means it is already in.
    if (!DRY) {
      const existing = await Resource.findOne({
        folderId,
        fileName: f.name,
        fileSize: f.size,
        kind: ResourceKinds.File,
      }).select("_id").lean();
      if (existing) { skipped++; continue; }
    }

    const ext = path.extname(f.name).toLowerCase();
    const contentType = MIME[ext] ?? "application/octet-stream";
    const key = buildObjectKey(f.name);

    if (DRY) {
      if (i < 5) console.log(`  would upload ${label}\n     -> ${key}`);
      uploaded++; bytes += f.size;
      continue;
    }

    try {
      await s3.send(new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: fs.createReadStream(f.abs),
        ContentLength: f.size,
        ContentType: contentType,
      }));

      // Verify it actually landed before writing a row that promises it exists.
      const head = await s3.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
      if (Number(head.ContentLength) !== f.size) {
        throw new Error(`size mismatch: sent ${f.size}, stored ${head.ContentLength}`);
      }

      await Resource.create({
        kind: ResourceKinds.File,
        title: path.basename(f.name, ext),
        folderId,
        objectKey: key,
        fileUrl: publicUrlFor(key),
        fileName: f.name,
        fileSize: f.size,
        mimeType: contentType,
        type: resourceType(ext),
        academicYear: academicYearFor(f.relDir[0]),
        createdBy: admin._id,
      });

      uploaded++; bytes += f.size;
      if (uploaded % 25 === 0 || uploaded === 1) {
        console.log(`  ${uploaded}/${files.length}  ${(bytes / 1048576).toFixed(0)} MB  ${label.slice(0, 60)}`);
      }
    } catch (err) {
      failed++;
      console.error(`  FAILED ${label}: ${(err as Error).message}`);
    }
  }

  console.log(`\nuploaded ${uploaded}, skipped ${skipped} (already present), failed ${failed}`);
  console.log(`transferred ${(bytes / 1048576).toFixed(1)} MB`);
  await mongoose.disconnect();
}

main().catch((err) => { console.error(err); process.exitCode = 1; });
void crypto;
