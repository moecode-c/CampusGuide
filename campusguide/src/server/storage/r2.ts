import crypto from "node:crypto";
import {
  DeleteObjectsCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { env } from "@/env";

/**
 * Cloudflare R2 over the S3-compatible API.
 *
 * Object keys are `resources/<uuid>/<safe-name>` — deliberately unrelated to the
 * folder tree. Folders live in MongoDB only, so renaming or moving a folder is a
 * metadata update and never has to copy or re-upload anything in R2.
 */

export const MAX_UPLOAD_BYTES = 200 * 1024 * 1024; // 200 MB
const UPLOAD_URL_TTL_SECONDS = 600;

export type R2Config = {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
  publicBaseUrl: string;
};

export class StorageNotConfiguredError extends Error {
  constructor(missing: string[]) {
    super(`Cloudflare R2 is not configured. Missing: ${missing.join(", ")}`);
    this.name = "StorageNotConfiguredError";
  }
}

function readConfig(): R2Config {
  const raw = {
    R2_ACCOUNT_ID: env.R2_ACCOUNT_ID,
    R2_ACCESS_KEY_ID: env.R2_ACCESS_KEY_ID,
    R2_SECRET_ACCESS_KEY: env.R2_SECRET_ACCESS_KEY,
    R2_BUCKET: env.R2_BUCKET,
    R2_PUBLIC_BASE_URL: env.R2_PUBLIC_BASE_URL,
  };

  const missing = Object.entries(raw)
    .filter(([, v]) => !v)
    .map(([k]) => k);

  if (missing.length) throw new StorageNotConfiguredError(missing);

  return {
    accountId: raw.R2_ACCOUNT_ID!,
    accessKeyId: raw.R2_ACCESS_KEY_ID!,
    secretAccessKey: raw.R2_SECRET_ACCESS_KEY!,
    bucket: raw.R2_BUCKET!,
    publicBaseUrl: raw.R2_PUBLIC_BASE_URL!.replace(/\/+$/, ""),
  };
}

export function isStorageConfigured() {
  try {
    readConfig();
    return true;
  } catch {
    return false;
  }
}

type ClientGlobal = typeof globalThis & { __r2Client?: { client: S3Client; accountId: string } };
const globalForR2 = globalThis as ClientGlobal;

function getClient(config: R2Config) {
  // Reused across requests (and across hot reloads in dev) so we don't leak sockets.
  if (globalForR2.__r2Client && globalForR2.__r2Client.accountId === config.accountId) {
    return globalForR2.__r2Client.client;
  }

  const client = new S3Client({
    region: "auto",
    endpoint: `https://${config.accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
  });

  globalForR2.__r2Client = { client, accountId: config.accountId };
  return client;
}

/** Strips anything that would break a URL or let a name escape its key prefix. */
export function sanitizeFileName(name: string) {
  const base = name.split(/[\\/]/).pop() ?? "file";
  const cleaned = base
    .replace(/\p{Cc}/gu, "")
    .replace(/[^a-zA-Z0-9._ -]/g, "_")
    .replace(/ +/g, " ")
    // A leading dot would produce a hidden-looking key such as "<uuid>/.pdf".
    .replace(/^\.+/, "")
    .trim();

  const safe = cleaned.length ? cleaned : "file";
  // Keep the tail: the extension matters more than the start of a long name.
  return safe.length > 120 ? safe.slice(safe.length - 120) : safe;
}

export function buildObjectKey(fileName: string) {
  return `resources/${crypto.randomUUID()}/${sanitizeFileName(fileName)}`;
}

export function publicUrlFor(key: string) {
  const { publicBaseUrl } = readConfig();
  const encoded = key.split("/").map(encodeURIComponent).join("/");
  return `${publicBaseUrl}/${encoded}`;
}

/** Presigned PUT the browser uploads to directly, so files never pass through this server. */
export async function createUploadUrl(params: { key: string; contentType: string }) {
  const config = readConfig();
  const client = getClient(config);

  const uploadUrl = await getSignedUrl(
    client,
    new PutObjectCommand({
      Bucket: config.bucket,
      Key: params.key,
      ContentType: params.contentType,
    }),
    { expiresIn: UPLOAD_URL_TTL_SECONDS }
  );

  return { uploadUrl, expiresIn: UPLOAD_URL_TTL_SECONDS };
}

export type ObjectHead = { size: number; contentType: string | null };

/** Confirms an upload actually landed, and reports its real size (client-declared sizes lie). */
export async function headObject(key: string): Promise<ObjectHead | null> {
  const config = readConfig();
  const client = getClient(config);

  try {
    const res = await client.send(new HeadObjectCommand({ Bucket: config.bucket, Key: key }));
    return { size: Number(res.ContentLength ?? 0), contentType: res.ContentType ?? null };
  } catch (err) {
    const status = (err as { $metadata?: { httpStatusCode?: number } })?.$metadata?.httpStatusCode;
    if (status === 404 || (err as Error)?.name === "NotFound") return null;
    throw err;
  }
}

/**
 * Deletes objects in batches of 1000 (the S3 DeleteObjects cap).
 * Returns the keys R2 refused so callers can decide whether to fail the request.
 */
export async function deleteObjects(keys: string[]): Promise<{ failed: string[] }> {
  const unique = [...new Set(keys.filter(Boolean))];
  if (unique.length === 0) return { failed: [] };

  const config = readConfig();
  const client = getClient(config);
  const failed: string[] = [];

  for (let i = 0; i < unique.length; i += 1000) {
    const batch = unique.slice(i, i + 1000);
    const res = await client.send(
      new DeleteObjectsCommand({
        Bucket: config.bucket,
        Delete: { Objects: batch.map((Key) => ({ Key })), Quiet: true },
      })
    );

    for (const error of res.Errors ?? []) {
      if (error.Key) failed.push(error.Key);
    }
  }

  return { failed };
}

export async function deleteObject(key: string) {
  return deleteObjects([key]);
}
