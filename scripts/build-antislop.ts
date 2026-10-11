// Reads content/evidence/ and content/rules/, validates both against the
// closed vocabulary, computes every rule's count from the evidence files it
// names, rewrites the counts in place between generated markers, and emits the
// offline snapshot the MCP server serves.
//
// Fourth instance of the pipeline this repo already runs for registry.json,
// mcp/src/conventions.ts and llms.txt: markdown source in the repo, one
// build-* script that validates and computes, a generated artifact nobody
// hand-edits. The parsing and the arithmetic live in scripts/antislop/*.ts;
// this file owns the I/O, the CLI and the two whole-corpus guards.
//
//   node scripts/build-antislop.ts            build
//   node scripts/build-antislop.ts --report   per-signal eligibility, writes nothing
//
// Run as part of `npm run registry:build`.
import { mkdirSync, readFileSync, readdirSync, realpathSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { ALL_SIGNALS } from "../lib/antislop-vocab.ts";
import { fail, parseEvidence, type Evidence } from "./antislop/evidence.ts";
import { countRule, parseRule, type Rule } from "./antislop/rules.ts";
import { deadSignals, eligibility } from "./antislop/eligibility.ts";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

export type BuildPaths = { evidenceDir: string; rulesDir: string; snapshotPath: string };

export const DEFAULT_PATHS: BuildPaths = {
  evidenceDir: join(ROOT, "content/evidence"),
  rulesDir: join(ROOT, "content/rules"),
  snapshotPath: join(ROOT, "mcp/data/antislop.json"),
};

// Same marker semantics as build-mcp-conventions.ts and build-readme.ts:
//
//   <!-- generated:NAME start -->value<!-- generated:NAME end -->
//
// Everything outside the pair is left byte-untouched, and a missing or
// unpaired marker is a hard failure naming the file and the marker — this
// never inserts a marker the file does not already have. It throws rather
// than calling process.exit, unlike the copy in build-mcp-conventions.ts:
// exiting is the CLI's decision, and a function that kills the process cannot
// be tested for the failure it exists to produce.
//
// indexOf/slice rather than String.replace: a replacement containing `$&`
// would be expanded by replace, and a generated value is not a pattern.
export function applyMarker(text: string, name: string, value: string, path: string): string {
  const start = `<!-- generated:${name} start -->`;
  const end = `<!-- generated:${name} end -->`;
  const startIdx = text.indexOf(start);
  const endIdx = text.indexOf(end);
  if (startIdx === -1 || endIdx === -1) {
    fail(
      path,
      `missing the "${name}" marker pair (expected both "${start}" and "${end}"). ` +
        `Add the markers by hand around the text they should govern — this script ` +
        `only rewrites content between existing markers, it never inserts them.`,
    );
  }
  if (endIdx < startIdx) {
    fail(path, `has the "${name}" marker pair out of order (end appears before start).`);
  }
  return text.slice(0, startIdx + start.length) + value + text.slice(endIdx);
}

// Both loaders take their directory rather than closing over DEFAULT_PATHS:
// the real corpus cannot currently make any signal eligible, so the only way
// to exercise counting, the marker rewrite and the unruled-signal guard is to
// point the build at a fixture tree. See scripts/test-antislop-build.ts.
const markdownIn = (dir: string, what: string): string[] => {
  let names: string[];
  try {
    names = readdirSync(dir);
  } catch {
    fail(dir, `${what} directory is missing or unreadable. It is committed (with a .gitkeep if empty) — a build that silently found nothing would emit an empty snapshot.`);
  }
  return names.filter((f) => f.endsWith(".md")).sort();
};

export function loadCorpus(dir: string = DEFAULT_PATHS.evidenceDir): Map<string, Evidence> {
  const corpus = new Map<string, Evidence>();
  for (const file of markdownIn(dir, "evidence")) {
    const slug = file.replace(/\.md$/, "");
    corpus.set(slug, parseEvidence(readFileSync(join(dir, file), "utf8"), slug));
  }
  return corpus;
}

export function loadRules(dir: string = DEFAULT_PATHS.rulesDir): Rule[] {
  return markdownIn(dir, "rules").map((file) => {
    const id = file.replace(/\.md$/, "");
    return parseRule(readFileSync(join(dir, file), "utf8"), id);
  });
}

// The --report text. Returned rather than printed so the shape is testable:
// one line per signal, then the zero-evidence block.
export function report(corpus: Map<string, Evidence>): string {
  const lines = ALL_SIGNALS.map((s) => {
    const e = eligibility(s, corpus);
    return `${e.eligible ? "OK  " : "SKIP"} ${s.padEnd(26)} ${e.reason}`;
  });
  const dead = deadSignals(corpus);
  if (dead.length > 0) {
    lines.push(
      "",
      `zero-evidence signals (${dead.length}): ${dead.join(", ")}`,
      "These fired 'present' in no file. Either the pattern has passed, or the signal is named at the wrong altitude — see vocabulary-v2 section 2.",
    );
  }
  return lines.join("\n");
}

export type BuildResult = { evidenceCount: number; ruleCount: number; rewritten: string[]; snapshotBytes: number };

export function buildAntislop(paths: BuildPaths = DEFAULT_PATHS): BuildResult {
  const corpus = loadCorpus(paths.evidenceDir);
  const rules = loadRules(paths.rulesDir);

  // Every signal must be reachable by a rule or explicitly ineligible —
  // otherwise it validates, counts, and emits while backing nothing, which no
  // per-file check can catch. Reported together: fixing them one build at a
  // time is six builds to learn there are six.
  const ruled = new Set(rules.map((r) => r.signal));
  const orphans = ALL_SIGNALS.filter((s) => eligibility(s, corpus).eligible && !ruled.has(s));
  if (orphans.length > 0) {
    throw new Error(
      `${orphans.length} rule-eligible signal(s) with no rule in ${paths.rulesDir}: ${orphans.join(", ")}. ` +
        `Author a rule for each, or the signal counts toward nothing. ` +
        `Run with --report for the evidence behind each verdict.`,
    );
  }

  // Count everything before writing anything. countRule fails on a rule that
  // names a slug with no file, and a build that has already rewritten three
  // rule files by then leaves the repo half-generated.
  const counted = rules.map((r) => ({ rule: r, ...countRule(r, corpus) }));

  const rewritten: string[] = [];
  const served = counted.map(({ rule, present, total }) => {
    const count = `${present}/${total}`;
    const rel = `content/rules/${rule.id}.md`;
    const path = join(paths.rulesDir, `${rule.id}.md`);
    const before = readFileSync(path, "utf8");
    const after = applyMarker(before, "count", count, rel);
    if (before !== after) {
      writeFileSync(path, after);
      rewritten.push(rule.id);
    }
    // The served body carries the same count the file now does. Storing the
    // body as parsed would ship the placeholder the author typed: the MCP
    // would answer "0/0 files studied" while content/rules/ says 3/6, and
    // nothing downstream could see the two disagree.
    //
    // Trimmed here rather than in the MCP formatter so the snapshot is the
    // canonical text: splitFrontmatter keeps the newline that terminated the
    // closing fence, and an untrimmed body opens every served rule with a
    // blank line.
    return { ...rule, body: applyMarker(rule.body, "count", count, rel).trim(), present, total };
  });

  const snapshot = JSON.stringify(
    {
      generatedAt: new Date().toISOString(),
      evidenceCount: corpus.size,
      cohorts: [...new Set([...corpus.values()].map((e) => e.cohort))].sort(),
      rules: served,
    },
    null,
    2,
  );
  mkdirSync(dirname(paths.snapshotPath), { recursive: true });
  writeFileSync(paths.snapshotPath, `${snapshot}\n`);

  return {
    evidenceCount: corpus.size,
    ruleCount: rules.length,
    rewritten,
    snapshotBytes: Buffer.byteLength(snapshot) + 1,
  };
}

// The three path flags exist so the guards below can be proven to fire. On
// content/evidence/ as it stands no signal is rule-eligible and content/rules/
// is empty, so "delete an evidence file a rule depends on" deletes a file no
// rule depends on and the build exits 0 — a guard nobody has watched go red.
// Pointing the real CLI at a fixture tree is what makes the red run real, and
// scripts/test-antislop-build.ts asserts the exit code through these flags.
// A flag with no value is a hard failure: silently falling back to the real
// corpus is how a fixture run would quietly rewrite the repo.
function flag(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  if (i === -1) return undefined;
  const value = process.argv[i + 1];
  if (value === undefined || value.startsWith("--")) {
    throw new Error(`--${name} needs a path. Omit the flag to use the repo's own directory.`);
  }
  return value;
}

function main(): void {
  const paths: BuildPaths = {
    evidenceDir: flag("evidence-dir") ?? DEFAULT_PATHS.evidenceDir,
    rulesDir: flag("rules-dir") ?? DEFAULT_PATHS.rulesDir,
    snapshotPath: flag("snapshot") ?? DEFAULT_PATHS.snapshotPath,
  };

  if (process.argv.includes("--report")) {
    console.log(report(loadCorpus(paths.evidenceDir)));
    return;
  }
  const { evidenceCount, ruleCount, rewritten, snapshotBytes } = buildAntislop(paths);
  // Repo-relative where it can be, matching the one-line summary every other
  // script in the registry:build chain prints.
  const where = paths.snapshotPath.startsWith(ROOT) ? relative(ROOT, paths.snapshotPath) : paths.snapshotPath;
  console.log(
    `${where}: ${evidenceCount} evidence file(s), ${ruleCount} rule(s), ` +
      `${snapshotBytes} bytes` +
      (rewritten.length > 0 ? `; count rewritten in ${rewritten.join(", ")}` : ""),
  );
}

// Importing this module must not run the build: the test suite imports
// applyMarker and buildAntislop, and a top-level run would rebuild the real
// corpus — and fail the suite on the real corpus's own state — on every
// `node --test`.
const entry = process.argv[1];
let invokedDirectly = false;
try {
  invokedDirectly = entry !== undefined && realpathSync(entry) === import.meta.filename;
} catch {
  invokedDirectly = false;
}

if (invokedDirectly) {
  try {
    main();
  } catch (err) {
    console.error(`build-antislop: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  }
}
