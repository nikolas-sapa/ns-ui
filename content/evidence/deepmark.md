---
source: https://www.deepmark.me
kind: site
cohort: yc-current
context: [hero, features, testimonials, cta, footer]
verdict: slop
studied: 2026-10-13
materials: [single-theme, illustration, stock-photo]
signals:
  gradient-blob: absent
  three-card-row: present
  glass-card-overuse: absent
  emoji-as-icon: absent
  generic-sans-default: present
  symmetric-everything: present
  badge-pill-spam: present
  generic-line-icon-set: present
  testimonial-card-row: present
  indigo-violet-accent: absent
  gradient-fill-cta: absent
  scroll-reveal-blank: absent
  typewriter-headline: absent
  stock-photo-generic: present
  centered-hero-stack: present
  hero-mockup-float: present
  asymmetric-split: present
  single-optical-anchor: absent
  type-scale-high-contrast: absent
  editorial-grid-break: absent
  custom-type-pairing: absent
  real-product-screenshot: absent
  artifact-not-dashboard: absent
  density-variation: present
  one-accent-discipline: present
  live-claim-control: absent
---
10760px, walked (docH unchanged before and after, so nothing is scroll-gated).

Centered hero in its textbook form: a top announcement bar, then a Y
Combinator badge, then "Verified calls for the AI voice era" at roughly
48px over 17px body, then one centered cyan CTA, all on the vertical axis.
Below it an illustrated phone floats dead centre showing a mocked-up
"Unknown Caller" screen with a gradient "Verified by DeepMark" pill, over a
full-width cyan audio-waveform field that recurs as the page's only motif.
Then a four-mark logo wall (Meta, Microsoft, Adobe, "And more").

**This is the first page in the corpus to fire `badge-pill-spam`**, and it
is not a close call: eleven decorative cyan section labels run down the
page above their headings — "Content integrity & detection", "Voice agent
authentication", "How it works", "Use cases", "Features", "For
developers", "Company", "Security", "Compliance", "Testimonials", "Our
blog". Each is a pill with no function, naming the section the heading
immediately names again.

`generic-line-icon-set` fires on the cyan glyph chips: one set, uniform
stroke and size, carrying nothing the adjacent heading does not already
say. They appear in the four-up "Real-time watermarking has tradeoffs"
grid, the three-up use-case row and the numbered register/embed/detect/
resolve list.

`three-card-row` fires twice: three use-case cards (banking and financial
services, contact centres and customer support, healthcare and insurance)
each over a desaturated stock photograph, and again as a three-up blog
card row. `stock-photo-generic` is present on those use-case photographs,
which are interchangeable grey office and clinic frames with the type set
on top of them rather than sited in them.

What keeps a page like this from reading worse is usually craft carrying
the template moves. Here there is little: one accent (cyan) is held
throughout and the section densities do vary, but the type runs at a
single scale with no display face, nothing breaks the grid, there is no
real product screenshot anywhere on 10760px, and the cyan competes with
itself in enough places that no single element anchors the view.

Calibration note: this nets +5 (8 slop, 3 craft), the same net as
`heroku-2014`, where `railway-com` nets +1 on a comparable slop count
because six craft signals carry it.
