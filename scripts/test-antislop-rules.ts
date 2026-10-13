// Unit tests for rule parsing, computed counts and rule eligibility.
// Fixtures are built as Evidence object literals rather than through
// parseEvidence: countRule and eligibility must be testable without the
// parser, or a parser bug reads as a counting bug.
import { test } from "node:test";
import assert from "node:assert/strict";
import { parseRule, countRule } from "./antislop/rules.ts";
import { eligibility, deadSignals } from "./antislop/eligibility.ts";
import type { Evidence } from "./antislop/evidence.ts";

function evidence(slug: string, over: Partial<Evidence> = {}): Evidence {
  return {
    slug,
    source: "https://e.com",
    kind: "site",
    cohort: "yc-current",
    context: ["hero"],
    verdict: "mixed",
    studied: "2026-10-11",
    signals: {},
    materials: [],
    prose: "x",
    ...over,
  };
}

function ev(slug: string, signal: string, value: string): Evidence {
  return evidence(slug, { signals: { [signal]: value } as Evidence["signals"] });
}

function evc(slug: string, cohort: string, verdict: string, signal: string, value: string): Evidence {
  return evidence(slug, { cohort, verdict, signals: { [signal]: value } as Evidence["signals"] });
}

// Every gate now has a minimum rated pool, so eligibility fixtures have to
// supply three pools rather than list files one by one. Built here so each
// test body shows only the evidence whose verdict it is actually pinning.
function many(
  prefix: string,
  cohort: string,
  verdict: string,
  signal: string,
  value: string,
  count: number,
): [string, Evidence][] {
  return Array.from({ length: count }, (_, i) => {
    const slug = `${prefix}${i + 1}`;
    return [slug, evc(slug, cohort, verdict, signal, value)] as [string, Evidence];
  });
}

const slops = (signal: string, value: string, count = 3, prefix = "s") =>
  many(prefix, "yc-current", "slop", signal, value, count);
const exemplars = (signal: string, value: string, count = 3, prefix = "e") =>
  many(prefix, "yc-current", "exemplar", signal, value, count);
const controls = (signal: string, value: string, count = 3, prefix = "ctrl") =>
  many(prefix, "pre-ai-2015", "mixed", signal, value, count);

const RULE = `---
id: hero-gradient
context: hero
signal: gradient-blob
stance: avoid
severity: soft
evidence: [a, b, c]
---
## Avoid
<!-- generated:count start -->0/0<!-- generated:count end -->`;

// --- Task 4: rules and counts ---------------------------------------------

test("counts only files where the signal is present", () => {
  const corpus = new Map([
    ["a", ev("a", "gradient-blob", "present")],
    ["b", ev("b", "gradient-blob", "absent")],
    ["c", ev("c", "gradient-blob", "present")],
  ]);
  const rule = parseRule(RULE, "hero-gradient");
  assert.deepEqual(countRule(rule, corpus), { present: 2, total: 3 });
  assert.equal(rule.stance, "avoid");
  assert.deepEqual(rule.evidence, ["a", "b", "c"]);
  // The body is what the MCP tool serves and what Task 6 rewrites the count
  // marker inside, so the fence split must not eat it.
  assert.match(rule.body, /<!-- generated:count start -->0\/0<!-- generated:count end -->/);
});

// Every failure must name the rule file whoever has to fix it will open.
test("every rejection is prefixed with the rule's own path", () => {
  for (const broken of [
    RULE.replace("signal: gradient-blob", "signal: single-theme"),
    RULE.replace("[a, b, c]", "[a, b, a]"),
    RULE.replace("severity: soft\n", ""),
    "no fence at all",
  ]) {
    assert.throws(() => parseRule(broken, "hero-gradient"), /^Error: content\/rules\/hero-gradient\.md: /);
  }
  const corpus = new Map([["a", ev("a", "gradient-blob", "present")]]);
  assert.throws(
    () => countRule(parseRule(RULE, "hero-gradient"), corpus),
    /^Error: content\/rules\/hero-gradient\.md: /,
  );
});

