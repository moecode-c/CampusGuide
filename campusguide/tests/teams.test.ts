/**
 * Team-board helpers. The skills parser and the two phone formatters run on
 * every card and every submission, and all three have edge cases that are
 * awkward to reach through the UI.
 */
import test from "node:test";
import assert from "node:assert/strict";
import {
  DIFFICULTY_HINTS,
  DIFFICULTY_LABELS,
  DIFFICULTY_TONES,
  AT_POST_LIMIT_MESSAGE,
  KIND_LABELS,
  MAX_OPEN_POSTS_PER_ACCOUNT,
  MAX_SKILLS,
  TeamDifficulties,
  TeamPostKinds,
  STALE_POST_DAYS,
  formatPhone,
  isAtPostLimit,
  isPostStale,
  postAgeDays,
  postAgeLabel,
  stalePostCutoff,
  parseSkills,
  remainingPostsLabel,
  whatsappNumber,
} from "../src/lib/teams";
import { normalizePhone } from "../src/lib/miu";

// ------------------------------------------------------------------ skills

test("skills are split, trimmed and emptied of blanks", () => {
  assert.deepEqual(parseSkills("frontend, design , presentation"), [
    "frontend",
    "design",
    "presentation",
  ]);
  assert.deepEqual(parseSkills("frontend,,  ,design"), ["frontend", "design"]);
  assert.deepEqual(parseSkills("   "), []);
  assert.deepEqual(parseSkills(""), []);
});

test("duplicate skills collapse to one tag", () => {
  assert.deepEqual(parseSkills("sql, SQL, sql"), ["sql", "SQL"], "case is preserved, exact repeats are not");
  assert.deepEqual(parseSkills("design, design"), ["design"]);
});

test("the tag list is capped so one post can't carry fifty labels", () => {
  const many = Array.from({ length: 20 }, (_, i) => `skill${i}`).join(",");
  assert.equal(parseSkills(many).length, MAX_SKILLS);
});

test("an overlong tag is truncated rather than dropped", () => {
  const long = "a".repeat(100);
  const [tag] = parseSkills(long);
  assert.equal(tag.length, 24, "matches the server's per-tag max");
});

// ------------------------------------------------------------------- phone

test("wa.me gets the number without its plus", () => {
  assert.equal(whatsappNumber("+201012345678"), "201012345678");
  assert.equal(whatsappNumber("+20 101 234 5678"), "201012345678");
});

test("a number too short to dial yields no WhatsApp link", () => {
  assert.equal(whatsappNumber("+2010"), null);
  assert.equal(whatsappNumber(""), null);
});

test("a stored number is displayed the way it is read locally", () => {
  assert.equal(formatPhone("+201012345678"), "0101 234 5678");
  assert.equal(formatPhone("+201112223344"), "0111 222 3344");
});

test("anything not in the canonical shape is shown unchanged rather than mangled", () => {
  assert.equal(formatPhone("+15551234567"), "+15551234567");
  assert.equal(formatPhone("not a phone"), "not a phone");
});

test("the display and wa.me forms round-trip whatever normalizePhone stores", () => {
  // The three ways a student might type the same number all reach one card.
  for (const typed of ["01012345678", "+201012345678", "00201012345678", "0101 234 5678"]) {
    const stored = normalizePhone(typed);
    assert.equal(stored, "+201012345678", `${typed} should normalize`);
    assert.equal(formatPhone(stored!), "0101 234 5678");
    assert.equal(whatsappNumber(stored!), "201012345678");
  }
});

// ------------------------------------------------------------- label tables

test("every difficulty has a label, a hint and a badge tone", () => {
  for (const d of Object.values(TeamDifficulties)) {
    assert.ok(DIFFICULTY_LABELS[d], `${d} needs a label`);
    assert.ok(DIFFICULTY_HINTS[d], `${d} needs a hint`);
    assert.ok(DIFFICULTY_TONES[d], `${d} needs a tone`);
  }
});

test("difficulty hints carry no dash, because the select renders one already", () => {
  // The option reads "Hard — <hint>"; a dash inside the hint made it read as
  // two unrelated thoughts.
  for (const hint of Object.values(DIFFICULTY_HINTS)) {
    assert.ok(!hint.includes("—"), `"${hint}" would double up the separator`);
  }
});

test("every post kind has a label", () => {
  for (const k of Object.values(TeamPostKinds)) {
    assert.ok(KIND_LABELS[k], `${k} needs a label`);
  }
});

// ------------------------------------------------- per-account post cap

test("the cap trips only once five posts are already live", () => {
  assert.equal(isAtPostLimit(0), false);
  assert.equal(isAtPostLimit(4), false, "a student with four posts may still add one");
  assert.equal(isAtPostLimit(5), true, "the fifth post fills the last slot");
});

test("a count somehow above the cap still reads as at-limit", () => {
  // Reachable through the count-then-insert race in the create route, or by an
  // admin editing the database. It must not read as "one slot free".
  assert.equal(isAtPostLimit(6), true);
  assert.equal(isAtPostLimit(99), true);
});

