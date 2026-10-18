---
source: https://anthropic.com
kind: site
cohort: agent-tools
context: [hero, nav, features, footer]
verdict: exemplar
studied: 2026-10-10
materials: [single-theme]
signals:
  gradient-blob: absent
  three-card-row: present
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
  custom-type-pairing: present
  real-product-surface: absent
  shows-deliverable: absent
  density-variation: present
  one-accent-discipline: present
  live-claim-control: absent
---
Captured at 1440x900; full page 3340px. A cookie-consent card occupies the lower
right of the capture from roughly (960,605) to (1415,850) and hides part of the
hero panel; everything described outside that rectangle is unobstructed.

The field is #f0eee6 — a warm cream, measured flat at (20,450). Not white, not
near-black. That single choice does most of the work on this page, because it means
black type sits at lower contrast than it would on white and the two secondary
surfaces can be *warmer tints of the same hue* rather than grey: the hero promo panel
is #faf9f5 (lighter than the field) and the release cards are a deeper warm tint.
Three surface values, one temperature, no grey anywhere.

The brand stylesheet contains zero linear-gradient and zero radial-gradient
declarations, and zero backdrop-filter. Not "no visible gradient" — none are written.
The page's depth comes entirely from surface value and one 1px rule weight.

The hero is a two-column asymmetric split: headline left from x=80 to x=712, body
right from x=845 to x=1296, with a ~130px gutter and nothing centered. Headline
measures roughly 64px cap-derived on 67px leading over three lines; the right column
is 17px on 34px leading. Ratio about 3.8:1. The pairing is the finding, and it is
visible rather than merely provisioned: the headline is set in a bespoke Anthropic
Sans and the body column beside it in a bespoke Anthropic Serif, so the hero shows
two custom faces simultaneously rather than one face at two sizes. The site
self-hosts a full bespoke superfamily — Anthropic Sans roman and italic, Anthropic
Serif roman and italic, Anthropic Mono roman and italic — plus JetBrains Mono.

Two editorial devices worth stealing. First, the headline underlines two words
("research", "products") with a heavy rule at display size — emphasis inside a 64px
headline, which almost nothing attempts because it reads as a link unless the rule
weight is tuned against the stem weight. Second, the promo panel sets "Claude Haiku
5.5" in the bespoke serif at roughly 90px *on a curved baseline*, with two thin
hand-drawn arcs sweeping out to the panel edges above and below it. Type on an arc is
the grid break: nothing else on the page leaves the baseline grid, so the one element
that does is the one being announced.

The three-card row is real and is recorded as present. "Latest releases" runs three
equal cards at roughly 405px wide with 30px gaps, rounded about 12px, filled a warm
tint above the field, each with heading, body paragraph, and an identical black
"Read announcement" pill. Three identical CTAs in a row. What keeps it from reading
as the generated version is that the card body is a *spec table* rather than
marketing copy — DATE / CATEGORY / DETAILS as left labels in small caps with
right-aligned values and a 1px rule under each row, so the card is a data record
rather than a pitch. And there is no icon: the usual row puts a 24px line icon above
each heading, and this one puts nothing there at all, which is why
generic-line-icon-set is absent even though the row is present.