// Review Focus 3
test("unresolved never counts toward a rule", () => {
  const corpus = new Map([
    ["a", ev("a", "gradient-blob", "present")],
    ["b", ev("b", "gradient-blob", "unresolved")],
    ["c", ev("c", "gradient-blob", "unresolved")],
  ]);
  const { present, total } = countRule(parseRule(RULE, "hero-gradient"), corpus);
  assert.equal(present, 1, "unresolved is an admission, not a present");
  assert.equal(total, 1, "unresolved files must leave the denominator too, or the rate is diluted by non-answers");
});

// A signal a file never set is a non-answer exactly like `unresolved`, and it
// is not hypothetical: the migration sets seven new signals across 20 files,
// so an older file can be missing one while the corpus is mid-flight. Counting
// it puts a file that said nothing into the denominator.
test("a signal the file never set leaves both sides, like unresolved", () => {
  const corpus = new Map([
    ["a", ev("a", "gradient-blob", "present")],
    ["b", ev("b", "three-card-row", "present")], // says nothing about gradient-blob
    ["c", ev("c", "gradient-blob", "absent")],
  ]);
  assert.deepEqual(countRule(parseRule(RULE, "hero-gradient"), corpus), { present: 1, total: 2 });
});

// Review Focus 2
test("a duplicate slug in evidence: is rejected, not double-counted", () => {
  assert.throws(() => parseRule(RULE.replace("[a, b, c]", "[a, b, a]"), "hero-gradient"), /duplicate.*a/i);
});

test("a rule naming a slug with no evidence file fails, naming the slug", () => {
  const corpus = new Map([["a", ev("a", "gradient-blob", "present")]]);
  assert.throws(() => countRule(parseRule(RULE, "hero-gradient"), corpus), /\bb\b/);
});

// Review Focus 5
test("a rule whose signal is a material is rejected", () => {
  assert.throws(() => parseRule(RULE.replace("signal: gradient-blob", "signal: single-theme"), "x"), /material|stance/i);
});

test("a rule whose signal is outside the vocabulary is rejected", () => {
  assert.throws(() => parseRule(RULE.replace("gradient-blob", "sparkle"), "x"), /sparkle/);
});

// parseRule carries its own fence handling via the shared splitFrontmatter, so
// the malformed-frontmatter class is pinned here too, not only for evidence.
test("a rule with no frontmatter fence is rejected, naming the problem", () => {
  assert.throws(() => parseRule("## Avoid\njust prose", "hero-gradient"), /frontmatter/i);
  assert.throws(() => parseRule("---\ncontext: hero\nstill going", "hero-gradient"), /frontmatter/i);
});

test("a rule missing a required key is rejected, naming the key", () => {
  // Asserted on the exact message: every required key also has a downstream
  // closed-set check that mentions the same word, so a looser regex passes
  // with the required-key loop deleted.
  assert.throws(
    () => parseRule(RULE.replace("severity: soft\n", ""), "hero-gradient"),
    /missing required key 'severity'/,
  );
  assert.throws(
    () => parseRule(RULE.replace("evidence: [a, b, c]\n", ""), "hero-gradient"),
    /missing required key 'evidence'/,
  );
});

// A rule whose context, stance or severity is outside its closed set is as
// unsatisfiable as the material case — rulesForContext would never return it,
// or the MCP output carries a stance no reader can act on.
test("a rule outside the closed context, stance and severity sets is rejected", () => {
  assert.throws(() => parseRule(RULE.replace("context: hero", "context: heros"), "x"), /heros/);
  assert.throws(() => parseRule(RULE.replace("stance: avoid", "stance: avid"), "x"), /avid/);
  assert.throws(() => parseRule(RULE.replace("severity: soft", "severity: medium"), "x"), /medium/);
});

// 0/0 is a count that reads as evidence and is not.
test("a rule with an empty evidence list is rejected", () => {
  assert.throws(() => parseRule(RULE.replace("[a, b, c]", "[]"), "x"), /evidence/i);
});

// --- Task 5: eligibility --------------------------------------------------

