---
source: https://www.melty.gg
kind: site
cohort: yc-current
context: [hero, nav, features, cta, footer]
verdict: exemplar
studied: 2026-10-10
materials: [single-theme, video-hero]
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
  scroll-reveal-blank: unresolved
  typewriter-headline: absent
  stock-photo-generic: absent
  centered-hero-stack: absent
  hero-mockup-float: absent
  asymmetric-split: absent
  single-optical-anchor: present
  type-scale-high-contrast: present
  editorial-grid-break: absent
  custom-type-pairing: absent
  real-product-screenshot: present
  artifact-not-dashboard: absent
  density-variation: present
  one-accent-discipline: present
  live-claim-control: absent
---
Game mashups, YC F26. Consumer gaming, and the only site in this pass whose hero
is the product running rather than a picture of the product.

The opening viewport is a single rounded-corner video panel, nearly full width,
playing actual mashup footage: an Elden Ring environment, dust and a cathedral
facade, with a Minecraft HUD composited over it (heart row, hunger row, hotbar with
item counts 63 / 63 / 16) and a diamond sword in the lower right at Minecraft's own
block resolution. A small label top-left names the pairing with both games' store
icons ("Elden Craft"). The headline sits over the footage at the bottom left in two
lines: "Play game mashups" in white, then "In one click" reversed out of a blue
pill with a play triangle. Pause and mute controls sit in the panel's top right.

The headline is not centred and the video is not a floating mockup; it is the frame
the page is built around, and it is the only thing in the first screen.

live-claim-control is absent: the clip autoplays and loops on
its own, and the pause and mute affordances stop motion rather than let a visitor
test the claim the page is making. Across
two captures 3.5s apart the video is at different frames and the panel is otherwise
identical.

Below the hero: a one-line "Backed by Y Combinator" credit, then the pairing
mechanic shown literally as real Call of Duty and Super Mario cover art flanking a
"Download Melty · Free on Windows" button. Then a long blank band in the full-page
capture, so a mid-page section is scroll-triggered and did not fire; its signals are
not claimed here.

The FAQ is a two-column definition list, seven questions, left column the question
in two short lines, right column a direct answer: "What's a mashup? / A mod that
joins games into one. In SkyCraft, you play Skyrim as a Minecraft player." One of
them names the build path ("Copy Melty's instructions into Claude Code or Codex and
say what you want. Your agent builds it and publishes it.") and one answers the
actual objection ("Every upload is checked for dangerous files."). The close is
"Safe and free" with the same download button.

One accent, a single electric blue, on the nav Download chip, the "In one click"
pill and the download buttons. Nothing else on the page is chromatic; the colour
all comes from the game footage. Single theme, heavy condensed grotesk wordmark,
tight geometric sans for the headline.

**Scroll walker says no, and the first reading of it was wrong.** The band under the
hero does change between captures — Elden Ring and Hollow Knight cover art where the
static capture had Call of Duty and Super Mario — but that is the page rotating its
cover art per load, not a section mounting. A row-level diff of the two full captures
puts every changed row in the hero video panel plus two rows at y1220-1260 in that
cover-art strip. Across the roughly 4000px of black between it and the FAQ, not one
row differs. Mean ink per row goes 7.6% to 8.3%, and all of that 0.7 point is the
video sitting at a different frame.

So `scroll-reveal-blank` is `unresolved`, on the same standard applied to
`vercel-com`: the band is real and the page is clearly not rendering something, but
scrolling is the gate the signal names and a full-document walk does not open it.
`openhack` under the identical walk goes 6.0% to 27.8% mean ink, 4.6x — that is what
a confirmed gate looks like, and this is not it.
