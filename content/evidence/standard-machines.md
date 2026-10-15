---
source: https://standardmachines.com
kind: site
cohort: yc-current
verdict: mixed
studied: 2026-10-14
context: [nav, hero, blog-index, footer]
signals:
  gradient-blob: absent
  three-card-row: absent
  glass-card-overuse: absent
  emoji-as-icon: absent
  generic-sans-default: absent
  symmetric-everything: absent
  badge-pill-spam: absent
  generic-line-icon-set: absent
  testimonial-card-row: absent
  indigo-violet-accent: absent
  gradient-fill-cta: absent
  scroll-reveal-blank: absent
  typewriter-headline: absent
  stock-photo-generic: absent
  centered-hero-stack: absent
  hero-mockup-float: absent
  asymmetric-split: absent
  single-optical-anchor: present
  type-scale-high-contrast: absent
  editorial-grid-break: absent
  custom-type-pairing: absent
  real-product-surface: absent
  shows-deliverable: absent
  density-variation: present
  one-accent-discipline: present
  live-claim-control: absent
materials: [single-theme, illustration]
---
Captured at 1440x900; full page 1668px; 3 tiles, 1 strip. A launch-announcement
page for a chip-design research company, and the cohort's cleanest case of a
question the vocabulary cannot currently answer: it scores zero slop signals,
and it is not clear how much of that is discipline.

**The page height disagreement is a `zoom` artifact, and 1668px is the real
number.** `documentElement` reports `scrollHeight` 1668 against `clientHeight`
900; `body` and the root `div` both report 2059 against 1111. The root element
carries `zoom: 0.81`, and 2059 × 0.81 = 1667.8. The probe records the ratio
directly as 1.2344, which is 1/0.81. So 1668 is the painted height in layout
pixels and 2059 is the same page measured in the body's own pre-zoom coordinate
space. Three independent checks settle it on 1668: `maxScrollY` is 768, which is
exactly 1668 − 900; the bottom-most element is `MAIN` with `bottom: 1668`; and
the no-JS render also returns 1668. Every `getBoundingClientRect` y in the probe
is post-zoom and therefore on the 1668 scale — the footer hairline at y1560 and
the footer text at y1590 both fall inside it, which they could not do if the page
were 2059.

The strip is 2300px for a 1668px page and the surplus is a stitching artifact,
not content. The walk advanced in nominal 700px steps, but the third step clamped
at `maxScrollY` 768 against a nominal 1400, so the stitcher appended 700px it had
already shown. The backer line, the post card and the footer each appear twice in
the strip, and a ~30px band of the pattern canvas appears mid-strip out of
position. The mapping confirms it arithmetically: strip y2223 is real
y968 + (2223 − 1600) = y1591, which is the footer text at y1590. Nothing is
hidden below 1668.

**No slop signal is present.** The page is 412 characters of innerText, one
typeface, two images, one canvas, zero SVG icons, zero pills, zero gradients and
zero accents. The structure in full: a 52px logo and two 12.5px nav links, a
two-line 36px statement, a 1143x546 generative pattern, roughly 300px of void, a
centred two-line backer line, one dated blog card, a footer.

Three craft signals are present.

**`single-optical-anchor`.** The pattern block at x140 y247, 1145x548 inside a
1px `rgb(221, 221, 221)` border, is the only place the eye can land. The ink
profile makes the dominance quantitative: 48.5% at y300, 47.0% at y400, 44.5% at
y500, 45.6% at y600, 47.3% at y700, against 0.5% at y0 and 8.1% at y100 above it
and 0.0% at y800 below. The next-densest band anywhere on the page is 24.8% at
y1268, the post card. One element carries roughly twice the ink of anything else
and nothing competes for mass in its band.

**`density-variation`.** 48.5% peak against three consecutive 100px bands at
exactly 0.0% ink (y800, y868, y968), then 24.8% at y1268, then 0.7% at y1568. The
void between the pattern and the backer line is ~300px on a 1668px page, 18% of
the full height held empty in one run. The luminance histogram is correspondingly
bimodal rather than graded: 70.9% of sampled pixels in the top bucket and 18.1%
in bucket 4 (64-79), with every intermediate bucket at or below 1.4%. Paper and
ink, nothing between them.

