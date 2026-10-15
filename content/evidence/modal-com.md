---
source: https://modal.com
kind: site
cohort: agent-tools
verdict: exemplar
studied: 2026-10-11
context: [hero, nav, features, cta, footer]
signals:
  gradient-blob: absent
  three-card-row: present
  glass-card-overuse: absent
  emoji-as-icon: absent
  generic-sans-default: absent
  symmetric-everything: absent
  badge-pill-spam: absent
  generic-line-icon-set: present
  testimonial-card-row: absent
  indigo-violet-accent: absent
  gradient-fill-cta: absent
  scroll-reveal-blank: absent
  typewriter-headline: absent
  stock-photo-generic: absent
  centered-hero-stack: present
  hero-mockup-float: absent
  asymmetric-split: present
  single-optical-anchor: present
  type-scale-high-contrast: absent
  editorial-grid-break: present
  custom-type-pairing: absent
  real-product-screenshot: present
  shows-deliverable: absent
  density-variation: present
  one-accent-discipline: present
  live-claim-control: absent
materials: [single-theme, webgl]
---
Captured at 1440x900; full page 10618px. The cleanest ornament sheet measured in
this cohort: zero gradients of any kind, zero faded text, one hue. It carries a
centered hero and a line-icon set and is still the exemplar here, which is
itself a useful data point about which signals carry weight.

**Zero gradients. Not few — zero.** No element over 500x250px on the page
declares a `gradient` of any kind: the large-element scan returns an empty list.
No button declares one. No text carries `background-clip: text`. For a 2026 AI
infrastructure homepage that is close to unheard of, and it is why the page needs
no defence of its background: there is nothing painted on it. The field samples
`#040804` at every one of fifty-six probe points away from content — a near-black
with a four-point green cast baked into the base colour itself rather than
applied as a wash. 75.3% of viewport pixels sit in one 16-step bucket around
(8,8,8).

**One hue, and the exceptions are data.** The only saturated chrome colour is
`rgb(127, 238, 100)` green: "production AI" in the headline, the section eyebrow
glyphs, the nav hover, the CLI word in mono. Seven other saturated colours exist
in the DOM and every one is information rather than brand — `rgb(203, 241, 193)`
and `rgb(251, 116, 85)` inside `<pre>` syntax highlighting, and amber / violet /
coral / teal exclusively on region labels across the world map (US Central, EU
North, Asia Pacific · Melbourne, Japan), which is a categorical scale encoding
geography. By the same exemption that keeps product-UI pills out of
`badge-pill-spam`, `one-accent-discipline` is present.

**The hero is the one centered thing on the page.** "The platform for production
AI" sets at 44px centered, weight 400 — not 600, not 700 — on a 16px centered
subhead, over two centered pills. Display-to-body is 2.75:1, the lowest measured
in this cohort, so `type-scale-high-contrast` is absent; the restraint is
deliberate and consistent, since section heads below run 37px and feature labels
14px. One of twenty-five headings on the page is centered. Everything after the
hero sets left at x=64 or x=231, including the closing CTA ("Ship your first app
in minutes", left at x=64, with `$30 / month free compute` under it at 12px
mono), so `symmetric-everything` is absent and the hero reads as a deliberate
exception rather than a default.

Behind it, a 1440x1080 WebGL canvas positioned at y=-90 renders an isometric cube
as a field of individual green dots, brightest at the centre, dissolving into
near-black at the edges. It bleeds above the viewport top and past both margins.
Because it never exceeds roughly 40% luminance — the whole page tops out at
`lumMax: 227`, nothing reaches white — the only high-luminance object in the
first viewport is the headline plus the 104x36 "Get started" pill.
`single-optical-anchor` present, by the same mechanism Linear uses: spend the
luminance budget once.

**Type is ABC Diatype at every size.** A licensed Dinamo grotesque sets the 44px
headline, the 16px body, the 14px labels and the nav; Fira Mono carries code and
figures. `generic-sans-default` absent. `custom-type-pairing` is absent rather
than present: a sans with mono confined to code blocks is one speaking voice, not
two in dialogue — contrast Railway, which puts a serif display against a sans
body in the same section.

