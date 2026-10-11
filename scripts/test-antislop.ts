import { test } from "node:test";
import assert from "node:assert/strict";
import { ALL_SIGNALS, SLOP_SIGNALS, CRAFT_SIGNALS, MATERIALS } from "../lib/antislop-vocab.ts";
import { parseEvidence } from "./antislop/evidence.ts";

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
  // Every source is a URL, so a value split on every colon rather than the
  // first one silently mangles all 20 files without failing any other check.
  assert.equal(e.source, "https://example.com");
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