**`one-accent-discipline`, at zero accents.** The accent scan returns an empty
list. Page saturation is 0.1%; mean chroma 0, max chroma 1, with 100% of sampled
pixels in the 0-7 chroma bucket. Top colours are 248,248,248 at 70.9%, 72,72,72
at 18.1%, then four greys. Per the decided ruling, zero and one are the same
restraint, so this is present — but it is present the way a greyscale page gets
it, not the way a page with one chosen hue earns it.

Near-misses, and the reason the verdict is `mixed` rather than `exemplar`:

**The pattern is not a product screenshot and not an artifact, and this is the
closest call on the page.** The 1143x546 element is a `<canvas>` with a 2d
context and class `pattern`, backing store 1414x676, drawing a dense black
space-filling serpentine curve — visually a routing maze, which for a chip
company is an apt motif. It is not `real-product-screenshot`: there is no UI
chrome, no panel, no label, no control, no data. It is not
`artifact-not-dashboard` either, on the harder test — that signal names the
product shown as its *deliverable*, a thing with readable content, and this
graphic carries no cells, no nets, no pads, no metrics and no axis. It alludes to
the deliverable without being one. Both read absent, which is the correct answer
and also the place where the page gets no credit for its single most deliberate
visual decision.

**`stock-photo-generic` absent, on scale and role.** The one photographic image
is `blog/sequioas.png`, natural 1586x992, displayed at 389x114 with a 12px
radius — a pastel, painterly, upward-radiating tree canopy that could belong to
any company. What settles it absent: it occupies 44,346px² of a 1440x1668 page
(1.8% of page area), it is the thumbnail of a dated blog entry rather than a hero
or a section field, `scrims` is empty, and no type is set on it. If the same image
ran full-bleed behind the headline this would be present.

**`generic-sans-default` absent because the face is paid for.** One family does
the whole page — Guaruja Neue, self-hosted as `guaruja-neue-regular.woff2` and
`guaruja-neue-italic.woff2`, with `"Helvetica Neue", Arial, sans-serif` behind it
only as fallback. It is a licensed grotesque, not a default, so the signal does
not fire on the Railway/Linear reading (body face is Inter). The visual family
resemblance to Helvetica is real and does not change the measurement.

**`custom-type-pairing` absent and `type-scale-high-contrast` absent, both on the
same ladder.** Two cuts of one family is one voice; the italic is not a second.
Display is 36px declared / 29.2px painted, body 16.192px declared / 13.1px
painted, a ratio of 2.23:1 — below Railway's 2.7:1, which was already recorded as
absent and below everything in its cohort but Modal. Everything sets at weight
400 except a 600 on the post title and one inline run. So the type is restrained
and also carries no hierarchy: the headline is barely twice the body, which is
the same arithmetic flagged on heroku-2014 at roughly 30px over 16px.

**`centered-hero-stack` and `symmetric-everything` both absent on alignment
counts.** The statement sets `text-align: start` at x140, w1145, and the canvas
starts at the same x140. Of six measured text rows, 5 are start-aligned and 1 is
centred (the backer line, x279 w866). The footer splits left/right rather than
centring: copyright at x324, nav at x1014 and x1080. `asymmetric-split` is absent
too, by the opposite test — there is no split at all, only full-width blocks
stacked in one column with margins of 140 left and 155 right.

**`editorial-grid-break` absent.** The one candidate is the 1px vertical
connector at x≈255 with a horizontal tick, running beside the post card (card
left edge x292) as a timeline affordance. It spans ~160px next to one card and
sits inside the content area, not in the page margin. Railway's rail ran the full
12212px at x≈170 outside an x=259 column; this does not approach that.

**`scroll-reveal-blank` absent, and this is the page's strongest positive
engineering fact.** `hiddenText` is 0 before the walk and 0 after; `innerTextLen`
is 412 before and 412 after; `docH` is 1668 before and 1668 after; `rowsAfter` is
empty. With JavaScript disabled the page returns 412 characters, 1668px and 2
images — the same inventory, item for item. No text is gated on anything. Against
a cohort where openhack rendered near-total black until walked and Railway
yielded 53% of its text only under JS, full no-JS parity is a decision, not an
accident.

