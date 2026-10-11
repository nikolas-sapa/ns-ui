---
source: https://silicamachines.com/
kind: site
cohort: yc-current
context: [hero, features, footer]
verdict: exemplar
studied: 2026-10-10
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
  type-scale-high-contrast: present
  editorial-grid-break: present
  custom-type-pairing: absent
  real-product-screenshot: absent
  artifact-not-dashboard: present
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

`real-product-screenshot` moves to absent and `artifact-not-dashboard` to present.
There is no software UI anywhere on this page — the product appears as a line drawing,
as isometric renders of the arm doing each task, and as force-vs-time charts. The
chart is the deliverable, which is the example v3 cites for the signal.
