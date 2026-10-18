# Hole 8: whether a deliverable's content is sourced or fabricated (proposal)

Date: 2026-10-16
Follows: `2026-10-15-change-3-addendum.md` hole 8, and
`2026-10-15-holes-7-and-2-applied.md`, which carved provenance OUT of
`shows-deliverable` and left it unscored.
Status: **proposal, not applied.** No vocabulary entry, no signal value, no
test. The test plan comes before the procedure, as this program requires.

---

## Why this is the hole change 3 created

Change 3 split the screenshot from the deliverable. Change 3b then split
capture from genuineness on the surface side. Hole 2's wording had to state
explicitly that "audit" is not a provenance test: three of thirteen raters read
it as one, and a verified-live odometer scored `absent` anyway. That left a
question no signal records: **did the deliverable's content come from somewhere
real?**

The session generated more evidence on this axis than any other:

| file | provenance finding | where it came from |
|---|---|---|
| `silica` | the force chart is `Math.random`; the Silica trace is applied force + `gauss()*.8` | inline script |
| `tsenta` | scan log is clock-seeded and regenerates per load; also a miscounted word claim and a transposed score order | two loads, arithmetic |
| `financial-datasets` | every response is a client-side fixture, but each row cites an accession number with a live sec.gov `filing_url` | network log, DOM |
| `railway-com` | error log carries a `wlwmanifest.xml` scanner probe: "nobody invents that for a mockup" | content inference |
| `modal-com` | `image.push` is not a real audited action in Modal's own docs (only `image.delete` is) | vendor docs |
| `the-subvocal-company` | the decode video is byte-identical to the page's `src`; audio sits at about −63 dBFS during decodes | file hash, audio level |
| `sentient-os` | the page labels its own sample: an `Example` badge, `5 example files · Personal details omitted` | DOM |
| `grep-ai` | the vendor-cost row is labelled `Modeled, not benchmarked`; a panel uses `Acme Holdings` | DOM |
| `papaya` | its panels draw on the app's own `PhiAirwaysExample` demo set | app bundle |
| `neuron-industries` | its test curve is captioned `ILLUSTRATION: ...` (hole 5) | DOM |

Three distinct things are tangled together in that table, and the proposal has
to separate them before it can measure any of them:

1. **Origin:** is the content from a real run, real data or a real customer, or
   was it authored?
2. **Disclosure:** does the page say which it is?
3. **External anchor:** can a reader check any value against an authority the
   vendor doesn't control?

`financial-datasets` is the case that forces the split. Its content is authored
(a fixture), but every value is anchored to SEC filings the vendor does not
control. In the auditor's words: "Chosen is not the same as free." Collapse the
three into one bit and that file reads the same as `silica`, which it is not.

## Test plan, before any procedure

A procedure is only worth writing if a second rater reproduces it. Each test
has a numeric pass criterion. **If a test fails, the spec is wrong**, not the
test.

**T1, inter-rater agreement.** Two blind raters score the 9 `shows-deliverable:
present` files on each sub-question. Pass: ≥ 8/9 agreement per sub-question.
At 7/9 or below, that sub-question is not a procedure and is dropped.

**T2, falsifiability.** For each `fabricated` or `anchored` call, the rater
names the instrument that settled it: a script excerpt, a network request, a
file hash, a docs URL, an arithmetic check. Pass: 100% of calls carry one.
"Looks invented" is not an instrument.

**T3, no collapse onto existing signals.** Across the 9, provenance values must
not be identical to any existing signal's values. Pass: at least 2 of 9 files
where provenance and `real-product-surface` disagree. Otherwise it is
measuring the medium again.

**T4, the anchor survives the authored case.** `financial-datasets` must score
authored AND anchored; `silica` must score authored AND unanchored. Pass: both,
from blind raters. If they cannot be told apart, the split has failed and the
axis is one bit.

**T5, disclosure is recorded, not rewarded.** `sentient-os` (self-labelled
example) and `neuron-industries` (captioned illustration) must both score
disclosed. The craft net must not move on disclosure alone. Pass: no craft
signal changes value in either file because of this axis. This is hole 5's
question, answered by keeping disclosure out of the signal and in a material.

## Procedure, provisional, pending T1-T5

Three sub-questions, asked only of a deliverable already scored `present`:

- **`origin`**: one of `captured`, `authored` or `unresolved`.
  - `captured` needs an instrument that ties the content to a real event. For
    example: byte-identity with a source recording, a live network fetch
    returning the values, or a detail with no plausible authored purpose (the
    `wlwmanifest.xml` class, stated as the inference it is).
  - `authored` needs an instrument too: a script that generates it, a
    fixture, a clock seed, internal arithmetic that fails.
  - Everything else is `unresolved`, which will be the common answer and is
    honest.
- **`anchor`**: `anchored` or `unanchored`. Anchored means a value in the
  artefact can be checked against an authority outside the vendor's control:
  a regulator's filing, a third-party benchmark, a competitor's published
  price.
- **`disclosure`**: `disclosed` or `undisclosed`. Whether the page labels
  authored content as such.

**Where they live: `materials`, not the signal list.** These are facts about
what the artefact is made of, and the vocabulary already reserves `materials`
for exactly that kind of non-stance-bearing fact. Its rule is that a material
must never back a rule. That is correct here. `authored` is not slop: silica's
simulated chart is honest, passes `shows-deliverable`, and would be wrongly
convicted by a rule against fabrication. So keeping these out of the signal
namespace is the point, not a convenience.

This collides with change 5's open blocker: `materials` is a flat string list.
Three enum sub-questions fit as tokens (`origin-authored`, `anchor-external`,
`disclosed`), which change 5 called "data smuggled into a vocabulary" when the
value was a number. Enums are not numbers, and the objection does not obviously
transfer. **This needs a decision**, and it is the same decision change 5 is
waiting on, so take them together.

## Non-goals

- **Not a slop signal.** Fabricated content is not a template tell. A rule
  against `authored` would convict silica, tsenta and financial-datasets, three
  of the corpus's most honest deliverables.
- **Not scored on files without a deliverable.** Provenance of nothing is not
  a measurement. 33 files are exempt by construction.
- **Not a truth audit of vendor claims.** It asks where an artefact's content
  came from, not whether the company's marketing is accurate. modal-com's
  invented `image.push` is recorded as an origin tell, not as a lie.
- **Not hole 5.** Self-disclosure is recorded under `disclosure` and moves no
  craft value. Whether `shows-deliverable` should credit a captioned
  illustration stays an open decision.
- **No re-rating of `shows-deliverable`.** The carve-out stands. A provenance
  finding never flips the deliverable signal.

## Cost and order

Cheap, because it runs on the 9 files already re-rated this session, and most
instruments are already recorded in their prose. T1 needs two blind raters per
file: 18 agents, or 9 if one existing pass counts as the first rater (weaker,
since that rater wasn't blind to the sub-questions).

**Recommended order:**
1. Decide the `materials` shape. It blocks both this and change 5.
2. Run T1-T5 on the 9 files.
3. Apply whatever sub-questions survive.

Expect `origin` to survive and `disclosure` to be trivial. `anchor` is the
uncertain one: the evidence that an authority is genuinely outside the vendor's
control is a judgement, and T1 will say whether raters share it.
