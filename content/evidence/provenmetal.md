---
source: https://provenmetal.com
kind: site
cohort: yc-current
verdict: mixed
studied: 2026-10-16
context: [nav, hero, features, faq, cta, footer]
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
  scroll-reveal-blank: present
  typewriter-headline: absent
  stock-photo-generic: absent
  centered-hero-stack: absent
  hero-mockup-float: absent
  asymmetric-split: present
  single-optical-anchor: absent
  type-scale-high-contrast: present
  editorial-grid-break: absent
  custom-type-pairing: present
  real-product-surface: absent
  shows-deliverable: absent
  density-variation: absent
  one-accent-discipline: present
  live-claim-control: absent
materials: [single-theme, illustration]
---

**Capture.** Viewport 1440x900. Reused today's walk at
`~/scratch/antislop/s5/provenmetal` (shot 14:23-14:24, 2026-10-16): 7 tiles,
`scroller: window`, `clamped: false`, `coverage: 1`, docH 4384 before and after
the walk. `NS_SESSION=s5 stitch.py` re-run at 15:55: 1 strip, 4384px stitched
against a 4384px page, no drift. The strip ends in the footer: the 200px
"ProvenMetal" wordmark over a tiled M-mark texture, below the
`FOUNDERS@PROVENMETAL.COM` / phone block and the `© PROVENMETAL / ALL RIGHTS
RESERVED` line. Page text (`body.innerText`) is 2,301 characters across seven
bands: hero y105-614, turn times y614-1133, process (network) y1133-1813, FAQ
y1813-2729, closing CTA y2729-3125, "America builds again." y3125-3707, footer
y3707-4384. All values below were read off the DOM with Playwright, not pixels,
except where a pixel measurement is named. Single theme: forcing
`colorScheme: 'light'` leaves `body` at `rgb(10, 10, 10)`.

This is a thin page (4384px, 2,301 characters, no pricing, no testimonials, no
product capture). Several signals are absent because they have nowhere to fire,
and the verdict below allows for that.

**`scroll-reveal-blank` present, settled by the walk-vs-dwell control.** The
whole closing CTA band is text gated behind scroll. Four wrappers carry
`.reveal`, whose stylesheet rule is `opacity: 0` with a 22px `translateY`, lifted
only by `.reveal.is-visible { opacity: 1 }`. Two fresh page loads, same 8000ms
pre-wait as the walker, then:

- walk (scrollTo every 700px, 900ms settle, census of every element's direct
  text with effective opacity multiplied up the ancestor chain), 6,375ms: of 108
  text nodes, 5 sat under 8% at t0 and all 5 reached opacity 1. "Ready to order
  your PCB?" first visible at y2100; `LOGIN`, `GET A QUOTE`, "Automated DFM review
  uses heuristic-based harnesses ..." and "Review data handling" at y2800;
- dwell (same loop, no scroll), 6,348ms: the same 5 nodes under 8% at t0, and
  0 of 5 recovered. Max opacity 0 for every one.

Five recovered by scroll, none by time, so the gate is scroll. Two corroborating
reads: with `javaScriptEnabled: false` all four `.reveal` blocks compute
`opacity: 0`, so a no-JS visitor or a print gets a heading-less, button-less
closing band; with `reducedMotion: 'reduce'` and no scroll they compute `1`
(the page ships a `prefers-reduced-motion` override). Scale, stated plainly:
5 of 108 text nodes, one 396px band, 9% of page height. Every other band,
including the hero, is visible at t0.

This also settles the "empty outlines" an earlier capture showed. They are this
gate plus a stitch seam. Tile 03 (scrollY 2100) has the buttons at viewport
y857-912, not yet far enough in to fire, so they paint nothing; the heading above
them had already fired. Tile 04 (scrollY 2800) has them fully revealed at
viewport y157-212 under the 69px sticky header, but its new band starts at
viewport y200, so the strip keeps only their bottom 12px: a sliver of the 1px
border on `LOGIN` and of the red fill on `GET A QUOTE`. The buttons are real and
render; they render only after scroll.

**`asymmetric-split` present, on four of six content bands, not on the hero.**
Turn times: the h2 "Your next PCB build, sooner." is an 822px block at x72; the
"½ / THE LEAD TIME" figure sits right-aligned at x1035-1330, a small mass
opposing a large one across a vacant middle. Process: the h2 "The factory is a
network." is 695px at x72, the paragraph is 480px at x799 and starts 19px lower
(y1238 against y1219), roughly 60/40, with the prose column stopping at x1279,
89px short of the frame. FAQ: a start-aligned single column whose answers end
near x820 in a 72-1368 frame, leaving about 548px vacant to the right. The h1
and the first three h2s are start-aligned; only the closing CTA and the flag band
are centred. The near-miss is the hero itself: its two cells are 756px and 684px
(52.5/47.5) holding a 560px text block and a 560px image frame, which is an even
split, not an asymmetric one.

