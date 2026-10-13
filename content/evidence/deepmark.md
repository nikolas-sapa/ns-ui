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
  three-card-row: absent
  glass-card-overuse: absent
  emoji-as-icon: absent
  generic-sans-default: present
  symmetric-everything: present
  badge-pill-spam: present
  generic-line-icon-set: present
  testimonial-card-row: absent
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

`three-card-row` and `testimonial-card-row` were both rated `present` here
on a first pass and are **absent** on measurement. A blind second rater
instrumented them: the use-case row is four cards (w=525 at x=48, 605,
1162, 1718) inside a carousel with a 1408px clip over a 2195px track and
prev/next arrows, and the testimonial section is a carousel of two with one
card visible. Three cards are in frame at 1440px, which is the trap — the
viewport shows a three-up that does not exist in the markup.

`stock-photo-generic` is present on the use-case photographs, which are
interchangeable grey office and clinic frames with the type set on top of
them rather than sited in them.

What keeps a page like this from reading worse is usually craft carrying
the template moves. Here there is little: one accent (cyan) is held
throughout and the section densities do vary, but the type runs at a
single scale with no display face, nothing breaks the grid, there is no
real product screenshot anywhere on 10760px, and the cyan competes with
itself in enough places that no single element anchors the view.

Calibration note: this nets +4 (7 slop, 3 craft) after the two carousel
corrections. A blind second rater, working from the vocabulary and the
existing slop files without seeing this one, independently returned `slop`
at 6 slop / 2 craft / net +4 and ~75% confidence. Both readings land on
+4, which is also `openhack`'s net.

The craft count is what decides it rather than the slop count:
`railway-com` survives eight slop signals because six pieces of craft carry
them, and this page has two or three, one of which is "holds one hue" —
`heroku-2014`'s single piece of discipline, in that file's own words.

The margin is thin and the second rater named where the residual doubt
sits: `type-scale-high-contrast` has no threshold in v3, and this page
measures 3.58:1 at the hero cap-height against 2.6:1 across the page
rhythm. Scoring the hero instead of the rhythm would add a craft signal and
put it at +3, in `railway-com`'s neighbourhood.
