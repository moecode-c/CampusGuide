/**
 * FAQ content integrity.
 *
 * A question whose `topic` does not match a real topic is not a crash — it just
 * silently vanishes from the page, because every view is built by filtering on
 * topic. That is the worst kind of bug for content: the answer is written, it
 * looks committed, and no student can ever reach it. These tests fail loudly
 * instead.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { FAQS, FAQ_TOPICS, questionsFor, searchFaqs, topicById } from "../src/lib/faq";

test("every question belongs to a real category", () => {
  const ids = new Set(FAQ_TOPICS.map((t) => t.id));
  for (const f of FAQS) {
    assert.ok(ids.has(f.topic), `"${f.question}" has unknown topic "${f.topic}"`);
  }
});

test("every category is reachable and has at least one question", () => {
  for (const t of FAQ_TOPICS) {
    assert.ok(questionsFor(t.id).length > 0, `topic "${t.id}" would render an empty page`);
  }
});

test("every question is reachable by browsing its topic", () => {
  // The sum of the per-topic lists must account for every question — nothing
  // may exist only in the array and never on screen.
  const reachable = FAQ_TOPICS.reduce((n, t) => n + questionsFor(t.id).length, 0);
  assert.equal(reachable, FAQS.length);
});

test("no two questions are worded identically", () => {
  const seen = new Set<string>();
  for (const f of FAQS) {
    const key = f.question.trim().toLowerCase();
    assert.ok(!seen.has(key), `duplicate question: ${f.question}`);
    seen.add(key);
  }
});

test("no question or answer is left blank", () => {
  for (const f of FAQS) {
    assert.ok(f.question.trim().length > 5, `question too short: ${f.question}`);
    assert.ok(f.answer.trim().length > 20, `answer too short for: ${f.question}`);
  }
});

test("every topic has a label, blurb and icon", () => {
  for (const t of FAQ_TOPICS) {
    assert.ok(t.label.trim(), `topic ${t.id} needs a label`);
    assert.ok(t.blurb.trim(), `topic ${t.id} needs a blurb`);
    assert.ok(t.icon, `topic ${t.id} needs an icon`);
    assert.equal(topicById(t.id)?.id, t.id);
  }
});

test("search finds the answers students actually come for", () => {
  // Each of these is a real thing a student types into the box.
  const expectations: [string, RegExp][] = [
    ["medical", /medical report/i],
    ["sick", /students\.medical@miuegypt\.edu\.eg/],
    ["probation", /probation/i],
    ["teams", /Microsoft Teams/i],
    ["drafting", /military papers/i],
    ["60", /60%/],
  ];

  for (const [query, expected] of expectations) {
    const hits = searchFaqs(query);
    assert.ok(hits.length > 0, `search for "${query}" found nothing`);
    assert.ok(
      hits.some((h) => expected.test(`${h.question} ${h.answer}`)),
      `search for "${query}" did not surface the expected answer`
    );
  }
});

test("the medical report answer states that it does not erase absences", () => {
  // This one is worth pinning: the placeholder copy this replaced said the
  // opposite, and a student who believes an absence was removed will miscount
  // their way into a drop.
  const medical = FAQS.find((f) => /medical report/i.test(f.question));
  assert.ok(medical, "the medical report question is missing");
  assert.match(medical!.answer, /does not remove the absence/i);
  assert.match(medical!.answer, /extra 5%/i);
  assert.match(medical!.answer, /students\.medical@miuegypt\.edu\.eg/);
});

test("the English levels answer names all four levels", () => {
  const answer = questionsFor("english")
    .map((q) => q.answer)
    .join("\n");

  for (const level of ["FAE1", "FAE2", "EAP", "Freshman 1"]) {
    assert.ok(answer.includes(level), `${level} is missing from the English answers`);
  }
});

test("the English answers are unambiguous about what counts toward GPA", () => {
  // A student who reads this wrong calculates a GPA that will not match their
  // transcript, so the two halves must stay explicit and opposite.
  const answer = questionsFor("english")
    .map((q) => q.answer)
    .join("\n");

  assert.ok(
    answer.includes("FAE1 and FAE2 (levels 1 and 2) do not count toward your GPA"),
    "the answer must say plainly that FAE1 and FAE2 are excluded"
  );
  assert.ok(
    answer.includes("EAP and Freshman 1 (levels 3 and 4) do count toward your GPA"),
    "the answer must say plainly that EAP and Freshman 1 are included"
  );
});
