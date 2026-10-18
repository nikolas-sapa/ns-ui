---
source: https://standardmachines.com
kind: site
cohort: yc-current
verdict: mixed
studied: 2026-10-16
context: [hero, nav]
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
  single-optical-anchor: absent
  type-scale-high-contrast: absent
  editorial-grid-break: absent
  custom-type-pairing: absent
  real-product-surface: absent
  shows-deliverable: absent
  density-variation: absent
  one-accent-discipline: present
  live-claim-control: absent
materials: [single-theme]
---

**Capture.** 1440x900 viewport, page height 900px, 2 tiles, `clamped: false`,
`coverage: 1.0`, one stitched strip of 1440x900, stitched height equal to the
settled height (`docH_before` = `docH_after` = 900). The two tiles are
byte-identical (same MD5): there is no scroll range, so the second tile is the
first one again and the stitcher correctly took nothing from it. The page ends
in a bottom `<nav>` (`Careers`, `Blog`); there is no `<footer>` element on this
route. `SiteFooter.XJ-5cdEE.css` is fetched (it serves the blog route) but
nothing on the homepage uses it.

**Zoom, and why 900 is not a measurement of content.** `:root` sets
`--zoom: .81; zoom: var(--zoom)` (computed `zoom: 0.81` on `<html>`, `1` on
`<body>`). Layout runs at 1111px and renders at 1111 x 0.81 = 900. The frame is
`min-height: calc(100svh / var(--zoom))` on a three-row grid
(`minmax(min-content,1fr) auto minmax(min-content,1fr)`), so the page is sized
to the viewport by construction: at 390x844 the document is 844px. Every px
value below is stated nominal (computed style, pre-zoom) and rendered (x0.81)
where it matters. Rendered sizes: paragraphs 20.88px nominal / 16.91px
rendered (`clamp(1.15rem,1.45vw,1.4rem)` at 1440), nav links 17.6 / 14.26, logo
88 / 71.3px square. Body is 16 / 12.96, and no text node on the page renders at
it.

**What is on the page, all of it.** A 71px logo (black S on a near-white
`#fefefe` square, PNG, max chroma 12 in the source, which is anti-alias noise)
centred at y=126; a 44rem column (570px rendered, about 71 characters per line)
of five `<p>` at one size, one weight, `text-align: start`, `#242424`,
line-height 1.65, 1.2em between paragraphs; two nav links centred at the
bottom. 28 elements in `<body>`, one image, zero `<svg>`, `<canvas>`, `<video>`,
`<iframe>`. One webfont: Guaruja Neue Regular 400 (Tipografio, Fio Gonçalves,
828 glyphs, self-hosted woff2); the italic is declared and never loads.
Server-rendered: with JavaScript disabled, `innerText` is identical and the
document is still 900px.

This is the case where craft signals stop discriminating. Of the 26 signals,
about 20 have no section to fire in. A page with one size, one colour, one
column and no product can only score absences, and the absences say almost
nothing about craft either way. The net below should be read as "no evidence"
rather than "balanced evidence".

## Slop signals present

None. The zeros, with the reading that settled each:

- `glass-card-overuse`: 0 elements with `backdrop-filter`.
- `gradient-blob`, `gradient-fill-cta`: 0 elements with a gradient
  `background-image` at rest. The only gradient in the CSS is the logo's
  hover sweep (`.brand:after`, a hard-stopped white band at 40-60%,
  `mix-blend-mode: difference`, 0.48s, gated on `:hover`/`:focus-visible`
  and `prefers-reduced-motion: no-preference`). It is a stripe, not a blob,
  it is not on a button, and it is invisible at rest.
- `indigo-violet-accent`: max chroma over the stitched strip is 3. The UA
  default link blue (`rgb(0,0,238)`) computes on the `.brand` anchor, but that
  anchor contains only the image and paints no text or underline; the strip
  confirms nothing blue is drawn.