test("a slop signal that separates exemplar from slop and is rare pre-AI is eligible", () => {
  const corpus = new Map([
    ...slops("gradient-blob", "present"),
    ...exemplars("gradient-blob", "absent"),
    ...controls("gradient-blob", "absent"),
  ]);
  assert.equal(eligibility("gradient-blob", corpus).eligible, true);
});

// Fix 1. A craft signal is by definition commoner among exemplars, so testing
// slopRate - exemplarRate made all 10 negative by construction: every craft
// signal was ineligible and the whole `stance: prefer` branch was dead.
test("a craft signal that separates toward exemplars is eligible", () => {
  const corpus = new Map([
    ...exemplars("asymmetric-split", "present"),
    ...slops("asymmetric-split", "absent"),
    ...controls("asymmetric-split", "absent"),
  ]);
  const r = eligibility("asymmetric-split", corpus);
  assert.equal(r.eligible, true, "a craft signal commoner among exemplars is exactly what a prefer rule needs");
  assert.equal(r.exemplarRate, 1);
  assert.equal(r.slopRate, 0);
});

// Fix 1, the half that must NOT be Math.abs. A slop signal commoner among
// exemplars is not a craft signal with a flipped stance; it is a signal whose
// classification is wrong, and that has to surface as ineligible.
test("a slop signal commoner among exemplars stays ineligible, it is not flipped", () => {
  const corpus = new Map([
    ...exemplars("gradient-blob", "present"),
    ...slops("gradient-blob", "absent"),
    ...controls("gradient-blob", "absent"),
  ]);
  const r = eligibility("gradient-blob", corpus);
  assert.equal(r.eligible, false, "an absolute gap would call this eligible with the stance silently inverted");
  assert.match(r.reason, /slop signal/);
});

// Fix 1. An ineligible craft signal must not read like an ineligible slop one.
test("the reason names which direction was tested", () => {
  const slopWrongWay = new Map([
    ...slops("three-card-row", "present"),
    ...exemplars("three-card-row", "present"),
    ...controls("three-card-row", "absent"),
  ]);
  assert.match(eligibility("three-card-row", slopWrongWay).reason, /as a slop signal/);

  const craftWrongWay = new Map([
    ...slops("density-variation", "present"),
    ...exemplars("density-variation", "absent"),
    ...controls("density-variation", "absent"),
  ]);
  const c = eligibility("density-variation", craftWrongWay);
  assert.equal(c.eligible, false);
  assert.match(c.reason, /as a craft signal/);
});

// The direction comes from the signal's class, so a name in neither class has
// no direction to be tested in. It must say that rather than silently default
// to the slop direction and report rates for a name nothing can rate.
test("a signal in neither class is ineligible and says so", () => {
  const corpus = new Map([
    ...slops("sparkle-overload", "present"),
    ...controls("sparkle-overload", "absent"),
  ]);
  const r = eligibility("sparkle-overload", corpus);
  assert.equal(r.eligible, false);
  assert.match(r.reason, /sparkle-overload/);
  assert.match(r.reason, /SLOP_SIGNALS|CRAFT_SIGNALS|vocabulary/);
});

// A decisive finding beats "not enough evidence": a signal known to be a 2014
// convention reports that, even when its verdict pools are thin.
test("a signal already common pre-AI is ineligible — it is a convention", () => {
  const corpus = new Map([
    ...slops("hero-mockup-float", "present", 1),
    ...exemplars("hero-mockup-float", "absent", 1),
    ...controls("hero-mockup-float", "present"),
  ]);
  const r = eligibility("hero-mockup-float", corpus);
  assert.equal(r.eligible, false);
  assert.match(r.reason, /pre-ai-2015|convention/i);
});

// Fix 2. n=0 reading as "0% pre-AI" is a fail-open gate: the signal silently
// clears the exact check that exists to catch pre-AI conventions.
test("no control evidence is ineligible, naming the pool size", () => {
  const corpus = new Map([
    ...slops("gradient-blob", "present"),
    ...exemplars("gradient-blob", "absent"),
  ]);
  const r = eligibility("gradient-blob", corpus);
  assert.equal(r.eligible, false, "a signal with no control evidence must not clear the control gate");
  assert.match(r.reason, /n=0/);
});

