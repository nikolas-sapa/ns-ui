---
source: https://papaya.fyi/
kind: site
cohort: yc-current
context: [hero, nav]
verdict: mixed
studied: 2026-10-13
materials: [single-theme, illustration]
signals:
  gradient-blob: absent
  three-card-row: unresolved
  glass-card-overuse: absent
  emoji-as-icon: absent
  generic-sans-default: absent
  symmetric-everything: absent
  badge-pill-spam: absent
  generic-line-icon-set: absent
  testimonial-card-row: unresolved
  indigo-violet-accent: absent
  gradient-fill-cta: absent
  scroll-reveal-blank: unresolved
  typewriter-headline: absent
  stock-photo-generic: absent
  centered-hero-stack: absent
  hero-mockup-float: absent
  asymmetric-split: present
  single-optical-anchor: present
  type-scale-high-contrast: present
  editorial-grid-break: absent
  custom-type-pairing: absent
  real-product-surface: present
  shows-deliverable: absent
  density-variation: present
  one-accent-discipline: absent
  live-claim-control: absent
---
Viewport only; below-fold unresolved.

Asymmetric split, copy left and a commissioned isometric illustration
right: three stacked slabs in salmon, sand and blue representing scanning
traces, analyzing runs and recommendations, with labelled tabs
("Redundant retries", "Excessive tool calls", "Missing context") carrying
real metric chips (`Latency -20%`, `Cost -22%`, `Quality +7%`). Trace
lines fan in from the bottom left into the lowest slab.

"Optimize your agents at scale." runs at roughly 44px in a geometric sans
against 16px body, with a single red period as punctuation. Two bare stats
under the CTA, 4.1B+ tokens and 1.04M+ messages processed, each with its
unit named.

The illustration is `artifact-not-dashboard`: it renders what the product
finds (named failure modes with their measured deltas) rather than the UI
that would show them. Accent discipline fails, though — salmon, sand,
blue, a red period and a black CTA put five hues on one screen.

**v4 holes 7+2 / change 3b re-score**

Signal profile, decided before this prose: `shows-deliverable: absent`
(was `present`, flipped) and `real-product-surface: present` (was
`absent`, flipped). `verdict` untouched.

Capture. Reused `~/scratch/antislop/s5/papaya/walk.json`: 14 tiles,
`clamped: false`, `coverage: 1`, docH 9591 stable before and after.
Stitched to 3 strips, 9591px vs page 9591px. The last strip ends in the
footer (`© 2026 PAPAYA`, y 9551). Exact text came from a Playwright DOM
walk of the live page at 1440 wide (docH 9591 again); every y below is
document y from that walk. The seven feature images were fetched and read
at their full 1200x750.

The page has moved since the viewport-only note above. Headline is now
`Continuously improve your agents` with the red `.` (y 289/422). One stat
remains, `1.1M+` / `conversations analyzed` (y 617/645); `4.1B+ tokens`
and `1.04M+ messages processed` are gone. The hero isometric is an
animated inline SVG (y 65-1153, 1170x1088): slab tabs `Recommendations`,
`Analyzing runs`, `Scanning traces`, four `Traces` tags, and a chip panel
that cycles fifteen failure modes, not three. **[Superseded — the second pass
below measures twelve modes and twenty-four chips from the served HTML, against
this pass's fifteen and thirty read off the render. That correction is
re-verified; this figure is not.]**

Q1 `shows-deliverable`: ABSENT. Entry that could embarrass the vendor:
none. What was searched:

