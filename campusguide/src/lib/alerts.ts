/**
 * Suspicious-activity vocabulary, shared by the detector and the admin UI.
 *
 * Kept in `lib` so the dashboard can render alerts without importing mongoose.
 */

export const AlertTypes = {
  /** Repeated wrong passwords against one account, or from one address. */
  BruteForce: "auth.bruteforce",
  /** Someone is still trying to sign in to an account that was banned. */
  BannedAttempt: "auth.banned_attempt",
  /** Sign-in attempts against accounts that do not exist — address harvesting. */
  UnknownAccounts: "auth.unknown_accounts",
  /** One account signing in from many different addresses — shared credentials. */
  SharedAccount: "auth.shared_account",
  /** Sustained 429s: scraping, or a script hammering an endpoint. */
  RateAbuse: "abuse.rate_limit",
  /** A burst of deletions by one actor. */
  MassDeletion: "abuse.mass_deletion",
} as const;

export type AlertType = (typeof AlertTypes)[keyof typeof AlertTypes];

export const AlertSeverities = {
  Low: "low",
  Medium: "medium",
  High: "high",
} as const;

export type AlertSeverity = (typeof AlertSeverities)[keyof typeof AlertSeverities];

export const SEVERITY_TONES: Record<AlertSeverity, "success" | "warning" | "risk"> = {
  [AlertSeverities.Low]: "success",
  [AlertSeverities.Medium]: "warning",
  [AlertSeverities.High]: "risk",
};

export const ALERT_LABELS: Record<AlertType, string> = {
  [AlertTypes.BruteForce]: "Repeated failed sign-ins",
  [AlertTypes.BannedAttempt]: "Banned account still trying to sign in",
  [AlertTypes.UnknownAccounts]: "Sign-in attempts on accounts that don't exist",
  [AlertTypes.SharedAccount]: "One account used from many addresses",
  [AlertTypes.RateAbuse]: "Rate limit repeatedly hit",
  [AlertTypes.MassDeletion]: "Burst of deletions",
};

/**
 * Detection thresholds, in one place so they can be tuned without hunting
 * through the detector. Each is "N events inside a rolling window".
 */
export const AlertRules = {
  [AlertTypes.BruteForce]: { count: 5, windowMinutes: 15, severity: AlertSeverities.High },
  [AlertTypes.BannedAttempt]: { count: 1, windowMinutes: 60, severity: AlertSeverities.Medium },
  [AlertTypes.UnknownAccounts]: { count: 8, windowMinutes: 15, severity: AlertSeverities.Medium },
  [AlertTypes.SharedAccount]: { count: 3, windowMinutes: 60, severity: AlertSeverities.Low },
  [AlertTypes.RateAbuse]: { count: 5, windowMinutes: 10, severity: AlertSeverities.Medium },
  [AlertTypes.MassDeletion]: { count: 10, windowMinutes: 10, severity: AlertSeverities.High },
} as const satisfies Record<AlertType, { count: number; windowMinutes: number; severity: AlertSeverity }>;

/** Plain-English explanation of why an alert fired, for the dashboard card. */
export function explainAlert(type: AlertType, count: number) {
  const rule = AlertRules[type];
  // Widened: every current rule is multi-minute, so a literal-typed comparison
  // against 1 reads as dead code to the compiler. It stops being dead the
  // moment someone tunes a window down.
  const minutes: number = rule.windowMinutes;
  const window = `${minutes} minute${minutes === 1 ? "" : "s"}`;

  switch (type) {
    case AlertTypes.BruteForce:
      return `${count} failed sign-ins in ${window}. Someone may be guessing a password.`;
    case AlertTypes.BannedAttempt:
      return `A banned account tried to sign in ${count} time${count === 1 ? "" : "s"}.`;
    case AlertTypes.UnknownAccounts:
      return `${count} sign-in attempts on accounts that don't exist in ${window}. Looks like someone probing for valid student IDs.`;
    case AlertTypes.SharedAccount:
      return `One account signed in from ${count} different addresses in ${window}. Credentials may be shared.`;
    case AlertTypes.RateAbuse:
      return `${count} rate limits hit in ${window}. Possibly a script rather than a person.`;
    case AlertTypes.MassDeletion:
      return `${count} items deleted in ${window}.`;
  }
}

/** What slice of the record the history view is asking for. */
export const AlertStatuses = {
  Open: "open",
  Acknowledged: "acknowledged",
  All: "all",
} as const;

export type AlertStatus = (typeof AlertStatuses)[keyof typeof AlertStatuses];

export const ALERT_STATUS_VALUES = Object.values(AlertStatuses);

export const ALERT_STATUS_LABELS: Record<AlertStatus, string> = {
  [AlertStatuses.Open]: "Still open",
  [AlertStatuses.Acknowledged]: "Dealt with",
  [AlertStatuses.All]: "Everything",
};

/**
 * Paging cursor for the alert history.
 *
 * Alerts are ordered by `lastSeenAt` descending, which is not unique — two
 * raised in the same millisecond would straddle a page boundary and one would
 * never be shown. The document id is carried alongside as a tiebreak.
 */
export function encodeAlertCursor(lastSeenAt: string, id: string): string {
  return `${lastSeenAt}|${id}`;
}

export function parseAlertCursor(raw: string | null | undefined): { lastSeenAt: Date; id: string } | null {
  if (!raw) return null;

  const [iso, id] = raw.split("|");
  if (!iso || !id) return null;

  const lastSeenAt = new Date(iso);
  if (!Number.isFinite(lastSeenAt.getTime())) return null;

  // 24 hex characters, or it is not an ObjectId and would throw when cast.
  if (!/^[0-9a-f]{24}$/i.test(id)) return null;

  return { lastSeenAt, id };
}
