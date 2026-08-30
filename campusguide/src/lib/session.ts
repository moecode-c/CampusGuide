/**
 * How long a sign-in lasts.
 *
 * Two lengths, chosen by the "remember me" box on the sign-in form. The longer
 * one is also the hard ceiling: it is what the session cookie and the JWT are
 * issued for, and the shorter one is enforced inside the token. A cookie can
 * therefore outlive its own token, which is the safe direction — the token is
 * what every guard actually trusts.
 *
 * In `lib` so the form can label the checkbox with the same number the server
 * enforces, rather than the two drifting apart.
 */

/** Ticked: the longest a session may live. */
export const SESSION_REMEMBER_DAYS = 50;

/** Unticked: still generous, because students come back between lectures. */
export const SESSION_DEFAULT_DAYS = 20;

const DAY_MS = 24 * 60 * 60 * 1000;

export function sessionDays(rememberMe: boolean): number {
  return rememberMe ? SESSION_REMEMBER_DAYS : SESSION_DEFAULT_DAYS;
}

/** Absolute moment a session issued now should stop being accepted. */
export function sessionExpiryFrom(rememberMe: boolean, now: number = Date.now()): number {
  return now + sessionDays(rememberMe) * DAY_MS;
}

/** Whether a token's own expiry has passed. Missing means "no extra limit". */
export function isSessionExpired(expiresAt: unknown, now: number = Date.now()): boolean {
  if (typeof expiresAt !== "number" || !Number.isFinite(expiresAt)) return false;
  return now >= expiresAt;
}

/** Seconds, for NextAuth's `session.maxAge`, which is the outer bound. */
export const SESSION_MAX_AGE_SECONDS = SESSION_REMEMBER_DAYS * 24 * 60 * 60;
