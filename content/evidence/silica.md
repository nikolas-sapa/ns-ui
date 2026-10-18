---
source: https://silicamachines.com/
kind: site
cohort: yc-current
context: [hero, features, footer]
verdict: exemplar
studied: 2026-10-10
materials: [single-theme, illustration, origin-authored]
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
  asymmetric-split: absent
  single-optical-anchor: present
  type-scale-high-contrast: present
  editorial-grid-break: present
  custom-type-pairing: absent
  real-product-surface: absent
  shows-deliverable: present
  density-variation: present
  one-accent-discipline: present
  live-claim-control: present
---
Force-sensing robot joints, YC F26. The one site in this pass that spends its
opening viewport on nothing at all.

The first 1440x900 contains a black field and a single white line drawing: a
jointed robot arm, drawn in uniform 1px stroke, with its gripper open and a small
bird perched on the palm. No headline, no nav, no CTA, no logo above the fold. The
arm's upper link runs off the left edge of the viewport, so the composition reads
as a crop of something larger. That is the entire first screen, and it is the
argument the page is making (a machine gentle enough to hold a bird) stated before
any words.

Scrolling, the black ends on a hard horizontal edge and the body is light grey.
Copy is left-aligned at a narrow measure against a very wide right margin:
"Today's robots are numb." then two short paragraphs. The claim section sets
"Today's" and "a tennis ball." in orange inside an otherwise black sentence, so the
accent marks the two load-bearing words rather than decorating a button.

