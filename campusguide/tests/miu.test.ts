/**
 * MIU registration rules. These are the gate that keeps non-students out, so
 * they're covered here rather than only through the rate-limited register API.
 */
import test from "node:test";
import assert from "node:assert/strict";
import {
  formatMiuIdInput,
  isValidMiuEmail,
  isValidMiuId,
  isValidPhone,
  miuIdDigits,
  normalizeMiuId,
  normalizePhone,
  validateMiuIdentity,
} from "../src/lib/miu";

// ------------------------------------------------------------ student ids

test("a student ID must be 20xx/xxxxx", () => {
  assert.ok(isValidMiuId("2024/15832"));
  assert.ok(isValidMiuId("2019/00001"));

  assert.ok(!isValidMiuId("1999/15832"), "intake years all start with 20");
  assert.ok(!isValidMiuId("2024/1583"), "the serial is five digits");
  assert.ok(!isValidMiuId("2024/158321"), "six digits is too many");
  assert.ok(!isValidMiuId("202415832"), "the separator is required");
  assert.ok(!isValidMiuId(""));
});

test("a dash or space is accepted where the slash goes", () => {
  assert.equal(normalizeMiuId("2024-15832"), "2024/15832");
  assert.equal(normalizeMiuId(" 2024 15832 "), "2024/15832");
  assert.ok(isValidMiuId("2024-15832"));
});

test("the ID digits are the seven that appear in the email", () => {
  assert.equal(miuIdDigits("2024/15832"), "2415832");
  assert.equal(miuIdDigits("nonsense"), null);
});

// -------------------------------------------------------------- addresses

test("only university addresses are accepted", () => {
  assert.ok(isValidMiuEmail("ahmed2415832@miuegypt.edu.eg"));
  assert.ok(isValidMiuEmail("AHMED2415832@MIUEGYPT.EDU.EG"), "case should not matter");

  assert.ok(!isValidMiuEmail("ahmed2415832@gmail.com"), "a personal address is not a student");
  assert.ok(!isValidMiuEmail("ahmed@miuegypt.edu.eg"), "the ID digits are missing");
  assert.ok(!isValidMiuEmail("2415832@miuegypt.edu.eg"), "the name is missing");
  assert.ok(!isValidMiuEmail("ahmed241583@miuegypt.edu.eg"), "six digits is not an ID");
  assert.ok(!isValidMiuEmail("ahmed202415832@miuegypt.edu.eg"), "the full intake year is not used");
});

// ------------------------------------------------------- the pair together

test("the ID and the email have to describe the same student", () => {
  assert.equal(validateMiuIdentity("2024/15832", "ahmed2415832@miuegypt.edu.eg"), null);
  assert.equal(validateMiuIdentity("2024-15832", "Ahmed2415832@miuegypt.edu.eg"), null);
  assert.equal(validateMiuIdentity("2025/07617", "omar2507617@miuegypt.edu.eg"), null);
});

test("a mismatched pair is rejected with a specific message", () => {
  const message = validateMiuIdentity("2024/15832", "ahmed2499999@miuegypt.edu.eg");
  assert.ok(message, "digits that disagree must not pass");
  assert.match(String(message), /same digits/i);
});

test("a bad ID is reported before the email is blamed", () => {
  assert.match(String(validateMiuIdentity("garbage", "ahmed2415832@miuegypt.edu.eg")), /2024\/15832/);
});

// ------------------------------------------------------------ phone numbers

test("Egyptian mobiles are accepted in the formats people actually type", () => {
  for (const input of [
    "01012345678",
    "+201012345678",
    "00201012345678",
    "010 1234 5678",
    "010-1234-5678",
  ]) {
    assert.equal(normalizePhone(input), "+201012345678", `"${input}" should normalize`);
  }
});

test("all four Egyptian mobile prefixes work", () => {
  for (const prefix of ["010", "011", "012", "015"]) {
    assert.ok(isValidPhone(`${prefix}12345678`), `${prefix} is a real network prefix`);
  }
});

test("landlines and junk are refused", () => {
  assert.equal(normalizePhone("0221234567"), null, "a Cairo landline is not a mobile");
  assert.equal(normalizePhone("0131234567"), null, "013 is not an Egyptian mobile prefix");
  assert.equal(normalizePhone("0101234567"), null, "one digit short");
  assert.equal(normalizePhone("not a phone"), null);
  assert.equal(normalizePhone(""), null);
});

// ------------------------------------- typing an ID on a phone (no slash key)

test("the ID formatter inserts the slash so only digits need typing", () => {
  // A numeric keypad has no "/" key, so this field was unfillable on mobile.
  assert.equal(formatMiuIdInput("2"), "2");
  assert.equal(formatMiuIdInput("2024"), "2024");
  assert.equal(formatMiuIdInput("20241"), "2024/1");
  assert.equal(formatMiuIdInput("202415832"), "2024/15832");
});

test("the formatted result is one the validator accepts", () => {
  // The whole point: type nine digits, get something isValidMiuId() approves.
  assert.equal(isValidMiuId(formatMiuIdInput("202415832")), true);
});

test("re-typing over an already formatted value does not double the slash", () => {
  // React feeds the formatted value back in on every keystroke.
  assert.equal(formatMiuIdInput("2024/15832"), "2024/15832");
  assert.equal(formatMiuIdInput(formatMiuIdInput("202415832")), "2024/15832");
});

test("pasted separators are absorbed rather than rejected", () => {
  assert.equal(formatMiuIdInput("2024-15832"), "2024/15832");
  assert.equal(formatMiuIdInput("2024 15832"), "2024/15832");
  assert.equal(formatMiuIdInput(" 2024 / 15832 "), "2024/15832");
});

test("the field cannot be overfilled past nine digits", () => {
  assert.equal(formatMiuIdInput("20241583299999"), "2024/15832");
});

test("deleting back through the slash still works", () => {
  // Backspacing "2024/1" removes the 1, leaving "2024/" — which must collapse
  // to "2024" rather than stranding a trailing separator.
  assert.equal(formatMiuIdInput("2024/"), "2024");
  assert.equal(formatMiuIdInput("202"), "202");
  assert.equal(formatMiuIdInput(""), "");
});