test("the remaining-posts hint counts down and never goes negative", () => {
  assert.equal(remainingPostsLabel(0), "5 left");
  assert.equal(remainingPostsLabel(3), "2 left");
  assert.equal(remainingPostsLabel(4), "1 left");
  assert.equal(remainingPostsLabel(5), "none left");
  assert.equal(remainingPostsLabel(7), "none left", "an over-cap account is not owed slots");
});

test("the limit message names the actual limit, so the two cannot drift", () => {
  assert.match(AT_POST_LIMIT_MESSAGE, new RegExp(String(MAX_OPEN_POSTS_PER_ACCOUNT)));
  assert.match(AT_POST_LIMIT_MESSAGE, /close or delete/i, "it must say how to free a slot");
});

// ------------------------------------------- stale posts and the purge button

test("a post is flagged only after it passes 30 days, not on the day itself", () => {
  const now = new Date("2026-08-30T12:00:00.000Z");
  const daysAgo = (n: number) => new Date(now.getTime() - n * 24 * 60 * 60 * 1000);

  assert.equal(isPostStale(daysAgo(0), now), false, "posted today");
  assert.equal(isPostStale(daysAgo(29), now), false);
  assert.equal(
    isPostStale(daysAgo(STALE_POST_DAYS), now),
    false,
    "the 30th day still belongs to the post"
  );
  assert.equal(isPostStale(daysAgo(STALE_POST_DAYS + 1), now), true);
  assert.equal(isPostStale(daysAgo(365), now), true);
});

test("the flag threshold is the 30 days the button promises", () => {
  // The dashboard prints this number next to a delete button. If the two ever
  // disagree the button removes something other than what it says.
  assert.equal(STALE_POST_DAYS, 30);
});

test("post age counts whole days and never goes negative", () => {
  const now = new Date("2026-08-30T12:00:00.000Z");
  const daysAgo = (n: number) => new Date(now.getTime() - n * 24 * 60 * 60 * 1000);

  assert.equal(postAgeDays(daysAgo(0), now), 0);
  assert.equal(postAgeDays(daysAgo(1), now), 1);
  assert.equal(postAgeDays(daysAgo(31), now), 31);
  // A post dated in the future — clock skew between the server and Atlas —
  // must read as brand new, not as an enormous negative age.
  assert.equal(postAgeDays(new Date(now.getTime() + 60_000), now), 0);
});

test("a missing or unreadable date is never flagged for deletion", () => {
  // Failing closed matters here: the flag drives an irreversible bulk delete, so
  // an unparseable date must keep the post rather than sweep it up.
  const now = new Date("2026-08-30T12:00:00.000Z");

  assert.equal(isPostStale(null, now), false);
  assert.equal(isPostStale(undefined, now), false);
  assert.equal(isPostStale("not a date", now), false);
  assert.equal(postAgeDays(null, now), 0);
});

test("the age label reads correctly at zero, one and many days", () => {
  const now = new Date("2026-08-30T12:00:00.000Z");
  const daysAgo = (n: number) => new Date(now.getTime() - n * 24 * 60 * 60 * 1000);

  assert.equal(postAgeLabel(daysAgo(0), now), "posted today");
  assert.equal(postAgeLabel(daysAgo(1), now), "1 day old");
  assert.equal(postAgeLabel(daysAgo(45), now), "45 days old");
});

test("the flag badge and the bulk delete agree on every age, including part-days", () => {
  // The bug this guards: the badge asked "whole-day age > 30" while the delete
  // compared against `now - 30 days`. A post 30.01 days old showed as safe and
  // was deleted anyway — the dashboard flagged 3 and the button removed 4.
  const now = new Date("2026-08-30T12:00:00.000Z");
  const DAY = 24 * 60 * 60 * 1000;
  const cutoff = stalePostCutoff(now).getTime();

  const ages = [0, 0.5, 5, 29, 29.9, 30, 30.01, 30.5, 30.99, 31, 31.5, 60, 200];

  for (const days of ages) {
    const createdAt = new Date(now.getTime() - days * DAY);

    const badgeSaysStale = isPostStale(createdAt, now);
    const deleteWouldTake = createdAt.getTime() <= cutoff;

    assert.equal(
      badgeSaysStale,
      deleteWouldTake,
      `at ${days} days the badge and the delete disagree — badge=${badgeSaysStale}, delete=${deleteWouldTake}`
    );
  }
});

test("a post is only swept once it is a full 31 days old", () => {
  const now = new Date("2026-08-30T12:00:00.000Z");
  const DAY = 24 * 60 * 60 * 1000;
  const at = (days: number) => isPostStale(new Date(now.getTime() - days * DAY), now);

  assert.equal(at(30), false, "exactly 30 days is kept");
  assert.equal(at(30.9), false, "still inside its 31st day, so kept");
  assert.equal(at(31), true, "a full 31 days is swept");
});
