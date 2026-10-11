// Tests for scripts/build-antislop.ts: the marker rewrite, the two loaders,
// the unruled-eligible-signal guard, and the emitted snapshot.
//
// Why there is a fixture corpus in here. On content/evidence/ as it stands,
// zero of the 26 signals are eligible — 2 files are rated `slop` against a
// 3-file pool minimum in eligibility.ts — so a build over the real corpus
// writes no counts, emits an empty `rules` array, and passes by having
// nothing to do. Asserting against it would prove the build runs, not that it
// computes anything. Every claim about counting, marker rewriting and the
// guard is therefore made against a corpus written to a temp directory at
// test time: 3 slop + 3 exemplar + 3 pre-ai-2015 files, which is exactly
// enough for `gradient-blob` to clear every gate, plus one rule that uses it.
//
// Fixtures never land in content/evidence/. A fabricated rating sitting in the
// real corpus directory would silently contaminate every count in the project,
// which is a worse outcome than an untested build.
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ALL_SIGNALS } from "../lib/antislop-vocab.ts";
import { eligibility } from "./antislop/eligibility.ts";
import { applyMarker, buildAntislop, loadCorpus, loadRules, report, type BuildPaths } from "./build-antislop.ts";

// The one signal the fixture is built to make eligible. Named once: if the
// thresholds in eligibility.ts move, the test below that pins this is the one
// that fails, rather than every other test quietly going inert.
const LIVE = "gradient-blob";

const evidenceText = (slug: string, cohort: string, verdict: string, value: string) => `---
source: https://example.com/${slug}
kind: site
cohort: ${cohort}
context: [hero]
verdict: ${verdict}
studied: 2026-10-11
signals:
  ${LIVE}: ${value}
---
Fixture file written by scripts/test-antislop-build.ts. Not evidence.`;

// 3 rated files in each verdict pool and 3 in the control cohort: the minimums
// eligibility.ts fails closed on. `present` in all three slop files and absent
// everywhere else gives a gap of 1.0 against a 0.3 floor, and a control rate
// of 0 against a 0.3 ceiling.
const ROWS: readonly [slug: string, cohort: string, verdict: string, value: string][] = [
  ["slop-1", "yc-current", "slop", "present"],
  ["slop-2", "yc-current", "slop", "present"],
  ["slop-3", "yc-current", "slop", "present"],
  ["good-1", "yc-current", "exemplar", "absent"],
  ["good-2", "yc-current", "exemplar", "absent"],
  ["good-3", "yc-current", "exemplar", "absent"],
  ["old-1", "pre-ai-2015", "mixed", "absent"],
  ["old-2", "pre-ai-2015", "mixed", "absent"],
  ["old-3", "pre-ai-2015", "mixed", "absent"],
];

const RULE_ID = "hero-gradient";
// Deliberately NOT every file in the corpus: a rule's count comes from the
// files it names, and a denominator that happens to equal the corpus size
// cannot tell the two apart.
const RULE_EVIDENCE = ROWS.filter(([, cohort]) => cohort !== "pre-ai-2015").map(([slug]) => slug);
const RULE_TEXT = `---
context: hero
signal: ${LIVE}
stance: avoid
severity: soft
evidence: [${RULE_EVIDENCE.join(", ")}]
---
## Avoid

A gradient blob behind the hero headline.

Seen in <!-- generated:count start -->0/0<!-- generated:count end --> of the
files studied for this rule.
`;

