# Anti-slop evidence pipeline — session 2 implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn 20 hand-written evidence files into a validated, counted
dataset an agent can query through the ns-ui MCP server.

**Architecture:** Mirrors the pipeline this repo already runs three times
(`registry.json`, `conventions.ts`, `llms.txt`): markdown source files in
the repo, a `build-*` script that validates and computes, a generated JSON
snapshot shipped with the MCP package. The closed vocabulary lives in one
TypeScript module the way `lib/css-tokens.ts` is the single source for the
token line, and counts are computed from resolved evidence slugs so a rule
cannot claim a number its files do not support.

**Tech Stack:** TypeScript run directly by Node (`node scripts/foo.ts`, no
build step — this repo relies on Node's native TS stripping), `node:test`
for assertions, zod for the MCP tool's input schema, `@modelcontextprotocol/sdk`.

**Spec:** `docs/superpowers/specs/2026-10-10-antislop-authority-design.md`
**Vocabulary:** `docs/superpowers/specs/2026-10-11-vocabulary-v3.md` (the decided list)
**Why the vocabulary changed:** `docs/superpowers/specs/2026-10-11-vocabulary-v2.md`

## Global Constraints

- **Worktree:** `/Users/nikolassapalidis/Developer/misc/ns-ui-slop`, branch
  `feat/antislop-authority`. Never `cd` to another ns-ui worktree.
- **No new runtime dependencies.** Spec non-goal. Use the stdlib and what
  `package.json` already carries.
- **Scripts are `.ts` run by `node`**, matching every existing
  `scripts/build-*.ts`. No ts-node, no tsx, no compile step.
- **Generated content sits between markers** — `<!-- generated:NAME start -->value<!-- generated:NAME end -->` — and a missing or unpaired marker is a hard failure naming the file and the marker. Never insert a marker the file does not already have. Copy the mechanism from `scripts/build-mcp-conventions.ts`.
- **MCP stdout carries only JSON-RPC frames.** All diagnostics go to
  `console.error`. A stray `console.log` in `mcp/src/` corrupts the stream.
- **`mcp/data/antislop.json` stays under 2MB** at 300 evidence files (spec
  test 7). The registry snapshot is already 12MB; this one stays lean.
- **Evidence values are exactly `present` | `absent` | `unresolved`.**
- **No screenshots in the repo.** They live in `~/scratch/antislop/shots/`.

## Review Focus

Input classes the spec implies but no task's own happy path exercises. Each
has its test pinned to the task that owns the code.

1. **An evidence file with a malformed or absent frontmatter block** — no
   `---` fence at all, or an unterminated one. Must fail naming the file,
   not throw a regex `TypeError`. (Task 2)
2. **A rule whose `evidence:` list contains a duplicate slug** — the count
   must not double-count it. A rule claiming 40 with 39 distinct files is
   the exact failure the spec's count discipline exists to prevent. (Task 4)
3. **A signal set to `unresolved` must never count toward a rule's
   evidence.** It is an admission the evidence could not settle it;
   counting it inflates every number built on top. (Task 4)
4. **An evidence file with zero signals set** — frontmatter parses, every
   other key is present, `signals:` is empty. Must fail, not emit a file
   that silently contributes nothing. (Task 2)
5. **A `materials` value appearing in a rule's `signal` field** — materials
   are never stance-bearing; the build must reject it rather than emit a
   rule nothing can satisfy. (Task 4)

---

## File Structure

| File | Responsibility |
|---|---|
| `lib/antislop-vocab.ts` | The closed vocabulary. Single source, the way `lib/css-tokens.ts` is for tokens. No I/O. |
| `scripts/build-antislop.ts` | Reads evidence + rules, validates, computes counts and rule-eligibility, rewrites markers, emits the snapshot. |
| `scripts/test-antislop.ts` | The build's own test suite, including the defect-injection checks. |
| `mcp/src/antislop.ts` | Loads `mcp/data/antislop.json`, exposes typed lookup. Mirrors `mcp/src/data.ts`. |
| `mcp/src/index.ts` | Registers `get_antislop_rules`. Modified, not created. |
| `content/evidence/*.md` | 20 existing files, migrated to v3. |
| `content/rules/*.md` | New. Authored only after Task 5 reports eligibility. |

---

### Task 1: The closed vocabulary module

**Files:**
- Create: `lib/antislop-vocab.ts`
- Test: `scripts/test-antislop.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `SLOP_SIGNALS`, `CRAFT_SIGNALS`, `ALL_SIGNALS`, `CONTEXTS`,
  `COHORTS`, `MATERIALS`, `SIGNAL_VALUES`, `KINDS`, `VERDICTS` — all
  `readonly string[]`; plus types `Signal`, `Cohort`, `SignalValue`.

- [ ] **Step 1: Write the failing test**

```ts
// scripts/test-antislop.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { ALL_SIGNALS, SLOP_SIGNALS, CRAFT_SIGNALS, MATERIALS } from "../lib/antislop-vocab.ts";

test("vocabulary matches the decided v3 list", () => {
  assert.equal(SLOP_SIGNALS.length, 16);
  assert.equal(CRAFT_SIGNALS.length, 10);
  assert.equal(ALL_SIGNALS.length, 26);
});

test("no signal appears in both classes", () => {
  const overlap = SLOP_SIGNALS.filter((s) => (CRAFT_SIGNALS as readonly string[]).includes(s));
  assert.deepEqual(overlap, []);
});

test("materials are not signals — they can never carry a stance", () => {
  const leaked = MATERIALS.filter((m) => (ALL_SIGNALS as readonly string[]).includes(m));
  assert.deepEqual(leaked, [], "a material in the signal namespace will have a rule written against it");
});

test("v1 names that were renamed are gone", () => {
  for (const dead of ["feature-icons-identical", "testimonial-card-triplet", "stock-photo-hero", "purple-blue-gradient-cta", "motion-tied-to-input", "dark-mode-afterthought"]) {
    assert.ok(!(ALL_SIGNALS as readonly string[]).includes(dead), `${dead} was renamed or dropped in v3`);
  }
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `node --test scripts/test-antislop.ts`
Expected: FAIL — `Cannot find module '../lib/antislop-vocab.ts'`

- [ ] **Step 3: Write the module**

Transcribe the tables in `docs/superpowers/specs/2026-10-11-vocabulary-v3.md`
exactly. The 16 slop signals, in that document's order: `gradient-blob`,
`three-card-row`, `glass-card-overuse`, `emoji-as-icon`,
`generic-sans-default`, `symmetric-everything`, `badge-pill-spam`,
`generic-line-icon-set`, `testimonial-card-row`, `indigo-violet-accent`,
`gradient-fill-cta`, `scroll-reveal-blank`, `typewriter-headline`,
`stock-photo-generic`, `centered-hero-stack`, `hero-mockup-float`.

The 10 craft signals: `asymmetric-split`, `single-optical-anchor`,
`type-scale-high-contrast`, `editorial-grid-break`, `custom-type-pairing`,
`real-product-screenshot`, `artifact-not-dashboard`, `density-variation`,
`one-accent-discipline`, `live-claim-control`.

```ts
// The closed vocabulary every evidence file and rule is validated against.
// Decided in docs/superpowers/specs/2026-10-11-vocabulary-v3.md after 20
// evidence files invalidated a third of the list written before any site
// was studied. Adding a name here is a deliberate act: scripts/build-antislop.ts
// rejects anything outside these arrays, which is what keeps the counts
// meaningful. See the v2 doc for why each rename was forced.
export const SLOP_SIGNALS = [
  "gradient-blob",
  // ... the 16, in v3's order
] as const;

export const CRAFT_SIGNALS = [
  "asymmetric-split",
  // ... the 10
] as const;

export const ALL_SIGNALS = [...SLOP_SIGNALS, ...CRAFT_SIGNALS] as const;

// Descriptive facts a page is made of. Deliberately NOT signals: a material
// cannot carry a stance, so a rule must never be written against one. Open
// list — extend as evidence demands.
export const MATERIALS = [
  "single-theme", "dual-theme", "stock-photo", "commissioned-photo",
  "illustration", "webgl", "video-hero",
] as const;

export const CONTEXTS = [
  "hero", "nav", "pricing", "features", "testimonials", "cta", "footer",
  "docs", "dashboard", "empty-state", "404", "auth", "blog-index", "article",
] as const;

export const COHORTS = [
  "yc-current", "yc-2015-2019", "agent-tools", "design-studio",
  "pre-ai-2015", "print", "architecture", "infographic", "academic-paper",
] as const;

// `unresolved` is an admission the evidence could not settle the signal,
// not a judgment. It must never count toward a rule — see build-antislop.ts.
export const SIGNAL_VALUES = ["present", "absent", "unresolved"] as const;
export const KINDS = ["site", "paper", "repo", "tool", "artifact"] as const;
export const VERDICTS = ["exemplar", "slop", "mixed"] as const;

export type Signal = (typeof ALL_SIGNALS)[number];
export type Cohort = (typeof COHORTS)[number];
export type SignalValue = (typeof SIGNAL_VALUES)[number];
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `node --test scripts/test-antislop.ts`
Expected: PASS, 4 tests.

- [ ] **Step 5: Commit**

```bash
git add lib/antislop-vocab.ts scripts/test-antislop.ts
git commit -m "feat(antislop): closed signal vocabulary, v3

26 signals (16 slop, 10 craft) plus a separate non-stance-bearing
materials list. Single source the build validates against, the way
lib/css-tokens.ts is for the token line."
```

---

### Task 2: Evidence parsing and validation

**Files:**
- Create: `scripts/build-antislop.ts`
- Modify: `scripts/test-antislop.ts`

**Interfaces:**
- Consumes: `lib/antislop-vocab.ts` (Task 1).
- Produces: `export type Evidence = { slug, source, kind, cohort, context: string[], verdict, studied, signals: Record<string, SignalValue>, materials: string[], prose: string }` and `export function parseEvidence(text: string, slug: string): Evidence` — throws `Error` with a message naming the slug and the problem.

- [ ] **Step 1: Write the failing tests**

```ts
// append to scripts/test-antislop.ts
import { parseEvidence } from "./build-antislop.ts";

const GOOD = `---
source: https://example.com
kind: site
cohort: yc-current
context: [hero]
verdict: exemplar
studied: 2026-10-11
signals:
  gradient-blob: absent
  asymmetric-split: present
---
Prose.`;

test("parses a well-formed evidence file", () => {
  const e = parseEvidence(GOOD, "example");
  assert.equal(e.cohort, "yc-current");
  assert.equal(e.signals["asymmetric-split"], "present");
  assert.equal(e.prose.trim(), "Prose.");
});

test("rejects a signal outside the vocabulary, naming signal and file", () => {
  const bad = GOOD.replace("gradient-blob:", "sparkle-overload:");
  assert.throws(() => parseEvidence(bad, "example"), /sparkle-overload.*example|example.*sparkle-overload/s);
});

test("rejects a value outside present/absent/unresolved", () => {
  assert.throws(() => parseEvidence(GOOD.replace("absent", "maybe"), "example"), /maybe/);
});

test("rejects an unknown cohort", () => {
  assert.throws(() => parseEvidence(GOOD.replace("yc-current", "yc-2026"), "example"), /yc-2026/);
});

test("rejects a missing required key, naming the key", () => {
  assert.throws(() => parseEvidence(GOOD.replace("studied: 2026-10-11\n", ""), "example"), /studied/);
});

// Review Focus 1
test("rejects a file with no frontmatter fence rather than throwing TypeError", () => {
  assert.throws(() => parseEvidence("no fence here, just prose", "example"), /frontmatter/i);
});

test("rejects an unterminated frontmatter fence", () => {
  assert.throws(() => parseEvidence("---\nsource: https://x.com\nstill going", "example"), /frontmatter/i);
});

// Review Focus 4
test("rejects a file with zero signals set", () => {
  const empty = GOOD.replace(/signals:\n(  .*\n)+/, "signals:\n");
  assert.throws(() => parseEvidence(empty, "example"), /signals/i);
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `node --test scripts/test-antislop.ts`
Expected: FAIL — `parseEvidence` is not exported.

- [ ] **Step 3: Implement the parser**

Hand-rolled, no YAML dependency — the frontmatter here is a fixed shape and
the spec forbids new runtime deps.

```ts
import { ALL_SIGNALS, COHORTS, CONTEXTS, KINDS, MATERIALS, SIGNAL_VALUES, VERDICTS } from "../lib/antislop-vocab.ts";

const REQUIRED = ["source", "kind", "cohort", "context", "verdict", "studied"] as const;

function fail(slug: string, msg: string): never {
  throw new Error(`content/evidence/${slug}.md: ${msg}`);
}

export function parseEvidence(text: string, slug: string): Evidence {
  // A missing or unterminated fence must name the problem, not blow up on a
  // null match downstream.
  if (!text.startsWith("---\n")) fail(slug, "no frontmatter: file must start with '---'");
  const end = text.indexOf("\n---", 3);
  if (end === -1) fail(slug, "unterminated frontmatter: no closing '---'");
  const head = text.slice(4, end);
  const prose = text.slice(end + 4);

  const scalars: Record<string, string> = {};
  const signals: Record<string, string> = {};
  let inSignals = false;
  for (const line of head.split("\n")) {
    if (!line.trim()) continue;
    if (line === "signals:") { inSignals = true; continue; }
    if (inSignals && line.startsWith("  ")) {
      const [k, v] = line.trim().split(/:\s*/);
      signals[k] = v;
      continue;
    }
    inSignals = false;
    const [k, ...rest] = line.split(/:\s*/);
    scalars[k] = rest.join(": ");
  }

  for (const key of REQUIRED) if (!scalars[key]) fail(slug, `missing required key '${key}'`);
  if (!KINDS.includes(scalars.kind as never)) fail(slug, `kind '${scalars.kind}' is not one of: ${KINDS.join(", ")}`);
  if (!COHORTS.includes(scalars.cohort as never)) fail(slug, `cohort '${scalars.cohort}' is not one of: ${COHORTS.join(", ")}`);
  if (!VERDICTS.includes(scalars.verdict as never)) fail(slug, `verdict '${scalars.verdict}' is not one of: ${VERDICTS.join(", ")}`);

  const context = (scalars.context ?? "").replace(/[[\]]/g, "").split(",").map((s) => s.trim()).filter(Boolean);
  for (const c of context) if (!CONTEXTS.includes(c as never)) fail(slug, `context '${c}' is not in the vocabulary`);

  const materials = (scalars.materials ?? "").replace(/[[\]]/g, "").split(",").map((s) => s.trim()).filter(Boolean);
  for (const m of materials) if (!MATERIALS.includes(m as never)) fail(slug, `material '${m}' is not in the vocabulary`);

  // An evidence file that sets nothing contributes nothing but still passes
  // every other check — it would inflate the file count behind every rule.
  if (Object.keys(signals).length === 0) fail(slug, "signals: block is empty — an evidence file must set at least one signal");

  for (const [k, v] of Object.entries(signals)) {
    if (!ALL_SIGNALS.includes(k as never)) fail(slug, `signal '${k}' is not in the vocabulary (lib/antislop-vocab.ts)`);
    if (!SIGNAL_VALUES.includes(v as never)) fail(slug, `signal '${k}' has value '${v}'; must be ${SIGNAL_VALUES.join(" | ")}`);
  }

  return { slug, source: scalars.source, kind: scalars.kind, cohort: scalars.cohort, context, verdict: scalars.verdict, studied: scalars.studied, signals, materials, prose } as Evidence;
}
```

- [ ] **Step 4: Run to verify they pass**

Run: `node --test scripts/test-antislop.ts`
Expected: PASS, 12 tests.

- [ ] **Step 5: Commit**

```bash
git add scripts/build-antislop.ts scripts/test-antislop.ts
git commit -m "feat(antislop): evidence parser with vocabulary validation

Hand-rolled frontmatter parse, no YAML dep. Malformed, unterminated and
signal-less files fail naming the file and the problem rather than
throwing downstream."
```

---

### Task 3: Migrate the 20 evidence files to v3

**Files:**
- Modify: all 20 `content/evidence/*.md`
- Modify: `scripts/test-antislop.ts`

**Interfaces:**
- Consumes: `parseEvidence` (Task 2).
- Produces: a corpus that parses clean. No new exports.

**Context the implementer needs:** the 20 files were written against v1.
Four signals were renamed, two dropped, seven added. Renames are mechanical;
the seven new signals are unset everywhere and genuinely need a re-pass
against the screenshots, which still exist in `~/scratch/antislop/shots/`
(74 PNGs). **Do not invent values for the new signals.** Set them
`unresolved` wherever the screenshot was not re-examined, and say in the
commit how many were actually looked at.

- [ ] **Step 1: Write the corpus test**

```ts
// append to scripts/test-antislop.ts
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const EVIDENCE_DIR = join(import.meta.dirname, "../content/evidence");

test("every committed evidence file parses against v3", () => {
  const files = readdirSync(EVIDENCE_DIR).filter((f) => f.endsWith(".md"));
  assert.ok(files.length >= 20, `expected the 20 committed files, found ${files.length}`);
  for (const f of files) {
    parseEvidence(readFileSync(join(EVIDENCE_DIR, f), "utf8"), f.replace(/\.md$/, ""));
  }
});

test("seed gate: at least 12 files across at least 3 cohorts", () => {
  const files = readdirSync(EVIDENCE_DIR).filter((f) => f.endsWith(".md"));
  const cohorts = new Set(files.map((f) => parseEvidence(readFileSync(join(EVIDENCE_DIR, f), "utf8"), f).cohort));
  assert.ok(files.length >= 12, `seed gate: ${files.length} files, need 12`);
  assert.ok(cohorts.size >= 3, `seed gate: ${cohorts.size} cohorts, need 3`);
});

test("real-product-screenshot and artifact-not-dashboard are mutually exclusive", () => {
  for (const f of readdirSync(EVIDENCE_DIR).filter((x) => x.endsWith(".md"))) {
    const e = parseEvidence(readFileSync(join(EVIDENCE_DIR, f), "utf8"), f);
    const both = e.signals["real-product-screenshot"] === "present" && e.signals["artifact-not-dashboard"] === "present";
    assert.ok(!both, `${f}: showing the UI and showing the deliverable instead of the UI cannot both be true`);
  }
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `node --test scripts/test-antislop.ts`
Expected: FAIL — v1 names (`feature-icons-identical` etc.) are no longer in the vocabulary.

- [ ] **Step 3: Apply the renames**

```bash
cd content/evidence
sed -i '' \
  -e 's/^  feature-icons-identical:/  generic-line-icon-set:/' \
  -e 's/^  testimonial-card-triplet:/  testimonial-card-row:/' \
  *.md
```

Then, per file, by hand: delete the `purple-blue-gradient-cta`,
`motion-tied-to-input` and `dark-mode-afterthought` lines, and add the
seven new signals. Move each file's theme fact to `materials: [single-theme]`
or `[dual-theme]` — that is where `dark-mode-afterthought`'s information goes.

- [ ] **Step 4: Re-pass the screenshots for the new signals**

For each of the 20, open its PNG in `~/scratch/antislop/shots/` and set the
seven new signals from what is actually visible. Where a signal cannot be
settled from the still — `live-claim-control` needs a visible control label,
`scroll-reveal-blank` needs the full-page capture compared against the
viewport one — set `unresolved`.

- [ ] **Step 5: Run to verify it passes**

Run: `node --test scripts/test-antislop.ts`
Expected: PASS, 15 tests.

- [ ] **Step 6: Commit**

```bash
git add content/evidence/
git commit -m "refactor(antislop): migrate 20 evidence files to vocabulary v3

Renames applied mechanically. The seven new signals were set by
re-examining each file's screenshot; ones a still cannot settle are
unresolved rather than guessed."
```

---

### Task 4: Rules, counts, and the unresolved discipline

**Files:**
- Modify: `scripts/build-antislop.ts`
- Modify: `scripts/test-antislop.ts`
- Create: `content/rules/.gitkeep`

**Interfaces:**
- Consumes: `parseEvidence`, the vocabulary.
- Produces: `export type Rule = { id, context, signal, stance, severity, evidence: string[], body: string }`, `export function parseRule(text, id): Rule`, and `export function countRule(rule: Rule, corpus: Map<string, Evidence>): { present: number; total: number }`.

- [ ] **Step 1: Write the failing tests**

```ts
// append to scripts/test-antislop.ts
import { parseRule, countRule } from "./build-antislop.ts";

function ev(slug: string, signal: string, value: string) {
  return parseEvidence(`---
source: https://e.com
kind: site
cohort: yc-current
context: [hero]
verdict: mixed
studied: 2026-10-11
signals:
  ${signal}: ${value}
---
x`, slug);
}

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

test("counts only files where the signal is present", () => {
  const corpus = new Map([
    ["a", ev("a", "gradient-blob", "present")],
    ["b", ev("b", "gradient-blob", "absent")],
    ["c", ev("c", "gradient-blob", "present")],
  ]);
  assert.deepEqual(countRule(parseRule(RULE, "hero-gradient"), corpus), { present: 2, total: 3 });
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
```

- [ ] **Step 2: Run to verify they fail**

Run: `node --test scripts/test-antislop.ts`
Expected: FAIL — `parseRule` is not exported.

- [ ] **Step 3: Implement**

```ts
export function parseRule(text: string, id: string): Rule {
  // ...same fence handling as parseEvidence, failing with `content/rules/${id}.md: ...`
  // After scalars are read:
  if (MATERIALS.includes(scalars.signal as never)) {
    fail(id, `signal '${scalars.signal}' is a material, not a signal. Materials are descriptive and cannot carry a stance — a rule written against one can never be satisfied.`);
  }
  if (!ALL_SIGNALS.includes(scalars.signal as never)) fail(id, `signal '${scalars.signal}' is not in the vocabulary`);

  const evidence = (scalars.evidence ?? "").replace(/[[\]]/g, "").split(",").map((s) => s.trim()).filter(Boolean);
  const seen = new Set<string>();
  for (const slug of evidence) {
    // A duplicate inflates the numerator against a denominator of distinct
    // files — exactly the drift the computed-count discipline exists to stop.
    if (seen.has(slug)) fail(id, `duplicate slug '${slug}' in evidence:`);
    seen.add(slug);
  }
  // ...
}

export function countRule(rule: Rule, corpus: Map<string, Evidence>) {
  let present = 0, total = 0;
  for (const slug of rule.evidence) {
    const e = corpus.get(slug);
    if (!e) throw new Error(`content/rules/${rule.id}.md: evidence '${slug}' has no file in content/evidence/`);
    const v = e.signals[rule.signal];
    // `unresolved` leaves both sides: it is a statement that the evidence
    // could not settle this, so it can neither support nor oppose the rule.
    if (v === "unresolved" || v === undefined) continue;
    total += 1;
    if (v === "present") present += 1;
  }
  return { present, total };
}
```

- [ ] **Step 4: Run to verify they pass**

Run: `node --test scripts/test-antislop.ts`
Expected: PASS, 21 tests.

- [ ] **Step 5: Commit**

```bash
git add scripts/ content/rules/.gitkeep
git commit -m "feat(antislop): rule parsing and computed counts

unresolved leaves both numerator and denominator — it is an admission the
evidence could not settle the signal, so it can neither support nor oppose
a rule. Duplicate slugs and material-as-signal are rejected."
```

---

### Task 5: Rule eligibility, computed from evidence

**Files:**
- Modify: `scripts/build-antislop.ts`, `scripts/test-antislop.ts`

**Context:** This is the structural finding from session 1. Several v1 slop
signals are pre-AI web conventions — `hero-mockup-float` ran 43% in 2014,
`centered-hero-stack` 5/7 — so a rule against them convicts good pages and
fails against the control cohort the first time anyone checks. Eligibility
is therefore computed, not declared.

**Interfaces:**
- Produces: `export function eligibility(signal: string, corpus: Map<string, Evidence>): { eligible: boolean; reason: string; exemplarRate: number; slopRate: number; controlRate: number }`

- [ ] **Step 1: Write the failing tests**

```ts
// append to scripts/test-antislop.ts
import { eligibility, deadSignals } from "./build-antislop.ts";

function evc(slug: string, cohort: string, verdict: string, signal: string, value: string) {
  return parseEvidence(`---
source: https://e.com
kind: site
cohort: ${cohort}
context: [hero]
verdict: ${verdict}
studied: 2026-10-11
signals:
  ${signal}: ${value}
---
x`, slug);
}

test("a signal that separates exemplar from slop and is rare pre-AI is eligible", () => {
  const corpus = new Map([
    ["s1", evc("s1", "yc-current", "slop", "gradient-blob", "present")],
    ["s2", evc("s2", "yc-current", "slop", "gradient-blob", "present")],
    ["e1", evc("e1", "yc-current", "exemplar", "gradient-blob", "absent")],
    ["e2", evc("e2", "yc-current", "exemplar", "gradient-blob", "absent")],
    ["c1", evc("c1", "pre-ai-2015", "mixed", "gradient-blob", "absent")],
  ]);
  assert.equal(eligibility("gradient-blob", corpus).eligible, true);
});

test("a signal already common pre-AI is ineligible — it is a convention", () => {
  const corpus = new Map([
    ["s1", evc("s1", "yc-current", "slop", "hero-mockup-float", "present")],
    ["e1", evc("e1", "yc-current", "exemplar", "hero-mockup-float", "absent")],
    ["c1", evc("c1", "pre-ai-2015", "mixed", "hero-mockup-float", "present")],
    ["c2", evc("c2", "pre-ai-2015", "mixed", "hero-mockup-float", "present")],
  ]);
  const r = eligibility("hero-mockup-float", corpus);
  assert.equal(r.eligible, false);
  assert.match(r.reason, /pre-ai-2015|convention/i);
});

test("a signal that fires on exemplars as often as slop is ineligible", () => {
  const corpus = new Map([
    ["s1", evc("s1", "yc-current", "slop", "three-card-row", "present")],
    ["e1", evc("e1", "yc-current", "exemplar", "three-card-row", "present")],
    ["e2", evc("e2", "yc-current", "exemplar", "three-card-row", "present")],
  ]);
  assert.equal(eligibility("three-card-row", corpus).eligible, false);
});

test("ineligibility always states the evidence that disqualified it", () => {
  const corpus = new Map([["c1", evc("c1", "pre-ai-2015", "mixed", "hero-mockup-float", "present")]]);
  const r = eligibility("hero-mockup-float", corpus);
  assert.ok(r.reason.length > 20, "a bare false teaches nobody why");
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `node --test scripts/test-antislop.ts` → FAIL, `eligibility` not exported.

- [ ] **Step 3: Implement**

```ts
// Thresholds. Deliberately stated here, not buried: they encode session 1's
// finding and will need revisiting as n grows. See
// docs/superpowers/specs/2026-10-11-vocabulary-v2.md section 6.
const SEPARATION_MIN = 0.3;  // slopRate - exemplarRate
const CONTROL_MAX = 0.3;     // present-rate within pre-ai-2015

// Spec test 9. A signal that never fires is not self-evidently wrong — the
// badge-pill and glassmorphism waves genuinely passed — but it must be
// visible, because the other cause is a definition that cannot match reality.
export function deadSignals(corpus: Map<string, Evidence>): string[] {
  return ALL_SIGNALS.filter((s) =>
    ![...corpus.values()].some((e) => e.signals[s] === "present")
  );
}

export function eligibility(signal: string, corpus: Map<string, Evidence>) {
  const rate = (pred: (e: Evidence) => boolean) => {
    const pool = [...corpus.values()].filter(pred).filter((e) => e.signals[signal] && e.signals[signal] !== "unresolved");
    if (pool.length === 0) return 0;
    return pool.filter((e) => e.signals[signal] === "present").length / pool.length;
  };
  const slopRate = rate((e) => e.verdict === "slop");
  const exemplarRate = rate((e) => e.verdict === "exemplar");
  const controlRate = rate((e) => e.cohort === "pre-ai-2015");

  if (controlRate > CONTROL_MAX) {
    return { eligible: false, exemplarRate, slopRate, controlRate,
      reason: `already present in ${Math.round(controlRate * 100)}% of pre-ai-2015 evidence — a convention, not an AI artifact. A rule against it would convict the control cohort.` };
  }
  if (slopRate - exemplarRate < SEPARATION_MIN) {
    return { eligible: false, exemplarRate, slopRate, controlRate,
      reason: `does not separate: ${Math.round(slopRate * 100)}% of slop vs ${Math.round(exemplarRate * 100)}% of exemplar evidence. A rule would convict pages that did it well.` };
  }
  return { eligible: true, exemplarRate, slopRate, controlRate, reason: `separates ${Math.round(slopRate * 100)}% slop vs ${Math.round(exemplarRate * 100)}% exemplar, ${Math.round(controlRate * 100)}% pre-AI` };
}
```

- [ ] **Step 4: Run to verify they pass**

Run: `node --test scripts/test-antislop.ts` → PASS, 25 tests.

- [ ] **Step 5: Report eligibility across the real corpus**

Run the build's `--report` flag (Task 6) over `content/evidence/` and paste
the per-signal verdict into the commit message. Expect `hero-mockup-float`
and `centered-hero-stack` to come back ineligible — if they do not, the
thresholds are wrong and that is worth knowing before rules are authored.

- [ ] **Step 6: Commit**

```bash
git add scripts/
git commit -m "feat(antislop): rule eligibility computed from evidence

A signal backs a rule only if its present-rate separates exemplar from slop
AND it is not already common in pre-ai-2015. Ineligibility always names the
evidence that disqualified it."
```

---

### Task 6: The build script, markers, and the snapshot

**Files:**
- Modify: `scripts/build-antislop.ts` (add `main()`), `package.json`
- Create: `mcp/data/antislop.json` (generated)

**Interfaces:**
- Produces: a CLI — `node scripts/build-antislop.ts` builds, `--report` prints eligibility without writing.

- [ ] **Step 1: Write the failing tests**

```ts
// append to scripts/test-antislop.ts
import { applyMarker } from "./build-antislop.ts";

test("rewrites content between markers, leaving the rest byte-identical", () => {
  const before = `## Why\n<!-- generated:count start -->0/0<!-- generated:count end -->\ntail`;
  const after = applyMarker(before, "count", "38/40", "rules/x.md");
  assert.ok(after.includes("<!-- generated:count start -->38/40<!-- generated:count end -->"));
  assert.ok(after.endsWith("\ntail"));
});

test("a missing marker pair is a hard failure naming file and marker", () => {
  assert.throws(() => applyMarker("no markers", "count", "1/1", "rules/x.md"), /rules\/x\.md.*count|count.*rules\/x\.md/s);
});

// Spec test 9: a signal nothing has ever exhibited must surface, or the
// vocabulary quietly accumulates names that measure nothing.
test("--report names every zero-evidence signal", () => {
  const corpus = new Map([["a", ev("a", "gradient-blob", "present")]]);
  const dead = deadSignals(corpus);
  assert.ok(dead.includes("emoji-as-icon"), "a signal with no present in any file is dead vocabulary");
  assert.ok(!dead.includes("gradient-blob"));
});

test("snapshot stays under the 2MB ceiling", () => {
  const { statSync } = require("node:fs");
  const bytes = statSync(join(import.meta.dirname, "../mcp/data/antislop.json")).size;
  assert.ok(bytes < 2_000_000, `antislop.json is ${bytes} bytes; ceiling is 2MB (spec test 7)`);
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `node --test scripts/test-antislop.ts` → FAIL, `applyMarker` not exported.

- [ ] **Step 3: Implement `applyMarker` and `main()`**

Copy `applyMarker` from `scripts/build-mcp-conventions.ts` — same marker
semantics, parameterised by file path for the error message. Then:

```ts
async function main() {
  const report = process.argv.includes("--report");
  const corpus = loadCorpus();            // parseEvidence over content/evidence/*.md
  const rules = loadRules();              // parseRule over content/rules/*.md

  if (report) {
    for (const s of ALL_SIGNALS) {
      const e = eligibility(s, corpus);
      console.log(`${e.eligible ? "OK  " : "SKIP"} ${s.padEnd(26)} ${e.reason}`);
    }
    const dead = deadSignals(corpus);
    if (dead.length) {
      console.log(`\nzero-evidence signals (${dead.length}): ${dead.join(", ")}`);
      console.log("These fired 'present' in no file. Either the pattern has passed, or the signal is named at the wrong altitude — see vocabulary-v2 section 2.");
    }
    return;
  }

  // Every signal must be reachable by a rule or explicitly ineligible —
  // otherwise it validates, counts, and emits while backing nothing, which
  // no per-file check can catch.
  const ruled = new Set(rules.map((r) => r.signal));
  for (const s of ALL_SIGNALS) {
    const e = eligibility(s, corpus);
    if (e.eligible && !ruled.has(s)) {
      console.error(`build-antislop: '${s}' is rule-eligible but no rule in content/rules/ uses it. Author one, or the signal counts toward nothing.`);
      process.exit(1);
    }
  }

  for (const r of rules) {
    const { present, total } = countRule(r, corpus);
    const path = join(ROOT, `content/rules/${r.id}.md`);
    writeFileSync(path, applyMarker(readFileSync(path, "utf8"), "count", `${present}/${total}`, `content/rules/${r.id}.md`));
  }

  writeFileSync(join(ROOT, "mcp/data/antislop.json"), JSON.stringify({
    generatedAt: new Date().toISOString(),
    evidenceCount: corpus.size,
    cohorts: [...new Set([...corpus.values()].map((e) => e.cohort))],
    rules: rules.map((r) => ({ ...r, ...countRule(r, corpus) })),
  }, null, 2));
}
```

- [ ] **Step 4: Wire into the build**

In `package.json`, append to `registry:build`: ` && node scripts/build-antislop.ts`,
and add `"test:antislop": "node --test scripts/test-antislop.ts"`.

- [ ] **Step 5: Run to verify they pass**

Run: `npm run test:antislop` → PASS, 28 tests.

- [ ] **Step 6: Prove the check can fail**

Non-negotiable: a green build nobody has seen go red is not evidence.

```bash
# 1. delete an evidence file a rule depends on
mv content/evidence/linear-app.md /tmp/
node scripts/build-antislop.ts; echo "expect non-zero: $?"
mv /tmp/linear-app.md content/evidence/

# 2. hand-edit a generated count, confirm the build restores it
sed -i '' 's/<!-- generated:count start -->[^<]*/<!-- generated:count start -->999\/999/' content/rules/*.md
node scripts/build-antislop.ts
git diff --exit-code content/rules/; echo "expect 0 after rebuild: $?"

# 3. inject an unknown signal
echo "  sparkle: present" >> content/evidence/linear-app.md
node scripts/build-antislop.ts; echo "expect non-zero: $?"
git checkout content/evidence/linear-app.md
```

Record all three outcomes in the commit message. If any exits 0 where
non-zero was expected, the guard is decorative — fix it before committing.

- [ ] **Step 7: Add the CI diff check**

Restoring the count is only half of spec test 5 — a stale count must also
fail CI, or someone's hand-edit ships. Add to `.github/workflows/ci.yml`,
in the job that already runs `registry:build`:

```yaml
      - name: anti-slop counts are not stale
        run: |
          node scripts/build-antislop.ts
          git diff --exit-code content/rules/ mcp/data/antislop.json
```

Verify it can fail: hand-edit a count, commit it, push the branch, confirm
the job goes red. A diff check nobody has seen fail is decorative.

- [ ] **Step 8: Commit**

```bash
git add scripts/ package.json mcp/data/antislop.json .github/workflows/ci.yml
git commit -m "feat(antislop): build script, computed counts, snapshot

Wired into registry:build. Verified red before green: deleted evidence,
hand-edited count and unknown signal each fail the build."
```

---

### Task 7: The `get_antislop_rules` MCP tool

**Files:**
- Create: `mcp/src/antislop.ts`
- Modify: `mcp/src/index.ts`

**Interfaces:**
- Consumes: `mcp/data/antislop.json` (Task 6).
- Produces: `loadAntislop()`, `rulesForContext(context: string)`.

- [ ] **Step 1: Write the loader**

Mirror `mcp/src/data.ts` exactly — same `readFileSync`/`existsSync` shape,
same resolution from `import.meta.url`, same "regenerate with" error when
the snapshot is absent.

```ts
// Loads the anti-slop snapshot baked into this package by
// scripts/build-antislop.ts. Same contract as data.ts: offline, no network,
// no filesystem walk at query time.
export type AntislopRule = { id: string; context: string; signal: string; stance: "avoid" | "prefer"; severity: "hard" | "soft"; present: number; total: number; body: string };
```

- [ ] **Step 2: Register the tool**

In `mcp/src/index.ts`, after `get_conventions`, matching that file's style:

```ts
server.registerTool(
  "get_antislop_rules",
  {
    title: "Get ns-ui anti-slop design rules",
    description:
      "What to avoid and what to do instead for a given page context (hero, " +
      "pricing, features, …), each rule backed by a count of real sites studied. " +
      "Read this before writing marketing-page UI so the result doesn't default " +
      "to the template every AI-built page converges on. Counts are computed from " +
      "the evidence files, not asserted.",
    inputSchema: {
      context: z.string().describe("Page context, e.g. 'hero' or 'pricing'. Omit for every rule."),
    },
  },
  async ({ context }) => text(formatRules(rulesForContext(context)))
);
```

- [ ] **Step 3: Verify over stdio**

Run: `node mcp/scripts/verify-stdio.mjs`
Expected: PASS, server lists `get_antislop_rules` among its tools.

- [ ] **Step 4: Confirm stdout discipline**

```bash
node mcp/src/index.ts < /dev/null 2>/dev/null | head -c 200
```
Expected: empty or JSON-RPC only. Any human-readable line means a
`console.log` leaked into stdout and will corrupt the client stream.

- [ ] **Step 5: Time it**

```bash
node -e "
const t=Date.now();
const {rulesForContext}=await import('./mcp/src/antislop.ts');
for(let i=0;i<100;i++) rulesForContext('hero');
console.log('p100 total ms:', Date.now()-t);
"
```
Expected: well under 5000ms total for 100 calls (spec test 6: p95 < 50ms each).

- [ ] **Step 6: Commit**

```bash
git add mcp/src/
git commit -m "feat(mcp): get_antislop_rules

Serves counted anti-slop rules by page context from the offline snapshot.
stdio discipline and latency verified."
```

---

## Out of scope for session 2

Per the program's session map, these belong to later sessions and must not
be started here: `/directory`, `/guidelines`, essays, community submission,
`llms.txt` integration, screenshot storage in the repo, and any new
evidence gathering beyond the Task 3 re-pass.

## Known-open, carried from session 1

- **The blind re-rate.** The density bands (0-2 / 0-4 / 5-6) came from
  raters who set the signals and then assigned the verdict. One agent sets
  signals, a second assigns verdicts blind. Not in this plan because it is
  evidence work, not pipeline work.
- **The 7 disagreement files.** `resend-com`, `capveon`, `github-2014`,
  `basecamp-2014`, `cursor-com`, `nxtcure-labs`, `squarespace-2014` — every
  one had `exemplar` withheld by a rater despite a clean signal profile.
  Whatever they saw is the vocabulary's largest blind spot.
- **`agent-tools` is 5 of 10.** Stripe, Railway, Clerk, Modal and
  Browserbase were never studied; that agent died on a budget error.
- **One viewport.** Everything was captured at 1440×900. `asymmetric-split`
  in particular may not survive at phone width.
