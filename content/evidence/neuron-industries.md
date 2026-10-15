---
source: https://neuronindustries.com
kind: site
cohort: yc-current
verdict: mixed
studied: 2026-10-14
context: [hero, nav, testimonials, features, pricing, cta, footer, team, faq]
signals:
  gradient-blob: absent
  three-card-row: absent
  glass-card-overuse: present
  emoji-as-icon: absent
  generic-sans-default: present
  symmetric-everything: absent
  badge-pill-spam: absent
  generic-line-icon-set: absent
  testimonial-card-row: absent
  indigo-violet-accent: absent
  gradient-fill-cta: absent
  scroll-reveal-blank: absent
  typewriter-headline: present
  stock-photo-generic: absent
  centered-hero-stack: absent
  hero-mockup-float: absent
  asymmetric-split: present
  single-optical-anchor: absent
  type-scale-high-contrast: absent
  editorial-grid-break: present
  custom-type-pairing: absent
  real-product-surface: present
  shows-deliverable: present
  density-variation: present
  one-accent-discipline: present
  live-claim-control: absent
materials: [single-theme, illustration, commissioned-photo]
---
Industrial controllers, YC Summer 2026. Captured at 1440x900 in 700px steps
with 900ms settle and animations disabled; document height 13947px; 20 tiles
stitched into 4 strips. The walk is complete — the last tile carries the
footer rule, `© 2026 NEURON INDUSTRIES` and `EL SEGUNDO, CA` — so the
truncation failure that cost `sentient-os` 16 tiles did not occur here. One
reading artifact to discount: the nav is fixed at 1440x65 with
`backdrop-filter: blur(16px)`, so it reprints in every tile and appears four
times down each strip. It is one nav.

The `px` block samples the viewport only (`page.screenshot()`, no
`fullPage`), so its figures describe the hero and not the page: 91.8% of
first-viewport pixels are rgb(8,8,8), 1.6% total saturation, luminance
4.5-255. Below y900 the page inverts to a near-white field, which the strips
show directly and which no instrument in the probe measured.

Three slop signals are present, and all three sit in the first viewport.

**`glass-card-overuse` — seven `backdrop-filter` surfaces, five above the
fold.** NAV.nav 1440x65 `blur(16px)` on rgba(5,7,12,0.72); ASIDE.spec-panel
400x176 `blur(8px)` radius 12px; SPAN.kicker 582x34 `blur(8px)` radius 8px;
H1 608x80 `blur(8px)` radius 14px; P.sub 591x80 `blur(8px)` radius 10px;
A.chip 204x31 `blur(6px)` radius 999px; SPAN.file 146x24 `blur(6px)` radius
999px at y1745. Threshold is 3+, so this fires at more than double. Worth
naming precisely what four of the seven are: the kicker, the H1, the subhead
and the chip are *text* elements each given a translucent rgba(5,7,12,0.35)
plate, a 1px border and a radius, because the type cannot hold against the
drawing behind it. They are glass plates functioning as a per-element scrim,
on top of a page-wide one — DIV.zoom-scrim, 1440x900 at y0, carrying
`linear-gradient(rgba(5,7,12,0.62) 0%, rgba(5,7,12,0.15) 30%, rgba(5,7,12,0.05) 55%, rgba(5,7,12,0.55) 100%)`.
Two scrims stacked to make a 60px headline legible.

**`generic-sans-default` — Inter carries display and body both.** Body
computes `Inter, ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto,
Helvetica, Arial, sans` at 16px, and Inter also sets the 60px H1 at weight
650 and `letter-spacing: -1.98px`. `faces` is empty: no `@font-face` rule is
readable anywhere on the page, so nothing is self-hosted and the first name
in the stack is all the evidence there is for which face rendered. Same
reading applied to railway and linear.

**`typewriter-headline` — the product panel cycles, the headline does not.**
This is the one signal the probe flagged and could not settle:
`heroTextStable` returned false with a `heroTextDelta` whose two samples were
truncated at identical length, so the change lay past the recorded prefix.
Measured directly — 12 samples at 1200ms, 14.4s total, zero scroll
displacement and zero pointer input — `.spec-panel` took four distinct text
states. The index advanced `02 / 11 AUTH CAMERA` to
`03 / 11 2× INDUSTRIAL ETHERNET`, and inside item 02 the status line ran
`SCANNING…` to `OPERATOR VERIFIED` to `EDITS UNLOCKED — LOCKDOWN MODE`. Over
the same window `h1` held one value (`Meet the Cortex AIC.`) and `.kicker`
held one (`WORLD'S FIRST INDUSTRIAL CONTROLLER BUILT FOR AI`). So the
headline is stable and the signal fires on its second clause: a product panel
cycling phrases on a timer, unprompted, through an 11-item hardware tour.