- Hero chip cycle (y 162-390, x 834-1033): 15 modes, 30 deltas. **[Count
  superseded: twelve and twenty-four, per the corrections below. The deltas
  below were re-read across all twelve and every one still holds, so this
  bullet's substance stands and only its count is wrong.]** Every
  Cost and Latency delta negative, every Quality delta positive.
  `Redundant retries` `Cost` `−33%` `Latency` `−12%`; `Excessive tool
  calls` `Latency` `−55%` `Cost` `−41%`; `Missing context` `Quality` `+7%`
  `Cost` `−23%`; through `Stale tool schema` `Quality` `+11%` `Cost` `−6%`
  and `Verbose system prompt` `Cost` `−24%` `Latency` `−9%`. The smallest
  (`−6%`, `−7%`) are still wins. No baseline, no named run.
- `Why Papaya` cards (y 1792-1904): `+20%` `Quality improvement` `Typical
  success-rate gain from the first workflow analysis.`; `−30%` `Latency
  reduction`; `$25K+` `Cost savings` `Annualized, per large-scale
  workflow.` All one direction.
- How-it-works canvas overlays (y 2734-2947): `Context bloat` ... `18.0% of
  runs` `−$2.1K/mo`; `Prompt caching` ... `62.4% cost reduction`
  `−$1.4K/mo`; `Tool schema drift` ... `11.4% of runs` `−$840/mo`; `Retry
  loops` ... `1,422 affected runs` `+8.2s latency`. The one adverse sign,
  `+8.2s latency`, is what the bug costs the customer's agent, i.e.
  Papaya's find, not a cost of Papaya.
- Seven panels (y 3713-7406). Plenty of bad values, every one about the
  demo customer's agent: `Compensation issued without an eligibility
  check` `412`; `Cancellation And Refunds` `204` `58%` `Failing 42%`,
  `Compensation` `102` `64%` `Failing 36%`; `66 were handed to a person`
  `40 settled for less` `18 gave up`; `SUCCESS` `78%` with the Failed band
  widening Oct 4 to Oct 7 over a falling Success band. **[Corrected below: the
  band holds at about 14% through Oct 5 and rises on Oct 6-7, so it does not
  widen from Oct 4. The Success fall and the direction of travel are unaffected,
  and this is one of the second pass's raster reads, recorded as such rather
  than re-measured.]** Each is the
  product's catch, which is what the page sells (`Catch drift before
  customers do`, y 8230), so each argues FOR the vendor. Strongest
  candidate: the P0 card's `Expected impact` `Cost` `Low`. The live app's
  level map is `High` / `Medium` / `Low` / `Unknown` with no negative
  level, so `Low` is the smallest win, not a cost or a miss, and a low row
  inside a ranking is the ranking working.
- Refusals and limits: `In your control — human-in-the-loop if needed.`
  (y 2046), `Implement the ones you choose.` (y 5598), `No commitment: the
  audit is yours to keep either way.` (y 8927). None narrows a claim; the
  last is an offer.
- Missing though the product has it: the live app's user-signal export
  carries a `Not a fit reason` field and the impact map an `Unknown`
  level; neither reaches the page. No rejected recommendation, false
  positive, missed failure, fix that regressed, losing comparison row or
  price.

Every value attached to Papaya's own effect is the flattering one; every
unflattering value belongs to the customer's agent and is the product's
find. Fails on stance (seeded demo where every value flatters), not on
provenance and not on medium: the panels are readable product chrome and
would have counted under Part B had their content carried an entry.

Q2 `real-product-surface`: PRESENT. The seven numbered surfaces are raster
(`/home10/features/{issue-detection,use-cases,user-signals,
recommendations,slack,observability,llm-judge}.webp`, each 1200x750 VP8,
shown 583x375 at y 3713 / 4266 / 4819 / 5372 / 5925 / 6478 / 7031). Raster
settles nothing. What decided it: the live product SPA at `/app`
(`/app/assets/index-BfPfe5X4.js`, lazy `Observability-CZtUyUnO.js`) ships
the same components with the same labels and structure.

- `04 / 07` recommendations: app component `aria-label:"Expected impact"`
  renders rows in order `Quality`, `Latency`, `Cost`, each a 3-segment bar
  (`[0,1,2]`, filled 3/2/1) with a right-aligned level `High` / `Medium` /
  `Low` in tokens `ember` / `gold` / `umber`. The panel is exactly that:
  same order, same three-segment bars, same three hues.
- `03 / 07` user signals: app `title:"Why fix it"` and outcome phrases
  `"were handed to a person"`, `"settled for less"`, `"gave up"`; panel
  matches verbatim.
- `07 / 07` LLM judge: app tabs `Definition` / `Decisions` / `Versions`
  (plus `Usage`), mono uppercase `Definition` kicker, heading
  `Guidelines v${version}`, outline status badge, `title:"Score bands"`;
  panel shows `DEFINITION`, `Guidelines v1`, `draft`, `SCORE BANDS`.
- `06 / 07` observability: app KPI cards `Success`, `Cost/success`, `Total
  cost`, `p95`, `Trace count`; panel shows four of the five.
- Data: the app ships a `PhiAirwaysExample` chunk, and the panels share
  one airline demo set that cross-checks across surfaces (`2,834` `of
  12,480 traces` against observability `TRACE COUNT` `12,480`; the P0
  `Check eligibility before cancellation and compensation` recurs in the
  Slack card `Seen in 147 traces · Expected impact: High`).
- Glyphs at 3x: clean font-engine text, no generative letter drift.

Not untouched captures: each is cropped to one component and enlarged
about 2x, a KPI card is dropped, and some strings (`Judge guidelines ·
drafted from 56 traces`, `Issues found`, `Top issues`, `Pass/fail over
time`) are not in the shipped bundle, so at least panels 01 and 06 were
re-rendered for marketing. The Slack panel rebuilds Slack's chrome around
Papaya's alert. Under the stated test ("A faithful rebuild populated with
invented data is `present`") these are the real product's surfaces, not a
stylised or invented UI. The hero isometric is the stylised element and
earns nothing here.

Drift from the old prose: the original note was viewport-only and scored
the hero as the deliverable. Headline, stats and chips have since changed
(`Latency -20%` and `Cost -22%` are no longer on the page; `Redundant
retries` now carries `Cost −33%` `Latency −12%`). The
`artifact-not-dashboard` description of the hero still holds, but no chip
carries anything against the vendor, so `present` does not survive the
procedure. `real-product-surface: absent` was a below-fold miss, not a
wrong call on what was seen. Other signals left as rated; `three-card-row`,
`testimonial-card-row` and `scroll-reveal-blank` still read `unresolved`
though the full page is now captured, not re-scored here.

**Corrections to the above, from an independent second pass on the same task.**
None moves a value; both passes reached `shows-deliverable: absent` and
`real-product-surface: present` independently.

- **The hero cycles 12 modes and 24 chips, not "15 modes, 30 deltas".**
  Verified from the served HTML rather than the render: the cycle is
  JS-driven but every mode and chip ships in the document. Twelve mode titles
  (`Redundant retries` through `Verbose system prompt`), each carrying two
  `±N%` chips. The document holds 26 `±N%` fragments in all; the other two sit
  in body copy outside the hero.
- **The panels only partly cross-check.** The `2,834 of 12,480 traces` and
  observability `TRACE COUNT 12,480` agreement holds, but the use-cases panel
  reads `851 traces · 5 use cases` against the 12,480 elsewhere, and its four
  rows sum to 723. One demo set, not one consistent one.
- **The Failed band does not widen from Oct 4.** By measurement it holds at
  about 14% through Oct 5, then rises to 25% on Oct 6 and 34% on Oct 7, while
  Success falls from 79% to 61%.
- **The observability chart is recoloured** from the live app: Success is
  blue on the page where the app's own palette uses teal. One more marketing
  edit alongside the crops, the dropped Usage tab and the drawn Slack frame,
  and consistent with `present` for a faithful rebuild.

The first correction was re-verified for this note. The other three are the
second pass's raster reads and are recorded as such, not re-measured.
