import test from "node:test";
import assert from "node:assert/strict";
import { normalizeExternalUrl } from "../src/lib/url";
import { isDuplicateKeyError } from "../src/server/mongoErrors";

test("a bare host gets an https scheme so the href isn't treated as relative", () => {
  assert.equal(normalizeExternalUrl("google.com"), "https://google.com/");
  assert.equal(normalizeExternalUrl("drive.google.com/file/d/abc"), "https://drive.google.com/file/d/abc");
});

test("existing schemes are preserved", () => {
  assert.equal(normalizeExternalUrl("http://example.com/x"), "http://example.com/x");
  assert.equal(normalizeExternalUrl("https://example.com/x?y=1"), "https://example.com/x?y=1");
});

test("surrounding whitespace is trimmed", () => {
  assert.equal(normalizeExternalUrl("  example.com/a  "), "https://example.com/a");
});

test("dangerous schemes are rejected", () => {
  assert.equal(normalizeExternalUrl("javascript://example.com/%0aalert(1)"), null);
  assert.equal(normalizeExternalUrl("data://text/html,<script>"), null);
  assert.equal(normalizeExternalUrl("file://host/etc/passwd"), null);
});

test("empty and hostless values are rejected", () => {
  assert.equal(normalizeExternalUrl(""), null);
  assert.equal(normalizeExternalUrl("   "), null);
  assert.equal(normalizeExternalUrl("localhost"), null);
  assert.equal(normalizeExternalUrl("not a url"), null);
});

test("normalization is idempotent", () => {
  const once = normalizeExternalUrl("example.com/a")!;
  assert.equal(normalizeExternalUrl(once), once);
});

test("isDuplicateKeyError recognises E11000 and nothing else", () => {
  assert.equal(isDuplicateKeyError({ code: 11000 }), true);
  assert.equal(isDuplicateKeyError({ code: 11001 }), true);
  assert.equal(isDuplicateKeyError({ code: 121 }), false);
  assert.equal(isDuplicateKeyError(new Error("boom")), false);
  assert.equal(isDuplicateKeyError(null), false);
  assert.equal(isDuplicateKeyError(undefined), false);
});