**`type-scale-high-contrast` present.** `scripts/antislop/ladder.cjs`: body
computed 16px; largest letter-bearing text node is the footer wordmark, an SVG
`<text>` "ProvenMetal" at 200px in Rhetorik Serif, so the procedure's ratio is
200/16 = 12.5:1. That node is decorative, so the reading that matters is the
next one down: the h1 "We build circuit boards fast." at 65.5px, 65.5/16 =
4.09:1, also over the 3.75 cut. The ladder below it is 64 / 64 / 54.7 / 54.4 /
48px section heads, 26.4 / 22.4 / 19.2px serif sub-heads, and a mono floor of
16 / 15 / 14 / 13.6 / 13 / 12.8 / 12.5 / 12 / 11.5 / 10.9 / 10.4px. The "½" is
128px but carries no letter and is excluded by the procedure.

**`custom-type-pairing` present.** Three loaded faces, each with a job: Rhetorik
Serif (served under the family name `Rhetorik Serif Trial`, weights 400/500) for
every heading and the wordmark; DM Mono 400/500 for all body, labels, nav and
buttons, uppercase-tracked at 1.25-2.64px for eyebrows and controls; and a
bespoke `ProvenMetal Numerals` face whose `@font-face` declares
`unicode-range: U+30`, i.e. it replaces only the digit zero, first in the body
stack. No sans-serif appears in any text node's computed stack. A serif display
over a mono body with a single-glyph house numeral is a decision, not a default.

**`one-accent-discipline` present.** One chromatic colour carries the page:
`rgb(255, 0, 33)` (chroma 255). It fills the hiring banner, every `GET A QUOTE`
and `ORDER WITH AI` button, the step and FAQ ordinals (01-04), the closing M mark,
and the routing diagram's strokes (8) and fills (4). Everything else is neutral:
text `#fff`, `rgb(244, 246, 248)` (chroma 4), a cool grey `rgb(154, 167, 176)`
(chroma 22) for secondary copy, `rgb(98, 98, 98)` and `rgb(238, 238, 238)` in the
diagram, background `rgb(10, 10, 10)`. No border on the page has chroma above 40.
The only other chromatic pixel is the 16px Y Combinator mark in the eyebrow,
`fill rgb(255, 102, 0)`, which is YC's logo, not a colour decision of this page.

**Near-misses.**

- `three-card-row`, absent on construction. The process steps "01 Quote &
  source / 02 Route & build / 03 Track & deliver" are three equal 432px `LI`
  columns, which is the shape the signal targets. They are not cards:
  `background-color: rgba(0, 0, 0, 0)`, `border-radius: 0px`, `box-shadow: none`,
  separated only by a 1px right border at 12% white under a 1px top rule. That is
  the corpus's standing ruling for hairline-divided 3-ups.
- `generic-line-icon-set`, absent. The steps carry numerals, not icons. The 49
  inline SVGs are: 12px registration "+" marks on the frame (stroke 1), 13px
  "↗" link arrows (stroke 1.3) on the banner and seven footer links, two social
  marks, the YC mark, the routing diagram (two glyph types, a fab trace and an
  assembly chip, each repeated four times inside one figure), and the footer
  wordmark. The ↗ arrows are uniform and say nothing a link does not, but they are
  link affordances, not a feature set attached to headings.
