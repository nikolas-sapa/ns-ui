---
source: https://railway.com
kind: site
cohort: agent-tools
verdict: mixed
studied: 2026-10-11
context: [hero, nav, features, testimonials, cta, footer]
signals:
  gradient-blob: present
  three-card-row: absent
  glass-card-overuse: absent
  emoji-as-icon: absent
  generic-sans-default: present
  symmetric-everything: absent
  badge-pill-spam: absent
  generic-line-icon-set: present
  testimonial-card-row: present
  indigo-violet-accent: present
  gradient-fill-cta: present
  scroll-reveal-blank: present
  typewriter-headline: absent
  stock-photo-generic: absent
  centered-hero-stack: present
  hero-mockup-float: absent
  asymmetric-split: present
  single-optical-anchor: present
  type-scale-high-contrast: absent
  editorial-grid-break: present
  custom-type-pairing: present
  real-product-screenshot: present
  shows-deliverable: absent
  density-variation: present
  one-accent-discipline: absent
  live-claim-control: absent
materials: [single-theme, illustration]
---
Captured at 1440x900; full page 12212px. The most template-shaped page in this
cohort and simultaneously the one carrying the strongest single piece of
invention. Both halves are worth recording.

**The hero is the textbook centered stack.** "Ship software peacefully" sets at
54px centered (x=422, w=588 in a 1440 frame), on a 20px centered subhead, over two
centered buttons. The field behind it is `bg-train-dusk.webp`, a 1400x1700 painted
night sky with clouds and stars, mirrored by `matrix(-1, 0, 0, 1, 0, 0)` and
carrying a `linear-gradient(rgba(0,0,0,0.3), rgba(0,0,0,0.05))` scrim. It is an
illustration commissioned around the brand's one metaphor, not stock, so
`stock-photo-generic` is absent — but the structure underneath is the same
structure a generator emits.

Then the closing CTA repeats it exactly, and adds the two signals the hero
avoided. "A better future is / now boarding" sets centered over a centered
subhead over a single centered pill, inside a ~690x560 soft radial wash running
magenta through amber on near-black with no hard edge anywhere — a gradient blob,
diegetically justified as light through a carriage window and still a gradient
blob. The pill itself measures
`radial-gradient(73.46% 138.39% at 50.21% 0%, rgb(170, 10, 170) 50%, rgb(109, 29, 189) 75.47%, rgb(56, 29, 189) 100%)`:
magenta to violet to indigo, on the page's primary conversion button.
`gradient-fill-cta` and `indigo-violet-accent` both fire here, on the same
149x56px element.

**What it does instead, and this is the thing to copy: a vertical rail in the
gutter.** A 1px line runs the full 12212px at x≈170, outside the x=259 content
column, with a small illustrated train carriage travelling down it and node
markers at each section boundary. The content column never touches it. It is a
progress indicator, a section index and the brand metaphor in one element that
occupies no layout space, and it is why `editorial-grid-break` is present: an
element that lives permanently in the margin.

**The split-flap board.** At y≈9674, "218.7M+ deploys per month (and counting)"
sits over a mechanical departure board — a grid of character cells spelling
USERS / SERVICES / DEPLOYMENTS / REQUESTS / LOGS against live right-aligned
figures (4,646,624 / 15,847,488 / 218,783,620 / 322,345,212,748 /
1,063,463,634,989). A railway station board showing platform telemetry. One
device doing the metaphor, the proof and the scale claim at once. It is not
scored under `artifact-not-dashboard` because that signal is mutually exclusive
with `real-product-screenshot`, which the page satisfies four times over; but it
is the closest thing in this cohort to showing a deliverable rather than a UI,
and the vocabulary currently has no slot for it.

**Type is three families and the pairing is real.** IBM Plex Serif carries every
display line (54px hero, 40px social proof, 36px section heads at x=259), Inter
carries body at 16-20px, JetBrains Mono carries build logs and the footer status
line. A serif display against a sans body is two voices in dialogue, visible in
one section, which is what `custom-type-pairing` names — and it holds even though
all three faces are open-licence. The licence is free; the decision to set a
developer-tool headline in a serif is not.

`generic-sans-default` is present on the same reading applied to Linear: the body
face is Inter. Unlike Linear there is no per-size tracking table compensating for
it; the 16px body runs at `letter-spacing: normal`.