The two numbers in the recorded delta are not counters and the signal does
not rest on them. `127` and `66` are millimetre dimension figures on the
hero's isometric line drawing. Sampled over the same 14.4s they keep their
values and move their positions — 127 at (1059,208) to (999,193) to
(991,192), 66 at (1210,412) to (1196,365) — which is the `zoom-scrim`
element's name made literal: a slow scale on the drawing behind the glass,
dragging fixed callouts with it. A numeric counter would have changed value
and held position; this did the opposite.

Five craft signals are present.

**`asymmetric-split`.** The hero opposes a six-element text stack at x=46
(kicker 582px, H1 608px, sub 591px, availability line, two buttons, YC chip,
all `text-align: start`) against an 11-item feature rail whose numerals sit
at x=1221, with the wireframe drawing spanning roughly x=693-1386 between
them. The body grid starts at x=160, so the hero's type begins 114px left of
every section heading below it. The feature band repeats a different
asymmetry eight times: a 260px rail at x=160-420, a 789x350 screenshot at
x≈479-1268, and a 569px prose measure at x=489 — nothing balances the right
edge and no section centres anything. The census is 99 of 104 `h1-h4/p/li`
nodes at `text-align: start`; the five centred nodes are the closing CTA.

**`editorial-grid-break`.** A sticky section index lives in the left gutter
for the whole feature band, y2405 to y9370 — 6965px — reading
`CORTEX FEATURES · ALL IN ONE` over nine mono items (WORKSPACE, I/O CONFIG,
ROBOT STUDIO, VERSION CONTROL, UNIT TESTS, STATE MACHINES, HISTORY, DATA
STREAMING, HMI) and highlighting whichever section is in frame: strip1 shows
it stepping ROBOT STUDIO, VERSION CONTROL, UNIT TESTS, STATE MACHINES,
HISTORY as the walk descends. That band's own prose has vacated x=160 for
x=489 to make room for it. This is the value most exposed to a second rater
and the argument against is stated below.

**`real-product-screenshot`.** Nine panels of the Synapse IDE at 789x350,
every one dense and specific: `synapse / workspace · controller.py` with a
file tree, Python source and an assistant pane; `i/o config · 32 fieldbus
channels` as a channel table with per-row state; `robot studio` with a joint
table, a 3D arm trajectory and a timeline scrubber; `version control` as a
commit list with per-entry Restore buttons; `unit tests` with two waveform
charts and a pass/fail log reading `RESULT · PASS · 7 assertions`;
`state machines` as a node graph (IDLE / HOMING / RUNNING / PAUSED / FAULTED)
beside a live `RUNNING` log; `history · hippocampus` as channel time-series;
`data streaming · egress` as a CORTEX AIC to InfluxDB/MQTT diagram;
`hmi · p&id overlay`. Two of the nine are captioned by the page itself, in
11px mono: `ILLUSTRATION: ATTACH A SUPPORTED ARM AND ROBOT STUDIO APPEARS
AUTOMATICALLY` and `ILLUSTRATION: EACH BEHAVIOR BECOMES ONE ISOLATED, TIMED
TEST`. A page labelling which of its own product images are composed rather
than captured is not a thing this corpus has recorded before.

**`density-variation`.** The hero holds roughly 340 characters and one
drawing across 1440x900 at 91.8% rgb(8,8,8). The spec table at y10704 runs
20+ rows across three columns (`Max scan rate 1000 Hz / 4000 Hz`,
`P99.9 jitter 3 µs / 0.5 µs`, `CPU ARM A72 Quad + A53 Quad`, `NPU 6 TOPS`,
`Storage 32 GB · expandable to 1 TB / 64 GB · expandable to 1 TB`). Sixteen
distinct font sizes are in use, 9px to 60px.

**`one-accent-discipline`.** One hue. rgb(8,88,216) — hue 217°, blue, not
indigo — is 1.1% of first-viewport pixels, and of the 1.6% total saturation
1.56 falls in the 210-240° bucket with no other bucket above 0.03. That one
blue carries the nav CTA fill, the second clause of three display lines
(`from weeks to minutes`, `One box, one browser tab.`, `your process`), every
link, the Cortex column of the spec table, and the closing CTA. Two
exclusions, both on the corpus's existing reasoning: the orange Y in
`Backed by Y Combinator` is a third-party mark, and the green
`● LIVE CONTROLLER` chips are inside the product screenshots, the same
treatment railway's in-capture chart palette received.

