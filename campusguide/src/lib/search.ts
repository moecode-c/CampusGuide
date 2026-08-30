/**
 * Shared search-as-you-type rules for the browse pages (Resources, Teams).
 *
 * Both pages fire a request on every keystroke. At 250ms from the first
 * character, typing "software" could cost eight round trips; at 400ms with a
 * two-character floor it costs two or three, and the first letter costs
 * nothing. Search traffic is the largest avoidable share of the app's API
 * bandwidth, and a single-letter query was never a useful search anyway.
 */

export const SEARCH_DEBOUNCE_MS = 400;

/** One letter matches most of the table; it is noise, not a search. */
export const MIN_SEARCH_LENGTH = 2;

/**
 * The term a query should actually be run with, or "" for "not searching yet".
 *
 * Derive this once and depend on *it* rather than on the raw input: typing the
 * first character leaves the value unchanged, so the effect never re-fires and
 * that keystroke costs no request at all.
 */
export function searchTerm(raw: string) {
  const trimmed = raw.trim();
  return trimmed.length >= MIN_SEARCH_LENGTH ? trimmed : "";
}
