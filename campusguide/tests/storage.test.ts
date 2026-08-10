/**
 * Pure helpers behind the resources drive. No server, no database, no
 * Cloudflare credentials — these run under `npm test`.
 *
 * Awkward inputs (control characters, non-ASCII) are built with fromCharCode so
 * this file stays readable ASCII and the test says exactly what it is feeding in.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { buildObjectKey, sanitizeFileName } from "../src/server/storage/r2";
import { buildFolderPath } from "../src/server/models/Folder";
import { formatBytes } from "../src/lib/bytes";

const NUL = String.fromCharCode(0);
const TAB = String.fromCharCode(9);
const ARABIC_LAM = String.fromCharCode(0x0644);

// ------------------------------------------------------------ file names

test("a traversal attempt cannot escape its key prefix", () => {
  // Everything before the last separator is dropped, so "../.." can't climb out
  // of resources/<uuid>/ and overwrite an unrelated object.
  assert.equal(sanitizeFileName("../../secrets.pdf"), "secrets.pdf");
  assert.equal(sanitizeFileName("..\\..\\windows\\system32.dll"), "system32.dll");
  assert.equal(sanitizeFileName("/etc/passwd"), "passwd");
});

test("characters that would break a URL are replaced, ordinary ones survive", () => {
  assert.equal(sanitizeFileName("Lecture 1 - Intro.pdf"), "Lecture 1 - Intro.pdf");
  assert.equal(sanitizeFileName("week#3 (final)?.pdf"), "week_3 _final__.pdf");
});

test("non-ASCII names become underscores instead of vanishing", () => {
  const arabicName = `${ARABIC_LAM}${ARABIC_LAM}.pdf`;
  assert.equal(sanitizeFileName(arabicName), "__.pdf");
});

test("control characters are stripped rather than smuggled into a key", () => {
  assert.equal(sanitizeFileName(`bad${NUL}na${TAB}me.pdf`), "badname.pdf");
});

test("a leading dot is removed so the key isn't a hidden file", () => {
  assert.equal(sanitizeFileName(".hidden.pdf"), "hidden.pdf");
  assert.equal(sanitizeFileName("...pdf"), "pdf");
});

test("an empty or unusable name still produces something addressable", () => {
  assert.equal(sanitizeFileName(""), "file");
  assert.equal(sanitizeFileName("///"), "file");
  assert.equal(sanitizeFileName("..."), "file");
});

test("an overlong name keeps its tail, so the extension survives", () => {
  const safe = sanitizeFileName(`${"a".repeat(300)}.pdf`);

  assert.equal(safe.length, 120);
  assert.ok(safe.endsWith(".pdf"), "truncating from the front would leave a file with no extension");
});

test("object keys are unique per upload and namespaced under resources/", () => {
  const first = buildObjectKey("notes.pdf");
  const second = buildObjectKey("notes.pdf");

  assert.match(first, /^resources\/[0-9a-f-]{36}\/notes\.pdf$/);
  assert.notEqual(first, second, "reusing a key would let the CDN serve the old file after a replace");
});

// --------------------------------------------------------- folder paths

test("folder paths are built root-first with a single separator", () => {
  const root = buildFolderPath(null, "MIU File Storage");
  assert.equal(root, "/MIU File Storage");

  const term = buildFolderPath(root, "1st term freshman");
  assert.equal(term, "/MIU File Storage/1st term freshman");
  assert.equal(buildFolderPath(term, "Lectures"), "/MIU File Storage/1st term freshman/Lectures");
});

// ------------------------------------------------------------ file sizes

test("byte sizes render in the largest sensible unit", () => {
  assert.equal(formatBytes(0), "0 B");
  assert.equal(formatBytes(512), "512 B");
  assert.equal(formatBytes(1024), "1.0 KB");
  assert.equal(formatBytes(1536), "1.5 KB");
  assert.equal(formatBytes(2.4 * 1024 * 1024), "2.4 MB");
  assert.equal(formatBytes(3 * 1024 ** 3), "3.0 GB");
});

test("an unknown size renders as nothing rather than 'NaN undefined'", () => {
  assert.equal(formatBytes(null), "");
  assert.equal(formatBytes(undefined), "");
  assert.equal(formatBytes(Number.NaN), "");
  assert.equal(formatBytes(-1), "");
});