Now the near-misses, in the order they were hard.

**`artifact-not-dashboard` is absent by the exclusion convention, and this is
the strongest case against that convention yet filed.** The page shows its UI
as screenshots nine times, so `real-product-screenshot` fires and this
cannot. But the page's best section is a deliverable, not a UI: a priced
two-up — Cortex Mini $2,950 against Cortex $6,450, `Coming Q1 2027` against
`Coming Q2 2027`, 1000 Hz against 4000 Hz, 3 µs against 0.5 µs P99.9 jitter,
`Soft real-time` against `Hard real-time`, `EtherCAT` against
`Integrated motion` — over a specification table carrying actual refusals:
`Certifications UL + CE (planned)`, `Motion EtherCAT only` on the cheaper
unit, and `Specifications reflect current production targets and are subject
to change`. The vocabulary's own example for this signal is "a priced
comparison with real refusals". That is on the page, at y9802-11400, and the
file must score it absent. Values not flipped, per the convention; recorded
so the count can be revisited.

**`single-optical-anchor` absent — four masses, not one.** The first viewport
distributes the text stack (x=46-654), the wireframe (x≈693-1386), the
numbered feature rail (x=1221) and the 400x176 spec panel (y682) without any
one subordinating the rest. The 60px white H1 and the large light drawing are
opposed across the diagonal, which is what makes `asymmetric-split` present
and is the opposite of a single anchor. The corpus standard that settled it
is the existing "absent on three competing masses in the first viewport".

**`type-scale-high-contrast` absent on the ratio, measured twice.** 60px H1
against the 18.4px subhead directly beneath it is 3.26:1; against 16px body
it is 3.75:1. The corpus has called this band conventional three times —
openhack at 3.5:1 ("a conventional ratio rather than a deliberate jump"),
railway at 3.4:1, clerk-com at 3.1:1 against an 18px subhead — and present
once above it, anthropic-com at 3.8:1. 3.75 sits under that line, and the
page's larger sizes do not rescue it the way browserbase's 6.5:1 range did:
the biggest type anywhere is the 60px hero, with section heads at 57.6px and
feature heads at 35.2px.

**`custom-type-pairing` absent, and the node counts are the argument both
ways.** Two families are in use: Inter on 246 text nodes spanning 11.68-60px,
and monospace on 412 nodes spanning 9-22px. By node count the mono is the
dominant face on the page — it carries the nav, every eyebrow, every spec
label, the hero panel and all SVG diagram annotation, which for an
industrial-controls company is a defensible editorial decision and reads as
one. What settles it absent is which mono: the computed stack is
`ui-monospace, Menlo, monospace`, the CSS generic keyword, so the page did not
choose a mono face, it chose whatever mono the visitor's OS supplies.
Combined with display and body sharing one family at 60px and 16px, and with
`faces` empty, no typeface is specified anywhere on this page. Scoring a
craft signal for pairing two defaults while `generic-sans-default` fires on
one of them would be incoherent. Railway's precedent does not reach: its
present rested on IBM Plex Serif carrying display against Inter body, two
named faces in two roles, and the ruling there was explicitly that free
licensing does not disqualify a *decision*. There is no second decision here.

**`scroll-reveal-blank` absent, and the measurement is unusually clean.**
`innerText` is 18179 characters before the walk and 18178 after — one
character of change across 13947px of scrolling. No dwell control is needed
because nothing mounted for a control to attribute. Text under 8% opacity
falls 340 to 12 characters, and the 328 are identifiable: `Peripheral
expansion`, `Wi-Fi (optional)`, `Internal wireless connectivity`,
`8× ARM cores`, `High-performance SoC` are the unselected rows of the hero's
11-item spec selector, which the panel swaps on the timer measured above. The
gate is that timer, not intersection.

**`emoji-as-icon` absent on font family, as at railway.** Seven U+2713. All
seven are inside SVG `<text>` nodes at 11-12px in
`ui-monospace, Menlo, monospace`, colour rgb(11,18,32), reading
`✓ latch holds` (y6159), `✓ 1 · Prompt`,
`✓ 2 · Components located, HMI drawn`,
`✓ 3 · Live I/O pinned · operator mode` (y9174-9199). Mono checklist lines
inside illustrated panels, not icons.

