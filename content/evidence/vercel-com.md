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