// The signal's own positive count, which neither pool gate constrains. The
// gate first opened with badge-pill-spam eligible on ONE `present` file: 1 of
// 3 slop files is 33%, which clears the 0.3 separation gap, and both pool
// minimums were satisfied because they count RATED files, not observations.
test("a signal observed fewer than 3 times corpus-wide is ineligible", () => {
  const corpus = new Map([
    // 1 present among the slop pool, 0 elsewhere: every rate and pool size
    // clears, and the whole corpus has exactly one observation of the signal.
    ["s1", evc("s1", "yc-current", "slop", "badge-pill-spam", "present")],
    ["s2", evc("s2", "yc-current", "slop", "badge-pill-spam", "absent")],
    ["s3", evc("s3", "yc-current", "slop", "badge-pill-spam", "absent")],
    ...exemplars("badge-pill-spam", "absent"),
    ...controls("badge-pill-spam", "absent"),
  ]);
  const r = eligibility("badge-pill-spam", corpus);
  assert.equal(r.eligible, false, "one observation cannot authorize a rule");
  assert.match(r.reason, /only 1 file\(s\)|anecdote/i);
});

test("three observations corpus-wide clears the present-count gate", () => {
  const corpus = new Map([
    ...slops("gradient-blob", "present"),
    ...exemplars("gradient-blob", "absent"),
    ...controls("gradient-blob", "absent"),
  ]);
  assert.equal(eligibility("gradient-blob", corpus).eligible, true);
});

test("a control pool below the minimum is ineligible", () => {
  const base: [string, Evidence][] = [
    ...slops("gradient-blob", "present"),
    ...exemplars("gradient-blob", "absent"),
  ];
  for (const n of [1, 2]) {
    const r = eligibility("gradient-blob", new Map([...base, ...controls("gradient-blob", "absent", n)]));
    assert.equal(r.eligible, false, `${n} control file(s) is not enough to rule out a pre-AI convention`);
    assert.match(r.reason, new RegExp(`n=${n}`));
  }
  // The boundary: the minimum itself is enough.
  assert.equal(
    eligibility("gradient-blob", new Map([...base, ...controls("gradient-blob", "absent", 3)])).eligible,
    true,
  );
});

// Fix 2 meets the unresolved discipline: a control file that could not settle
// the signal does not help the pool reach its minimum.
test("unresolved control files do not count toward the pool minimum", () => {
  const corpus = new Map([
    ...slops("gradient-blob", "present"),
    ...exemplars("gradient-blob", "absent"),
    ...controls("gradient-blob", "unresolved", 4),
  ]);
  const r = eligibility("gradient-blob", corpus);
  assert.equal(r.eligible, false, "four files that could not settle the signal are not four rated files");
  assert.match(r.reason, /n=0/);
});

test("a signal that fires on exemplars as often as slop is ineligible", () => {
  const corpus = new Map([
    ...slops("three-card-row", "present"),
    ...exemplars("three-card-row", "present"),
    ...controls("three-card-row", "absent"),
  ]);
  assert.equal(eligibility("three-card-row", corpus).eligible, false);
});

test("ineligibility always states the evidence that disqualified it", () => {
  const corpus = new Map([
    ...slops("hero-mockup-float", "present", 1),
    ...exemplars("hero-mockup-float", "absent", 1),
    ...controls("hero-mockup-float", "present"),
  ]);
  assert.ok(eligibility("hero-mockup-float", corpus).reason.length > 20, "a bare false teaches nobody why");
});

// Spec section 11 — any claim built on these counts states its n. A rate
// printed without the pool it came from reads as a finding at n=20.
test("every reason states the n behind each rate", () => {
  const ok = new Map([
    ...slops("gradient-blob", "present"),
    ...exemplars("gradient-blob", "absent"),
    ...controls("gradient-blob", "absent"),
  ]);
  assert.match(eligibility("gradient-blob", ok).reason, /n=/);
  const conv = new Map([
    ...slops("hero-mockup-float", "present", 1),
    ...controls("hero-mockup-float", "present"),
  ]);
  assert.match(eligibility("hero-mockup-float", conv).reason, /n=/);
});