Display-to-body is 54/20 = 2.7:1 against the hero subhead, 3.4:1 against 16px
body. Below every site in this cohort except Modal, so
`type-scale-high-contrast` is absent.

**The repeating section figure is a stack, not a split, and that is still
asymmetric.** Each of five body sections pins a 544px heading block at x=259 and
leaves roughly 600px of the frame empty to its right, then runs a full-width
product capture beneath it. Nothing balances the heading, and nothing is
centered: 3 of 8 headings on the page are centered and all three are the hero or
social proof. So the page is asymmetric by vacancy rather than by opposing mass.

**Product capture is unusually honest and completely unfloated.** Four full-width
captures of the actual application: the Architecture canvas with a real service
graph (frontend / Backend (Server) / Backend (Worker) / [CRON] Batch upload
building / a redis+postgres group with volume mounts), a Build Logs panel with
timestamped `[vite] ✓ built` lines, and an Observability dashboard with six real
charts (CPU Usage, Memory Usage, Frontend hit/error, Disk Usage, 5XX Errors,
Network Egress) carrying plausible ten-day traces. The hero panel measures
`box-shadow: none`, `transform: none`, `border-radius: 0px`, 1400px wide, cropped
by the viewport's bottom edge: `hero-mockup-float` absent, with no bezel, tilt or
shadow anywhere on the page.

The eight check characters a naive emoji scan finds are U+2713 inside those
JetBrains Mono log lines (`mise node@25.2.1 ✓ installed`, `06:46:32 [vite] ✓ built`).
They are captured terminal output, not icons, so `emoji-as-icon` is absent — a
case where the raw count lies and the font family settles it.

Where the template wins:

**One line-icon set, five times.** A 20px uniform-stroke glyph sits above every
feature item in every 3-up and 4-up — eye, sparkle, cursor-sparkle, shield, pulse.
Each restates the heading directly beneath it ("See your infrastructure" over an
eye; "Automated fleet health" over a pulse line). One set, one weight, one size,
no information. `generic-line-icon-set` present.

**Three equal quote cards.** The social-proof block opens with three ~355px
bordered, rounded cards — Kartik Aggarwal (Tech Lead at Bilt), Daniel Lobaton
(CTO at G2X), Daniel Moretti (Co-Founder & CTO at Mappa) — each a quote above a
40px avatar, name and role. Heights equalised, widths equal. A horizontally
bleeding tweet marquee follows below, which is the better device, but it does not
replace the triplet, it follows it. `testimonial-card-row` present.

The feature 3-ups are *not* cards and the measurement says so plainly: three
316px columns with `background-color: rgba(0, 0, 0, 0)`, `border-width: 0px`,
`border-radius: 0px`, `box-shadow: none`. `three-card-row` absent.

`one-accent-discipline` is absent on two chrome accents, not one: violet carries
the CTAs, the Share avatar and the active tab underline; green carries the
section eyebrow chips ("Build and deploy", "Evolve and collaborate"), the deploy
status ticks and the footer's `All systems operational`. The six-series chart
palette inside the Observability capture is data colour and is not counted
against it.

`scroll-reveal-blank` is present, which reverses the earlier absent. That reading
rested on a static capture and on counting only prose at rest: excluding nav and
menu subtrees just 61 characters render under 8% opacity in the first viewport.
Walked at 1440x900 in 600px steps, 38 text nodes carrying 564 characters cross
from under 8% opacity to visible, and the band at y5500-6300 gains 41 rows while
losing none, going from 17.9% to 68.7% ink across 820px. A control dwelling the
same 22 steps without scrolling crosses zero text nodes and reproduces the static
capture, so the gate is the scroll rather than elapsed time — which also correctly
discounts this page's animated deploy feed, whose text mounts under the dwell too.
Worth recording
separately because the vocabulary does not name it: with JavaScript disabled the
page yields 7293 characters against 15497 with it, so 53% of the text exists only
under JS. That is a different defect from a scroll reveal and the build cannot
currently distinguish them.

`glass-card-overuse` absent at zero `backdrop-filter` surfaces on the entire page.
`badge-pill-spam` absent at zero rounded badges above the fold. Single theme,
dark-native: a `prefers-color-scheme: dark` render differs from light by 0.0% of
sampled pixels.