The section immediately after it is the better pattern and the direct alternative: a
left statement ("At Anthropic, we build AI to serve humanity's long-term
well-being." at ~28px over three lines) against a right-hand *index* — a list of
article titles, each with its category right-aligned on the same line and a hairline
rule beneath. The same information a card grid would carry, no card, scannable in one
vertical pass.

One chromatic element exists in the whole capture: a terracotta #e6a58f fill on the
cookie banner's accept button. Every other interactive surface, including the nav
"Try Claude" button, the panel's "Read more" button and all three card CTAs, is
#1b1b1a near-black. Footer is a five-column link index on near-black with monochrome
brand glyphs for LinkedIn, X and YouTube — real marks, not emoji; the page source
contains no emoji characters at all.

No product screenshot anywhere on the page: the thing being sold is represented by
typography and a word, never by a picture of an interface. Single theme — a
prefers-color-scheme dark capture differs from the light one by 0.1% of pixels, so
there is no dark variant that could be an afterthought.

**v4 change 3b surface re-pass**

Re-rated 2026-10-16 from the live page. Values decided before this prose:
`real-product-surface: absent` (confirmed, no flip), `shows-deliverable: absent`
(confirmed, no flip).

Capture: `shoot-tiles.cjs` walked the window scroller in 5 tiles at 1440x900,
`clamped: false`, `coverage: 1.002`, `docH_before` 3340, `docH_after` 3346 (the
larger, 3346, is the page height; the stitched strip is 1440x3340, one strip). The
last strip ends in the near-black footer (link columns, "© 2026 Anthropic PBC",
LinkedIn / X / YouTube glyphs), so the walk reached the bottom. The fixed cookie card
repeats in every tile at the lower right; text it covers was read from the DOM.

Every candidate surface, inventoried from the DOM (Playwright, after a full scroll):
- 0 `<video>`, 0 `<iframe>`, 0 `<table>`, 0 `<pre>`/`<code>`, 0 CSS background images.
- 3 `<img>` in `.moo-sq` wrappers at y=675, 228x228, x=206 / 606 / 1007
  (`hero_moo_1a/1b/1c.webp`). Raster. Fetched and viewed: a yellow paper collage with
  pencil lines, a dark oil-paint stroke over ochre, white chalk marks on blue. Painted
  textures. They show for about two seconds of the hero intro animation (frames at
  0.5s and 2s), then resolve into the panel title and sit at `visibility: hidden`.
  The walker disables animation, which is why the earlier prose never saw them.
  Decorative art, not a UI.
- 2 `<canvas>` in the hero panel: y=651, 777x221 (the curved "Claude Haiku 5.5"
  title) and y=820, 1285x112 (the two hand-drawn arcs). Typography and line art.
- 2 `<svg>`: the wordmark lottie at y=26 (143x16) and the footer mark at y=2412
  (45x32).
- Nav dropdowns ("Try Claude", Research, Commitments, Learn) add no imagery; the three
  `<img>` above are the only images in the document.

Q1, `real-product-surface`: absent. Claude, the product, is nowhere on the page as an
interface: no capture or rebuild of claude.ai, Claude Code, the console or the API,
no screen recording (no video element exists), no SVG or DOM rendering of a chat,
terminal or settings pane. The product appears only as words: the "Claude Haiku 5.5"
title, three release cards, an index of article titles and footer links ("Claude
Code", "Console login", "Log in to Claude"). The one visual medium that animates is
painted texture. Under the widened definition there is still nothing to credit.

Q2, `shows-deliverable`: absent. No entry could embarrass the vendor. Searched: every
text block, the three release cards, the hero panel, the six-row index; for a model
card, benchmark table, eval figure, system-card excerpt or model output of any kind
(none exist: 0 tables, 0 code blocks, no rendered output). The nearest candidates are
the card bodies at y=1405, vendor copy rather than a rendering of anything the product
produced:
- "Designed for high-volume, cost-sensitive work. It’s our fastest, cheapest, and most capable small model to date."
- "A clear upgrade over Sonnet 5 that runs 30% faster and costs up to 30% less for most work."
- "Opus 5.5 performs at the level of Fable 5.1 on most work, and costs 40% less to run than Opus 5 on typical workloads."

Every value is a win (faster, cheaper, more capable, parity with Fable 5.1). "For most
work", "up to" and "on typical workloads" are ordinary marketing hedges that keep the
figures large, not a refusal that narrows a claim against the vendor's interest. The
hero line at y=914, "The cheapest, fastest, and most capable small model we’ve ever
released.", is the same claim again. No artefact of the product's work is shown, and
the claims about it can only flatter.

Drift from the earlier prose: page height now 3346, was 3340. The hero intro animation
(three painted-texture squares dissolving into the curved title) is new to this record;
the earlier tile capture had animation off. The "Latest releases" row now reads Haiku
5.5 (October 7, 2026), Sonnet 5.5 (September 28, 2026), Opus 5.5 (September 22,
2026). The index beside "At Anthropic, we build AI to serve humanity’s long-term
well-being." now lists Claude Science, Core views on AI safety, Anthropic’s
Responsible Scaling Policy, Anthropic Academy: Build and Learn with Claude,
Anthropic’s Economic Index, Claude’s Constitution. The rest of the earlier description
(cream field, split hero, curved serif title, spec-table cards, terracotta only on the
cookie accept button, footer glyphs) still matches.
