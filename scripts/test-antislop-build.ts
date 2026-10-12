// Tests for scripts/build-antislop.ts: the marker rewrite, the two loaders,
// the unruled-eligible-signal guard, and the emitted snapshot.
//
// The corpus these run against is scripts/fixtures/antislop/, committed and
// reviewed. Two reasons it is not content/evidence/ and not written here at
// test time:
//
//   1. On content/evidence/ as it stands, zero of the 26 signals are
//      rule-eligible (2 files are rated `slop` against the 3-file pool minimum
//      in eligibility.ts), so a build over the real corpus writes no counts,
//      emits an empty `rules` array, and passes by having nothing to do.
//      Asserting against it would prove the build runs, not that it computes.
//      Fake ratings in the real directory are not an option either: they would
//      contaminate every count in the project.
//   2. A fixture a test generates is a target the test controls, which is the
//      stale-green shape this repo keeps finding. Committed files are reviewed
//      once, diff when someone changes them, and go through the real
//      parseEvidence/parseRule — the layer most likely to drift.
//
// Tests that mutate (a hand-edited count, a deleted rule, an injected signal)
// copy the committed tree into a temp workspace first, so a test run never
// dirties the repo. The bytes under test are still the committed ones.
import { spawnSync } from "node:child_process";
import { cpSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import assert from "node:assert/strict";
import { ALL_SIGNALS } from "../lib/antislop-vocab.ts";
import { eligibility } from "./antislop/eligibility.ts";
import { applyMarker, buildAntislop, loadCorpus, loadRules, report, type BuildPaths } from "./build-antislop.ts";

const FIXTURE = join(import.meta.dirname, "fixtures/antislop");
const FIXTURE_EVIDENCE = join(FIXTURE, "evidence");
const FIXTURE_RULES = join(FIXTURE, "rules");

// Facts about the committed fixture, asserted rather than assumed. If someone
// edits those files, the tests that pin these are the ones that fail, instead
// of every other test quietly going inert.
const LIVE = "gradient-blob"; // the one signal the fixture makes eligible
const EVIDENCE_COUNT = 10;
const RULE_ID = "fixture-hero-gradient";
const NAMED = 7; // evidence slugs the rule names
const COUNT = "3/6"; // ...of which one is `unresolved` and leaves both sides

const committedRule = () => readFileSync(join(FIXTURE_RULES, `${RULE_ID}.md`), "utf8");

// A throwaway copy of the committed tree. Every mutating test gets its own, so
// nothing needs restoring and no test can leak into another.
function workspace(t: { after: (fn: () => void) => void }): BuildPaths {
  const root = mkdtempSync(join(tmpdir(), "antislop-ws-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  cpSync(FIXTURE, root, { recursive: true });
  return {
    evidenceDir: join(root, "evidence"),
    rulesDir: join(root, "rules"),
    snapshotPath: join(root, "mcp-data/antislop.json"),
  };
}

const ruleFile = (p: BuildPaths) => readFileSync(join(p.rulesDir, `${RULE_ID}.md`), "utf8");
const snapshotOf = (p: BuildPaths) => JSON.parse(readFileSync(p.snapshotPath, "utf8"));
const setCount = (p: BuildPaths, value: string) =>
  writeFileSync(
    join(p.rulesDir, `${RULE_ID}.md`),
    applyMarker(ruleFile(p), "count", value, "ws"),
  );

// ---------------------------------------------------------------- applyMarker

test("rewrites content between markers, leaving the rest byte-identical", () => {
  const before = `## Why\n<!-- generated:count start -->0/0<!-- generated:count end -->\ntail`;
  const after = applyMarker(before, "count", "38/40", "rules/x.md");
  assert.ok(after.includes("<!-- generated:count start -->38/40<!-- generated:count end -->"));
  assert.ok(after.startsWith("## Why\n"));
  assert.ok(after.endsWith("\ntail"));
});

test("a missing marker pair is a hard failure naming file and marker", () => {
  assert.throws(() => applyMarker("no markers", "count", "1/1", "rules/x.md"), /rules\/x\.md.*count|count.*rules\/x\.md/s);
});

test("a reversed marker pair is a hard failure, not a negative slice", () => {
  const reversed = `<!-- generated:count end -->0/0<!-- generated:count start -->`;
  assert.throws(() => applyMarker(reversed, "count", "1/1", "rules/x.md"), /order|reversed/i);
});

test("a value containing $& is written literally", () => {
  // String.replace() would expand $& to the match. indexOf/slice does not —
  // this pins the implementation that cannot corrupt a value.
  const before = `<!-- generated:count start -->x<!-- generated:count end -->`;
  assert.ok(applyMarker(before, "count", "$&$1", "rules/x.md").includes("-->$&$1<!--"));
});

// -------------------------------------------------------------- the loaders

test("loadCorpus parses the committed fixture through the real parser", () => {
  const corpus = loadCorpus(FIXTURE_EVIDENCE);
  assert.equal(corpus.size, EVIDENCE_COUNT);
  assert.equal(corpus.get("fixture-slop-1")?.verdict, "slop");
  assert.equal(corpus.get("fixture-control-1")?.cohort, "pre-ai-2015");
  assert.equal(corpus.get("fixture-slop-unresolved")?.signals[LIVE], "unresolved");
  // Shapes the real corpus also uses, so the fixture exercises them: a
  // multi-value context list and a materials list.
  assert.deepEqual(corpus.get("fixture-slop-2")?.context, ["hero", "cta"]);
  assert.deepEqual(corpus.get("fixture-slop-2")?.materials, ["dual-theme"]);
  // Every source must be unresolvable by construction (RFC 2606 .invalid), so
  // a fixture can never be mistaken for a studied page.
  for (const e of corpus.values()) assert.match(e.source, /^https:\/\/example\.invalid\//);
});

test("loadCorpus ignores non-markdown files", (t) => {
  const p = workspace(t);
  writeFileSync(join(p.evidenceDir, "notes.txt"), "not evidence");
  assert.equal(loadCorpus(p.evidenceDir).size, EVIDENCE_COUNT);
});

test("loadCorpus names the offending file when one is malformed", (t) => {
  const p = workspace(t);
  writeFileSync(join(p.evidenceDir, "broken.md"), "no fence here");
  assert.throws(() => loadCorpus(p.evidenceDir), /broken.*frontmatter|frontmatter.*broken/s);
});

test("loadRules parses the committed fixture rule", () => {
  const rules = loadRules(FIXTURE_RULES);
  assert.equal(rules.length, 1);
  assert.equal(rules[0].id, RULE_ID);
  assert.equal(rules[0].signal, LIVE);
  assert.equal(rules[0].stance, "avoid");
  assert.equal(rules[0].evidence.length, NAMED);
});

test("a missing rules directory names the directory", () => {
  assert.throws(() => loadRules(join(FIXTURE, "no-such-dir")), /no-such-dir/);
});

// ------------------------------------------------- the fixture is still live

test("the committed fixture makes exactly one signal eligible", () => {
  // If this fails, either the fixture or the thresholds in eligibility.ts
  // moved, and every assertion below is testing a build with nothing to do —
  // the exact state content/evidence/ is in today.
  const corpus = loadCorpus(FIXTURE_EVIDENCE);
  assert.deepEqual(ALL_SIGNALS.filter((s) => eligibility(s, corpus).eligible), [LIVE]);
});

test("an unresolved rating leaves the eligibility pool, it does not count as absent", () => {
  // 3 slop files rate the signal present and a 4th rates it unresolved. Were
  // unresolved read as absent, slopRate would be 0.75.
  const { slopRate, exemplarRate, controlRate } = eligibility(LIVE, loadCorpus(FIXTURE_EVIDENCE));
  assert.equal(slopRate, 1);
  assert.equal(exemplarRate, 0);
  assert.equal(controlRate, 0);
});

// ------------------------------------------------------------------- the build

test("the build rewrites a stale count to what the evidence supports", (t) => {
  const p = workspace(t);
  setCount(p, "0/0");
  buildAntislop(p);
  // Byte-identical to the committed file: the rewrite produced exactly the
  // count that is checked in, which is what keeps the fixture non-stale.
  assert.equal(ruleFile(p), committedRule());
  assert.ok(committedRule().includes(`-->${COUNT}<!--`));
});

test("the build leaves the committed fixture untouched when nothing is stale", (t) => {
  const p = workspace(t);
  const { rewritten } = buildAntislop(p);
  assert.deepEqual(rewritten, []);
  assert.equal(ruleFile(p), committedRule());
});

test("the build is idempotent: a second run changes nothing", (t) => {
  const p = workspace(t);
  setCount(p, "0/0");
  buildAntislop(p);
  const first = ruleFile(p);
  buildAntislop(p);
  assert.equal(ruleFile(p), first);
});

test("a hand-edited count is restored by the next build", (t) => {
  const p = workspace(t);
  setCount(p, "999/999");
  buildAntislop(p);
  assert.equal(ruleFile(p), committedRule());
  assert.ok(!ruleFile(p).includes("999"));
});

test("the snapshot carries the corpus size, its cohorts, and the computed counts", (t) => {
  const p = workspace(t);
  buildAntislop(p);
  const snap = snapshotOf(p);
  assert.equal(snap.evidenceCount, EVIDENCE_COUNT);
  assert.deepEqual(snap.cohorts, ["pre-ai-2015", "yc-current"]);
  assert.equal(snap.rules.length, 1);
  assert.equal(snap.rules[0].id, RULE_ID);
  assert.equal(snap.rules[0].present, 3);
  // 7 files named, 6 in the denominator: the unresolved one leaves both sides,
  // end to end through loadCorpus -> countRule -> snapshot.
  assert.equal(snap.rules[0].evidence.length, NAMED);
  assert.equal(snap.rules[0].total, 6);
  assert.equal(snap.rules[0].stance, "avoid");
});

test("the snapshot stores the served count, not the placeholder the file carried", (t) => {
  // The body is what the MCP hands an agent. If the marker rewrite and the
  // snapshot disagree, the tool serves 0/0 while the repo says 3/6.
  const p = workspace(t);
  setCount(p, "0/0");
  buildAntislop(p);
  assert.ok(snapshotOf(p).rules[0].body.includes(`-->${COUNT}<!--`));
});

test("a stored rule body does not start with a blank line", (t) => {
  // splitFrontmatter keeps the newline that terminated the closing fence, so
  // an untrimmed body makes every served rule open with an empty line.
  const p = workspace(t);
  buildAntislop(p);
  const body: string = snapshotOf(p).rules[0].body;
  assert.ok(!/^\s*\n/.test(body), JSON.stringify(body.slice(0, 20)));
  assert.ok(body.startsWith("## Avoid"), JSON.stringify(body.slice(0, 20)));
});

// ------------------------------------------------------------------ the guards

test("an eligible signal with no rule fails the build, naming the signal", (t) => {
  const p = workspace(t);
  rmSync(join(p.rulesDir, `${RULE_ID}.md`));
  assert.throws(() => buildAntislop(p), new RegExp(`${LIVE}.*rule-eligible|rule-eligible.*${LIVE}`, "s"));
});

test("a rule naming a slug with no evidence file fails the build, naming the slug", (t) => {
  const p = workspace(t);
  rmSync(join(p.evidenceDir, "fixture-exemplar-3.md"));
  assert.throws(() => buildAntislop(p), /fixture-exemplar-3/);
});

test("an unknown signal in an evidence file fails the build, naming the file", (t) => {
  const p = workspace(t);
  const path = join(p.evidenceDir, "fixture-slop-1.md");
  writeFileSync(path, readFileSync(path, "utf8").replace(`  ${LIVE}:`, "  sparkle:"));
  assert.throws(() => buildAntislop(p), /fixture-slop-1.*sparkle|sparkle.*fixture-slop-1/s);
});

test("the build writes no snapshot when it fails", (t) => {
  // A guard that fails after emitting leaves a snapshot the MCP will serve.
  const p = workspace(t);
  rmSync(join(p.rulesDir, `${RULE_ID}.md`));
  assert.throws(() => buildAntislop(p));
  assert.throws(() => statSync(p.snapshotPath), /ENOENT/);
});

test("one broken rule rewrites no other rule's count", (t) => {
  // Counts are computed for every rule before any file is written. Without
  // that, a build that fails on the third rule leaves the first two rewritten
  // and the snapshot absent — a repo that is neither the old state nor the new.
  //
  // The broken rule must sort AFTER the good one: rules are processed in
  // filename order, so a broken rule that sorts first fails before anything
  // could have been written and the test would pass against a build that
  // writes as it counts. (Caught by mutation: a lazily-counted build survived
  // this test when the file sorted first.)
  const p = workspace(t);
  setCount(p, "0/0");
  const stale = ruleFile(p);
  writeFileSync(
    join(p.rulesDir, "zz-broken.md"),
    committedRule().replace(`signal: ${LIVE}`, "signal: three-card-row").replace(/evidence: \[.*\]/, "evidence: [no-such-file]"),
  );
  assert.throws(() => buildAntislop(p), /no-such-file/);
  assert.equal(ruleFile(p), stale);
});

// ------------------------------------------------------------------- --report

test("--report marks the eligible signal OK and the rest SKIP, with a reason", () => {
  const lines = report(loadCorpus(FIXTURE_EVIDENCE)).split("\n");
  const live = lines.find((l) => l.includes(LIVE));
  assert.match(live ?? "", /^OK/);
  assert.match(live ?? "", /separates/);
  assert.equal(lines.filter((l) => l.startsWith("SKIP")).length, ALL_SIGNALS.length - 1);
});

test("--report names every zero-evidence signal", () => {
  const text = report(loadCorpus(FIXTURE_EVIDENCE));
  assert.match(text, new RegExp(`zero-evidence signals \\(${ALL_SIGNALS.length - 1}\\)`));
  assert.ok(text.includes("emoji-as-icon"), "a signal with no present in any file is dead vocabulary");
});

// ------------------------------------------------- the CLI's own exit codes

// In-process assert.throws proves the guard throws; it does not prove the CLI
// turns that into a non-zero exit, and a build script that exits 0 while
// printing an error is a guard CI will never catch. Driven through the real
// entry point with the path flags, against a workspace copy.
function cli(p: BuildPaths, args: string[] = []) {
  return spawnSync(
    process.execPath,
    [
      join(import.meta.dirname, "build-antislop.ts"),
      "--evidence-dir", p.evidenceDir,
      "--rules-dir", p.rulesDir,
      "--snapshot", p.snapshotPath,
      ...args,
    ],
    { encoding: "utf8" },
  );
}

test("the CLI exits 0 and writes the snapshot on a clean corpus", (t) => {
  const p = workspace(t);
  const run = cli(p);
  assert.equal(run.status, 0, run.stderr);
  assert.equal(snapshotOf(p).rules[0].present, 3);
});

test("the CLI exits non-zero when an eligible signal has no rule", (t) => {
  const p = workspace(t);
  rmSync(join(p.rulesDir, `${RULE_ID}.md`));
  const run = cli(p);
  assert.equal(run.status, 1);
  assert.match(run.stderr, new RegExp(LIVE));
});

test("the CLI exits non-zero when a rule's evidence file is missing", (t) => {
  const p = workspace(t);
  rmSync(join(p.evidenceDir, "fixture-exemplar-3.md"));
  const run = cli(p);
  assert.equal(run.status, 1);
  assert.match(run.stderr, /fixture-exemplar-3/);
});

test("the CLI exits non-zero on an unknown signal in an evidence file", (t) => {
  const p = workspace(t);
  const path = join(p.evidenceDir, "fixture-slop-1.md");
  writeFileSync(path, readFileSync(path, "utf8").replace(`  ${LIVE}:`, "  sparkle:"));
  const run = cli(p);
  assert.equal(run.status, 1);
  assert.match(run.stderr, /sparkle/);
});

test("a path flag with no value fails rather than falling back to the real corpus", () => {
  const run = spawnSync(process.execPath, [join(import.meta.dirname, "build-antislop.ts"), "--rules-dir"], {
    encoding: "utf8",
  });
  assert.equal(run.status, 1);
  assert.match(run.stderr, /--rules-dir needs a path/);
});

// ------------------------------------------------------- the shipped snapshot

test("snapshot stays under the 2MB ceiling", () => {
  const bytes = statSync(join(import.meta.dirname, "../mcp/data/antislop.json")).size;
  assert.ok(bytes < 2_000_000, `antislop.json is ${bytes} bytes; ceiling is 2MB (spec test 7)`);
});