- `scroll-reveal-blank`: there is no scroll to gate on. `scrollHeight` 900 =
  `innerHeight` 900. All eight text-bearing or media elements (`main p` x5,
  nav `a` x2, header image) read opacity 1 / visible at 200, 500, 1000, 2000
  and 4000ms, with `document.getAnimations()` empty at every sample, so the
  dwell control and the walk agree trivially.
- `typewriter-headline`: 0 running animations; text identical from 200ms to
  8s and with JS disabled.
- `badge-pill-spam`, `three-card-row`, `testimonial-card-row`,
  `generic-line-icon-set`, `emoji-as-icon`, `stock-photo-generic`,
  `hero-mockup-float`: the elements these signals count do not exist on the
  page (0 pills, 0 cards, 0 icons, 0 photographs, 0 mockups). The investor
  list is inline linked text in one paragraph, not quote cards.

## Craft signals present

**`one-accent-discipline` present, on zero accents.** Every painted colour is
neutral: `#242424` text, `#cccccc` underline (`text-decoration-color`), `#fff`
field, a black/near-white logo. Hover goes to `#000`. Strip max chroma 3 of
255. Under the decided zero-accent ruling this is present. It is the only
craft signal the page earns, and it earns it the way every monochrome page
does.

## Near-misses

**`symmetric-everything` (absent, and the closest call on the page).** By the
corpus's applied procedure, alignment counts (edotenv, tsenta, deepmark), it is
absent: 0 of 7 text nodes are centre-aligned, all 7 compute `text-align: start`.
By mass placement it reads the other way. Horizontal ink centroids: logo
712.7, nav 711.2, text block 694.6, against a frame axis of 712.5 (1425px
content width after `scrollbar-gutter: stable`). The content block is
vertically centred too: `main` spans y=298-602, centre 450 of 900, between two
equal `1fr` rows. The one off-axis gesture, `.content { transform:
translate(3rem) }` at `min-width: 60em` (48px nominal, 38.9px rendered), is a
correction toward the axis, not away from it: without it the ragged-right
block's ink centroid would sit at 655.7, 56.8px left of the axis; with it,
17.9px. So the page is axial by intent and by measurement. I held `absent`
because the signal's applied procedure in this corpus is text alignment and
the page sets every line ragged-right; a rater scoring mass placement would
call it `present` and be able to defend it. This is a vocabulary gap: the
signal has no stated procedure and the two readings disagree here.

**`centered-hero-stack` (absent).** The silhouette is there: a centred mark
over a centred column over centred links. But the signal is keyed in this
corpus to a centre-aligned headline and subhead sharing the axis (osseus,
acyclic), and there is no headline: five start-aligned paragraphs at one size.
Held absent on 0 of 5 centre-aligned prose nodes.

**`generic-sans-default` (absent).** On face identity it is clearly absent:
Guaruja Neue is a licensed Tipografio grotesque, self-hosted, with a
`Helvetica Neue, Arial` fallback rather than `system-ui`, and it is not the
era's default (Inter, Geist, system). Under railway-com's discriminator (does
the page compensate with its own optical system?) it is weaker:
`letter-spacing: normal` at both sizes, no `font-feature-settings`. But that
discriminator was written for default faces, and with only two text sizes on
the page there is no ramp to track. Held absent on identity.

**`single-optical-anchor` (absent; rule-ineligible, recorded as my call).**
What I counted: three masses. The text block carries 93.0% of page ink, the
logo 4.7%, the nav 2.3%, over a page with 0.74% total ink coverage. On
edotenv's procedure (one element carries most of the band's ink, nothing else
to look at) the text block would pass. I scored it absent because the block is
not one element: it is five equal paragraphs at one size and weight, and it
dominates only because there is only one mass of content. That is the exact
degenerate case: one mass dominates because there is only one mass. The
singular, highest-contrast element is the logo, at 71px rendered and 4.7% of
ink, which does not dominate anything. If a second rater counts the block,
net moves from -1 to -2 and the verdict does not change.

