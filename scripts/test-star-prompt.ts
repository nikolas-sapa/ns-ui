/**
 * StarPrompt's trigger rules.
 *
 * The rule that matters is a NEGATIVE one: the card must never appear just
 * because somebody arrived. A regression there is invisible in review (the
 * card looks fine, it just shows up too early) and expensive — it trains
 * visitors to dismiss it, which burns the copy trigger too.
 *
 * This drives `lib/star-prompt-rule.ts` DIRECTLY. An earlier version of this
 * file reimplemented the rule in a local `replay()` helper, and a mutation
 * that deleted the distinct-slug guard from the component passed green,
 * because the test was checking its own copy of the logic. The rule was
 * extracted so there is only one implementation to test.
 *
 * The React wiring (which trigger fired, the lifetime cap, the copy text) is
 * still asserted against the component source, since those are not pure.
 */
import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
import { VISITS_BEFORE_ASK, recordVisit } from "../lib/star-prompt-rule.ts";

const SRC = readFileSync("app/_components/star-prompt.tsx", "utf8");

let failures = 0;
function check(name: string, fn: () => void) {
  try {
    fn();
    console.log(`  ok   ${name}`);
  } catch (err) {
    failures++;
    console.log(`  -    ${name}`);
    console.log(`       ${err instanceof Error ? err.message : String(err)}`);
  }
}

/** Walks a route sequence through the real rule, as the component's effect does. */
function walk(routes: string[]) {
  let seen: string[] = [];
  let asked = 0;
  let retired = false;
  for (const pathname of routes) {
    if (retired) continue;
    const out = recordVisit(pathname, seen);
    seen = out.seen;
    if (out.ask) {
      asked++;
      retired = true;
    }
  }
  return { asked, distinct: seen.length };
}

// ---- the rule ------------------------------------------------------------

check("VISITS_BEFORE_ASK is a sane threshold", () => {
  assert.ok(Number.isInteger(VISITS_BEFORE_ASK) && VISITS_BEFORE_ASK >= 2, `got ${VISITS_BEFORE_ASK}`);
});
check("arriving on the homepage never asks", () => {
  assert.equal(walk(["/"]).asked, 0);
});
check("arriving straight onto a component page never asks", () => {
  assert.equal(walk(["/components/dialog-emerge"]).asked, 0);
});
check("browsing non-component pages never asks, however many", () => {
  assert.equal(
    walk(["/", "/categories", "/install", "/docs", "/about", "/changelog", "/theming"]).asked,
    0,
  );
});
check(`${VISITS_BEFORE_ASK - 1} distinct components does not ask`, () => {
  assert.equal(walk(Array.from({ length: VISITS_BEFORE_ASK - 1 }, (_, i) => `/components/c${i}`)).asked, 0);
});
check(`${VISITS_BEFORE_ASK} distinct components asks exactly once`, () => {
  assert.equal(walk(Array.from({ length: VISITS_BEFORE_ASK }, (_, i) => `/components/c${i}`)).asked, 1);
});
check("reloading one component page never reaches the threshold", () => {
  const r = walk(Array.from({ length: VISITS_BEFORE_ASK * 5 }, () => "/components/dialog-emerge"));
  assert.equal(r.asked, 0);
  assert.equal(r.distinct, 1, "a reload was counted as a new component");
});
check("bouncing between one component and the catalog never asks", () => {
  const routes: string[] = [];
  for (let i = 0; i < VISITS_BEFORE_ASK * 4; i++) routes.push("/components/dialog-emerge", "/");
  assert.equal(walk(routes).asked, 0);
});
check("it asks once and then stops, however much more browsing happens", () => {
  assert.equal(walk(Array.from({ length: VISITS_BEFORE_ASK + 20 }, (_, i) => `/components/c${i}`)).asked, 1);
});
check("a nested component route is not the detail page", () => {
  assert.equal(walk(Array.from({ length: VISITS_BEFORE_ASK + 2 }, (_, i) => `/components/c${i}/raw`)).asked, 0);
});
check("the catalog itself is not a component page", () => {
  assert.equal(walk(Array.from({ length: VISITS_BEFORE_ASK + 2 }, () => "/components")).asked, 0);
});
check("recordVisit does not mutate the set it is given", () => {
  const before = ["a", "b"];
  recordVisit("/components/c", before);
  assert.deepEqual(before, ["a", "b"], "the caller's array was mutated");
});

// ---- the React wiring, which is not pure ---------------------------------

check("sessionStorage, not localStorage, holds the visit set", () => {
  assert.match(SRC, /sessionStorage\.setItem\(VISITED_KEY/);
  assert.doesNotMatch(SRC, /localStorage\.setItem\(VISITED_KEY/);
});
check("MAX_VIEWS still caps lifetime exposure", () => {
  const maxViews = Number(/const MAX_VIEWS = (\d+)/.exec(SRC)?.[1]);
  assert.ok(Number.isInteger(maxViews) && maxViews >= 1, `got ${maxViews}`);
  assert.match(SRC, /views >= MAX_VIEWS/);
});
check("both triggers route through one ask(), so the cap cannot be bypassed", () => {
  assert.match(SRC, /const onCopied = \(\) => ask\("copied"\)/);
  assert.match(SRC, /if \(earned\) ask\("browsed"\)/);
  assert.equal((SRC.match(/retired\.current = true/g) ?? []).length, 1);
  assert.equal((SRC.match(/localStorage\.setItem\(VIEWS_KEY/g) ?? []).length, 1);
});
check("the copy tells the truth on the browse path", () => {
  assert.match(SRC, /reason === "copied"/);
  const browsed = /: "([^"]*browsing[^"]*)"/.exec(SRC)?.[1] ?? "";
  assert.ok(browsed.length > 0, "no distinct browse-path copy found");
  assert.doesNotMatch(browsed, /Copied/, 'the browse path says "Copied." to someone who copied nothing');
});
check("the component uses the shared rule, not its own copy", () => {
  assert.match(SRC, /from "@\/lib\/star-prompt-rule"/);
  assert.doesNotMatch(SRC, /\\\/components\\\//, "the component re-implements the path rule");
});

console.log("");
if (failures > 0) {
  console.log(`FAIL star-prompt: ${failures} check(s) failed`);
  process.exit(1);
}
console.log("PASS star-prompt: earned triggers only, never on arrival");
