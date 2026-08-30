import test from "node:test";
import assert from "node:assert/strict";
import {
  BLOCK_REASONS,
  BLOCK_REASON_LABELS,
  UNKNOWN_IP,
  isBlockActive,
  isBlockReason,
  isBlockableIp,
  normalizeIp,
  type BlockReason,
} from "../src/lib/ipBlocks";
import { describeAgent } from "../src/components/admin/IpSecurity";

/**
 * The guard that keeps this feature from being a footgun: if `isBlockableIp`
 * ever returns true for the "unknown" placeholder, one click 403s the entire
 * site — every student and the admin who would have to undo it.
 */
test("the unknown placeholder can never be blocked", () => {
  assert.equal(isBlockableIp(UNKNOWN_IP), false);
  assert.equal(isBlockableIp("unknown"), false);
  assert.equal(isBlockableIp("UNKNOWN"), false, "case must not smuggle it through");
  assert.equal(isBlockableIp("  unknown  "), false, "nor whitespace");
});

test("real IPv4 addresses are accepted", () => {
  assert.equal(isBlockableIp("192.168.1.1"), true);
  assert.equal(isBlockableIp("8.8.8.8"), true);
  assert.equal(isBlockableIp("255.255.255.255"), true);
  assert.equal(isBlockableIp("0.0.0.0"), true);
});

test("malformed IPv4 is rejected rather than stored as a rule that never matches", () => {
  assert.equal(isBlockableIp("256.1.1.1"), false, "octet out of range");
  assert.equal(isBlockableIp("1.2.3"), false, "too few octets");
  assert.equal(isBlockableIp("1.2.3.4.5"), false, "too many octets");
  assert.equal(isBlockableIp("192.168.001.1"), false, "leading zeros are a second spelling");
  assert.equal(isBlockableIp(""), false);
  assert.equal(isBlockableIp("not an ip"), false);
  assert.equal(isBlockableIp("192.168.1.1; DROP"), false);
});

test("IPv6 is accepted, including the loopback and compressed forms", () => {
  assert.equal(isBlockableIp("::1"), true);
  assert.equal(isBlockableIp("2001:db8::ff00:42:8329"), true);
  assert.equal(isBlockableIp("fe80::1"), true);
});

test("a lone separator run is not an address", () => {
  assert.equal(isBlockableIp("::"), false, "no hex digits at all");
  assert.equal(isBlockableIp(":::"), false);
});

test("addresses are normalized so one host cannot hide under two spellings", () => {
  assert.equal(normalizeIp("  2001:DB8::1  "), "2001:db8::1");
  assert.equal(normalizeIp("8.8.8.8"), "8.8.8.8");
});

test("a permanent block never lapses", () => {
  assert.equal(isBlockActive(null), true);
});

test("a timed block is in force until its expiry and not after", () => {
  const now = new Date("2026-08-30T12:00:00.000Z");
  const future = new Date("2026-08-30T13:00:00.000Z").toISOString();
  const past = new Date("2026-08-30T11:00:00.000Z").toISOString();

  assert.equal(isBlockActive(future, now), true);
  assert.equal(isBlockActive(past, now), false);
});

test("an unreadable expiry keeps the block on rather than silently lifting it", () => {
  assert.equal(isBlockActive("not a date"), true);
});

test("every reason has a label, so no row can render blank", () => {
  for (const reason of BLOCK_REASONS) {
    assert.ok(BLOCK_REASON_LABELS[reason as BlockReason], `${reason} has no label`);
  }
});

test("reason validation refuses anything not in the catalog", () => {
  assert.equal(isBlockReason("brute_force"), true);
  assert.equal(isBlockReason("whatever"), false);
  assert.equal(isBlockReason(""), false);
});

test("user agents are summarised into something an admin can scan", () => {
  assert.equal(
    describeAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36"
    ),
    "Chrome on Windows"
  );
  assert.equal(
    describeAgent("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Version/17.0 Safari/604.1"),
    "Safari on iOS"
  );
  // Edge and Opera both carry "Chrome/" in their UA, so order of checks matters.
  assert.equal(
    describeAgent("Mozilla/5.0 (Windows NT 10.0) Chrome/120.0 Safari/537.36 Edg/120.0"),
    "Edge on Windows"
  );
  assert.equal(describeAgent(null), "Unknown device");
});
