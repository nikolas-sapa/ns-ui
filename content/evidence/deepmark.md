---
source: https://www.deepmark.me
kind: site
cohort: yc-current
context: [hero, features, testimonials, cta, footer]
verdict: mixed
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
  custom-type-pairing: present
  real-product-surface: absent
  shows-deliverable: absent
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

Calibration note, after two independent blind re-ratings. **This file was
rated `slop` and is `mixed`.**

Two blind raters worked it without seeing this file. Both independently
returned the same six slop signals. They split on craft: one scored 2, the
other 4, and the second was right on the call that decides it.

`custom-type-pairing` was rated `absent` here and is `present`, measured:
Space Grotesk carries every display size on the page (60, 42, 36 and 26px)
and Geist carries all body copy (14 to 18px). Two faces, each with a job,
assigned by role. A first rating that missed it was reading the page as
single-voiced when it is not.

That puts the page at 6 slop and 4 craft, net **+2** — identical to
`railway-com`, which is the `mixed` anchor, and well below both slop
anchors (`heroku-2014` +5, `openhack` +4). It also carries the lowest slop
count in the candidate pool with double the craft of either slop file.

The second rater also established `scroll-reveal-blank` as `absent` three
ways rather than by capture diff: zero text nodes under 8% opacity at rest,
after a 19-step walk, and after a matched dwell control, with visible
characters identical at 8285 in all three and one transformed element
page-wide. A capture diff alone reports 5.5% of pixels differing with 14
images missing, and the cause is native `loading="lazy"` on 31 of 34
images, which survives no-JS and withholds nothing from a markup reader.

Where the two raters would still differ, recorded because the margin is
thin: `symmetric-everything` is `absent` here, and the counter-case is
real — `wave-left.svg` and `wave-right.svg` at the closing CTA are a
pixel-exact mirror pair (mean absolute difference 0.07 against 15.84
unmirrored) flanking a centred stack, which is `heroku-2014`'s mechanism
exactly. It is held `absent` because 22 of 25 headings are left-aligned,
three sections carry measured voids, and the hero field is not mirrored.
Flipping it gives +3, still below both slop anchors.

**Consequence:** the slop pool returns to 2, below the gate's minimum of 3,
so no signal is rule-eligible and the eleven rules authored against this
file are withdrawn.