**`three-card-row` absent on chrome, not on count.** The stat triplet at
y1408 is three `DIV.stat` at widths 165/173/223 — unequal — each computing
`background-color: rgba(0,0,0,0)`, `border-width: 0px`, `border-radius: 0px`,
`box-shadow: none`. The footer 3-up at y13639 (435/311/311) is nav columns.
The only carded row on the page is two cards wide (`FBR|FBR`, 549/549) and
holds founder bios.

**`badge-pill-spam` absent at one decorative pill.** Four pills above the
fold, three of which are controls: the nav `Apply for a pilot` 203x33 at y16,
`Pre-order · $50 deposit` 233x41 at y731, `For investors` 137x41 at y731. The
one decorative badge is `Backed by Y Combinator`, 204x31 at y797.

**`generic-line-icon-set` absent at eight SVGs on a 13947px page.** Sizes
60x60 at y743, 14x14 at y745, 15x15 at y2261/2280/12267/12279, 14x14 at
y13475, 15x15 at y13814 — all `fill`, none stroke, and none in a feature
grid. No 3-up or 4-up on the page carries a glyph above a heading; the
feature lists bullet with a mono `+` character.

**`gradient-blob` absent at two gradients, neither a blob.** The page carries
exactly two `background-image` gradients: the 1440x900 four-stop vertical
scrim already quoted, and a 256x400 tile at y1750 running
`radial-gradient(90% 90% at 50% 0%, rgba(10,95,208,0.07) 0%, rgba(0,0,0,0) 65%)`
over a -45° hatch. The radial is 7% alpha inside a `+ Your machine here`
placeholder — a texture at tile scale, not a field. No soft wash anywhere
near blob size. `gradient-fill-cta` absent on the same scan: `btnGrad` is
empty and the primary button is a flat blue fill. `indigo-violet-accent`
absent at hue 217°.

**`symmetric-everything` absent despite three symmetric sub-sections.** The
product two-up (531/531), the founder two-up (549/549) and the 2x2 FAQ are
each internally symmetric, but 99 of 104 text nodes are left-aligned, the
hero puts type at x=46 and x=1221 with nothing on a shared centre axis, and
the proof section runs an unequal three-up (408px photo / 311px text / 256px
placeholder tile). The page is not composed symmetrically; three of its
blocks happen to hold two equal things.

**`centered-hero-stack` absent, with the centred stack displaced to the
bottom.** The hero H1 computes `text-align: start` at x=46. The page's one
centred composition is the closing CTA — `See Cortex on your process.`
centred over a centred three-line subhead over two centred buttons — which is
the reverse of railway, where the hero was the centred stack and the closing
CTA repeated it.

**`hero-mockup-float` absent at zero transforms.** `transformed` is empty: no
element on the page carries a CSS transform. The hero's product
representation is an inline wireframe with dimension leaders, no bezel, no
tilt and no shadow, and the first product screenshot is at y2655, 1755px
below the fold.

**`stock-photo-generic` absent — three photographs, none generic.** The hero
is a line drawing, so the scrim stack discussed under `glass-card-overuse` is
protecting type against an illustration rather than against a bought
photograph. The page's only editorial photograph is `cs-cw-cabinet.jpg`,
408x587 at y1729: a real electrical cabinet, visibly old, captioned
`CASE STUDY · #01 / CUREWOOD · ENGINEERED WOOD / A 1991 Siemens S5, replaced
in one 8-hour cutover` with `189 hardwired I/O points` and
`300 / 300 passes in simulation`. The other two are 168x168 founder
portraits.

**`testimonial-card-row` absent at zero quote cards.** The social-proof
section is a single case study with a photograph and a named customer, and
the only carded row on the page holds two founder bios. There is no quote
anywhere on the page, so the honest value is absent rather than unresolved.

**`live-claim-control` absent, and it is the gap worth naming.** The central
claim is that you describe machine behaviour in plain English and get
deterministic real-time Python. Nothing on the page lets a visitor test that.
The 11 hero buttons are a hardware tour that swaps a 400x176 description
panel; the `+ Your machine here` tile is a lead form (`Tell us about your
machine and what you want to automate. Apply for a pilot`); every IDE panel
is a static JPG. A page that ships an in-browser IDE as its product, and
serves it from the controller, shows nine pictures of it.

