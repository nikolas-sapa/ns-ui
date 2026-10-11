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

test("real-product-screenshot and artifact-not-dashboard are mutually exclusive", () => {
  for (const f of files()) {
    const e = read(f);
    const both = e.signals["real-product-screenshot"] === "present" && e.signals["artifact-not-dashboard"] === "present";
    assert.ok(!both, `${f}: showing the UI and showing the deliverable instead of the UI cannot both be true`);
  }
});
