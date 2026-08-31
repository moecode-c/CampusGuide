import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

/**
 * The proxy carries two lists that have to agree.
 *
 * `config.matcher` decides which requests Next hands to the proxy at all.
 * `PROTECTED_PREFIXES` decides which of those get an auth check. A path in the
 * matcher but not the prefixes is waved through to anyone; a path in the
 * prefixes but not the matcher is never seen by the proxy at all. Both failures
 * are silent — the page just renders.
 *
 * That is exactly what happened to /profile: it was added to the matcher only,
 * so a signed-out visitor got a 200. These tests read the source rather than
 * importing it, because the module pulls in the Next server runtime.
 */

const source = fs.readFileSync(path.join(process.cwd(), "src/proxy.ts"), "utf8");

function listBetween(startMarker: string): string[] {
  const start = source.indexOf(startMarker);
  assert.ok(start !== -1, `could not find ${startMarker} in src/proxy.ts`);

  const open = source.indexOf("[", start);
  const close = source.indexOf("]", open);
  assert.ok(open !== -1 && close !== -1, `could not read the array after ${startMarker}`);

  return [...source.slice(open, close).matchAll(/"([^"]+)"/g)].map((m) => m[1]);
}

const prefixes = listBetween("export const PROTECTED_PREFIXES");
const matcher = listBetween("matcher:");

test("both lists were actually found, so the rest of this file means something", () => {
  assert.ok(prefixes.length > 5, `only parsed ${prefixes.length} prefixes`);
  assert.ok(matcher.length > 5, `only parsed ${matcher.length} matcher entries`);
});

test("every guarded prefix is also matched, or the proxy never sees it", () => {
  for (const prefix of prefixes) {
    const expected = `${prefix}/:path*`;
    assert.ok(
      matcher.includes(expected),
      `"${prefix}" is guarded but "${expected}" is missing from config.matcher — the proxy will never run for it`
    );
  }
});

test("every matched path is also guarded, or it is waved straight through", () => {
  for (const entry of matcher) {
    const prefix = entry.replace("/:path*", "");
    assert.ok(
      prefixes.includes(prefix),
      `"${entry}" reaches the proxy but "${prefix}" is not in PROTECTED_PREFIXES — it will be served to anyone`
    );
  }
});

test("the pages a signed-out visitor must never reach are all covered", () => {
  // Named explicitly so deleting one from the list is a failing test, not a
  // silent hole.
  for (const guarded of ["/dashboard", "/profile", "/admin", "/api/admin", "/api/student"]) {
    assert.ok(prefixes.includes(guarded), `${guarded} is no longer protected`);
  }
});

test("the public pages stay public", () => {
  // A privacy policy has to be readable before anyone has an account, and the
  // auth pages obviously cannot sit behind auth.
  for (const open of ["/privacy", "/login", "/register", "/terms"]) {
    assert.ok(!prefixes.includes(open), `${open} was made private — it must stay reachable signed out`);
  }
});
