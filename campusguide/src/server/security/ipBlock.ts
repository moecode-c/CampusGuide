import { cacheGet, cacheSet, cacheDel } from "@/server/cache/cache";
import { connectToDatabase } from "@/server/db";
import { BlockedIp } from "@/server/models/BlockedIp";
import { UNKNOWN_IP } from "@/lib/ipBlocks";

/**
 * Enforcement side of the IP block list.
 *
 * The whole active set is loaded at once and held for a minute. It is a handful
 * of rows, and the alternative — a query keyed on the caller's address — would
 * be a database round trip on literally every request.
 */

const CACHE_KEY = "security:blocked-ips";
const CACHE_TTL_MS = 60_000;

/** Call after any block or unblock so the next request sees it. */
export function invalidateIpBlockCache() {
  cacheDel(CACHE_KEY);
}

async function activeBlockSet(): Promise<Set<string>> {
  const cached = cacheGet<string[]>(CACHE_KEY);
  if (cached) return new Set(cached);

  await connectToDatabase();

  const now = new Date();
  const rows = await BlockedIp.find({
    $or: [{ expiresAt: null }, { expiresAt: { $gt: now } }],
  })
    .select("ip")
    .lean();

  const ips = rows.map((r) => String(r.ip));
  cacheSet(CACHE_KEY, ips, CACHE_TTL_MS);
  return new Set(ips);
}

export async function isIpBlocked(ip: string): Promise<boolean> {
  // Never block the placeholder: with no forwarding header every request looks
  // like this, so treating it as a match would take the whole site down.
  if (!ip || ip === UNKNOWN_IP) return false;

  try {
    const blocked = await activeBlockSet();
    return blocked.has(ip.toLowerCase());
  } catch (err) {
    // Fail open. A database blip must not lock every student out of the site;
    // the worst case is an abusive address gets through for another minute.
    console.error("ip block lookup failed", err);
    return false;
  }
}

/**
 * Returns a 403 for a blocked caller, or null to continue.
 *
 * Deliberately terse and identical for every blocked request: a body that
 * explained the reason or the expiry would tell someone probing the site
 * exactly how the rule works.
 */
export function blockedResponse() {
  return new Response(JSON.stringify({ error: "Forbidden" }), {
    status: 403,
    headers: { "content-type": "application/json" },
  });
}
