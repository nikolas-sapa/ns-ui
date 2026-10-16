---
source: https://provenmetal.com
kind: site
cohort: yc-current
verdict: exemplar
studied: 2026-10-14
context: [hero, nav, features, cta, footer]
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
  single-optical-anchor: present
  type-scale-high-contrast: present
  editorial-grid-break: present
  custom-type-pairing: present
  real-product-screenshot: absent
  shows-deliverable: absent
  density-variation: present
  one-accent-discipline: present
  live-claim-control: absent
materials: [single-theme, illustration]
---
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

