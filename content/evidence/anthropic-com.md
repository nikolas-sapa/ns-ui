---
source: https://anthropic.com
kind: site
cohort: agent-tools
context: [hero, nav, features, footer]
verdict: exemplar
studied: 2026-10-10
signals:
  centered-hero-stack: absent
  gradient-blob: absent
  three-card-row: present
  glass-card-overuse: absent
  emoji-as-icon: absent
  generic-sans-default: absent
  purple-blue-gradient-cta: absent
  symmetric-everything: absent
  badge-pill-spam: absent
  hero-mockup-float: absent
  feature-icons-identical: absent
  testimonial-card-triplet: absent
  dark-mode-afterthought: absent
  asymmetric-split: present
  single-optical-anchor: present
  type-scale-high-contrast: present
  editorial-grid-break: present
  custom-type-pairing: present
  motion-tied-to-input: unresolved
  real-product-screenshot: absent
  density-variation: present
  one-accent-discipline: present
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
feature-icons-identical is absent even though the row is present.

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
