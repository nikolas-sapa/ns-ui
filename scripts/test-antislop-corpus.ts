// Corpus-level checks on content/evidence/*.md. These are deliberately
// separate from scripts/test-antislop.ts, which tests the parser and the
// build: nothing here asserts anything about a single file's contents, only
// about the dataset as a whole. A per-file check cannot see a seed gate or a
// contradiction that depends on two signals being set the same way.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { parseEvidence } from "./antislop/evidence.ts";
import { ALL_SIGNALS } from "../lib/antislop-vocab.ts";

const EVIDENCE_DIR = join(import.meta.dirname, "../content/evidence");

const files = () => readdirSync(EVIDENCE_DIR).filter((f) => f.endsWith(".md"));
const read = (f: string) => parseEvidence(readFileSync(join(EVIDENCE_DIR, f), "utf8"), f.replace(/\.md$/, ""));

test("every committed evidence file parses against v3", () => {
  const fs = files();
  assert.ok(fs.length >= 20, `expected the 20 committed files, found ${fs.length}`);
  for (const f of fs) read(f);
});

test("seed gate: at least 12 files across at least 3 cohorts", () => {
  const fs = files();
  const cohorts = new Set(fs.map((f) => read(f).cohort));
  assert.ok(fs.length >= 12, `seed gate: ${fs.length} files, need 12`);
  assert.ok(cohorts.size >= 3, `seed gate: ${cohorts.size} cohorts, need 3`);
});

// v4 change 3 dropped the exclusivity this test used to enforce, so the test
// now guards the rename instead of the constraint.
//
// The constraint was wrong, not merely inconvenient: the two signals are not
// defined over the same axis. `real-product-screenshot` is defined on a
// CAPTURE MEDIUM (the product's UI shown as a real screenshot) and
// `shows-deliverable` on CONTENT (the product shown as what it produces). A
// page can do both, and 23 of 42 files recorded the screenshot present and
// the deliverable absent purely because the convention gave the screenshot
// priority — starving the signal the spec calls its strongest discriminator.
//
// Three files proved it from three directions: financial-datasets ships NO
// screenshot at all (every surface is a live DOM rebuild) yet rendered a
// literal claims ledger; neuron-industries ships the vocabulary's own worked
// example, "a priced comparison with real refusals", and was forced to absent
// because it also ships 9 IDE screenshots; the-subvocal-company sells eyewear,
// so no UI exists to screenshot and the absent read as a deficiency rather
// than a category fact.
//
// See docs/superpowers/specs/2026-10-14-vocabulary-v4-proposal.md, change 3.
test("the artifact-not-dashboard rename is complete", () => {
  assert.ok(
    (ALL_SIGNALS as readonly string[]).includes("shows-deliverable"),
    "shows-deliverable must be in the vocabulary",
  );
  assert.ok(
    !(ALL_SIGNALS as readonly string[]).includes("artifact-not-dashboard"),
    "artifact-not-dashboard was renamed to shows-deliverable and must not survive",
  );
  for (const f of files()) {
    const e = read(f);
    assert.ok(
      !("artifact-not-dashboard" in e.signals),
      `${f}: still carries the old signal name artifact-not-dashboard`,
    );
    assert.ok(
      "shows-deliverable" in e.signals,
      `${f}: missing shows-deliverable`,
    );
  }
});

// v4 change 3b renamed `real-product-screenshot` to `real-product-surface`
// (addendum hole 6). The old name keyed the signal to a FORMAT when the thing
// worth recording is GENUINENESS: it credited a CAPTURED UI while
// `hero-mockup-float` penalised a FAKE one, leaving REAL BUT UNCAPTURED with
// no slot. Four files paid for that at n=42 — financial-datasets (every
// surface a live DOM rebuild, three instruments confirming no raster UI
// exists), railway-com (all five product visuals SVG with live `<text>` and
// zero `<image>`) and grep-ai (page-authored replicas) all read `absent`
// while plainly showing their product, and clerk-com held `present` only on
// the convention.
//
// This guards the rename, not a constraint. The re-pass that sets values
// against the new wording is separate, exactly as change 3's rename preceded
// its re-score.
test("the real-product-screenshot rename is complete", () => {
  assert.ok(
    (ALL_SIGNALS as readonly string[]).includes("real-product-surface"),
    "real-product-surface must be in the vocabulary",
  );
  assert.ok(
    !(ALL_SIGNALS as readonly string[]).includes("real-product-screenshot"),
    "real-product-screenshot was renamed to real-product-surface and must not survive",
  );
  for (const f of files()) {
    const e = read(f);
    assert.ok(
      !("real-product-screenshot" in e.signals),
      `${f}: still carries the old signal name real-product-screenshot`,
    );
    assert.ok(
      "real-product-surface" in e.signals,
      `${f}: missing real-product-surface`,
    );
  }
});

// The spec that applies change 3b states the signal's distribution in prose
// ("21 `present`, 20 `absent`, 1 `unresolved`"). Session 4's stitcher taught
// the rule the hard way: A DERIVED ARTEFACT NEEDS AN INVARIANT TYING IT BACK
// TO ITS SOURCE. That document already drifted once — it was written with 17
// `absent`, restated the stale figure two lines later, and the only detector
// was a human recounting by hand.
//
// So the prose is the derived artefact and the front-matter is the source.
// This fails if either moves without the other, which is what the 20-file
// re-pass is about to do on every flip.
test("the spec's stated signal distribution matches the corpus", () => {
  const spec = readFileSync(
    join(import.meta.dirname, "../docs/superpowers/specs/2026-10-15-holes-7-and-2-applied.md"),
    "utf8",
  );
  const stated = spec.match(
    /\*\*(\d+)\*\* files read `absent`\s+today, against (\d+) `present` and (\d+) `unresolved`/,
  );
  assert.ok(stated, "spec must state the real-product-surface distribution");
  const [, sAbsent, sPresent, sUnresolved] = stated;

  const actual = { present: 0, absent: 0, unresolved: 0 } as Record<string, number>;
  for (const f of files()) {
    const v = read(f).signals["real-product-surface"];
    assert.ok(v in actual, `${f}: illegal real-product-surface value ${v}`);
    actual[v] += 1;
  }

  assert.equal(
    actual.present + actual.absent + actual.unresolved,
    files().length,
    "every file must carry exactly one legal real-product-surface value",
  );
  assert.equal(Number(sPresent), actual.present, "spec `present` count is stale");
  assert.equal(Number(sAbsent), actual.absent, "spec `absent` count is stale");
  assert.equal(
    Number(sUnresolved),
    actual.unresolved,
    "spec `unresolved` count is stale",
  );
});