- `stock-photo-generic`, absent. The only photographic-looking asset is
  `flag-halftone.png` (2157x1136, shown 1038x326) under "America builds again.",
  with an infinite CSS `billow` animation. A flag can belong to any American firm,
  which is the case for firing. It does not, because it is a treated graphic
  (halftone dither, no type set on it, no scrim), and the page ties the motif to a
  stated policy in the FAQ (ITAR designs "stay with US partners ... boards for it
  are made in the US"). Recorded as `illustration` in materials.
- `hero-mockup-float`, absent. The hero image is `iso-board.png`, an exploded
  isometric line drawing of a generic board (alt "Exploded isometric view of a
  PCB and its components"), flat inside a hairline frame with corner marks. It is
  not a UI and does not float.
- `glass-card-overuse`, absent: one `backdrop-filter` on the page, the 69px sticky
  nav at `blur(12px)`. `badge-pill-spam`, absent: no element with
  `border-radius` of 8px or more carries text; every radius on the page is 0, and
  "BACKED BY Y COMBINATOR" is a plain tracked eyebrow, not a pill.
- `gradient-blob`, absent. All 16 `background-image` gradients are texture: 45°
  hatching at 8% white on the 44px side rails, 3.5% hairline grids, and a 10% dot
  grid behind the CTA band. None is a colour field.
- `typewriter-headline`, absent: every h1/h2/h3 and the figure text are
  byte-identical across three reads 4s apart. The routing diagram's selected
  partners stay "Fab 2" and "Assembly 3" across five reads 1.5s apart and the
  figure contains no button or focusable control, so it is a static schematic.
- `density-variation`, absent. Ink coverage (luminance over 90, every second
  pixel inside the rails) is 3.73 / 2.75 / 1.97 / 2.04 / 1.53% for hero through
  CTA and 0.90% for the footer, and characters per vertical pixel run 0.51 /
  0.61 / 0.64 / 0.72 / 0.44 / 0.41. One texture repeated: tracked mono eyebrow,
  48-65px serif head, 13-16px mono copy. The single outlier is the flag band
  (15.78% ink, 21 characters in 581px), and that swing comes from one image panel
  existing, not from any dense passage (no table, code, spec list or small-print
  block) contrasting with an airy one.
- `editorial-grid-break`, absent. The grid is unusually explicit (44px hatched
  rails at x0-44 and x1396-1440, hairline section rules, "+" marks at every
  junction) and nothing crosses it. The 200px footer wordmark fills the frame
  edge to edge (x72, 1296px) without breaking it; the 128px "½" sits inside its
  band; the full-bleed red hiring banner is chrome above the grid.
- `real-product-surface`, absent. The product is a PCB build service whose
  working surface is the quote/order app at `central.provenmetal.com` and,
  physically, the boards. Neither appears. The page shows a generic isometric
  board illustration and a routing schematic whose partners are anonymised
  placeholders ("Fab 1" to "Fab 4", "Assembly 1" to "Assembly 4"); that is a
  stylised diagram of the business model, not the product in use. The `LOGIN`
  and `GET A QUOTE` links are the doorway (`/order?step=upload`), which fails by
  rule. Not exercised: the order flow itself, because uploading files there
  creates a real quote request.
- `shows-deliverable`, absent. No entry inside an artefact could embarrass the
  vendor. The routing schematic shows a clean route with no cost, no time and
  no failed or declined partner. The "½ THE LEAD TIME / Your build schedule is
  confirmed in your quote." figure is a vendor claim. The candidates for a
  refusal all sit in prose: the FAQ's "AOI, X-ray and functional test are
  available by quote" and the ITAR answer ("it never goes to AI review, overseas
  fabricators or overseas parts sourcing"), and the CTA footnote disclosing that
  DFM review uses "heuristic-based harnesses". The procedure scores the
  artefact, not FAQ prose, so none of them counts. "5x faster than the
  industry" and "up to 2x faster" are vendor-aggregate figures with no shown
  basis, which are absent however phrased.
- `live-claim-control`, absent. The central claim is speed ("cut lead times in
  half", "5x faster" quoting). Nothing on the page lets a visitor test it; the
  only route is the off-page upload flow.
- `single-optical-anchor` (rule-ineligible, undefined), recorded absent. I
  counted masses at the hero and down the page. The hero holds two of nearly
  equal weight in near-equal cells: the 560x134 white serif h1 block on the left
  and the 558x399 framed line-art board on the right. Below it, five section
  heads at 48-65px and the 128px "½" each claim their own band, and the largest
  single mass on the page is the 200px wordmark at the very bottom. No one mass
  dominates, and this is not the "only one mass" case either.
- `scroll-reveal-blank` itself, the one slop value that could have gone the
  other way: the gate covers one band and 5 of 108 nodes, and the page guards
  reduced motion. The vocabulary sets no minimum share, the dwell recovers none
  of the five, and the five are the closing heading and the primary conversion
  buttons, so it stays present.

**Verdict: `mixed`, net −3** (1 slop present, 4 craft present). Net −3 sits in
the overlap of the `mixed` range (−5..+3) and the `exemplar` range (−8..−2), so
the number does not decide it. What decides it: the four craft signals are all
dress (type scale, type pairing, one red, left-weighted bands), and the three
that carry substance in this corpus, `real-product-surface`,
`shows-deliverable` and `live-claim-control`, are all absent. The page asks to
be believed on "½ the lead time", "2x" and "5x" without showing a board, a
quote, a schedule or a route that went wrong. It is also thin: 4384px and
2,301 characters, with no pricing, testimonial, stats or feature-grid band in
which most slop signals could fire, so its low slop count is partly absence of
surface. Rounding that up to `exemplar` would be crediting restraint for content
the page does not have. Not `slop`: net −3 is nowhere near the +4 floor.

**Drift from the 2026-10-14 study**

Everything above was rated before the old file was opened. The old file reads
`exemplar`, net −6 (1 slop, 7 craft). This draft reads `mixed`, net −3 (1 slop,
4 craft). Three signals and the verdict changed. None of the four changes is
caused by the redesign.

- `single-optical-anchor`: present → absent. **Not a page change, and not
  clearly an old-rating error: a scope disagreement on an undefined signal.**
  The hero is the same page in both studies. The old file measured luminance on
  the first viewport, and it reproduces on today's tile 00: of 27,828 pixels at
  luminance ≥160, the h1 box (560x134 at x72, y216) holds 9,341 (33.6%, density
  12.45%) and the drawing (558x399 at x803, y160) holds 1,806 (6.5%, density
  0.81%). So my blind sentence calling the hero's two masses "of nearly equal
  weight" is wrong by luminance; it rested on box area. By luminance the h1
  dominates the hero. I leave the value `absent` because I scored the page, not
  the first viewport, and down the page five 48-65px serif heads, the 128px "½"
  and the 200px footer wordmark each hold their own band with no one of them
  dominating. Whether this signal is a first-viewport or a whole-page reading is
  exactly what the vocabulary leaves undefined. On a first-viewport reading the
  value is `present`, craft is 5 and net is −4, and the verdict below does not
  change.
- `editorial-grid-break`: present → absent. **Page unchanged; old rating wrong
  on my reading.** The old file counted the 45° hatch bands in the side rails,
  the "+" registration crosses on the frame line and the footer wordmark. All
  three are still there. The corpus's present cases put content in the margin
  (a numbered section-label system outside the column, a sticky section index
  in the gutter); here what sits in the margin is the frame's own drawing, the
  hatching that fills the rails and the crosses that mark their junctions. That
  is the grid, not a break of it. The wordmark is inside the frame (x72, 1296px
  wide in a 72-1368 frame) and is large, not displaced. A second rater who reads
  "anything permanently in the margin" literally would side with the old call;
  that looseness is a vocabulary gap.
- `density-variation`: present → absent. **Page unchanged (innerText 2,340 →
  2,301, the same seven bands); old rating wrong against the corpus's later
  rulings.** The old evidence was descriptive: the FAQ packs four Q&As into
  640px, the network band spends 530px on a heading, a paragraph and a diagram.
  Measured, text bands run 0.41-0.72 characters per vertical pixel (1.75x) and
  0.90-3.73% ink. Other files have since ruled a 3.5x hero-versus-paragraph
  swing absent ("every page with a hero and a paragraph produces it") and a
  0.80-point ink spread absent. The only real outlier here is the image-only
  flag band.
- Verdict: `exemplar` → `mixed`. **Not a page change.** The three re-reads
  above take net from −6 to −3, into the overlap of the two ranges, and at −3
  the substance argument decides it: no product surface, no deliverable, no
  live claim control, a thin page. The old file's own closing reservation made
  this argument ("A rater who weighted 'how much is actually proven here' could
  argue `mixed` ..."). It is now made by the numbers as well as the reservation.

Unchanged values, with the facts that moved under them:

- `scroll-reveal-blank`: present in both, and the gated set is the same five
  nodes in the same band (old y2730-3125, now y2729-3125), so the walk-vs-dwell
  result is unchanged: 5 crossed on the walk, 0 on the dwell, in both studies.
  **The page changed the labels inside it**: the old file's gated buttons were
  "Get Online Quote" and "Order with AI"; today they are `LOGIN` and `GET A
  QUOTE` (`cta_location=bottom_cta`), and the old pair now sits ungated in the
  footer. The "empty outlines" the earlier re-pass saw in its strip are settled
  above: the `.reveal` gate plus a stitch seam at y3000, not a rendering fault.
- `asymmetric-split`: present in both, on different grounds for the hero. The
  old file counted the hero as one of three asymmetric splits; I measure its
  cells at 756/684 (52.5/47.5) holding two 560px blocks and count it as even. The
  value stands on the turn-times, network and FAQ bands in both readings.
- `type-scale-high-contrast`: both 4.09:1 on the h1 (65.5/16). The procedure as
  now written takes the largest letter-bearing node, which is the 200px SVG
  footer wordmark (12.5:1); either reading is over 3.75.
- `one-accent-discipline`: the old file sampled the red off pixels as `#F80828`;
  the DOM value is `rgb(255, 0, 33)`, `#FF0021`. Same accent, screenshot colour
  conversion. Likewise the background is `rgb(10, 10, 10)` in the DOM against
  the old pixel reading `#080808`.
- `generic-line-icon-set`: absent in both. The old file counted 7 SVGs page-wide;
  I count 49 inline SVGs, the difference being the 12px frame crosses, the 13px
  "↗" link arrows (banner, `ORDER WITH AI` and seven footer links) and the two
  large figures. I cannot tell from the old prose whether the footer arrows are
  new with the redesign or were excluded by method; neither reading moves the
  value.
- `real-product-surface`, `shows-deliverable`: absent in both, for the same
  reasons the 2026-10-16 surface re-pass gave.
- `context`: `faq` added. The FAQ band was on the old page too; the `faq` slot
  joined the vocabulary at n=42, after the old study.

**Superseded study (2026-10-14, verdict `exemplar`).** Everything below describes the page as it was before the redesign that forced the re-study above, and is kept as the record of that page. Its signal values, which the front-matter no longer carries:

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
scroll-reveal-blank: present
typewriter-headline: absent
stock-photo-generic: absent
centered-hero-stack: absent
hero-mockup-float: absent
asymmetric-split: present
single-optical-anchor: present
type-scale-high-contrast: present
editorial-grid-break: present
custom-type-pairing: present
real-product-surface: absent
shows-deliverable: absent
density-variation: present
one-accent-discipline: present
live-claim-control: absent
```

Captured at 1440x900, animations disabled, 900ms settle; full page 4384px,
walked in 700px steps to 7 tiles and stitched into two strips (4200px plus a
final 900px tile). The last tile is the footer, so the walk is complete.
AI-native PCB fabrication, assembly and component sourcing, YC S26. A
near-monochrome industrial page: 86.6% of sampled pixels are #080808 and the
entire saturated budget is one red.

**The one slop signal is `scroll-reveal-blank`, and it is the smallest
instance measured in this corpus.** Across the walk 5 text nodes carrying 185
characters cross from under 8% opacity to visible. Nothing mounts:
`documentElement.scrollHeight` reads 4384 before and after and `innerText`
reads 2340 characters before and after, so these are existing nodes fading in
rather than content being injected. The dwell control settles the gate — 9
steps, identical 900ms settle, `scrollTo(0, 0)` instead of `scrollTo(0, y)`
every step — and crosses 0 nodes and 0 characters, so the gate is scroll
displacement and not elapsed time. What is gated is named exactly: "Ready to
order your PCB?", "Get Online Quote", "Order with AI", "Automated DFM review
uses heuristic-based harnesses built on proprietary manufacturing and supply
chain data." and "Review data handling" — the whole closing CTA band at
y2730-3125, its heading, both buttons and its one compliance disclosure. 185
characters is the floor of this signal and it is still the page's closing
conversion ask. Every other band on the page renders at rest.

**Three asymmetric splits, measured off heading geometry in a 1440 frame.**
The hero sets "We build circuit boards fast." at 65.5px, `text-align: start`,
x=72, w=560, against a 558x399 technical drawing beginning at x≈762. The
turn-times band sets an 822px headline at x=72 against a "1/2" figure and its
two-line caption parked at x=1178. The network band sets "The factory is a
network." at 54.7px, x=72, w=695, with the explanatory paragraph in the right
half. 11 of 13 headings are `start`-aligned at x=72 or x=108. Nothing is
mirrored and nothing is balanced by opposing mass.

**`single-optical-anchor`, measured on the first viewport.** 25,007 of
1,296,000 pixels reach luminance ≥160. The two headline lines — a 652x250 box
at x=48 — hold 10,097 of them: 40.4% of the viewport's bright pixels in 12.6%
of its area, a 6.19% bright density. The 640x430 exploded-PCB drawing holds
1,806: 7.2% of bright pixels in 21.2% of the area, a 0.66% density at 0.00%
saturation. It is 2.3x the headline's area, one-ninth its bright density, and
pure monochrome hairline — a texture, not a competing mass. The next brightest
region, hero body copy plus both buttons, runs 2.42%. The announcement bar is
98.92% saturated but only 1.43% bright, so the red is chroma in a 1440x28
strip rather than a second anchor. The luminance budget is spent once, which
is the mechanism `resend-com` and `linear-app` use.

**Type scale 4.09:1.** 65.52px display against 16px body; 4.31:1 against the
15.2px hero paragraph; 5.04:1 against the 13px tracked button labels. Above
every `absent` reading in the corpus (railway-com 3.4:1, stripe-com 3.0:1,
clerk-com 3.1:1, cursor-com 2.2:1) and inside the present band (anthropic-com
3.8:1, vercel-com 3.9:1, sona8 and squarespace-2014 4:1).

**`editorial-grid-break` on three elements outside the content frame.** The
frame is 1344px wide, x=48 to x=1392, drawn with a 1px rule. Diagonal hatch
bands occupy x<48 and x>1392 for the full 4384px. Drafting registration
crosses sit on the frame line at the hero visual's corners, outside the
content column. And a ~190px "ProvenMetal" in the display serif sits behind
the footer at near-zero contrast (#181818 on #080808) over a tiled "M"
monogram field — larger than any live type on the page. The nav is a separate
full-bleed 1440px bordered cell above the frame, and behind the hero content a
1352x509 two-axis graph grid runs at
`linear-gradient(to right, rgba(255,255,255,0.035) 1px, rgba(0,0,0,0) 1px)`.
Grid behind the content, nav in its own cell outside it, decoration
permanently in the margin.

**`custom-type-pairing` is real, and the third face is one glyph.** Rhetorik
Serif Trial carries every display line: the 65.5px and 64px headlines, the
54.7/54.4/48px section heads, the 26.4px subheads and the 22.4px wordmark set
in two weights ("Proven" at 400, "Metal" at 500). DM Mono carries all prose
and every label: 16px body, 15.2px hero paragraph, 14px eyebrows at 1.4px
letter-spacing, 13px button labels at 1.82px. Serif display against monospace
body, two voices, and neither family appears at the other's sizes. The third
entry in `document.fonts`, "ProvenMetal Numerals", is not a third voice: its
`@font-face` carries `unicode-range: U+30` and the file is **764 bytes** (768
for the medium weight). It is a one-glyph webfont — the digit zero and nothing
else — loaded first in the body stack so every `0` on the page renders in a
bespoke figure while every other character falls through to DM Mono. A
single-codepoint overlay for a custom zero. Genuine craft, and correctly worth
nothing to the pairing count.

**Density varies by band.** The FAQ packs four questions and four answers into
640px (y1920-y2560, rows on a 124-167px pitch, divided by 1px rules). The
network band spends 530px (y1219-y1750) on one heading, one paragraph and a
line diagram. The closing CTA spends 395px on a heading, two buttons and a
10px disclosure. 10.37% of the first viewport reaches luminance 40.

**One hue, and the measurement is unusually clean.** Total page saturation is
5.3% of pixels; 5.28 of that 5.3 — 99.6% — falls in a single 30° hue bucket
(330-360°). The accent samples #F80828, hue ≈352°, at 5.1% coverage, carrying
the announcement bar, the primary CTA fill, the 01/02/03 process markers, the
01-04 FAQ markers and the active path in the routing diagram. The violet and
indigo buckets (240-300°) read 0.00%. The only other saturated mark anywhere
is the 16x16 Y Combinator square in the hero at 0.02% of pixels — a borrowed
third-party logo colour, not a second chrome accent. `railway-com` failed this
signal on two accents each carrying a system, violet for CTAs and green for
status, which is not what a 16px attribution mark does.

Now the near-misses.

**`three-card-row` absent, and the row is exactly the right shape.** y=895 is
three equal 432px siblings. The computed style on all three is empty: no
background fill, no border, no border-radius, no box-shadow. Across all eight
sibling rows detected (y105, 895, 1502, 1596, 2730, 3708, 3762) not one child
carries a fill, radius or shadow flag, and the only border flag on the page is
the nav's `border-b`. The 3-up is divided by 1px vertical rules under a 1px
horizontal rule, and its column markers are red 01/02/03 numerals where the
template puts a line icon. Zero cards on 4384px.

**`artifact-not-dashboard` absent — the closest call on the page.** Both
halves of the mutually-exclusive pair read absent, which is unusual: the page
never renders its application at all, so `real-product-screenshot` has nothing
to fire on either. Its two central visuals are an exploded isometric line
drawing of a populated PCB with dashed assembly leaders, and a routing graph
tracing ProvenMetal (Quote · DFM · route) → Fab 2 → a junction → Assembly 3 →
"Your boards / Courier tracking", with the unselected nodes dimmed and the
live path in red. That graph is the right shape for this signal and carries
none of its substance: every node is a placeholder — "Fab 2 / Fab 3 / Fab 4",
"Assembly 2 / Assembly 3 / Assembly 4", "Parts: Procure · kit · consign" — and
there is no price, no date, no supplier name, no part number and no layer
count anywhere in it. The corpus bar for this signal is real values the
product produced: capveon's named failure modes with measured deltas, decent's
escalation list with a refusal standing in it ("Flag / ERP customer credit
limit below contract value. Needs a person."), papaya's billion-scenario
figure. A schematic of the mechanism with anonymised nodes is not that. The
one place a populated artifact belongs, an actual quote with a price and a
confirmed date, sits behind the "Get Online Quote" CTA; the page asserts "1/2"
and "5x faster than the industry" instead of showing one.

**`generic-line-icon-set` absent at 7 SVGs page-wide**: a 16x16 monogram in
the nav, four 28x28 marks in the closing CTA band (y2770, y3058), and two
16-18px social marks in the footer (y4028, y4029). No icon sits above any
feature heading anywhere, and the Fab/Assembly chips in the routing diagram
carry schematic glyphs that differ from each other.

**`symmetric-everything` absent, but the last two sections do fall back to the
template.** "Ready to order your PCB?" at y2859 is `text-align: center`
(x=422, w=597) over two centered buttons over a centered disclosure, and
"America builds again." at y3181 is centered over a centered 1023x328 image.
Two of thirteen headings, both after the argument ends. Footer columns measure
384/240/240/288, unequal.

**`gradient-blob` absent on two gradients that are patterns, not washes**: a
1352x509 two-axis 1px graph grid at y105 and a 1440x395 1px radial dot matrix
at y2730, both with `rgba(255,255,255,0.035-0.1)` stops at 1px. No soft radial
field with no hard edge anywhere, and no `bg-gradient-*` or `from-*` utility in
the markup.

`gradient-fill-cta` absent at zero gradient-filled buttons; the primary CTA is
a flat #F80828 rectangle. `badge-pill-spam` absent at zero detected pills —
every button on the page is a square-cornered rectangle and no `rounded-*`
utility is applied anywhere in the markup. `glass-card-overuse` absent at
**one** computed `backdrop-filter` surface, the nav at `blur(12px)`, against
the 3+ threshold; the stylesheet ships `backdrop-blur` utility definitions 21
times, which is a stylesheet artifact rather than what the runtime shows.
`emoji-as-icon` absent at zero emoji in the DOM. `typewriter-headline` absent:
`setInterval` count 0 and hero text stable across the capture.
`testimonial-card-row` absent — there is no social-proof section at all, and
the only third-party reference on the page is the "BACKED BY Y COMBINATOR" line
in the hero. `hero-mockup-float` absent at zero transformed elements page-wide;
the hero drawing has no bezel, no shadow and no tilt, and is a line drawing
rather than a mockup. `stock-photo-generic` absent: the two images are a
commissioned exploded-PCB drawing and a halftone-dithered US flag, neither
photographic, and type never sits over either, so no scrim exists to bolt on.
`centered-hero-stack` absent — headline, paragraph and both buttons are all
`start`-aligned at x=72. `live-claim-control` absent at zero form controls in
the DOM; the central claim is halved lead time and the affordance that would
falsify it is the quote tool, which lives behind a CTA on another page. The
four FAQ items are expanded at rest, so they are not even a disclosure control.

**`generic-sans-default` absent, and the reason may indict the signal.** There
is no sans-serif on the page at all. `document.fonts` holds DM Mono, DM Mono
Fallback, ProvenMetal Numerals and Rhetorik Serif Trial, and the body stack is
`"ProvenMetal Numerals", "DM Mono", "DM Mono Fallback", ui-monospace, "SF
Mono", Menlo, monospace`. DM Mono is open-licence Google, and an all-mono body
is becoming this cohort's own default the way Inter was — but the signal names
the generic *sans* default, and a monospace carrying every paragraph at
15.2-16px is not that. Recorded as the tension rather than resolved by
stretching the signal.

**One fact with no vocabulary slot: the display family is a trial licence.**
It is literally named "Rhetorik Serif Trial" and the assets are served from
the production origin as `/fonts/RhetorikSerifTrial-Regular.woff2` (15,640
bytes) and `-Medium.woff2`, carrying every headline on the site. Each of those
`@font-face` rules also declares a second source,
`/fonts/RhetorikSerifTrial-Regular.otf` in `format("opentype")`, which returns
HTTP 404 — the desktop OTF is declared but not deployed. Harmless at runtime
because the woff2 resolves first, and a second licensing problem in intent,
since an .otf in a web `src` list is the raw desktop file. This is a fact about
the artifact rather than a craft or slop decision, and nothing in the
vocabulary holds it. `materials` would arguably take `trial-licence-font`, but
that is a vocabulary change and not this rating's to make.

**Verdict `exemplar` at net -6 (1 slop present, 7 craft present),** which sits
inside the exemplar band and outside `mixed`'s range entirely. The honest
reservation, which a second rater should weigh rather than inherit: the page
earns this with a notably small amount of page. 2,340 characters of innerText
across 4384px, no social proof, no product UI, and a routing diagram whose
nodes are placeholders. Some of its restraint is the restraint of having less
to show, which is a different achievement from showing a lot and showing it
well. A rater who weighted "how much is actually proven here" could argue
`mixed` on the absent populated artifact plus the gated closing CTA; the 26
signal values would not change under that argument, only the verdict.

**v4 change 3b surface re-pass**

Values decided before this prose: `real-product-surface: absent` (confirmed,
unchanged) and `shows-deliverable: absent` (confirmed, unchanged).

Capture, 2026-10-16: 7 tiles at 1440x900, `clamped: false`, `coverage: 1`,
`docH_before` 4384 = `docH_after` 4384, scroller `window`, stitched to one
1440x4384 strip that matches page height. The strip ends in the footer: the
contact block, the link columns and the near-black "ProvenMetal" wordmark over
the "M" monogram field at y4112. No `<video>`, `<iframe>` or `<canvas>` in the
DOM and no CSS `url()` backgrounds, so the stills miss nothing.

Every candidate product surface, top to bottom:
- y160, 558x399, raster (`/assets/v2/iso-board.png`, alt "Exploded isometric
  view of a PCB and its components"). A hairline isometric drawing of a
  generic populated board. It depicts the physical deliverable class, not any
  board ProvenMetal built, and it is the isometric illustration the definition
  fails.
- y725-1078, DOM: the "½" figure, "Your build schedule is confirmed in your
  quote." and the 01/02/03 "Quote & source" / "Route & build" / "Track &
  deliver" columns. Copy describing steps, no UI drawn.
- y1358, 1296x410, inline SVG with live `<text>`: the routing diagram, "Design
  files" → "ProvenMetal / Quote · DFM · route" → "Fab 1"-"Fab 4" → a junction
  fed by "Parts / Procure · kit · consign" → "Assembly 1"-"Assembly 4" → "Your
  boards / Courier tracking", with Fab 2 and Assembly 3 lit. This is a concept
  schematic of the routing mechanism, not a depiction of an interface.
- y3295, 1019x329, raster: halftone US flag. Decorative.

Faithfulness check against the real product. Every quote CTA points at
`central.provenmetal.com/order?step=upload`, which I loaded: a three-step
wizard ("1 Upload", "2 Build", "3 Finish"), "Upload your board files for a
quote", a dashed dropzone ("Drop your design files here"), a "Copy prompt"
button for agent ordering and a "This design is ITAR-controlled" checkbox, set
in Geist sans with rounded controls. Nothing on the homepage reproduces that
screen or its visual language: the routing SVG is DM Mono in square-cornered
chips and has no counterpart on the step that is reachable without uploading
files. I did not upload files to reach "Build", since that would create a quote
request, so whether a later step shows a fab/assembly route is unverified; the
anonymised "Fab 1"-"Fab 4" nodes make a faithful rebuild of it unlikely either
way.

**Q1, `real-product-surface`: absent.** The company has a real software surface
(the quote and order app at central.provenmetal.com), so this is a page fact
and not a hardware category fact. The homepage renders none of it: its two
central visuals are an isometric board drawing and a mechanism schematic, and
neither is a capture or a faithful rebuild of the app.

**Q2, `shows-deliverable`: absent.** The entry that could have embarrassed the
vendor: none exists in the scored content. The only artefact-shaped object is
the routing diagram, and its content is placeholder ("Fab 1"-"Fab 4",
"Assembly 1"-"Assembly 4"); dimmed unselected nodes are routing, not a decline,
and it carries no price, date, layer count or part. No quote, DFM report, BOM
or board photo appears. What I searched and rejected, all page copy rather than
product output: "½" (y725) and "5x faster than the industry." (y2482) are
vendor-aggregate figures that only flatter by being larger; "AOI, X-ray and
functional test are available by quote." (y2315) is a service-scope line in an
FAQ answer, not an artefact; "it never goes to AI review, overseas fabricators
or overseas parts sourcing" (y2606) is a limit sold as the ITAR
differentiator; "Automated DFM review uses heuristic-based harnesses built on
proprietary manufacturing and supply chain data." (y3038) is a compliance
footnote under the CTA, not a deliverable.

Drift from the earlier prose:
- The closing CTA band's buttons now read "LOGIN" and "GET A QUOTE"
  (`cta_location=bottom_cta`). "GET ONLINE QUOTE" and "ORDER WITH AI" now sit in
  the footer, so the gated-node list in the `scroll-reveal-blank` paragraph no
  longer names the current CTA labels. The CTA buttons still render as empty
  outlines in this capture's strip.
- `innerText` now reads 2,301 characters, against 2,340 recorded.
- The turn-times caption beside "½" now reads "THE LEAD TIME / Your build
  schedule is confirmed in your quote."; the glyph is a single "½" character
  in the DOM.
- The four FAQ items, recorded only as "01-04", are now "Who cares?", "What
  PCBs do you build?", "How much faster will ProvenMetal quote me?" and "Can
  you build ITAR-controlled designs?".
- The routing diagram reads "Fab 1"-"Fab 4" and "Assembly 1"-"Assembly 4"; the
  earlier quote listed only 2-4 of each.
- The earlier paragraph uses the retired names `artifact-not-dashboard` and
  `real-product-screenshot`; its reading (no app rendered anywhere) still
  holds under `real-product-surface`.

**Orchestrator note (superseded below: settled 2–1 for `mixed`): this verdict was contested.** The re-study
moved the verdict `exemplar` → `mixed` (net −6 → −3), and its own drift section
says **none of the changes comes from the redesign**. Every changed value is a
second rater disagreeing with the first on a signal with no stated procedure
(`single-optical-anchor`, `editorial-grid-break`), and net −3 sits where the
`mixed` and `exemplar` ranges overlap, so the number cannot decide it. The
re-study is merged because it is the whole-page, procedure-backed rating of the
live page, and the old one rated a page with different CTA labels and FAQ.
But two blind raters now split on this verdict, and that is exactly the
condition under which this corpus refuses to rest anything on a file. **A third
blind rating is recommended before provenmetal backs any rule.**

**Third blind rating, 2026-10-18: `mixed`, net −3. Verdict settled 2–1.** A
third rater, who opened neither this file nor either earlier draft, reached the
same verdict and net as the re-study above: 1 slop present, 4 craft present.
Its two contested calls, written so a fourth rater can re-run them:

- **`single-optical-anchor`: absent.** First viewport only (1440x900 at scroll
  0), measured by luminance ink: the sum over each mass's box of Y above the
  strip median background (Y = 0.2126R + 0.7152G + 0.0722B, background 10.0).
  A mass dominates at 2x or more of the next. H1 2382, second-section heading
  2238, hero illustration 1858, so the top mass is 1.06x and nothing
  dominates. By box area the hero box is 3.44x the H1; over the whole page the
  flag is 9.46x. Both of those readings give `present`.
- **`editorial-grid-break`: absent.** Only content placed outside the grid
  counts. Of 140 elements checked against the content column (x 72–1368), none
  with text or content media falls outside it. The hatched margins, 28
  registration crosses and corner ornaments are frame drawing, and drawing the
  grid is not breaking it.

Flipping both gives net −5, still inside the `mixed` range, so the verdict does
not depend on either call. What remains open is the vocabulary: both signals
still lack a stated scope and measure, and this page splits on that.
