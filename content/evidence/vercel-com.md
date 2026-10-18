---
source: https://vercel.com
kind: site
cohort: agent-tools
verdict: mixed
studied: 2026-10-18
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
  scroll-reveal-blank: absent
  typewriter-headline: absent
  stock-photo-generic: absent
  centered-hero-stack: absent
  hero-mockup-float: absent
  asymmetric-split: present
  single-optical-anchor: present
  type-scale-high-contrast: present
  editorial-grid-break: absent
  custom-type-pairing: absent
  real-product-surface: absent
  shows-deliverable: absent
  density-variation: absent
  one-accent-discipline: present
  live-claim-control: absent
materials: [dual-theme, webgl, illustration]
---

Captured 2026-10-18 at 1440x900. The page grows during load (5333px at 15s, then
5332, 5486, 5694 and 5930 across a wheel pre-pass to the bottom, stable at 5930 for
three checks). `shoot-tiles.cjs` with `NS_LOAD_MS=15000` therefore walked a 5333px
page and reached only 5800 of the settled 5930. I re-walked with the settle walker
(`~/scratch/antislop/walkers/shoot-tiles-settle.cjs`, with progress logging added and
the logic unchanged): **9 tiles, `clamped: false`, coverage 1.0, walkHeight 5930 =
docH_after 5930**. `stitch.py` reports 5930px against a 5930px page, OK, in two strips
(4400 + 1530). The last strip ends in the footer: twelve link columns, the triangle
mark, `ALL SYSTEMS NORMAL.` and the theme switcher. Light theme, body
`rgb(250,250,250)`, body font 16px GeistSans.

**The fixed scene.** A `.homepage-scene-host` (`position: fixed`, 546x728 at x447 y49,
`pointer-events: none`, z 73) sits mid-viewport in all nine tiles. It is a black
shipping container lettered "Ship SF", hung from a crane hook whose cable runs up
through the sticky header to y0, with a `READ THE RECAP` pill under it. It is a live
WebGL2 render (`canvas[data-engine]`, `role=img`, `aria-label="Suspended Ship SF
frame"`; `getContext('webgl2')` returns its context; 837x1092 CSS, 1532x1998 backing).
A 2d poster raster is the fallback, fetched as
`ship26-container/theme/light-closed-desktop-webgl.webp` and `...-webgpu.webp`. It does
not scroll away. Its own copy reads "Press Escape to release the container and
continue browsing the page", and a visually hidden control reads "Release the
container and drop to the footer". The repeat across tiles is this fixed layer, not
duplicated content.

To read what it covers, I hid fixed elements larger than 300x250 in a separate settled
session and shot nine aux tiles (`s5work/vercel-com/auxstrip-*.png`, also 5930px).
Behind it in the walk are: the middle of "Build agents on infrastructure that thinks
like them", the Notion capture's left edge, the Zapier capture's hero copy, the
Mintlify capture's centre, the bento's middle seam, nearly all of the closing "Built
by you, or your agents", and the middle footer columns (Security, Tools, Explore,
Company). All of it is ordinary text and imagery in the DOM, and nothing it covers
changes a call.

**Page inventory, top to bottom (DOM y).** Sticky 64px header. Hero, 64-900: H1
"Agentic Infrastructure" (64px, x24, w356), `Deploy now` and `Talk to sales`, the
container, and a right column of three links, "Backends / Agents / Enterprise" (x1068,
each to its product page). A marquee logo strip (Meta, Blackbox.ai, DoorDash, OpenAI,
SpaceX, The Weather Company, Polymarket; `animation-name: marquee`). Three customer
showcases. Each has a 56px H2, a 921px-wide `webp` capture of the customer's own
product (Notion's AI chat at y1264, Zapier's marketing page at y2137, Mintlify's docs
at y3009, each in light and dark variants) and a 340px column with a one-sentence
claim and a four-item "Features" list. "Recently shipped" (y3678): a bento of one
685x580 card (Backends) beside two stacked 685x280 cards (Agents, Sandbox). Closing
band (y4672): a centred "Built by you, or your agents", `Deploy now` and `Onboard your
agent`. Footer, y5084-5930.

## Slop signals: none present

None of the sixteen fires. Here are the measurements behind the ones a reader would
check first.

