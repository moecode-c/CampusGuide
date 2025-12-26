import { RRule } from "rrule";

type ExcludedRange = { start: Date; end: Date };

export function computeExdatesForRule({
  rrule,
  dtstart,
  excludedRanges,
}: {
  rrule: RRule;
  dtstart: Date;
  excludedRanges: ExcludedRange[];
}) {
  const ex = new Set<string>();
  for (const range of excludedRanges) {
    const between = rrule.between(range.start, range.end, true);
    for (const d of between) {
      // Keep occurrence's time-of-day aligned with rule; store as ISO string
      ex.add(d.toISOString());
    }
  }
  return Array.from(ex.values()).sort();
}
