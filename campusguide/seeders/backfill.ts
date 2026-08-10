import { AccountStatuses, User } from "../src/server/models/User";

/**
 * Accounts created before verification existed have no `status` field. The
 * guards treat a missing status as active, but the admin filters and counts
 * read the field directly — so stamp it once and they line up.
 *
 * Idempotent: after the first run there is nothing left to match.
 */
export async function backfillAccountStatus() {
  const result = await User.updateMany(
    { status: { $exists: false } },
    { $set: { status: AccountStatuses.Active } }
  );

  const changed = result.modifiedCount ?? 0;
  console.log(changed === 0 ? "  every account already has a status" : `  marked ${changed} legacy account(s) active`);

  return changed;
}