- `gradient-blob` absent. There are nine `background-image` gradients over 4000px²,
  all neutral: three 160px `to top` fade masks over the captures, a 16%-white
  grid-line pattern, a -45deg white/`#ebebeb` page-curl, three 60%-white shimmer bars
  and one `to right` fade. The three `filter: blur(120px)` divs behind the captures
  are `rgb(23,23,23)` at `opacity: 0`.
- `glass-card-overuse` absent: **0** elements carry a `backdrop-filter`, the header
  included.
- `generic-sans-default` absent; see near-misses.
- `badge-pill-spam` absent. Above the fold there are two CTA pills and the `READ THE
  RECAP` link pill, and **0** decorative badges. The page's four "New" pills are in
  the footer (y5866+).
- `indigo-violet-accent` absent. I checked every element's background, border, text,
  SVG fill and stroke for RGB chroma over 40 and found **3** hits, all one blue
  (`rgb(0,112,243)` / `rgb(0,114,245)`, hue 212°). The one chromatic raster is the
  Backends page-curl, which samples `rgb(32,136,240)`, hue 210°.
- `gradient-fill-cta` absent: every CTA has `background-image: none` and a flat fill,
  `rgb(23,23,23)` or white.
- `scroll-reveal-blank` absent, re-measured; see near-misses.
- `typewriter-headline` absent. I sampled the hero text six times over 9s, and it was
  identical each time. I shot the bento four times over 10s, and the pixel diff's
  bounding box was x439-1001 every time: only the container scene moves, and no card
  text changes.
- `emoji-as-icon` absent: an emoji-range regex over `body.textContent` returns 0.
- `three-card-row`, `testimonial-card-row`, `generic-line-icon-set`,
  `stock-photo-generic`, `centered-hero-stack` and `hero-mockup-float` are absent.
  There is no row of equal cards (the bento is 685x580 plus 2 x 685x280), no quote
  section, no feature-icon set (the "Features" lists are bare text) and no photograph.
  The hero's headline and CTAs are start-aligned at x24, and the hero visual is an
  event render, not a UI.

## Craft signals present (4)

**`asymmetric-split`.** The hero has three unequal zones: a 356px text block at x24,
the 546px scene centred at x447, and a 340px link column at x1068. Each customer
showcase sets a 921px capture against a ~340px claim column, about 2.7:1, on
alternating sides: the Notion capture is on the left, the Zapier capture shifts to
x495 with its claim at x24, and the Mintlify capture is on the left again. Five of the
six display headings are start-aligned; only the closing H2 is centred.

**`single-optical-anchor`** (rule-ineligible; this is my call, recorded as
instructed). The anchor is the container. In the first viewport below the nav, pixels
darker than luminance 80 total 187,620. **90.9%** of them fall inside the container's
box, 4.2% are the 64px headline, 2.4% the CTAs and 2.1% the logo strip. So one mass
does dominate, largely because it is the only dark mass on a `#fafafa` field: the
headline is weight 400 and the CTAs are 40px tall. A second rater should weigh one
caveat. The anchor is a fixed overlay, so it is also the anchor of every other
viewport and sits over content in each. It is a takeover, not the composition of a
section.

**`type-scale-high-contrast`.** By `ladder.cjs`, the largest text node with a letter
is the H1 "Agentic Infrastructure": **64px over 16px body = 4.00:1**, above the 3.75
cut. The threshold is necessary, not sufficient. What makes me call it present beyond
the number is that the scale has two tiers with nothing between them. Display sits at
64 and 56px (six headings). The next size down is 24px (claims), then 22, 20, 18, 16
and 14. There is no 32-48px step, so the jump from 56 to 24 (2.33x) is the page's
structure. The "Ship SF" lettering in the render is larger still, but it is pixels in
a canvas, not a text node, so it does not count.

**`one-accent-discipline`.** There is one accent hue, used twice. The DOM chroma
census above finds three chromatic elements, all the status blue (the skip link at
opacity 0, the status dot, and "All systems normal."). The only chromatic raster is
the Backends page-curl at hue 210°. On the full page with the overlay hidden, pixels
with chroma over 60 make up **0.081%**. Everything else is `#171717`, `#4d4d4d`,
`#8f8f8f`, `#fafafa` or white, and the customer captures are greyscale UIs.

## Near-misses

