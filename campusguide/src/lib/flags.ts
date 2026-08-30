/**
 * Admin-controlled kill switches.
 *
 * A flag takes a whole area of the app offline for students while an admin
 * fixes or reorganizes it. Admins keep full access to a locked area — the point
 * is to work on it without students seeing a half-finished state.
 *
 * Defined in `lib` so the admin UI can import the catalog without pulling
 * mongoose into the browser bundle.
 */

export const FlagKeys = {
  /** The Resources drive: browsing, searching and downloading. */
  ResourcesLocked: "resources.locked",
} as const;

export type FlagKey = (typeof FlagKeys)[keyof typeof FlagKeys];

export type FlagMeta = {
  key: FlagKey;
  label: string;
  /** What students lose while this is on. */
  description: string;
  /** Shown to students when no custom message is set. */
  defaultMessage: string;
};

export const FLAG_CATALOG: FlagMeta[] = [
  {
    key: FlagKeys.ResourcesLocked,
    label: "Lock the Resources drive",
    description:
      "Students cannot browse, search or download files. Admins keep full access, and the Resources link disappears from the student navbar.",
    defaultMessage:
      "The resource drive is being updated. It will be back shortly — check with your department if you need something urgently.",
  },
];

export const FLAG_KEYS = FLAG_CATALOG.map((f) => f.key);

export function isFlagKey(value: string): value is FlagKey {
  return (FLAG_KEYS as string[]).includes(value);
}

export function flagMeta(key: FlagKey) {
  return FLAG_CATALOG.find((f) => f.key === key)!;
}

/** Every flag defaults to off, so a missing row never takes an area offline. */
export type FlagState = { enabled: boolean; message: string | null; updatedAt: string | null; updatedBy: string | null };

export type FlagMap = Record<FlagKey, FlagState>;

export const DEFAULT_FLAG_STATE: FlagState = {
  enabled: false,
  message: null,
  updatedAt: null,
  updatedBy: null,
};
