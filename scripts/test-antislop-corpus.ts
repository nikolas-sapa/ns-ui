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