- **`real-product-surface`, absent: the closest call on the page.** There is no Vercel
  UI anywhere: no dashboard, deploy log, build output, CLI transcript, domain screen
  or firewall screen. The three captures are genuine, but they show the customers'
  products (`notion-desktop-light.webp`, `zapier-desktop-light.webp`,
  `mintlify-desktop-light.webp`) as case studies. The case for present is that a
  hosted site is literally what Vercel serves. I don't accept it: the surface Vercel
  presents in use is the one it shows the developer, and a customer's page is the
  customer's surface, just as a logo wall is not the product. The bento visuals are
  invented or stylised. Agents is an `@data-agent` chat with no product chrome.
  Sandbox is a 2d canvas labelled "Sandbox compute illustration", about 60 blank
  window glyphs. Backends is empty at rest apart from a page-curl corner; its "Backend
  / Queue / Daemon" labels are white `lab(100 0 0)` on a near-white card, a hover
  state. `Deploy now` and the `Onboard your agent` copy button are doorways.
- **`shows-deliverable`, absent.** The procedure is to name the entry that could have
  embarrassed the vendor. None of the three candidates qualifies:
  (1) The showcase claims ("Notion powers millions of agent conversations daily",
  "Zapier serves over 100 million monthly website visits", "Mintlify powers
  documentation for over 20,000 companies") are customer-aggregate statistics that can
  only flatter by being larger. They are absent by the railway-com precedent.
  (2) The Agents demo's "North America dipped 4% in August." is a negative number, but
  it is the customer's sales data and the agent reporting it correctly. Nothing in it
  shows the product declining, failing or costing.
  (3) The footer's live `All systems normal.` could in principle read otherwise. At
  capture it shows the flattering value, it is 14px status chrome rather than an
  artefact, and under the railway ruling liveness earns nothing.
- **`scroll-reveal-blank`, absent, re-measured** with copies of `srb.cjs` and
  `dwell.cjs` that write to `s5work`, same parameters. In the walk, 71 eligible text
  elements are stamped at rest. **1 crosses** from under 0.08 to visible (18
  characters), 1 stays faded (the skip link) and 0 mount. The dwell control (same
  steps and wall clock, no scroll) gives **0 crossed, 0 mounted**. So one node is
  genuinely scroll-gated. It is the `Onboard your agent` label span (class
  `motion-safe:animat…`, opacity 0 at 8s, y4623), and it blanks nothing. Its button
  carries `aria-label="Onboard your agent"` at rest, and a `visibility: hidden` sizer
  span with the same text holds the box, so no-JS readers, agents and assistive tech
  all get the label. Every heading, claim and paragraph is visible at rest. One
  animated button label is not text gated behind scroll.
- **`generic-sans-default`, absent on both identity and optical system.** Geist is on
  the corpus's era-default list (Inter, Geist, system), but this is the page that
  ships it as its own house face: Vercel released it. The railway-com discriminator
  (does the page compensate with its own optical system?) also says absent. Tracking
  is authored per size at exact percentages: -6.00% at 64 and 56px, -5.00% and -4.00%
  at 24px, -2.00% at 16px/450, +1.82% at 11px, and `normal` at 14-22px. Every text node
  also carries `font-feature-settings: "calt" 0, "rlig", "ss11"`. This matches
  edotenv's absent on the same face.
- **`custom-type-pairing`, absent** on edotenv's precedent: GeistSans and Geist Mono
  are one family in two widths. Mono appears on 10 text nodes at 12-20px (`READ THE
  RECAP`, the status line and a few labels), a role distinction inside one voice.
- **`editorial-grid-break`, absent.** The page's own layout holds one grid on a 24px
  margin. The Zapier showcase's shift to x495 lands on a column line, and the bento
  sits inside the margins. The only thing that crosses sections, header included, is
  the crane cable and container, and they are fixed to the viewport rather than placed
  against the grid: a layer above the grid, not a break in it. A rater who counts the
  cable through the nav as a deliberate grid break would flip this.
- **`density-variation`, absent.** I measured ink coverage per band, with the overlay
  hidden: pixels deviating more than 30 from the `#fafafa` modal background, sampled
  at every second pixel. Hero 1.99%, logo strip 1.51%, Notion 3.19%, Zapier 3.54%,
  Mintlify 2.48%, Recently shipped 2.09%, closing band 1.80%, footer 2.24%. That is a
  2.03 percentage-point spread, all under 4% absolute. For comparison, edotenv is
  absent on a 0.80pp spread and railway-com is present on 17.9% to 68.7%. The three
  showcases repeat one template, and even the 70-link footer inks only 2.24%. The page
  has one texture, and it is sparse.
- **`live-claim-control`, absent.** The page's controls are CTAs to signup, sales and
  product pages, a copy-prompt button, the theme switcher, and the
  release-the-container toy. None lets the visitor test "Agentic Infrastructure" or
  the scale claims. The status line links out to the status page; it is not a control
  on the page's claim.
- **`three-card-row`, absent.** "Recently shipped" does hold three product cards, but
  in a 1 + 2 bento with unequal heights (580 vs 280), not a row.
- **`centered-hero-stack`, absent.** The takeover itself is a centred stack (the
  container, then the recap pill), but the hero's headline and CTAs are start-aligned
  at x24. This is the call most exposed to the redesign: without the left text column,
  this hero would read as centred.

## Verdict: mixed, net -4

Slop present 0, craft present 4: **net -4**. That falls inside both the mixed range
(-6..+3) and the exemplar range (-8..-2), so the number does not decide it. Two files
already sit at -4, aviern and github-2014, and both are mixed.

I am not rounding this up to exemplar, for three reasons a second rater can check:

1. **It is a thin page.** It is 5930px tall, and the main content is a hero, three
   repeats of one showcase template, a three-card bento and a two-button closing band.
   There is no pricing, testimonial, icon-feature, FAQ or stats section, so most slop
   signals have nowhere to fire. The zero slop count partly reflects how little there
   is to score.
2. **All four present craft signals are structural** (split, anchor, scale, accent).
   Every substantive craft signal is absent: `real-product-surface`,
   `shows-deliverable`, `live-claim-control` and `density-variation`. The page shows
   other companies' products and aggregate numbers. It never shows its own surface or
   an entry that could count against it.
3. **The anchor is a takeover that covers the page.** The fixed container sits over
   the middle 546px of every viewport and hides parts of headings and captures until
   the visitor finds Escape. The vocabulary has no signal for that, so it costs nothing
   in the net, and I am not reading the net as more than it is.

**Drift from the 2026-10-10 study**

I opened the existing file only after everything above was written. The old file
reads `exemplar` at net **-7** (0 slop, 7 craft, `custom-type-pairing` unresolved).
This draft reads `mixed` at net **-4**.

**One correction to the brief first: the bento changed too, not only the hero.** The
file's 2026-10-16 re-pass quotes "Recently shipped" as eve, Passport and Containers
cards, and the Containers card held a page-authored deploy log ("▲ vercel deploy /
Vercel CLI / ✓ Building image from Dockerfile.vercel / ✓ Stored image in your
project's registry / ✓ Deployed to Fluid compute / Production:
https://my-server.vercel.app"). On 2026-10-18 the same section holds Backends, Agents
and Sandbox cards. The rendered body text contains no "vercel deploy", "Passport" or
"Containers" outside the footer's link list. So "everything below the hero was on the
studied page" held on 10-16 and no longer holds. The hero, the logo strip, the three
customer showcases, the closing band and the footer still match the old file's
description.

Changed values:

- **verdict `exemplar` → `mixed`.** Three craft signals flipped, so net moved from -7
  to -4. That takes the page out of the exemplar-only zone (below -6) and into the
  overlap, where the thin-page argument in the verdict decides it. The cause is both:
  one flip is the page changing, two are the old rating.
- **`real-product-surface` `present` → `absent`. Page changed.** The old file credits
  the customer captures, but its own prose concedes "the product being sold is never
  pictured", which fails the current definition. That basis was wrong. The studied
  page did, though, carry a basis the 10-10 rater could not see, because that region
  had not rendered: the Containers deploy log, a faithful Vercel CLI transcript with
  the product's output. The doorway rule does not exclude that, because the product
  has answered. That log is gone from the live page, and nothing replaces it. The
  value is right for both pages, but for different reasons. On the live page, the
  page change is what settles it.
- **`editorial-grid-break` `present` → `absent`. Old rating wrong, contestable.** The
  structure it rested on is unchanged: the Zapier section's heading indents to x495
  and its proof sentence sits at x24. I read that as two sides of one grid, because
  x24 is the left content edge of every other section (H1 included), and x495 is a
  column line. That fails the corpus's operative test for this signal: an element
  outside the content column that displaces none of it. The old file reads it as
  "neither section establishes a grid the other obeys". A rater who weighs the
  alternation as the break would keep `present`.
- **`density-variation` `present` → `absent`. Old rating wrong.** The old file gives
  no measurement, and half the page was unrendered when it was set. The parts the old
  rater did see (hero, logo strip, Notion and Zapier showcases) measure 1.51-3.54% ink
  here, and that layout is unchanged. The bento redesign can't explain the difference,
  because the old rater never saw the bento.
- **`custom-type-pairing` `unresolved` → `absent`. The capture is complete now.** The
  old `unresolved` rested on GeistPixel cuts being self-hosted but never seen in the
  part of the page that rendered. Today the whole page renders, and every text node
  computes to GeistSans or Geist Mono. `document.fonts` reports only those two
  families as loaded, and no text node uses a GeistPixel face. The old value was an
  honest unresolved, not a wrong one. One limit: if the removed eve or Passport cards
  set type in GeistPixel, the studied page may have differed, and I can't check that
  now.
- **`materials` `[dual-theme]` → `[dual-theme, webgl, illustration]`. Page changed.**
  `webgl` is the Ship SF container, a WebGL2 canvas added with the 2026-10-13 hero.
  `illustration` is the new Sandbox card's 2d canvas ("Sandbox compute illustration"),
  plus the rendered container. Dual-theme still holds: footer theme switcher, light
  and dark variants of every customer capture.

Unchanged values whose basis moved:

- `single-optical-anchor` stays `present`, but the anchor is a different object: the
  centred triangle mark then, the Ship SF container now (90.9% of first-viewport dark
  pixels). Page changed, value the same.
- `one-accent-discipline` stays `present`. The old file found zero hue in the hero;
  the now-rendered footer adds one blue (`rgb(0,112,243)`) on the status line, and the
  new Backends card adds a hue-210° page-curl. Zero accents became one; the call
  holds either way.
- `type-scale-high-contrast` stays `present`: the old ~3.9:1 was cap-derived, today's
  measured 64/16 is 4.00:1.
- `scroll-reveal-blank` stays `absent`, and I re-measured it rather than copying it:
  walk 1 node / 18 characters ("Onboard your agent"), dwell 0, the same numbers the
  orchestrator recorded on 2026-10-16. I also named the mechanism: the label's button
  carries the same text as `aria-label` at rest.
- `shows-deliverable` stays `absent`. Its strongest 10-16 candidate, the all-green
  deploy log, is gone. Its replacement candidate, the Agents demo's "North America
  dipped 4%", is the customer's data, not the product failing.
- `centered-hero-stack` stays `absent` on the same structure (left text column,
  centred visual, right list). The centred object is now a takeover instead of a logo.

**Superseded study (2026-10-10, verdict `exemplar`).** Everything below describes the page as it was before the redesign that forced the re-study above, and is kept as the record of that page. Its signal values, which the front-matter no longer carries:

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
asymmetric-split: present
single-optical-anchor: present
type-scale-high-contrast: present
editorial-grid-break: present
custom-type-pairing: unresolved
real-product-surface: present
shows-deliverable: absent
density-variation: present
one-accent-discipline: present
live-claim-control: absent
```

Captured at 1440x900; full page 5333px, of which everything below roughly 3300px
failed to render under a 3.5s wait (lazy-mounted), so the footer and any closing
CTA are unjudged here.

The page carries zero hue. Background is `#fafafa` measured flat at (10,10),
(400,250), (720,620) and (1420,880). Type is near-black. The primary button fill
and the nav "Sign Up" fill are both black. There is no chromatic accent anywhere
in the rendered viewport, and the customer logos are all reduced to one ink. The
primary CTA is separated from the secondary not by color but by fill inversion:
"Deploy now" is a black pill with white text, "Talk to sales" is the same pill
geometry with a hairline border and near-black text, set immediately beside it.
That is `one-accent-discipline` pushed to its limit — the accent is a value, not a
color, so there is nothing to get wrong.

Worth measuring because it looks like a counterexample: there appears to be a soft
radial glow behind the triangle mark. It is not one. (720,200), inside the apparent
glow, reads `#fbfbfb` against the field's `#fafafa` — a single step out of 255. What
actually reads as a glow is a cast shadow under the triangle's lower edge plus that
1/255 halo. No `radial-gradient` paints the hero field.

Hero is three columns at unequal widths and none of them is a centered stack:
headline plus two buttons left from x=24 to x=372, the triangle mark centered on the
viewport axis at roughly 620-820, and a three-line descriptor list right at x=1060
("For coding agents / To ship apps and agents / Automated by agents") set at 16px on
32px leading. "Agentic / Infrastructure" measures roughly 62px cap-derived on 64px
leading, so line-height sits at about 1.0 and against the 16px descriptor list the
display-to-body ratio is near 3.9:1. The mark is the only thing on the page that is
centered, and it is centered on the page axis while the type deliberately is not —
so the composition has one axis of symmetry carrying the logo and nothing else.

The two feature sections are where the grid actually breaks. Section one sets its
heading at the left margin (x=24) with the proof sentence and feature list in the
right column. Section two inverts it: the heading "Ship apps that scale from zero to
millions instantly" is indented to roughly x=495 while its proof sentence ("Zapier
serves over 100 million monthly website visits on Vercel.") drops back out into the
left margin at x=24, under the heading's start. The text column and heading column
swap sides between consecutive sections, so neither section establishes a grid the
other obeys.

No cards in either section. The feature enumeration is a plain unstyled list of text
links (Durable Orchestration / Sandboxed Environments / AI Model Gateway / Fluid
Compute) under a 12px `Features` label — no icon, no border, no tile. The mechanism
that replaces the three-card row is third-party proof: each section's visual is a
real capture of a named customer's product. Section one shows an actual Notion AI
chat panel with its real control row; section two shows zapier.com rendered inside
real browser chrome, tab bar and address bar included. Both are flat, unrotated, and
show another company's interface rather than Vercel's own, which is an unusual choice
— the product being sold is never pictured.

`custom-type-pairing` is marked unresolved rather than absent: the page self-hosts
`Geist_Variable`, five `GeistPixel` display cuts (Circle, Grid, Line, Square,
Triangle) and one unnamed hashed face, so a pairing is clearly provisioned, but no
pixel-face type appears in the region that rendered. The theme question v1 left
unresolved is settled: a dark-scheme capture is a fully built second theme — the
field goes near-black, both hero buttons and the nav "Sign Up" pill invert together,
the seven customer logos re-ink to white and the triangle mark gains a rendered
halo. Recorded as `materials: dual-theme`.

**v3 re-pass, and a signal the scroll walker took back.** Everything below roughly
3300px of the 5333px capture is empty, which reads as `scroll-reveal-blank` and was
first recorded that way. A full-document scroll walk (1440x900, 600px steps with a
700ms settle at each, height re-measured per step) does not paint it. The document
grows from 5333px to 5930px under the walk, so something mounts, but across the
2630px below y=3300 not one sampled pixel differs from the `#fafafa` field — maximum
deviation zero. Scrolling is what the signal names as the gate, and scrolling does
not open it.

So the value is `unresolved`, not `present`. A dead region is established; a
scroll-triggered reveal as its cause is not, and hydration that never completes
headless, an observer wanting real user activation, and a bot gate all fit the same
evidence. `nxtcure-labs` and `openhack` under the identical walk paint their whole
page, which is what the present case looks like.

**v4 hole-7 deliverable re-pass**

Value: `absent`, confirmed (unchanged). No entry in any scored artefact could
have embarrassed the vendor.

Capture, 2026-10-16. The stock walker (`shoot-tiles.cjs`) reproduced the old
fault exactly: docH 5333 before, 5930 after, reached 5800px, and the stitcher
refused it with a MISMATCH. Re-shot with a settle variant
(`~/scratch/antislop/walkers/shoot-tiles-settle.cjs`: 15s initial wait, then a
wheel-driven pass to the bottom repeated until scrollHeight held for three
checks, then back to top). The pre-pass grew the page 5333 → 5332 → 5486 →
5694 → 5930 and settled there. Walk: 9 tiles, `clamped: false`, docH_before
5930, docH_after 5930 (no drift during the walk), reachedPx 5930, `coverage`
1.0. Stitched to 2 strips, 5930px against a 5930px page, OK. The last strip
ends in the footer: link columns, the triangle wordmark and the status line
at y=5856. The region below y≈3300 that earlier captures recorded as blank
paints fully in this walk (a capture fact only; no other signal touched).
A fixed WebGL overlay (`homepage-scene-host`, 546x728, "Press Escape to
release the container and continue browsing the page.") sits mid-viewport in
every tile, so occluded content was read from the DOM and from overlay-hidden
auxiliary shots in `~/scratch/antislop/s5-aux/vercel-com/`, and the three
customer captures were pulled at source resolution.

Candidates weighed, top to bottom:

- y=1264, inside a product capture: Notion's AI chat panel. "How can I help
  you today?" with three prompt suggestions and an empty "Ask, search, or
  make anything..." field. No output at all, and Notion's, not Vercel's.
- y=2137 (stats near y≈2490), inside a product capture: zapier.com in browser
  chrome, carrying "450K+ Agents built", "9,000+ App integrations with governed
  access", "3.39M+ MCP tool calls completed". Zapier's own odometers, each one
  able to flatter only by being larger.
- y=3009, inside a product capture: Mintlify's docs landing. Navigation and
  two quickstart cards, no output.
- Page canvas, proof lines beside each capture: "Notion powers millions of
  agent conversations daily on Vercel." (y=1380), "Zapier serves over 100
  million monthly website visits on Vercel." (y=2253), "Mintlify powers
  documentation for over 20,000 companies on Vercel." (y=3110). Vendor-aggregate
  adoption figures; absent by the odometer precedent.
- y=4171-4283, page-authored panel in the "Recently shipped" Containers card:
  the strongest candidate, because it is Vercel's own output on a job and it
  is readable. Verbatim: "▲ vercel deploy / Vercel CLI / ✓ Building image from
  Dockerfile.vercel / ✓ Stored image in your project's registry / ✓ Deployed to
  Fluid compute / Production: https://my-server.vercel.app". Static markup, no
  animation, no hidden rows. Every step is the passing one; no failed step,
  warning, retry, duration or cost appears. Same shape as browserbase-com's
  ledger with `Done` and no `Failed`: it fails on stance.
- y=3884-4216, page canvas: the Passport card's graphic, "VERCEL PASSPORT /
  PASAPORTE / PASSAPORTO / パスポート" and "Iss 2026". A decorative identity
  mark, not output. The eve card (y=4336) is a wordmark plus one line.
- y=5856, footer: "ALL SYSTEMS NORMAL." (`data-testid="footer/status/success"`,
  linking to vercel-status.com). It is live and could in principle read
  otherwise, but the content captured is the flattering state, and it reports
  platform uptime rather than the product's output on a job. Liveness is a
  property of the rendering, per the railway-com ruling. Not credited.

Also searched the whole rendered body text for failure vocabulary (✗, ✕,
"Failed", "Error", "Degraded", "Outage"): zero hits.

Verdict: the page shows Vercel's output exactly once, as a deploy log in which
every line succeeds. Nothing in any scored artefact narrows a claim or counts
against the vendor, so the signal stays absent.

Studied-page check: the hero has been redesigned since 2026-10-10. The Wayback
snapshot of 2026-10-10 00:03 UTC carries `showShip26Hero:false` and the
descriptor list "For coding agents / To ship apps and agents / Automated by
agents" described above; the live page runs a Ship SF takeover (the hanging
container scene with "Read the recap" in place of the triangle mark, and
"Backends / Agents / Enterprise" as the right-hand list, the old descriptor
still in the DOM at 0x0). Wayback's homepage HTML jumps from about 49KB to 84KB
on 2026-10-13. Everything below the hero is unchanged: the same snapshot
contains "Host platforms", the Mintlify proof, "Recently shipped", the eve,
Passport and Containers cards, "Built by you, or your agents", and the deploy
log verbatim, with the same three ✓ lines and no failure glyph. So every
candidate above was on the studied page, and the confirmed value stands for
it. The hero change is flagged for re-study; it does not bear on this signal.

**Orchestrator: `scroll-reveal-blank` unresolved → absent.** The `unresolved`
rested on 2630px below y≈3300 that never painted. Today's walker renders that
region fully, so it was a capture failure (the page grows 5333 → 5930px
during load). Measured with `srb.cjs`/`dwell.cjs`: a full scroll walk crosses
**1** text node from under 8% opacity to visible (18 characters, "Onboard
your agent"); the dwell control crosses 0. One label against 374,923 visible
characters is not content gated behind scroll. For scale, railway-com's
`present` rests on 38 nodes / 564 characters. These are the numbers, not a new
threshold; a second rater can re-run both probes.
