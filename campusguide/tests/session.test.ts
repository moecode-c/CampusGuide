import test from "node:test";
import assert from "node:assert/strict";
import {
  SESSION_DEFAULT_DAYS,
  SESSION_MAX_AGE_SECONDS,
  SESSION_REMEMBER_DAYS,
  isSessionExpired,
  sessionDays,
  sessionExpiryFrom,
} from "../src/lib/session";

const DAY_MS = 24 * 60 * 60 * 1000;
const NOW = new Date("2026-08-30T12:00:00.000Z").getTime();

test("the two session lengths are the ones the sign-in form promises", () => {
  assert.equal(SESSION_REMEMBER_DAYS, 50, "the checkbox label says 50 days");
  assert.equal(SESSION_DEFAULT_DAYS, 20, "unticked must still be at least 20 days");
});

test("the default session is never shorter than the 20-day floor", () => {
  // The floor is the requirement, not an implementation detail: someone tuning
  // these numbers down would silently start signing students out early.
  assert.ok(SESSION_DEFAULT_DAYS >= 20);
  assert.ok(SESSION_REMEMBER_DAYS >= SESSION_DEFAULT_DAYS, "remembering must last longer, not less");
});

test("ticking the box picks the longer window", () => {
  assert.equal(sessionDays(true), SESSION_REMEMBER_DAYS);
  assert.equal(sessionDays(false), SESSION_DEFAULT_DAYS);
});

test("the stamped expiry is exactly the chosen number of days out", () => {
  assert.equal(sessionExpiryFrom(true, NOW) - NOW, SESSION_REMEMBER_DAYS * DAY_MS);
  assert.equal(sessionExpiryFrom(false, NOW) - NOW, SESSION_DEFAULT_DAYS * DAY_MS);
});

test("a session is live right up to its expiry and dead on it", () => {
  const expiry = sessionExpiryFrom(false, NOW);

  assert.equal(isSessionExpired(expiry, NOW), false, "valid the moment it is issued");
  assert.equal(isSessionExpired(expiry, expiry - 1), false, "still valid a millisecond before");
  assert.equal(isSessionExpired(expiry, expiry), true, "dead on the boundary");
  assert.equal(isSessionExpired(expiry, expiry + 1), true);
});

test("an unticked session outlives 19 days and does not reach 21", () => {
  const expiry = sessionExpiryFrom(false, NOW);
  assert.equal(isSessionExpired(expiry, NOW + 19 * DAY_MS), false, "must survive 19 days");
  assert.equal(isSessionExpired(expiry, NOW + 21 * DAY_MS), true);
});

test("a ticked session survives 49 days and not 51", () => {
  const expiry = sessionExpiryFrom(true, NOW);
  assert.equal(isSessionExpired(expiry, NOW + 49 * DAY_MS), false);
  assert.equal(isSessionExpired(expiry, NOW + 51 * DAY_MS), true);
});

test("a token with no expiry is left alone rather than treated as expired", () => {
  // Sessions issued before this shipped carry no stamp. Reading a missing value
  // as "expired" would sign every existing student out on deploy.
  assert.equal(isSessionExpired(undefined, NOW), false);
  assert.equal(isSessionExpired(null, NOW), false);
  assert.equal(isSessionExpired("not a number", NOW), false);
  assert.equal(isSessionExpired(Number.NaN, NOW), false);
});

test("the cookie ceiling matches the longest session, so a token never outlives it", () => {
  assert.equal(SESSION_MAX_AGE_SECONDS, SESSION_REMEMBER_DAYS * 24 * 60 * 60);
  assert.ok(
    SESSION_MAX_AGE_SECONDS * 1000 >= SESSION_DEFAULT_DAYS * DAY_MS,
    "the cookie must outlast the shorter window, never the other way round"
  );
});