`typewriter-headline` absent: `heroTextStable` true, `setInterval` 0, no
`requestAnimationFrame`. The three underlined runs in the statement
("environments" x245, "evaluations" x480, "chip design" x800) all sit at y148 on
one line and are inline emphasis within a single sentence, not a cycling slot —
they are also not links, since the link inventory contains only the two nav
items, the post card and the two footer items. `glass-card-overuse` absent at 0
`backdrop-filter` surfaces. `badge-pill-spam` absent at 0 pills — there is no YC
badge, no "backed by" chip, nothing. `gradient-fill-cta` absent with no button
gradients and, more to the point, no primary button anywhere on the page.
`indigo-violet-accent` absent: the 240-300° hue bucket samples 0.00%, and the
only non-zero buckets are 0.06% at 300-330° and 0.01% at 0-30°, which at 0.1%
total page saturation is antialiasing fringe. `emoji-as-icon` absent at zero
emoji. `generic-line-icon-set` absent: the page has exactly two SVGs, both 11x11
brand marks in the footer (X and LinkedIn), and no feature-icon set exists to be
uniform. `three-card-row` absent at one card. `hero-mockup-float` absent: no
mockup, and the one large framed element measures `transform: none` with no
shadow and a square 1px border. `live-claim-control` absent at zero controls — no
input, toggle, slider or field on the page. `testimonial-card-row` absent because
there is no social-proof section at all: the backer line names Y Combinator and
angels from Anthropic, OpenAI, Google, Cognition, Perplexity and a16z as two
lines of 21.6px centred text, with no cards, no logos and no quotes.

Single theme, light-native: 0 `prefers-color-scheme` rules and 0 dark hooks, so
there is no second theme to neglect.

**Why `mixed` and not `exemplar`, stated so a second rater can check it.** Net is
−3 (0 slop present, 3 craft present), which falls inside both the exemplar range
(−7..−2) and the mixed range (−5..+4), so the arithmetic does not decide it. What
decides it is which craft signals fire. Seven of ten craft signals are absent,
and they are the seven that require a decision beyond leaving things out:
`type-scale-high-contrast` at 2.23:1, `custom-type-pairing` on one family,
`asymmetric-split`, `editorial-grid-break`, `real-product-screenshot`,
`artifact-not-dashboard`, `live-claim-control`. The three that fire are the three
a near-empty greyscale page gets close to free: zero accents on a page with 0.1%
saturation, one optical anchor on a page with one graphic, and density variation
between one dense block and the void beside it. The no-JS parity and the paid
typeface are real decisions and are recorded as such; they are not enough to
carry an exemplar reading against a 2.23:1 ladder, one weight, and nothing shown
of the product.

**And the honest answer to the restraint question: this page's zero slop count is
mostly absence of surface area, not restraint.** The page is 1668px and 412
characters. Of the sixteen slop signals, at least nine have no section in which
they could have fired — no features grid for `three-card-row` or
`generic-line-icon-set`, no social-proof block for `testimonial-card-row`, no
primary button for `gradient-fill-cta`, no icon set, no pricing, no CTA band. A
page cannot overuse glass it never had the surface for. The three places where
the page did have the opportunity and declined are genuine restraint: it could
have put a gradient behind the statement, a YC pill above it, or a scroll reveal
on the pattern, and it did none of the three. The no-JS parity is genuine
engineering. But the headline "zero of sixteen" is produced far more by brevity
than by judgment, and a second rater should read it that way.

**Vocabulary gap.** There is no signal, and no normalisation, that separates
restraint from absence of surface area. This page's 0/16 and a hypothetical
12000px page that ships forty sections while refusing every gradient, pill, glass
surface and scroll gate score identically on the slop side, and the second is
overwhelmingly stronger evidence of discipline. The craft side has the mirrored
problem: `single-optical-anchor` and `density-variation` are close to automatic
when a page contains exactly one graphic and one text block, so they stop
discriminating at low surface area precisely where the slop count also stops
discriminating. Both would be fixed by the same thing — a denominator, such as
page height or section count, recorded alongside the counts so a reader can tell
a 0/16 earned across forty sections from a 0/16 earned across five elements.
Until that exists, this file's net of −3 should be read as much weaker evidence
than the same net on a long page.
