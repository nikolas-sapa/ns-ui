---
source: https://web.archive.org/web/2014/https://github.com/
kind: site
cohort: pre-ai-2015
context: [hero, features, auth, footer]
verdict: mixed
studied: 2026-10-11
materials: [single-theme, illustration]
signals:
  gradient-blob: absent
  three-card-row: absent
  glass-card-overuse: absent
  emoji-as-icon: absent
  generic-sans-default: absent
  symmetric-everything: absent
  badge-pill-spam: absent
  generic-line-icon-set: present
  testimonial-card-row: absent
  indigo-violet-accent: absent
  gradient-fill-cta: present
  scroll-reveal-blank: absent
  typewriter-headline: absent
  stock-photo-generic: absent
  centered-hero-stack: absent
  hero-mockup-float: absent
  asymmetric-split: present
  single-optical-anchor: present
  type-scale-high-contrast: present
  editorial-grid-break: absent
  custom-type-pairing: absent
  real-product-screenshot: present
  shows-deliverable: absent
  density-variation: present
  one-accent-discipline: absent
  live-claim-control: absent
---
Capture year 2014 (Jan 2015 snapshot). The only page in the cohort that
puts a working form in the hero instead of a button.

Asymmetric split at the top: headline left at roughly 44px against 15px
body, signup fields right — username, email, password, and a green submit.
The optical anchor is the green button and nothing else competes with it.
Hero sits on a near-black field with a faint tiled octicon pattern at very
low contrast, the one decorative element.

Immediately under it an entirely different band: a pale blue sky-and-clouds
illustration promoting GitHub Enterprise, with its own ghost-outline CTA.
Two unrelated visual systems stacked with no transition.

Features are four items in a 2x2, each under a blue line icon from one set
at one weight — the identical-icon pattern, just four up instead of three.

Lower, two large unretouched screenshots of the desktop client at near
full width, showing real commit history and a real diff with green and red
gutters. No device frame, no tilt. Readable at 1:1.

Accent discipline fails: green submit, blue links, blue icons, plus the
Enterprise band's own palette.
**v3 re-pass.** `gradient-fill-cta` is present and measured: the green "Sign up for
GitHub" submit runs #84d768 at its top edge to #66b74a at its bottom. Same finding as
`stripe-2014` and `dropbox-2014` — a gradient-filled primary button was ordinary in
2014, which the eligibility test will have to absorb. No indigo-violet anywhere, no
scroll-gated bands (the page renders complete to the footer).
