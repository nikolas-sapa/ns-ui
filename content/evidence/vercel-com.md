---
source: https://vercel.com
kind: site
cohort: agent-tools
context: [hero, nav, features, cta, footer]
verdict: exemplar
studied: 2026-10-10
materials: [dual-theme]
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
  asymmetric-split: present
  single-optical-anchor: present
  type-scale-high-contrast: present
  editorial-grid-break: present
  custom-type-pairing: unresolved
  real-product-screenshot: present
  shows-deliverable: absent
  density-variation: present
  one-accent-discipline: present
  live-claim-control: absent
---
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
