/**
 * IP blocking vocabulary, shared by the model, the API schemas and the admin UI.
 *
 * In `lib` so the client can validate before posting without pulling mongoose
 * into the browser bundle — the same split the other features use.
 */

export const BlockReasons = {
  BruteForce: "brute_force",
  Probing: "probing",
  RateAbuse: "rate_abuse",
  Spam: "spam",
  Other: "other",
} as const;

export type BlockReason = (typeof BlockReasons)[keyof typeof BlockReasons];

export const BLOCK_REASON_LABELS: Record<BlockReason, string> = {
  [BlockReasons.BruteForce]: "Password guessing",
  [BlockReasons.Probing]: "Probing for accounts",
  [BlockReasons.RateAbuse]: "Hammering the API",
  [BlockReasons.Spam]: "Spam or junk content",
  [BlockReasons.Other]: "Other",
};

export const BLOCK_REASONS = Object.values(BlockReasons);

export function isBlockReason(value: string): value is BlockReason {
  return (BLOCK_REASONS as string[]).includes(value);
}

/** Preset block lengths. `null` means it stays until someone lifts it. */
export const BLOCK_DURATIONS: { label: string; hours: number | null }[] = [
  { label: "1 hour", hours: 1 },
  { label: "24 hours", hours: 24 },
  { label: "7 days", hours: 24 * 7 },
  { label: "Permanent", hours: null },
];

export type BlockedIpRow = {
  id: string;
  ip: string;
  reason: BlockReason;
  note: string | null;
  createdByName: string | null;
  createdAt: string | null;
  /** Null is permanent. A past date means it has lapsed and is no longer enforced. */
  expiresAt: string | null;
  active: boolean;
};

/**
 * The placeholder `getRequestIp` returns when no forwarding header is present —
 * every local request looks like this. Blocking it would lock out the whole site
 * including the admin, so it is never a valid target.
 */
export const UNKNOWN_IP = "unknown";

/**
 * Trims and lowercases; IPv6 is case-insensitive and would otherwise store two
 * rows for one address.
 */
export function normalizeIp(raw: string): string {
  return raw.trim().toLowerCase();
}

const IPV4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;
// Deliberately permissive: enough to reject typos and free text, without
// reimplementing RFC 4291. The value only ever gets compared, never dialled.
const IPV6 = /^[0-9a-f:]+$/;

/**
 * Whether a string is an address we are willing to store and enforce against.
 *
 * Rejects the `unknown` placeholder explicitly — see UNKNOWN_IP.
 */
export function isBlockableIp(raw: string): boolean {
  const ip = normalizeIp(raw);
  if (!ip || ip === UNKNOWN_IP) return false;

  const v4 = IPV4.exec(ip);
  if (v4) {
    return v4.slice(1).every((part) => {
      const n = Number(part);
      // "01" and "1" are the same address; allowing both would let one host be
      // blocked under two spellings and matched under neither.
      return String(n) === part && n >= 0 && n <= 255;
    });
  }

  // An IPv6 address has at least one colon and cannot be a lone separator run.
  if (ip.includes(":") && IPV6.test(ip) && /[0-9a-f]/.test(ip)) return true;

  return false;
}

/** Whether a stored block is still in force right now. */
export function isBlockActive(expiresAt: string | null, now: Date = new Date()): boolean {
  if (!expiresAt) return true;
  const end = new Date(expiresAt).getTime();
  if (!Number.isFinite(end)) return true;
  return end > now.getTime();
}
