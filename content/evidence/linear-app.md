---
source: https://linear.app
kind: site
cohort: agent-tools
context: [hero, nav, features, testimonials, cta, footer]
verdict: exemplar
studied: 2026-10-10
signals:
  centered-hero-stack: absent
  gradient-blob: absent
  three-card-row: absent
  glass-card-overuse: absent
  emoji-as-icon: absent
  generic-sans-default: present
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
  editorial-grid-break: absent
  custom-type-pairing: absent
  motion-tied-to-input: unresolved
  real-product-screenshot: present
  density-variation: present
  one-accent-discipline: present
---
Captured at 1440x900; full page 9960px.

The hero field is flat `#08090a`, measured identical at (20,200), (700,150) and
(1420,250) — no vignette, no radial, no mesh. The only element above 90% luminance
in the whole viewport is the `#e5e5e6` "Sign up" pill in the nav, 73x27px. That is
the mechanism worth copying: instead of avoiding a gradient blob, the page spends
its entire luminance budget on one 2000px² rectangle, so the eye lands on the
signup pill because it is the only bright thing, not because it is the biggest.

Headline sets left at x=80, not centered — "The product development / system for
teams and agents" at roughly 72px cap-measured, on 64px leading, so line-height
is below 1.0 and the two lines lock into a block. Subhead is 16px. That is a 4.5:1
display-to-body ratio in the same viewport. The secondary link ("New Loops ->")
is right-aligned on the subhead's own baseline at x=1330, which is what makes the
hero an asymmetric split rather than a stack: two items share a baseline at
opposite margins with 900px of nothing between them.

Product is a real Linear issue view — DRV-8852, a live-looking cycle, actual
sidebar nav — rendered as a flat panel from x=60 to x=1380 and cropped by the
viewport's bottom edge. No perspective tilt, no device bezel, no drop shadow
floating it off the page. It reads as the application continuing below the fold
rather than as a picture of the application.

The three-up section is the strongest anti-slop artifact on the page. Three columns,
and not one card: no fill, no border, no radius, no shadow. They are divided by two
1px vertical hairlines at x=505 and x=931 that run only the height of the content
(y=1868 to y=2350) and stop short of the section edges. Each column is headed
`FIG 0.1` / `FIG 0.2` / `FIG 0.3` in ~11px uppercase monospace, a technical-plate
convention lifted from print. The illustrations share one 1px stroke weight drawn at
roughly `#1a1b1d` on `#08090a` — barely above the background — but the three subjects
are genuinely different objects (a stack of discs, a cluster of four cubes, a fanned
stack of plates), drawn in isometric. So the row survives the two signals that
usually kill it: the cards are gone, and the icons are not three variations of the
same glyph set.

Testimonials are a 2-up at unequal widths — 888px and 432px, roughly 2:1 — not a
triplet. Each card is filled with the *quoted company's* color rather than the site's
own card style: the OpenAI quote sits on a blue-to-lavender gradient carrying the
OpenAI knot as an oversized watermark, the Ramp quote on Ramp's acid yellow. Note
this is a purple-blue gradient on the page, and it is not scored as `gradient-blob`
because it is a rectangular card fill sourced from a third party's identity, not a
soft-edged background ornament. The consequence is that every chromatic color above
the footer belongs to a customer; Linear's own palette above the fold is near-black
and one near-white. Attribution is logo, 1px rule, name/role at 13px.

Feature sections repeat one asymmetric figure: a two-line heading left at ~28px, a
body paragraph and a "Learn more ->" right at ~16px, then a wide product capture
below, then a row of small `Features: X / Y / Z` links as a section footer. Density
varies hard inside a single screen — 72px headline, 16px body, and ~11-13px live
application chrome all co-present in the hero.

The only centered block on the page is the closing CTA ("Built for the future. /
Available today." with two buttons under it), which is the one place where centering
carries meaning because there is nothing left to compare it against.

Sceptical note on `generic-sans-default`: the page's single webfont is
`InterVariable.woff2`. Inter is the most-defaulted sans in machine-generated design,
so under the definition used across this cohort — primary typeface is a system stack
or a free ubiquitous default rather than a licensed or bespoke face — Linear scores
`present`, and is the only site in the agent-tools cohort that does. What separates
it from a default is not the face but the tracking: a per-size letter-spacing token
scale (`--title-1-letter-spacing` through `--text-micro-letter-spacing`, with values
down to -0.004em) means the headline and the 11px label are tracked differently.
Copying Inter gets none of that. The face is free; the tracking table is the work.
