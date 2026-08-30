import test from "node:test";
import assert from "node:assert/strict";
import {
  ALERT_LABELS,
  ALERT_STATUS_LABELS,
  ALERT_STATUS_VALUES,
  AlertRules,
  AlertSeverities,
  AlertStatuses,
  AlertTypes,
  SEVERITY_TONES,
  encodeAlertCursor,
  explainAlert,
  parseAlertCursor,
  type AlertSeverity,
  type AlertType,
} from "../src/lib/alerts";

test("every alert type has a label, a rule and a severity tone", () => {
  for (const type of Object.values(AlertTypes) as AlertType[]) {
    assert.ok(ALERT_LABELS[type], `${type} has no label`);
    assert.ok(AlertRules[type], `${type} has no detection rule`);
    assert.ok(SEVERITY_TONES[AlertRules[type].severity], `${type} has an untoned severity`);
  }
});

test("every severity maps to a tone, so no badge renders blank", () => {
  for (const severity of Object.values(AlertSeverities) as AlertSeverity[]) {
    assert.ok(SEVERITY_TONES[severity], `${severity} has no tone`);
  }
});

test("every status the API accepts has a label for the filter", () => {
  for (const value of ALERT_STATUS_VALUES) {
    assert.ok(ALERT_STATUS_LABELS[value], `${value} has no label`);
  }
  assert.deepEqual(
    [...ALERT_STATUS_VALUES].sort(),
    [AlertStatuses.Acknowledged, AlertStatuses.All, AlertStatuses.Open].sort()
  );
});

test("every alert type explains itself in plain English", () => {
  for (const type of Object.values(AlertTypes) as AlertType[]) {
    const text = explainAlert(type, 7);
    assert.ok(text && text.length > 10, `${type} produced no explanation`);
  }
});

// ------------------------------------------------------------- paging cursor

test("a cursor round-trips through encode and parse", () => {
  const iso = "2026-08-30T12:34:56.789Z";
  const id = "6a947a270c1d05122ec00572";

  const parsed = parseAlertCursor(encodeAlertCursor(iso, id));
  assert.ok(parsed);
  assert.equal(parsed.id, id);
  assert.equal(parsed.lastSeenAt.toISOString(), iso);
});

test("the cursor carries an id, because lastSeenAt alone is not unique", () => {
  // Two alerts raised in the same millisecond straddle a page boundary. Without
  // the id tiebreak one of them is silently never shown.
  const iso = "2026-08-30T12:34:56.789Z";
  const a = encodeAlertCursor(iso, "6a947a270c1d05122ec00572");
  const b = encodeAlertCursor(iso, "6a947a270c1d05122ec00573");
  assert.notEqual(a, b, "same timestamp must still give distinct cursors");
});

test("a malformed cursor is refused rather than cast into a Mongo error", () => {
  assert.equal(parseAlertCursor(null), null);
  assert.equal(parseAlertCursor(""), null);
  assert.equal(parseAlertCursor("nonsense"), null, "no separator");
  assert.equal(parseAlertCursor("2026-08-30T12:00:00.000Z"), null, "no id half");
  assert.equal(parseAlertCursor("|6a947a270c1d05122ec00572"), null, "no date half");
  assert.equal(parseAlertCursor("not-a-date|6a947a270c1d05122ec00572"), null, "unparseable date");
  assert.equal(parseAlertCursor("2026-08-30T12:00:00.000Z|nope"), null, "id is not an ObjectId");
  assert.equal(
    parseAlertCursor("2026-08-30T12:00:00.000Z|6a947a270c1d05122ec0057"),
    null,
    "id is 23 characters, one short"
  );
});

test("an uppercase ObjectId is still accepted", () => {
  const parsed = parseAlertCursor("2026-08-30T12:00:00.000Z|6A947A270C1D05122EC00572");
  assert.ok(parsed, "ObjectId hex is case-insensitive");
});