**The repeating figure is a real asymmetric split.** Four consecutive sections
pin a ~440px text column at x=231 (16px heading, three-line body, a 2x2 grid of
small line-icon features, a "Learn more" pill) against a 646x499 panel at the
right. Unequal widths, same axis, four times. In the left gutter at x=64 a sticky
section index (Inference / Training / Sandboxes / Functions) tracks scroll with
the active item in green — an element living permanently in the margin outside
the content column, which with the full-bleed world map running under type that
belongs to the content column is why `editorial-grid-break` is present.

**Those right-hand panels are the thing to copy, and they are easy to misread.**
A naive full-page capture renders them empty: correct dimensions, a centred mono
caption, nothing between. They are not blank. Scrolled into view with a ten-second
dwell they paint animated diagrams on 644x498 canvases — an orbit of model-provider
marks around a `modal deploy` code chip; a TRAINER / INFERENCE / SANDBOXES
hexagon grid where red cells drain and green cells fill. Twelve further WebGL
contexts sit at 0x0 until mounted. The capture lies, not the page.

Critically, the claim never lives in the canvas. Each panel carries its assertion
as mono text in the DOM —
`Trainer, Inference, and Sandboxes exchange weights, requests, and rollout data.`
— so the canvas decorates a sentence that is already readable. This is why
`scroll-reveal-blank` is absent and the number is emphatic: excluding nav and
menu subtrees, **zero characters** of body prose render under 8% opacity at rest,
and with JavaScript disabled the page still yields 7882 of 7966 characters, 99%.
No other site in this cohort comes close.

**Product capture with its own numbers.** The enterprise row shows three dark
filled cards, each a genuine fragment of the Modal console: an Audit Logs table
with `sandbox.create` / `sandbox.terminate` / `image.push` rows timestamped
Sep 10, 13:54:32 and attributed to `modal-bot`, `deploy-bot`, `ci-runner`; a
Containers chart with Live and Total series; and a Live Usage panel reading
`Containers 108`, `GPU Utilization 94%`, `H100s — 74 GPUs`. `real-product-screenshot`
present, so `artifact-not-dashboard` is absent by construction.

**The dot-matrix world map.** At y≈5442 the continents are drawn as a field of
small distinct glyphs — circles, diamonds, squares, asterisks — at roughly 15%
luminance, with exactly one green marker labelled "US West". A full-bleed 1440px
illustration whose only chromatic element is a single point. It replaces the
"globally distributed" stock-globe without being a globe.

Where the template wins, and it is two signals:

**A 20px line-icon set above a four-up.** Globe over "Globally distributed
capacity", checkbox over "True, on-demand autoscaling", gear over "Any GPU, any
time", pulse over "Automated fleet health". One set, one stroke weight, one size,
each glyph restating its heading. The row is separated by 1px vertical hairlines
running only the content height — the Linear device — but the hairlines do not
rescue the icons. `generic-line-icon-set` present.

**Three equal cards with chrome.** The enterprise row above is three ~430px
panels with a dark fill, a hairline border and radius, at one rank, equal weight.
`three-card-row` present. Two other 3-ups on the page (the storage/scheduling row
at x=81/525/969, the news row in the light section) carry no card chrome, but one
genuine instance is one instance.

`gradient-fill-cta` absent — "Get started" is a flat light pill, "Contact us" a
flat dark one. `indigo-violet-accent` absent entirely; the only violet on the
page is a map region label and a blog tag. `glass-card-overuse` absent: four
`backdrop-filter` surfaces exist and they are the sticky nav plus three
sub-40px controls at `rgba(255,255,255,0.05)` over a flat near-black field, where
a blur has nothing to blur. `badge-pill-spam` absent — four rounded elements
above the fold and all four are buttons; the tinted category tags
("Customer Stories", "News") sit below 9000px. Zero emoji. Zero `setInterval`,
and hero text byte-identical across 4.5s, so `typewriter-headline` absent. Single
theme, dark-native: dark and light renders differ by 0.0% of sampled pixels.
