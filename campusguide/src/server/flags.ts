import { cacheGet, cacheSet, cacheDel } from "@/server/cache/cache";
import { connectToDatabase } from "@/server/db";
import { FeatureFlag } from "@/server/models/FeatureFlag";
import {
  DEFAULT_FLAG_STATE,
  FLAG_CATALOG,
  type FlagKey,
  type FlagMap,
  type FlagState,
} from "@/lib/flags";

/**
 * Flag reads sit on the hot path — every resources request checks one — so they
 * are cached in memory the way account state is. Short enough that flipping a
 * switch takes effect almost immediately even on an instance that didn't serve
 * the write; the admin route clears the key outright, so on a single instance
 * it is instant.
 */
const FLAGS_TTL_MS = Number(process.env.FLAGS_TTL_MS ?? 15_000);
const CACHE_KEY = "flags:all";

function emptyMap(): FlagMap {
  const map = {} as FlagMap;
  for (const meta of FLAG_CATALOG) map[meta.key] = { ...DEFAULT_FLAG_STATE };
  return map;
}

export function invalidateFlags() {
  cacheDel(CACHE_KEY);
}

export async function getFlags(): Promise<FlagMap> {
  const cached = cacheGet<FlagMap>(CACHE_KEY);
  if (cached) return cached;

  const map = emptyMap();

  try {
    await connectToDatabase();
    const rows = await FeatureFlag.find({}).lean();

    for (const row of rows) {
      const key = row.key as FlagKey;
      // Ignore rows for flags that no longer exist in the catalog.
      if (!(key in map)) continue;
      map[key] = {
        enabled: Boolean(row.enabled),
        message: row.message ?? null,
        updatedAt: row.updatedAt ? new Date(row.updatedAt).toISOString() : null,
        updatedBy: row.updatedByName ?? null,
      };
    }
  } catch (err) {
    // A database blip must not lock students out of an area that is actually
    // fine. Fail open — every flag defaults to off.
    console.error("flag read failed; defaulting to unlocked", err);
    return emptyMap();
  }

  cacheSet(CACHE_KEY, map, FLAGS_TTL_MS);
  return map;
}

export async function isLocked(key: FlagKey) {
  const flags = await getFlags();
  return flags[key]?.enabled ?? false;
}

/** The state one flag should present to a student, message included. */
export async function lockState(key: FlagKey): Promise<FlagState> {
  const flags = await getFlags();
  return flags[key] ?? { ...DEFAULT_FLAG_STATE };
}

export async function setFlag(
  key: FlagKey,
  input: { enabled: boolean; message?: string | null; actorId: string; actorName?: string | null }
) {
  await connectToDatabase();

  await FeatureFlag.updateOne(
    { key },
    {
      $set: {
        key,
        enabled: input.enabled,
        message: input.message?.trim() ? input.message.trim() : undefined,
        updatedBy: input.actorId,
        updatedByName: input.actorName ?? undefined,
      },
    },
    { upsert: true }
  );

  invalidateFlags();
}
