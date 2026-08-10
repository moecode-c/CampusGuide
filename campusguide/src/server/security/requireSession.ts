import { getServerSession } from "next-auth";
import { authOptions } from "@/server/auth";
import { AccountStatuses } from "@/server/models/User";
import { getAccountState, touchLastSeen } from "@/server/security/accountStatus";

type Options = {
  /**
   * Skip the active-account requirement. Only for surfaces a pending user is
   * meant to reach — the "send your ID" screen and the auth pages.
   */
  allowAnyStatus?: boolean;
};

/**
 * A signed-in session belonging to an account that is still allowed in.
 *
 * Banned and unverified accounts hold valid JWTs, so the token alone is not
 * enough — the account is re-checked (from a short-lived cache) on every call.
 */
export async function requireSession(options: Options = {}) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return null;

  const state = await getAccountState(session.user.id);
  if (!state) return null;

  if (!options.allowAnyStatus && state.status !== AccountStatuses.Active) return null;

  // Presence is recorded for real users on real requests, not for rejected ones.
  void touchLastSeen(session.user.id);

  return session;
}
