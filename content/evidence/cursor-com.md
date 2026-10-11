---
source: https://cursor.com
kind: site
cohort: agent-tools
context: [hero, nav, features, testimonials, cta, footer]
verdict: mixed
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
  hero-mockup-float: present
  feature-icons-identical: absent
  testimonial-card-triplet: absent
  dark-mode-afterthought: absent
  asymmetric-split: present
  single-optical-anchor: absent
  type-scale-high-contrast: absent
  editorial-grid-break: absent
  custom-type-pairing: present
  motion-tied-to-input: unresolved
  real-product-screenshot: present
  density-variation: present
  one-accent-discipline: present
---
Captured at 1440x900 light and dark; full page 8175px. A cookie-consent card covers
roughly (890,755) to (1420,885) in both captures.

Recorded as mixed, and it is the most interesting site in the cohort for that reason:
the typography and the dark theme are better than almost anything else here, and the
page still ships two of the canonical slop patterns.

Typeface, settled by downloading the webfonts and reading their name tables rather
than inferring from letterforms: the primary face is **Cursor Gothic** (roman and
italic), bespoke. The site also self-hosts the full Lato family and EB Garamond.
Nothing in the document names a family — every face is content-hashed under
/marketing-static/_next/static/media/ — so letterform guessing would have called this
one wrong in either direction. The pairing is visible in the site's own chrome, not
merely provisioned: section three sets a copyable install snippet
(curl https://cursor.com/install -fsS | bash) in a monospace face inside a #f2f1ed
filled field with a copy button, beside Cursor Gothic body copy.

The theme pair is the single best mechanism on the page. Light field is #f7f7f4,
dark field is #14120b — both *warm*. The dark theme is a temperature counterpart, not
an inversion to cold black, so the two renders look like the same brand rather than a
palette and its negative. The button pair inverts together: in light, primary is a
#26251e near-black pill and secondary a #e6e5e0 grey pill; in dark, primary becomes a
#edecec near-white pill and secondary a #26241e dark pill with a hairline. Both
members flip, so the primary/secondary hierarchy survives the theme change — the
common failure is inverting the field and leaving one button's fill fixed, which
collapses the pair. The painted backdrop is the same painting in both themes,
darkened and desaturated in dark rather than swapped. A dark capture differs from
light across 99.7% of pixels; this is a designed second theme, so
dark-mode-afterthought is absent.

Where it fails. The hero composites two application windows over a 19th-century
romantic landscape oil painting: a "Cursor Desktop" window from x=180 to x=1260 with
macOS traffic lights, and a second "Cursor CLI" window overlapping it from x=860 to
x=1337 at a nearer z-depth, both with drop shadows, floating on an unrelated painted
image. Axis-aligned rather than tilted in perspective, which is the better version of
the move, but it is still a mockup float: the interface is pictured on decorative art
rather than placed on the page. Consequence for the signal above it —
single-optical-anchor is absent, because the painting, two overlapping windows and
the headline each claim attention and none dominates.

"Stay on the frontier" is a true three-card row and should be recorded without
softening: three cards at roughly 427px with ~11px gaps, each with a 1px #e4e3dd
border, ~6px radius, internal padding, a 17px heading, 15px body, an orange link, and
a visual panel below. Card chrome is unambiguously present. The row also ships
visibly broken: the third card ("Develop enduring software") puts its "Explore
enterprise" link at y=391 where the other two sit at y=220 and y=234, and its visual
panel from (960,420) to (1355,640) is an empty grey rectangle. Three cards, one of
them hollow, live on the homepage.

The headline is the cohort's outlier in the other direction: "Cursor is your coding
agent for building ambitious software." measures roughly 33px cap-derived on 33px
leading, against 15px body and nav. That is a 2.2:1 display-to-body ratio, so
type-scale-high-contrast is absent — about half the ratio of every other exemplar
here. There is no subhead at all; the headline goes straight to two buttons. The page
is betting on the product image carrying the hero, which is consistent with the
mockup float and explains why both read as the same decision.

What it does well besides the theme. Testimonials are six quotes in a 3x2 lattice
divided by 1px rules — no fill, no radius, no shadow, so no card — with attribution
as name plus role at ~11px beneath each quote (Diana Hu, Jensen Huang, Andrej
Karpathy, Patrick Collison, shadcn, Greg Brockman). Changelog and "Recent highlights"
are both four-column rows separated by hairline top rules rather than tiles. One
accent and one only: #f54e00 orange on every inline link ("Explore models",
"Learn about cloud agents", "Explore enterprise", "See what's new in Cursor"), and
nowhere else — the buttons stay achromatic. Every chromatic value other than that
orange is inside a real product capture (green diff counts, a mint CLI plan line, a
#d0a467 "Build" badge), not in the site's own palette.

Real product capture throughout, with real content rather than lorem: actual file
paths, +135/-21 diff counts, a model picker listing named models, a Slack thread with
a "View PR" button. The logo wall is eight customer marks in one monochrome row.
