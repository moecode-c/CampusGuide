import test from "node:test";
import assert from "node:assert/strict";
import { youtubeIdFromInput, youtubeEmbedUrl } from "../src/lib/youtube";
import { isValidSlug, slugify, lessonCountLabel } from "../src/lib/videoCourses";

/**
 * The "YouTube embeds only" rule is enforced by this one function: the admin
 * types a string, and whatever comes out of here is what ends up in an iframe
 * src. If it ever returns an id for a non-YouTube input, the rule is gone.
 */

test("the URL shapes people actually paste all resolve to the same id", () => {
  const id = "dQw4w9WgXcQ";

  assert.equal(youtubeIdFromInput(`https://www.youtube.com/watch?v=${id}`), id);
  assert.equal(youtubeIdFromInput(`https://youtu.be/${id}`), id);
  assert.equal(youtubeIdFromInput(`https://www.youtube.com/embed/${id}`), id);
  assert.equal(youtubeIdFromInput(`https://www.youtube.com/shorts/${id}`), id);
  assert.equal(youtubeIdFromInput(`https://m.youtube.com/watch?v=${id}`), id);
});

test("a scheme-less link still resolves, because that is how people copy them", () => {
  const id = "dQw4w9WgXcQ";

  assert.equal(youtubeIdFromInput(`youtu.be/${id}`), id);
  assert.equal(youtubeIdFromInput(`www.youtube.com/watch?v=${id}`), id);
});

test("a bare id is accepted, and whitespace around any input is tolerated", () => {
  assert.equal(youtubeIdFromInput("dQw4w9WgXcQ"), "dQw4w9WgXcQ");
  assert.equal(youtubeIdFromInput("  https://youtu.be/dQw4w9WgXcQ  "), "dQw4w9WgXcQ");
});

test("extra query parameters do not defeat the parser", () => {
  assert.equal(
    youtubeIdFromInput("https://www.youtube.com/watch?v=dQw4w9WgXcQ&list=PL123&t=42s"),
    "dQw4w9WgXcQ"
  );
});

test("anything that is not a YouTube video is rejected", () => {
  assert.equal(youtubeIdFromInput("https://vimeo.com/123456789"), null);
  assert.equal(youtubeIdFromInput("https://example.com/watch?v=dQw4w9WgXcQ"), null);
  assert.equal(youtubeIdFromInput("https://notyoutube.com/watch?v=dQw4w9WgXcQ"), null);
  assert.equal(youtubeIdFromInput(""), null);
  assert.equal(youtubeIdFromInput("   "), null);
});

test("script and data URLs cannot smuggle themselves into an embed", () => {
  assert.equal(youtubeIdFromInput("javascript:alert(1)"), null);
  assert.equal(youtubeIdFromInput("data:text/html,<script>alert(1)</script>"), null);
  // A hostname that merely ends with youtube.com is a different site.
  assert.equal(youtubeIdFromInput("https://evil-youtube.com/watch?v=dQw4w9WgXcQ"), null);
});

test("ids of the wrong length are refused, so a truncated paste fails loudly", () => {
  assert.equal(youtubeIdFromInput("short"), null);
  assert.equal(youtubeIdFromInput("waytoolongforanid12345"), null);
  assert.equal(youtubeIdFromInput("https://youtu.be/tooshort"), null);
});

test("the embed URL is always built on the nocookie host", () => {
  assert.equal(
    youtubeEmbedUrl("dQw4w9WgXcQ"),
    "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ"
  );
});

test("slugs are URL-safe and match the pattern the API validates against", () => {
  assert.equal(slugify("Networks"), "networks");
  assert.equal(slugify("Data Structures & Algorithms"), "data-structures-algorithms");
  assert.equal(slugify("  Computer   Networks II  "), "computer-networks-ii");

  for (const title of ["Networks", "Data Structures & Algorithms", "OS/2 Internals"]) {
    assert.ok(isValidSlug(slugify(title)), `${title} produced an invalid slug`);
  }
});

test("accents are folded rather than turned into stray dashes", () => {
  assert.equal(slugify("Réseaux"), "reseaux");
});

test("a title with no Latin characters still yields a usable slug", () => {
  const slug = slugify("شبكات");
  assert.ok(slug.length > 0);
  assert.ok(isValidSlug(slug), `fallback slug ${slug} is not URL-safe`);
});

test("slug validation rejects what the pattern is meant to keep out", () => {
  assert.equal(isValidSlug("Networks"), false, "uppercase");
  assert.equal(isValidSlug("-networks"), false, "leading dash");
  assert.equal(isValidSlug("net works"), false, "space");
  assert.equal(isValidSlug("net/works"), false, "slash");
  assert.equal(isValidSlug(""), false, "empty");
});

test("the video count reads correctly at one and at zero", () => {
  assert.equal(lessonCountLabel(0), "0 videos");
  assert.equal(lessonCountLabel(1), "1 video");
  assert.equal(lessonCountLabel(12), "12 videos");
});