// Each fixture gets its own temp tree, so a test that mutates a rule file or
// deletes a rule has nothing to restore and cannot leak into another test.
function fixture(t: { after: (fn: () => void) => void }, opts: { rule?: boolean } = {}): BuildPaths {
  const root = mkdtempSync(join(tmpdir(), "antislop-fixture-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const paths: BuildPaths = {
    evidenceDir: join(root, "content/evidence"),
    rulesDir: join(root, "content/rules"),
    snapshotPath: join(root, "mcp/data/antislop.json"),
  };
  mkdirSync(paths.evidenceDir, { recursive: true });
  mkdirSync(paths.rulesDir, { recursive: true });
  for (const [slug, cohort, verdict, value] of ROWS) {
    writeFileSync(join(paths.evidenceDir, `${slug}.md`), evidenceText(slug, cohort, verdict, value));
  }
  if (opts.rule !== false) writeFileSync(join(paths.rulesDir, `${RULE_ID}.md`), RULE_TEXT);
  return paths;
}

const ruleFile = (p: BuildPaths) => readFileSync(join(p.rulesDir, `${RULE_ID}.md`), "utf8");
const snapshotOf = (p: BuildPaths) => JSON.parse(readFileSync(p.snapshotPath, "utf8"));

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

test("loadCorpus keys evidence by slug and ignores non-markdown files", (t) => {
  const p = fixture(t);
  writeFileSync(join(p.evidenceDir, "notes.txt"), "not evidence");
  const corpus = loadCorpus(p.evidenceDir);
  assert.equal(corpus.size, ROWS.length);
  assert.equal(corpus.get("slop-1")?.verdict, "slop");
  assert.equal(corpus.get("old-1")?.cohort, "pre-ai-2015");
});

test("loadCorpus names the offending file when one is malformed", (t) => {
  const p = fixture(t);
  writeFileSync(join(p.evidenceDir, "broken.md"), "no fence here");
  assert.throws(() => loadCorpus(p.evidenceDir), /broken.*frontmatter|frontmatter.*broken/s);
});

test("loadRules parses each rule, and a missing rules directory names the directory", (t) => {
  const p = fixture(t);
  const rules = loadRules(p.rulesDir);
  assert.equal(rules.length, 1);
  assert.equal(rules[0].id, RULE_ID);
  assert.equal(rules[0].signal, LIVE);
  rmSync(p.rulesDir, { recursive: true });
  assert.throws(() => loadRules(p.rulesDir), /content\/rules|rules/);
});

// ------------------------------------------------- the fixture is still live

test("the fixture corpus makes exactly one signal eligible", (t) => {
  // If this fails, the thresholds in eligibility.ts moved and every assertion
  // below is testing a build that has nothing to do — the exact failure mode
  // the real corpus has today.
  const corpus = loadCorpus(fixture(t).evidenceDir);
  const live = ALL_SIGNALS.filter((s) => eligibility(s, corpus).eligible);
  assert.deepEqual(live, [LIVE]);
});

// ------------------------------------------------------------------- the build

test("the build rewrites the count from the evidence, leaving the rest byte-identical", (t) => {
  const p = fixture(t);
  buildAntislop(p);
  const after = ruleFile(p);
  // 3 present of 6 rated: the 3 pre-ai-2015 files are not in this rule's
  // evidence list, so they are in neither side of the count.
  assert.ok(after.includes("<!-- generated:count start -->3/6<!-- generated:count end -->"), after);
  assert.equal(after.replace("3/6", "0/0"), RULE_TEXT);
});

test("the build is idempotent: a second run changes nothing", (t) => {
  const p = fixture(t);
  buildAntislop(p);
  const first = ruleFile(p);
  buildAntislop(p);
  assert.equal(ruleFile(p), first);
});

test("a hand-edited count is restored by the next build", (t) => {
  const p = fixture(t);
  buildAntislop(p);
  const path = join(p.rulesDir, `${RULE_ID}.md`);
  writeFileSync(path, ruleFile(p).replace("3/6", "999/999"));
  buildAntislop(p);
  assert.ok(ruleFile(p).includes("-->3/6<!--"));
  assert.ok(!ruleFile(p).includes("999"));
});

test("the snapshot carries the corpus size, its cohorts, and the computed counts", (t) => {
  const p = fixture(t);
  buildAntislop(p);
  const snap = snapshotOf(p);
  assert.equal(snap.evidenceCount, ROWS.length);
  assert.deepEqual([...snap.cohorts].sort(), ["pre-ai-2015", "yc-current"]);
  assert.equal(snap.rules.length, 1);
  assert.equal(snap.rules[0].id, RULE_ID);
  assert.equal(snap.rules[0].present, 3);
  assert.equal(snap.rules[0].total, 6);
  assert.equal(snap.rules[0].stance, "avoid");
  assert.deepEqual(snap.rules[0].evidence, RULE_EVIDENCE);
});

test("the snapshot stores the served count, not the placeholder the file carried", (t) => {
  // The body is what the MCP hands an agent. If the marker rewrite and the
  // snapshot disagree, the tool serves 0/0 while the repo says 3/6.
  const p = fixture(t);
  buildAntislop(p);
  assert.ok(snapshotOf(p).rules[0].body.includes("-->3/6<!--"));
});

test("a stored rule body does not start with a blank line", (t) => {
  // splitFrontmatter keeps the newline that terminated the closing fence, so
  // an untrimmed body makes every served rule open with an empty line.
  const p = fixture(t);
  buildAntislop(p);
  const body: string = snapshotOf(p).rules[0].body;
  assert.ok(!/^\s*\n/.test(body), JSON.stringify(body.slice(0, 20)));
  assert.ok(body.startsWith("## Avoid"), JSON.stringify(body.slice(0, 20)));
});

// ------------------------------------------------------------------ the guards

test("an eligible signal with no rule fails the build, naming the signal", (t) => {
  const p = fixture(t, { rule: false });
  assert.throws(() => buildAntislop(p), new RegExp(`${LIVE}.*rule-eligible|rule-eligible.*${LIVE}`, "s"));
});

test("a rule naming a slug with no evidence file fails the build, naming the slug", (t) => {
  const p = fixture(t);
  rmSync(join(p.evidenceDir, "good-3.md"));
  assert.throws(() => buildAntislop(p), /good-3/);
});

test("an unknown signal in an evidence file fails the build, naming the file", (t) => {
  const p = fixture(t);
  const path = join(p.evidenceDir, "slop-1.md");
  writeFileSync(path, readFileSync(path, "utf8").replace(`  ${LIVE}:`, "  sparkle:"));
  assert.throws(() => buildAntislop(p), /slop-1.*sparkle|sparkle.*slop-1/s);
});

test("the build writes no snapshot when it fails", (t) => {
  // A guard that fails after emitting leaves a snapshot the MCP will serve.
  const p = fixture(t, { rule: false });
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
  // this test when the file was named broken.md.)
  const p = fixture(t);
  writeFileSync(
    join(p.rulesDir, "zz-broken.md"),
    RULE_TEXT.replace(`signal: ${LIVE}`, "signal: three-card-row").replace(/evidence: \[.*\]/, "evidence: [no-such-file]"),
  );
  assert.throws(() => buildAntislop(p), /no-such-file/);
  assert.equal(ruleFile(p), RULE_TEXT);
});

// ------------------------------------------------------------------- --report

test("--report marks the eligible signal OK and the rest SKIP, with a reason", (t) => {
  const corpus = loadCorpus(fixture(t).evidenceDir);
  const lines = report(corpus).split("\n");
  const live = lines.find((l) => l.includes(LIVE));
  assert.match(live ?? "", /^OK/);
  assert.match(live ?? "", /separates/);
  assert.equal(lines.filter((l) => l.startsWith("SKIP")).length, ALL_SIGNALS.length - 1);
});

test("--report names every zero-evidence signal", (t) => {
  const corpus = loadCorpus(fixture(t).evidenceDir);
  const text = report(corpus);
  assert.match(text, /zero-evidence signals \(25\)/);
  assert.ok(text.includes("emoji-as-icon"), "a signal with no present in any file is dead vocabulary");
});

// ------------------------------------------------- the CLI's own exit codes

// In-process assert.throws proves the guard throws; it does not prove the CLI
// turns that into a non-zero exit, and a build script that exits 0 while
// printing an error is a guard CI will never catch. Driven through the real
// entry point with the path flags, against the fixture tree.
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
  const p = fixture(t);
  const run = cli(p);
  assert.equal(run.status, 0, run.stderr);
  assert.equal(snapshotOf(p).rules[0].present, 3);
});

test("the CLI exits non-zero when an eligible signal has no rule", (t) => {
  const run = cli(fixture(t, { rule: false }));
  assert.equal(run.status, 1);
  assert.match(run.stderr, new RegExp(LIVE));
});

test("the CLI exits non-zero when a rule's evidence file is missing", (t) => {
  const p = fixture(t);
  rmSync(join(p.evidenceDir, "good-3.md"));
  const run = cli(p);
  assert.equal(run.status, 1);
  assert.match(run.stderr, /good-3/);
});

test("the CLI exits non-zero on an unknown signal in an evidence file", (t) => {
  const p = fixture(t);
  const path = join(p.evidenceDir, "slop-1.md");
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
