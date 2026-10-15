---
source: https://TrueMile.AI/
kind: site
cohort: yc-current
context: [hero, nav]
verdict: exemplar
studied: 2026-10-13
materials: [single-theme, illustration]
signals:
  gradient-blob: absent
  three-card-row: absent
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
  custom-type-pairing: present
  real-product-surface: absent
  shows-deliverable: absent
  density-variation: present
  one-accent-discipline: present
  live-claim-control: absent
---
Viewport only; below-fold signals unresolved.

Asymmetric split on a warm off-white field. "AI operations team for your
trucking company." sits left at roughly 64px in a transitional serif, the
first line in orange and the remaining two in near-black, against 17px
sans body. That is close to a 4:1 ratio and two deliberately paired
voices.

The right half is the finding: instead of a dashboard screenshot or a
floating device, a hand-built wiring diagram runs the company's own
process as four numbered nodes (01 sourcing, 02 planning, 03 dispatch, 04
communications) connected by hairline curves to a central brand tile. The
numbers carry real copy, including a claim with a figure in it ("plans run
through a billion possible scenarios"). The product is shown as what it
produces rather than as its UI, which is `artifact-not-dashboard`.

One orange accent carries the logo, the first headline line, the CTA arrow
and the single word "Handled." at the fold. The dark CTA is the only solid
mass on the page, so nothing competes with it.

**v4 holes 7+2 / change 3b re-score**

Re-rated from the live page, full walk. Reused the existing s5 capture rather
than re-shooting: `walk.json` reports `clamped: false`, `coverage: 1`, 11
tiles, `scroller: window`, `docH_before` 7244 == `docH_after` 7244,
`reachedPx` 7244. Stitched to 2 strips (1440x4400 + 1440x2844), 7244px vs
page 7244px. Footer check passes: the last strip ends in the real footer,
nav columns, `469-394-7061`, `info@truemile.ai`, then `(c) 2026 TrueMile` and
`SMS Consent / Terms of Service / Privacy Policy` at y7205 against docH 7244.
Colour read off the DOM, not `satPct`: page field `rgb(248, 247, 240)`,
ink `rgb(37, 35, 32)` (345 nodes), accent `rgb(237, 78, 20)` on 3 nodes.
Media census: 0 canvas, 0 video, 0 iframe, 3 `<img>` (two 512x512 logo, one
1050x1400 photo), 9 SVG of which 3 carry live `<text>`.

The four hero node bodies as they actually read, which the earlier prose
quoted only one of (y209-763, right half):

- `01 / SOURCING` - `Customer & spot freight`
- `02 / PLANNING` - `Proposed plans run through a billion possible scenarios.`
- `03 / DISPATCH` - `Auto driver assignment`
- `04 / COMMUNICATIONS` - `Keep your customer, team, and driver connected at all times.`

None of the three unread nodes narrows anything. Two are bare capability
labels and the fourth broadens to `at all times`. The four accordion bodies
in `Four agents. / One operation.` (y3606-3909, probed by clicking each
`aria-expanded="false"` header) read the same way: Sourcing `Finds freight
across spot markets and existing customers.`, Planning `Brings freight,
capacity, and customer commitments into a coordinated weekly plan.`,
Dispatch `Assigns loads to trucks and drivers. Prepares reassignments when
availability changes, with your dispatcher approving the next move.`,
Communications `Coordinates driver and broker conversations across calls,
messages, and email. Prepares updates for your approval, then follows
through.`

**The entry that could have embarrassed the vendor: none exists.** Searched
the whole document text for limits, costs, failures, refusals and losing
comparison rows. The full-page regex sweep for `not|only|cannot|except|limit|
unsupported|planned|coming soon|beta|requires|minimum|fail|error|decline|
cost|price|%|fee|partial|yet` returns three hits on the entire page:
`Driver unavailable` and `When a driver is unavailable, TrueMile brings
coverage, plan updates, and communications into one coordinated response.`,
both the exception the product then handles cleanly, plus `PDF or Word, up
to 10 MB.` in the careers modal. There is no pricing table, no comparison
grid, no stats board, no error row, no `(planned)` qualifier. The only
quantity on the page is `a billion possible scenarios`, which can only
flatter by being larger.

`Approval before execution` (y3063) does not count, and the page itself
shows why. The same constraint is stated four separate times as a selling
point: hero subhead `Your dispatchers stay in control.` (y537), card
`02 / Control` into `Your team has the final say.` (y4445), diagram footer
`Shared context. Connected work. Your team in control.` (y3974), and the
panel footer. A limit the page repeats four times in its own voice is a
differentiator wearing a refusal's clothes, not a claim narrowed against
interest, exactly the "Enterprise only" case hole 1 rules out.

Medium is not what fails here, so Part B does not rescue it. The strongest
artefact is below the fold and the earlier viewport-only pass never saw it: a
page-authored panel at y2660, `div.work-surface`, 697x452, under the eyebrow
`TrueMile / Operations` with `Illustrative workflow` set opposite. It reads
`Driver unavailable` / `Two upcoming loads need coverage.`, then a semantic
`<ol>`: `1 Change identified` / `The affected work is brought into view.`,
`2 Coverage prepared` / `A revised assignment is ready for review.`,
`3 Communications drafted` / `Driver and broker updates follow the new
plan.`, closing `Your dispatcher reviews the response.` and `Approval before
execution`, with `Example sequence, showing the customer experience.` beneath
at y3125. Three tabs drive it, `01 A driver calls out`, `02 A truck opens
up`, `03 A new week begins` (y2556), and all three were clicked. Every one
of the nine steps across the three panels succeeds: availability identified,
options surfaced, assignments prepared, plan approved. Nothing declines,
costs, partially covers or fails. `Two upcoming loads need coverage.` is
never resolved to one covered and one not. Scored on what it says, per the
rule that a demo is scored on stance and not on being a demo, every value is
the flattering one.

So `shows-deliverable` flips to `absent`. The vocabulary names this page's own
artefact as a worked fail case, "a capability diagram whose only quantity is
'a billion possible scenarios'", and the live read confirms that holds for the
other three nodes, the four agent bodies and all three workflow panels.

`real-product-surface` stays `absent`, and on this page that is a genuine
absence rather than the old definition's letter misfiring on a faithful
rebuild. There is no product UI anywhere, in any medium. The hero wiring
diagram, the integration radial (McLeod, Trimble, Samsara, Truckstop,
WhatsApp, Microsoft Teams, Outlook, Gmail around a brand tile, y1227-1744)
and the four-agent radial are stylised renderings of a process, which the
signal excludes by name. The one candidate that wears chrome,
`div.work-surface`, has no product affordances and no product data: 0 tables,
0 inputs, 0 buttons, 0 SVG, 0 images inside it, its `->` glyph
`aria-hidden="true"`, and its content is three narrated sentences rather than
a load ID, driver name, truck number, time window or rate. Nothing here is a
capture, and nothing is a faithful rebuild of a real screen; it is a
card-shaped paraphrase of a workflow, self-labelled `Illustrative workflow`.
Consistent with `hero-mockup-float: absent`: the page does not fake a
dashboard, it declines to show one.

Drift from the original prose, recorded rather than rewritten. That pass was
viewport-only and scored `present` off the hero diagram under the change-3
wording. Its reading "The product is shown as what it produces rather than as
its UI" does not survive contact with the node bodies: the diagram runs
TrueMile's own four-stage process and the company's place in it, which is a
capability map, not an instance of the product's output on a job. The
`artifact-not-dashboard` characterisation describes the page's restraint
accurately and is worth keeping as a design observation, but it was carrying
weight on this signal that the content cannot support. Other front-matter
values left untouched, including the two `unresolved` below-fold signals and
the viewport-only note, which are outside this re-score.
