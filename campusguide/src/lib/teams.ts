/**
 * Team-board vocabulary, shared by the model, the API schemas and the page.
 *
 * These live in `lib` rather than beside the Mongoose model so the client
 * component can import them without pulling mongoose into the browser bundle —
 * the same split ActivityActions uses.
 */

export const TeamPostKinds = {
  /** A team that exists and has spots left. */
  NeedsMembers: "needs_members",
  /** A student on their own, looking to be picked up by a team. */
  NeedsTeam: "needs_team",
} as const;

export type TeamPostKind = (typeof TeamPostKinds)[keyof typeof TeamPostKinds];

export const TeamDifficulties = {
  Easy: "easy",
  Medium: "medium",
  Hard: "hard",
} as const;

export type TeamDifficulty = (typeof TeamDifficulties)[keyof typeof TeamDifficulties];

export const TeamPostStatuses = {
  Open: "open",
  /** Filled or abandoned. Still visible to its owner, hidden from the default feed. */
  Closed: "closed",
} as const;

export type TeamPostStatus = (typeof TeamPostStatuses)[keyof typeof TeamPostStatuses];

export const KIND_LABELS: Record<TeamPostKind, string> = {
  [TeamPostKinds.NeedsMembers]: "Looking for members",
  [TeamPostKinds.NeedsTeam]: "Looking for a team",
};

export const DIFFICULTY_LABELS: Record<TeamDifficulty, string> = {
  [TeamDifficulties.Easy]: "Easy",
  [TeamDifficulties.Medium]: "Medium",
  [TeamDifficulties.Hard]: "Hard",
};

/** Maps onto the three tones the Badge component already ships. */
export const DIFFICULTY_TONES: Record<TeamDifficulty, "success" | "warning" | "risk"> = {
  [TeamDifficulties.Easy]: "success",
  [TeamDifficulties.Medium]: "warning",
  [TeamDifficulties.Hard]: "risk",
};

export const DIFFICULTY_HINTS: Record<TeamDifficulty, string> = {
  [TeamDifficulties.Easy]: "Pass the course, keep it simple",
  [TeamDifficulties.Medium]: "Solid work, a good grade",
  // No dash in these hints: the selects render them as "Hard — <hint>", and a
  // second dash made the option read as two separate thoughts.
  [TeamDifficulties.Hard]: "Ambitious, expect long nights",
};

export const MAX_SKILLS = 6;

/**
 * How many posts one account may have live on the board at once.
 *
 * Counts open posts only, not everything ever written. Closing a post is the
 * natural "this one is done" action and a student can also delete their own, so
 * a lifetime quota would strand someone permanently a few weeks into term. The
 * cap exists to stop one account carpeting the board, and an open-post cap does
 * that exactly.
 */
export const MAX_OPEN_POSTS_PER_ACCOUNT = 5;

/** Shown when the cap blocks a create or a reopen — same wording in both places. */
export const AT_POST_LIMIT_MESSAGE =
  `You already have ${MAX_OPEN_POSTS_PER_ACCOUNT} posts on the board. ` +
  "Close or delete one to make room.";

export function isAtPostLimit(openPosts: number): boolean {
  return openPosts >= MAX_OPEN_POSTS_PER_ACCOUNT;
}

/** "2 left" / "1 left" / "none left" — the hint beside the create form. */
export function remainingPostsLabel(openPosts: number): string {
  const left = Math.max(0, MAX_OPEN_POSTS_PER_ACCOUNT - openPosts);
  if (left === 0) return "none left";
  return `${left} left`;
}

/** Splits the comma-separated skills field into at most MAX_SKILLS clean tags. */
export function parseSkills(raw: string) {
  return Array.from(
    new Set(
      raw
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
        .map((s) => s.slice(0, 24))
    )
  ).slice(0, MAX_SKILLS);
}

/**
 * `+201012345678` -> `201012345678`, which is what wa.me expects (no plus).
 * Returns null for anything that isn't in the canonical stored shape.
 */
export function whatsappNumber(phone: string) {
  const digits = phone.replace(/[^\d]/g, "");
  return digits.length >= 10 ? digits : null;
}

/** `+201012345678` -> `0101 234 5678`, which is how people read it locally. */
export function formatPhone(phone: string) {
  const local = phone.replace(/^\+20/, "0");
  if (!/^0\d{10}$/.test(local)) return phone;
  return `${local.slice(0, 4)} ${local.slice(4, 7)} ${local.slice(7)}`;
}

/**
 * When a post counts as stale and gets flagged for the admin.
 *
 * A fixed 30 days rather than "the same date next month": calendar-month
 * arithmetic has to decide what 31 January plus one month means, and the answer
 * would quietly differ between February and March. A flat count is predictable,
 * and the dashboard labels the button with this exact number so what it says and
 * what it deletes can never drift apart.
 */
export const STALE_POST_DAYS = 30;

const DAY_MS = 24 * 60 * 60 * 1000;

/** Whole days since a post went up. Negative clock skew reads as 0, not as stale. */
export function postAgeDays(createdAt: string | Date | null | undefined, now: Date = new Date()): number {
  if (!createdAt) return 0;

  const created = createdAt instanceof Date ? createdAt : new Date(createdAt);
  const ms = created.getTime();
  if (!Number.isFinite(ms)) return 0;

  return Math.max(0, Math.floor((now.getTime() - ms) / DAY_MS));
}

/**
 * The instant a post must have been created at or before to count as stale.
 *
 * This is the single definition of the boundary, and both sides must use it.
 * They did not at first: the badge asked "is its whole-day age > 30" while the
 * bulk delete compared against `now - 30 days` directly. A post a few minutes
 * past its thirtieth day therefore displayed as safe and was deleted anyway —
 * the dashboard flagged three posts and the button removed four.
 *
 * Expressed as a Date so the Mongo query and the badge can share it: a post is
 * stale exactly when it is a full 31 days old, which is the first moment its
 * whole-day age exceeds 30.
 */
export function stalePostCutoff(now: Date = new Date()): Date {
  return new Date(now.getTime() - (STALE_POST_DAYS + 1) * DAY_MS);
}

/**
 * Whether a post is old enough to be flagged.
 *
 * "More than 30 days", so a post on its 30th day is not yet flagged — the
 * boundary belongs to the post, not to the delete button.
 */
export function isPostStale(createdAt: string | Date | null | undefined, now: Date = new Date()): boolean {
  if (!createdAt) return false;

  const created = createdAt instanceof Date ? createdAt : new Date(createdAt);
  const ms = created.getTime();
  if (!Number.isFinite(ms)) return false;

  return ms <= stalePostCutoff(now).getTime();
}

/** "3 days old" / "1 day old" / "posted today" — the age column on the dashboard. */
export function postAgeLabel(createdAt: string | Date | null | undefined, now: Date = new Date()): string {
  const days = postAgeDays(createdAt, now);
  if (days === 0) return "posted today";
  return `${days} day${days === 1 ? "" : "s"} old`;
}