// Added after a mutation survived: with countRule's unresolved discipline
// tested and eligibility's untested, pooling unresolved as "not present" broke
// nothing. It deflates every rate — a slop signal stops separating and a
// convention slips past the control gate — which is the same corruption as
// counting it in a rule, one layer up.
test("unresolved leaves the pool in eligibility, it is not a 'not present'", () => {
  const sparse = new Map([
    ...slops("gradient-blob", "present", 3, "sp"),
    ...slops("gradient-blob", "unresolved", 3, "su"),
    ...exemplars("gradient-blob", "absent"),
    ...controls("gradient-blob", "absent"),
  ]);
  const r = eligibility("gradient-blob", sparse);
  assert.equal(r.slopRate, 1, "3 unresolved files must not dilute 3/3 into 3/6");
  assert.equal(r.eligible, true);

  // Same failure on the control side, where it reads as a false pass.
  const control = new Map([
    ...controls("hero-mockup-float", "present", 3, "cp"),
    ...controls("hero-mockup-float", "unresolved", 3, "cu"),
    ...slops("hero-mockup-float", "present", 1),
    ...exemplars("hero-mockup-float", "absent", 1),
  ]);
  const c = eligibility("hero-mockup-float", control);
  assert.equal(c.eligible, false, "a convention must not clear the gate because three raters could not settle it");
  assert.match(c.reason, /\(n=3\)/, "the n must be the files that answered, not the files asked");
});

// deadSignals is exported from this module; the plan tests it in Task 6 against
// the real corpus, which cannot distinguish a bug here from thin evidence.
test("deadSignals names every signal no file exhibits, and nothing else", () => {
  const corpus = new Map([["a", ev("a", "gradient-blob", "present")]]);
  const dead = deadSignals(corpus);
  assert.ok(dead.includes("emoji-as-icon"), "a signal with no present in any file is dead vocabulary");
  assert.ok(!dead.includes("gradient-blob"));
  assert.ok(
    deadSignals(new Map([["a", ev("a", "gradient-blob", "absent")]])).includes("gradient-blob"),
    "absent everywhere is still dead — the signal measures nothing yet",
  );
});

// --- Fix 3: the verdict pools fail closed too ------------------------------

// At n=20 the corpus holds 2 slop files, so slopRate is quantised to
// {0, 0.5, 1} and a perfect-looking gap can rest on one or two files. A
// separation computed from that cannot authorize a rule.
test("a slop pool below the minimum is ineligible however wide the gap looks", () => {
  const thin = new Map([
    ...slops("gradient-blob", "present", 2),
    ...exemplars("gradient-blob", "absent"),
    ...controls("gradient-blob", "absent"),
  ]);
  const r = eligibility("gradient-blob", thin);
  assert.equal(r.eligible, false, "a gap of 1.00 over 2 slop files is not evidence");
  assert.equal(r.slopRate, 1, "the rate is still reported, it just cannot authorize anything");
  assert.match(r.reason, /slop.*n=2|n=2.*slop/s);

  // The boundary: the minimum itself is enough.
  const enough = new Map([
    ...slops("gradient-blob", "present", 3),
    ...exemplars("gradient-blob", "absent"),
    ...controls("gradient-blob", "absent"),
  ]);
  assert.equal(eligibility("gradient-blob", enough).eligible, true);
});

// The same reasoning on the other side of the gap. It cannot bind at n=20
// (9 exemplars) but the gap is computed from both pools, so a thin exemplar
// pool makes it just as unreliable.
test("an exemplar pool below the minimum is ineligible", () => {
  const thin = new Map([
    ...slops("gradient-blob", "present"),
    ...exemplars("gradient-blob", "absent", 2),
    ...controls("gradient-blob", "absent"),
  ]);
  const r = eligibility("gradient-blob", thin);
  assert.equal(r.eligible, false);
  assert.match(r.reason, /exemplar.*n=2|n=2.*exemplar/s);
});