The measurement block is the craft move. A legend gives three live values ("Applied
force 2.0 g / Silica, measured at the joint 1.5 g / Motor-current estimate 22 g")
above a force-at-the-gripper chart plotting twelve seconds of three series, with
the motor-current estimate visibly noisy around 50g while the joint measurement
holds near zero. A "Press and hold to apply load" control sits above the chart, so
the motion on this page is driven by the visitor's pointer rather than a timer.
That is the claim ("most robots estimate force from the current in their motors")
made falsifiable on the page itself.

Use cases are a horizontally scrolling carousel, not a three-up: Manufacturing line,
Lab automation, Training, with prev/next arrows and a fourth card already bleeding
past the right viewport edge. Each card pairs an isometric render of the arm doing
the actual task against its own joint-torque chart ("Insertion force N, from the
joint torques", "Elbow torque, Q-9 N-m, last 4.4 s"). The carousel and the chart
both break out of the narrow prose measure; the prose column never moves.

One grotesk throughout, one orange, one theme. The footer is a wordmark and two
links.
**v3 re-pass.** `live-claim-control` is present and this page is the reference case
for it: "Press and hold to apply load" sits above the force-at-the-gripper chart as a
labelled control, so the claim that motor-current estimates are noise and joint
measurement is not can be falsified by the visitor on the page.

`scroll-reveal-blank` moves to present. Walked at 1440x900 in 600px steps against a
same-run control, the band at y4800-5100 goes from 0.0% to 53.5% ink with sixteen
rows gained and none lost: the Q Series lineup renders as an empty grey field until
scrolled, then paints four labelled machine renders. Four more text nodes cross from
under 8% opacity to visible, "Pre-orders open. Production starts January 2027."
among them. A control dwelling the same ten steps without scrolling leaves the band
empty, so the gate is the scroll and not elapsed time; the joint-selector captions
mount under the dwell as well and are not counted.

`real-product-screenshot` moves to absent and `artifact-not-dashboard` to present.
There is no software UI anywhere on this page — the product appears as a line drawing,
as isometric renders of the arm doing each task, and as force-vs-time charts. The
chart is the deliverable, which is the example v3 cites for the signal.

**v4 change 3b surface re-pass**

Decided first: `real-product-surface: absent` (unchanged), `shows-deliverable: present`
(unchanged).

Capture: `shoot-tiles.cjs` walked the window scroller in 8 tiles, `clamped: false`,
`coverage: 1`, docH 5388 before and after, stitched to 2 strips (1440x4400 and 1440x988)
with stitched height equal to page height. The last strip ends on the footer (`silica`
wordmark, "X", "LinkedIn"; DOM `footer` at y5292-5388). Exact values were read from the
DOM with Playwright, not pixels; the chart's code was read from the served HTML.

Candidate product surfaces, all checked:
- Hero figure, y101-841: a CG humanoid with blue-ringed joints, played from
  `/img/h-reveal.mp4` into a canvas, with "Select any joint to see which Silica actuator
  it uses." Frames extracted with ffmpeg: a render of hardware (the shell fades to show
  the actuators). No software.
- Force-at-the-gripper scope, y2296-3067 (legend y2546, "Press and hold to apply load"
  y2586, `<canvas id="trace">` y2647-3067). Not a capture of anything. The inline script
  simulates all three series in the browser: applied force rests at 2 g, a random pulse of
  4-14 g or 40-130 g arrives every few seconds, and holding the control drives it to
  `210+10*Math.sin(...)` g; the Silica trace is applied force plus `gauss()*.8` (commented
  "Silica: torque measured at the output"); the motor-current trace is a lagged estimate
  plus a 32 g offset, a `tanh` lag term and a random walk (commented "motor current:
  friction offset, lag and noise"). The only network loads are the document, the Lato
  stylesheet and the hero video; no telemetry is fetched. It is drawn as an explainer
  chart, not as any tool's chrome.
- Use-case cards, y3247-4223: four CG scene videos (`u-line`, `u-lab`, `u-arm`,
  `u-biped`; frames extracted, all renders) with plots redrawn on canvas from envelopes
  embedded in the page's `UC` object ("Insertion force N, from the joint torques",
  "Contact force at the tube N, from the joint torques", "Elbow torque, Q-9 N·m, last
  4.4 s", "Left knee torque N·m, from the joint"). Page-authored, synced to the renders.
- Q Series band, y4403-5182: chrome CG renders of Q-01S, Q-3, Q-9, Q-13.
- /buy and /about: spec sheets and a pre-order form. The spec modal lists "Interface" as
  "RS-485 (Q-01S), flying lead (Q-01H)", and the page says "Specifications are design
  targets." and "Prototypes in customers' hands December 2026."

Looked for Silica's real tooling to check the chart against: the site, /buy, /about and a
web search turned up no SDK, telemetry UI, control app or test-rig screen. I could not
find what Silica's software surface looks like, and nothing suggests a public one exists
yet. That does not leave the chart unresolved, because its source settles the question
directly: it is a page-authored demonstration generated from `Math.random`, with no
product surface behind it.

Q1 verdict, `absent`, confirmed. Every surface on the page is either a CG render of the
hardware or a page-authored simulation of what the hardware would measure; none is a
capture or faithful rebuild of Silica software. For a pre-production joint maker whose
shipped interface is a serial bus, this is a category fact, not a deficiency.

The entry that could embarrass the vendor: the legend's own Silica reading disagrees with
the applied force, at y2546. The recorded pair "Applied force 2.0 g" / "Silica, measured
at the joint 1.5 g" still occurs (6 of 150 DOM samples at 200 ms), but it is one frame of
a live random trace, not a fixed value. Across 72 samples at the 2.0 g resting load the
Silica value read from "0.3 g" to "3.8 g", below 2.0 g in 36 and off by more than 1 g in
10; the strip's frozen legend reads "Applied force 2.0 g", "Silica, measured at the joint
0.4 g", "Motor-current estimate 21 g". The error is authored (Gaussian, sigma 0.8 g), and
it sits below a heading (y1646) that swaps to "Silica's actuators can feel things as
light as a paperclip." A paperclip weighs about 1 g (outside knowledge, not on the page),
so the vendor's own demo shows its joint misreading the lightest load by more than the
paperclip it claims to feel. While the control is held the Silica reading tracks within
about a gram ("Applied force 200.6 g" / "Silica, measured at the joint 201.1 g"), and the
motor-current estimate swings between "196 g" and "279 g".

Q2 verdict, `present`, confirmed. The artefact shows the product's output on a job (force
at a gripper), page-authored but readable, and its stance is not all-win: Silica's own
trace visibly errs at small loads in the same legend that carries the claim.

Drift from the earlier prose:
- The black field with the bird is now a fixed `#intro` overlay ("black, a robot hand
  reaches in, a bird lands, every line folds into the mark, the page fades in", per its CSS
  comment) that plays on a first visit and ends on any click, key, wheel, touch or scroll.
  The resting first viewport is a new hero: "Actuators for Physical AI" (y323-496), YC /
  Founders Inc. / UP.Partners logos, "Book a call" and "Buy", and the CG humanoid on the
  right. Nav ("Buy", "About") now sits above the fold.
- Legend values are live and random, not fixed. "Motor-current estimate 22 g" was one low
  sample; at rest the estimate read "21 g" to "67 g" (mean 34.2 g over 72 samples), so the
  trace sits around 30-40 g, not "around 50g".
- "Today's" and "a tennis ball." now swap to "Silica's" and "a paperclip." in the same
  heading, beside a line-drawn tennis ball.
- The carousel has a fourth card, "Toy biped" ("8 Q-01S joints, 0.48 kg. Gait found by
  policy search in MuJoCo."), and a "Swipe for more" row.
- There is no black-to-grey hard edge any more; the whole resting page is one light grey
  canvas. The footer is still the wordmark plus "X" and "LinkedIn".
