import { cacheGet, cacheSet, cacheDel } from "@/server/cache/cache";
import { connectToDatabase } from "@/server/db";
import { AccountStatuses, User, type AccountStatus } from "@/server/models/User";
import type { Role } from "@/server/roles";

/**
 * Authoritative account state, read from the database rather than the JWT.
 *
 * A session token is stateless and lives for weeks, so it can't tell us whether
 * someone was banned thirty seconds ago. Every guarded request re-reads the
 * account, cached briefly so the cost is a memory hit rather than a query.
 */

export type AccountState = {
  id: string;
  status: AccountStatus;
  role: Role;
  name: string;
  miuId: string | null;
};

// Short enough that a ban takes effect almost immediately, long enough that a
// burst of requests from one user doesn't hammer the users collection. Admin
// actions clear the entry outright, so this only bounds out-of-band changes
// (someone editing the database directly, or a second server instance).
// Overridable so the API tests don't have to sleep out a 30-second window.
const STATE_TTL_MS = Number(process.env.ACCOUNT_STATE_TTL_MS ?? 30_000);
const SEEN_TTL_MS = 60_000;

const stateKey = (userId: string) => `user:state:${userId}`;
const seenKey = (userId: string) => `user:seen:${userId}`;

/** Call after any write that changes status or role, so the next request sees it. */
export function invalidateAccountState(userId: string) {
  cacheDel(stateKey(userId));
}

export async function getAccountState(userId: string): Promise<AccountState | null> {
  const cached = cacheGet<AccountState | "missing">(stateKey(userId));
  if (cached) return cached === "missing" ? null : cached;

  await connectToDatabase();
  const user = await User.findById(userId).select("status role name miuId").lean();

  if (!user) {
    // Cache the negative too — a deleted account shouldn't cause a query per request.
    cacheSet(stateKey(userId), "missing", STATE_TTL_MS);
    return null;
  }

  const state: AccountState = {
    id: String(user._id),
    // Accounts created before verification existed have no status; treat them as
    // established users rather than locking everyone out on deploy.
    status: (user.status as AccountStatus) ?? AccountStatuses.Active,
    role: user.role as Role,
    name: user.name,
    miuId: user.miuId ?? null,
  };

  cacheSet(stateKey(userId), state, STATE_TTL_MS);
  return state;
}

/**
 * Stamps `lastSeenAt`, throttled to once a minute per user. This is what the
 * DAU/WAU/MAU figures are computed from.
 */
export async function touchLastSeen(userId: string) {
  if (cacheGet<boolean>(seenKey(userId))) return;
  cacheSet(seenKey(userId), true, SEEN_TTL_MS);

  try {
    await User.updateOne({ _id: userId }, { $set: { lastSeenAt: new Date() } });
  } catch (err) {
    // Presence tracking is not worth failing a request over.
    console.error("lastSeenAt update failed", err);
  }
}