// The real corpus case: three-card-row was eligible on slop 1/1 because the
// other slop file left the pool unsettled. Unresolved must not fill a verdict
// pool any more than it fills the control pool.
test("unresolved files do not count toward a verdict pool minimum", () => {
  const corpus = new Map([
    ...slops("three-card-row", "present", 1, "sp"),
    ...slops("three-card-row", "unresolved", 3, "su"),
    ...exemplars("three-card-row", "absent"),
    ...controls("three-card-row", "absent"),
  ]);
  const r = eligibility("three-card-row", corpus);
  assert.equal(r.eligible, false, "1 rated slop file plus 3 non-answers is 1 rated slop file");
  assert.match(r.reason, /n=1/);
});

// Both pools short: the reason must name both, not stop at the first.
test("a reason naming a thin pool names every thin pool", () => {
  const corpus = new Map([
    ...slops("gradient-blob", "present", 2),
    ...exemplars("gradient-blob", "absent", 1),
    ...controls("gradient-blob", "absent"),
  ]);
  const r = eligibility("gradient-blob", corpus);
  assert.equal(r.eligible, false);
  assert.match(r.reason, /slop/);
  assert.match(r.reason, /exemplar/);
});

// --- Fix 4: the control gate is a slop-signal concern ----------------------

// The gate's own reason gives it away: "a rule against it would convict the
// control cohort" is an avoid-rule argument. A prefer rule on a craft signal
// that was common in 2014 praises that cohort; there is nothing to convict.
test("a craft signal common pre-AI is still eligible — the control gate is not its concern", () => {
  const corpus = new Map([
    ...exemplars("one-accent-discipline", "present"),
    ...slops("one-accent-discipline", "absent"),
    ...controls("one-accent-discipline", "present"),
  ]);
  const r = eligibility("one-accent-discipline", corpus);
  assert.equal(r.eligible, true, "71% in 2014 is weak positive evidence for a craft signal, not a disqualification");
  assert.equal(r.controlRate, 1, "the rate is still measured and reported, it just does not gate");
  // A reader seeing "71% in pre-ai-2015" on an eligible signal must be able to
  // tell the gate was skipped rather than passed.
  assert.match(r.reason, /not gated for a craft signal/);
});

// And the pool minimum behind that gate goes with it: a craft signal needs no
// control evidence at all, because a genuinely new technique has none.
test("a craft signal with no control evidence is still eligible", () => {
  const corpus = new Map([
    ...exemplars("live-claim-control", "present"),
    ...slops("live-claim-control", "absent"),
  ]);
  const r = eligibility("live-claim-control", corpus);
  assert.equal(r.eligible, true, "live-claim-control is exactly the new technique an inverted gate would disqualify");
  assert.equal(r.controlRate, 0);
});

// The other half: the gate must stay on for slop signals, both parts of it.
test("a slop signal still answers to the control gate", () => {
  const common = new Map([
    ...slops("gradient-blob", "present"),
    ...exemplars("gradient-blob", "absent"),
    ...controls("gradient-blob", "present"),
  ]);
  const r = eligibility("gradient-blob", common);
  assert.equal(r.eligible, false, "a slop signal common pre-AI is still a convention");
  assert.match(r.reason, /convention/i);

  const none = new Map([
    ...slops("gradient-blob", "present"),
    ...exemplars("gradient-blob", "absent"),
  ]);
  assert.equal(eligibility("gradient-blob", none).eligible, false, "and still fails closed with no control evidence");
});

// The slop-pool minimum is class-independent: a gap computed from one or two
// slop files is unreliable whichever direction it points.
test("a craft signal is still held to the slop-pool minimum", () => {
  const corpus = new Map([
    ...exemplars("editorial-grid-break", "present"),
    ...slops("editorial-grid-break", "absent", 2),
  ]);
  const r = eligibility("editorial-grid-break", corpus);
  assert.equal(r.eligible, false, "2 rated slop files cannot support a separation in either direction");
  assert.match(r.reason, /slop.*n=2|n=2.*slop/s);
});