**`type-scale-high-contrast` (absent, not close).** `ladder.cjs`: largest
letter-bearing node 20.88px over body 16px = 1.31:1 (rendered 16.91 / 12.96,
the same ratio, because the zoom sits on `:root` and scales numerator and
denominator alike). Against the smallest text actually rendered (nav, 17.6),
1.19:1. Both far below 3.75. The largest text on the page is body copy.

**`editorial-grid-break` (absent).** There is no grid to break. The 48px
translate is the only displacement on the page and, per the centroid reading
above, it is optical centring.

**`density-variation` (absent).** One density: five paragraphs at one size,
one leading, one gap. There is no second band to compare against, which on a
one-viewport page is structural rather than a choice the page made.

**`custom-type-pairing` (absent).** One family, one weight, one style loads.

**`real-product-surface`, `shows-deliverable` (absent).** No product surface
and no artefact. The product is one sentence ("autonomous systems to design
and discover advanced chips") and one offer ("environments to train your
models on chip design", via `mailto:founders@standardmachines.com`). The
entry that could have embarrassed the vendor: there is none. The only
substantive content beyond the description is an investor and angel list (YC,
plus angels "from" Anthropic, OpenAI, Meta Superintelligence Labs, Amazon AGI,
Google, Cognition, Perplexity, a16z), which can only flatter.

**`asymmetric-split`, `live-claim-control` (absent).** One column, no split;
no control of any kind beyond nine outbound links, a mailto and two nav links.

## Verdict

**`mixed`, net -1** (0 slop present, 1 craft present). Page height 900px, one
viewport, by construction.

It is outside the exemplar range (-8..-2) and nowhere near the slop threshold
(+4). The verdict is robust to every near-miss above taken singly:
`symmetric-everything` or `centered-hero-stack` flipped present gives net 0;
`generic-sans-default` flipped gives 0; `single-optical-anchor` flipped gives
-2, which touches the exemplar range's top edge but stays inside mixed's
-5..+3. A second rater would have to flip several signals in the same
direction to leave `mixed`.

`mixed` here does not mean a mixture. It means there is too little page for
the vocabulary to find either. Like acyclic, a low slop count is not evidence
of craft; unlike acyclic, nothing here is a template default either. The
craft that does exist (the optical-centring offset, a licensed face, a
monochrome palette held to one grey, `scrollbar-gutter: stable`, underline
colour and offset specified, `prefers-reduced-motion` respected on the one
animation) sits below the resolution of the 26 signals. Only the palette
registers.

**Drift from the 2026-10-14 study**

Opened only after the front-matter and the sections above were written. The
2026-10-16 v4 change-3b re-pass in that file already recorded the redesign
(1668 to 900px, canvas, blog card and footer gone) but by its own rule touched
only the two surface signals; this is the full re-study it asked for.

Values that changed:

- `single-optical-anchor`: present → absent. **Page changed.** The old anchor
  was the 1143x546 `<canvas class="pattern">`, 44.5-48.5% ink per 100px band
  against 0.0-8.1% around it. That element is not on the page. What remains is
  a text block that carries 93.0% of ink only because it is the only content
  mass, which is the degenerate case the old file itself flagged ("close to
  automatic when a page contains exactly one graphic and one text block"). The
  old call was sound for the old page.
- `density-variation`: present → absent. **Page changed.** The old reading was
  a 48.5% ink peak against three consecutive 0.0% bands and a ~300px void (18%
  of 1668px). The pattern and the void are both gone; five equal paragraphs at
  one size and leading on a 900px page have no second density to vary against.
- `verdict`: mixed → mixed, unchanged. Net -3 → -1. The old file argued
  `mixed` over `exemplar` at -3 because the three craft signals that fired were
  "the three a near-empty greyscale page gets close to free". Two of those
  three needed the canvas; the third, zero accents, survives.
- `context`: [nav, hero, blog-index, footer] → [hero, nav]. **Page changed.**
  The dated blog card (`blog-index`) and the `<footer>` with copyright and two
  11x11 social SVGs are gone; the nav moved from top to bottom.
- `materials`: [single-theme, illustration] → [single-theme]. **Page changed.**
  The generative serpentine canvas was the illustration; nothing drawn remains
  except the logo mark.

Values that held, with the measurement that moved under them:

- `type-scale-high-contrast` absent on both: 36/16.192 = 2.23:1 then, 20.88/16
  = 1.31:1 now. The redesign removed the only display size; the page now has
  no type above body-copy size.
- `one-accent-discipline` present on both, at zero accents (old max chroma 1,
  new strip max chroma 3).
- `generic-sans-default` and `custom-type-pairing` absent on both, on the same
  face: Guaruja Neue Regular. The old file listed the italic woff2 as shipped;
  it is still declared in `@font-face` and does not load on this page.
- `symmetric-everything` and `centered-hero-stack` absent on both, but the
  margin narrowed. The old page started the statement and the canvas at x140
  and split the footer left/right, so nothing shared a centre axis. The new
  page puts every mass on one axis (centroids 712.7 / 694.6 / 711.2 against
  712.5) and holds `absent` only on text alignment. If the vocabulary adopts a
  mass-placement procedure for `symmetric-everything`, this file flips and the
  old one would not have.
- `scroll-reveal-blank` absent on both; no-JS parity held across the redesign
  (412 → 441 characters, both identical with JS off).
- `real-product-surface`, `shows-deliverable` absent on both, confirmed by the
  3b re-pass and again here.
- All other slop signals absent on both, for the same reason: no section in
  which they could fire.

No value changed because the old rating was wrong. Every flip traces to an
element the redesign removed. The old file's closing vocabulary gap (no
denominator separating restraint from absence of surface area) applies with
more force now: 900px, 441 characters, one image, and a net of -1 that is
weaker evidence than the -3 it replaces, which was itself weak.

**Superseded study (2026-10-14, verdict `mixed`).** Everything below describes the page as it was before the redesign that forced the re-study above, and is kept as the record of that page. Its signal values, which the front-matter no longer carries:

```
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
```

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

**v4 change 3b surface re-pass**

Re-rated from the live page on 2026-10-16. Values decided before this prose:
`real-product-surface: absent` (confirmed, no flip) and `shows-deliverable:
absent` (confirmed, no flip).

Capture facts. `shoot-tiles.cjs` at 1440x900: 2 tiles, `clamped: false`,
`coverage: 1`, `docH_before` 900, `docH_after` 900, `scroller: window`,
`innerCands` empty. The two tiles are byte-identical (52526 bytes each) because
the whole page fits one viewport; the stitcher emitted 1 strip of 900px against a
900px page and flagged no mismatch, so the duplicate is the expected second shot
of a non-scrolling page, not a padded walk. A Playwright DOM read agrees:
`documentElement` `scrollHeight` 900 = `clientHeight` 900, `body` `scrollHeight`
1111, root `zoom: 0.81`, and 1111 × 0.81 = 899.9, the same zoom mechanics the
original section documented. No element scrolls internally. No text sits in a
hidden element. With JavaScript disabled the page returns the same 441
characters, 900px and 1 image. All y values below are painted (post-zoom) px.

Footer check. The strip ends in a bottom `<nav>` at y833 (h67, flush to y900)
holding two links, "Careers" and "Blog". That nav is the page's only footer
furniture: there is no `<footer>` element, no copyright line and no social icons
any more. Nothing exists below y900.

Every candidate product surface, searched across the full DOM inventory of
`img, video, canvas, svg, iframe, picture, object, embed`:
- y126: one IMG, `standard-machines-logo.Dc92TwCz.png`, 71x71 at x677. A brand
  mark. Not a product surface.
- That is the entire non-text inventory. Zero canvas, zero video, zero SVG, zero
  iframe. The 1143x546 pattern canvas and the `sequioas.png` blog card that the
  sections above describe are gone from this URL.

To decide whether absence is a category fact or a deficiency, I followed the
three internal links one click out (not scored). `/blog` and `/careers` carry
only the logo. `/launch` (10709px, the launch post) carries two canvases (charts
of benchmark scores, e.g. "97% — discriminates nothing"), one inline svg and four
SVG diagrams. `episode.svg` reads "agent workspace | spec.md | design.sv |
simulate | synthesize | preview P&R | ... | sealed | submit | grader | hidden
checks | physical flow | aggregation | one exact reward"; `gate-cascade.svg`
reads "admission | correctness | feasibility | performance (measured) | reject,
R = 0 | ...". These are architecture schematics of the environment, drawn boxes
and arrows, not a capture or faithful rebuild of anything the environment
actually emits. No trajectory transcript, grader report or task file appears
anywhere on the site.

Q1 verdict: `absent`. The scored page contains no product surface of any medium,
genuine or stylised; there is nothing to test for faithfulness. Most of this is a
category fact. The product, per the page, is "environments to train your models
on chip design": an RL environment consumed by a lab's training infrastructure,
with no end-user GUI to screenshot, so the absence of UI chrome is not a design
failure. The narrower point, recorded so it is not lost: the product does have a
genuine non-GUI surface (an episode trace, a grader verdict, a task contract),
and neither the homepage nor the launch post shows one. Read the `absent` as
"nothing shown, and little to show in the GUI sense", not as a page hiding a UI.

The entry that could have embarrassed the vendor: none exists. The scored content
is five paragraphs and a two-link nav, quoted in full:
- y298: "Standard Machines is a research company building autonomous systems to
  design and discover advanced chips."
- y374: "We're backed by Top VCs, Y Combinator, and angels from Anthropic,
  OpenAI, Meta Superintelligence Labs, Amazon AGI, Google, Cognition, Perplexity,
  a16z, and more."
- y478: "If you'd like environments to train your models on chip design, reach
  us." (`reach us` → `mailto:founders@standardmachines.com`)
- y526: "If you'd like to join us, we're hiring."
- y574: "We're based in San Francisco and London."
- y833: "Careers", "Blog".

I searched those 441 characters and 14 links for any number, output, limit,
failure, cost or refusal. There is no number on the page at all. The backer list
can only flatter. "research company" is positioning, not a refusal narrowing a
claim the page would benefit from leaving broad. The `/launch` post does contain
unflattering figures (CVDP "34% to 97%", testbenches overstating correctness "by
a factor of four or five"), but they count against other people's benchmarks, not
the vendor, and they are off the scored URL.

Q2 verdict: `absent`. No artefact of anyone's work is shown, in chrome, capture
or page-authored rendering, and no scored entry could count against the vendor.

Drift from the earlier prose. The page has been rebuilt, and almost every measured
fact above no longer matches the live URL:
- Height 1668 → 900. The page no longer scrolls at 1440x900.
- The 1143x546 `<canvas class="pattern">` at x140 y247 is gone from the homepage.
  `sequioas.png` and the dated blog card are gone too; `sequioas.png` now renders
  at 959x213 inside `/launch`.
- The two-line 36px statement with three underlined runs ("environments",
  "evaluations", "chip design") is replaced by five left-aligned paragraphs at
  x466, all declared 20.88px (≈16.9px painted after zoom), one size for all text.
- The 52px logo with two top nav links is now a centred 71x71 logo at x677 y126
  with no top nav; Careers and Blog moved to the bottom nav.
- The centred 21.6px backer line is now a left-aligned paragraph of nine linked
  names, adding "Meta Superintelligence Labs" and "Amazon AGI" and opening with
  "Top VCs".
- The footer with copyright at x324 and the 11x11 X and LinkedIn SVGs is gone;
  the page ends at the Careers/Blog nav.
- innerText 412 → 441 characters; images 2 → 1; canvases 1 → 0; SVGs 2 → 0.
- The earlier `single-optical-anchor` and `density-variation` readings rested on
  the canvas and the void beside it, neither of which is on the page now. This
  pass does not touch those signals; a later re-rate should.