**Verdict: `mixed` at net -2, three slop against five craft.** That net ties
the corpus's weakest exemplar, dropbox-2014, and the exemplar case here is
real: eleven of the sixteen slop signals are absent on structure rather than
on the section being missing, and the content is not generatable — two SKU
prices, two ship quarters, a 20-row spec table with planned certifications
and a subject-to-change disclaimer, a named customer with a 1991 Siemens S5
and a cutover duration, founder bios naming Freeform, Apple's Vision Pro
System EE team, Amazon and Tesla Fremont.

Two things hold it at `mixed`. First, the whole typographic axis is absent —
`custom-type-pairing`, `type-scale-high-contrast` and `single-optical-anchor`
all fail, which is three of the ten craft signals failing on one faculty, and
the page specifies no typeface at all. dropbox-2014 reached the same net with
its composition carrying it; this page is carried by its facts and its form
is conventional underneath them. Second, the figure repeats without
variation: eight consecutive feature sections run the identical armature —
sticky mono rail, 789x350 screenshot, mono eyebrow, 35.2px heading, prose,
two `+` bullets — and the hero is glass-plates-over-a-zooming-background with
an auto-advancing panel, which is the current template rather than a
decision.

For a second rater, the two values that move the verdict: flipping
`editorial-grid-break` to absent (if the 260px sticky rail reads as the left
column of a two-column layout rather than an element in the margin) takes the
net to -1 and confirms `mixed`; flipping `single-optical-anchor` to present
(if the wireframe is read as subordinating the hero's other three masses)
takes it to -3 and makes `exemplar` arguable. Both are judgments on the same
first viewport and both are stated above with their coordinates.

**v4 change 3 re-score — `shows-deliverable` absent → present.** Re-rated from
a fresh walk (20 tiles, `clamped: false`, `coverage: 1.0`) by a rater given the
page and the new independent-axis rule, not this file's prose.

The priced two-up under "Two configurations." (h2 y≈9860) is the vocabulary's
first worked example — "a priced comparison with real refusals" — verbatim, and
in no app chrome at all, so the exclusivity was the only thing suppressing it.
Cortex Mini $2,950 against Cortex $6,450 (y≈10398, each annotated `ONE-TIME ·
SOFTWARE INCLUDED · ZERO RUNTIME LICENSES`), 1000 vs 4000 Hz max scan, 10 vs
2.5 µs max jitter, 3 vs 0.5 µs P99.9, `Soft real-time` against `Hard
real-time`.

The refusals are what separate it from a spec sheet, and they cost the vendor
something: `Motion: EtherCAT only` on the cheap unit (spec table, y≈11171);
`Certifications: UL + CE (planned)` on **both** columns, flagship included,
with the row kept rather than omitted (y≈11390); `Soft real-time` naming the
weaker class in plain words; CPU/GPU/NPU identical across both columns
(`ARM A72 Quad + A53 Quad`, `Mali-G52 MC3`, `6 TOPS`) with `Data protocols` and
`Database support` merged, so the table declines to manufacture
differentiation where none exists; and `Specifications reflect current
production targets and are subject to change` plus `Launch windows are
estimates` at the point of sale, for a product that ships Q1-Q2 2027.

Two corrections to the ranges above: the block runs to the disclaimer at
y≈11610, not y11400 — the `COMPUTE` sub-band at y≈11418-11573 is inside it.
And the two-up's own Motion row reads plain `EtherCAT` (y≈10350); the "only"
that makes it a refusal is in the spec table row.

A second candidate was found and **discounted**: the unit-tests panel
(y≈5822-6213) is the vocabulary's *third* worked example, a force/temp-vs-time
curve with an `80.0 °C threshold` line and a timestamped assertion log
(`t+2.412 s TT_201 crosses 80.0 °C ↑`, `RESULT · PASS  3 assertions · 512
cycles simulated`). The page captions it itself at y≈6232, 11px mono:
`ILLUSTRATION: EACH BEHAVIOR BECOMES ONE ISOLATED, TIMED TEST`. Self-disclosed
as composed, so it is an honest drawing of a result rather than a measured one,
and the score does not rest on it.

`real-product-screenshot` stays `present`, confirmed directly: nine 789x350
panels with full app chrome — traffic-light dots, a `synapse · i/o config · 32
fieldbus channels` title bar, a `● LIVE CONTROLLER` chip, a nine-tab strip, and
`IDLE  Outputs held safe · machine cannot move`. Both axes fire, which is now
expressible.
