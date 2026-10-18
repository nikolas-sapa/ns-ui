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
  symmetric-everything: absent
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

**Re-pass, 2026-10-18: `symmetric-everything` present → absent, a data fix.** The #75 calibration note below held this `absent` ("22 of 25 headings are left-aligned") and stated net +2, but the front-matter kept `present`. Under the `symmetric-everything` procedure in `lib/antislop-vocab.ts` (share of h1/h2 section headings centred, run by `scripts/antislop/symmetry.cjs`; present at 0.85 or more) the page measures 2 of 13. Net +3 → +2, as the note says.

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

**v4 change 3b surface re-pass**

Re-rated from the live page on 2026-10-16. Both values are confirmed
`absent`; neither flipped.

Capture: 16 tiles, `clamped: false`, `coverage: 1`, `docH_before` 10760 =
`docH_after` 10760, scroller `window` (no inner scroller found). Stitched to
3 strips totalling 10760px against a 10760px page. The last strip ends in
the footer (logo, Home/Company/Blog/Contact/Request a Demo, "© 2026
DeepMark Inc. All rights reserved."). The sticky left column of "How it
works" repeats its heading once in the stills; that is a sticky artefact,
not missing content. The DOM carries no `<video>`, no `<canvas>`, no
`<iframe>`, no `<pre>` or `<code>`, and no CSS background images, so the
stills are complete.

Candidate product surfaces, every image on the page above 40px:

- y=557, `hero-visual-desktop.svg` (1440x496, SVG as `<img>`; zero `<text>`
  elements, all type outlined to paths). A phone reading "9:41", "Unknown
  Caller", "+1 (212) 546-3782", a gradient pill "Verified by DeepMark", and
  a row "Authenticity" / "100.00%". Not faithful. DeepMark's product is the
  Vigil C/C++ SDK and a REST API; its own docs (`/docs/vigil/overview`) say
  the detector returns "a confidence score and a binary decision"
  (`result.decision: 1 = watermarked, 0 = not watermarked`). I read all 15
  docs pages linked from the docs nav: none contains "Verified by",
  "Authenticity", a caller screen, a badge or any end-user UI. The call
  screen is an invented consumer surface, what a third-party dialler might
  show, not what DeepMark looks like.
- y=1382, `capabilities-img-01.svg`: audio, image and video glyphs wired
  into a DeepMark chip. Diagram.
- y=1875, `capabilities-img-02.svg`: grey waveform, brain-chip glyph, a
  "Verifying..." spinner pill. Decorative illustration, no `<text>`.
- y=4362, `feature-01.svg` and `feature-02.svg`: waveform behind a shield;
  radar rings with red and cyan dots. Illustration, no readable content.
- y=5407, `for-developers.svg`: isometric open box with server and database
  glyphs. Explicitly fails (isometric approximation). The "For developers"
  section shows no code, no response payload, no console.
- y=5974, `company.webp`: a person on stage beside a "3:47" timer. Event
  photo, not product.
- y=6512, `security-illustration.webp`: shield over a binary-texture page.
  Illustration.
- y=7081, `eu-ai-act-01.webp`: "THE EU AI ACT: ARTICLE 50" over a chip
  with the EU flag. Illustration.
- y=3505, four use-case photographs (`use-case1.webp` to `use-case3.webp`,
  `compliance.webp`) and y=8677, four blog thumbnails (one an "AudioSeal
  vs DeepMark Vigil" title graphic). Not product.

The real product does have a genuine visual surface, but only off this
page: `/docs/api/audio-vigil` and `/docs/api/audio-metis` carry
spectrogram examples, and `/docs/api/image-watermarking` shows watermarked
against passthrough photographs. None of it is on the homepage.

Q1 `real-product-surface`: **absent**. Under the widened definition a
faithful rebuild in SVG would count, so the hero was checked for exactly
that: it rebuilds nothing DeepMark ships, an invented call screen with a
label ("Authenticity") that does not exist in the product's own docs.
Every other surface is diagram, isometric illustration or photography. Not
a category fact either: this is a software SDK with real visual output
(spectrograms, image pairs) that the page does not show.

Q2, the entry that could have embarrassed the vendor: **none in scored
content.** The one page-authored rendering of the product's output is the
hero readout, "Verified by DeepMark" / "Authenticity" "100.00%" (y=557),
which can only flatter. Searched beyond it:

- y=4220 "Real-time watermarking has tradeoffs. We balance them all." and
  "Holding them at once is the research moat." Names a tradeoff in order
  to claim it resolved.
- y=4925 "High capacity. Up to 128 bits": a limit sold as a selling point.
- y=5075 "Under 2 ms of compute to watermark a second of audio." and
  "Around 30,000 seconds of audio per second of GPU time on an L40S."
  Product-output measures, but each value only flatters by being smaller
  or larger.
- y=2832 "with clear pass/fail results, from as little as a few seconds of
  audio": a minimum sold as speed.
- FAQ answers, collapsed at rest (rendered height 0): y=9372 "No watermark
  is impossible to remove." and y=9630 "It supports compliance, the legal
  obligation remains with the provider." These are genuine narrowings of
  claims the page would benefit from leaving broad, and the nearest thing
  to an embarrassing entry on the page. They do not count here: they are
  vendor prose in an accordion, not product chrome, a captured artefact or
  a rendering of the product's output, so they are not deliverable
  content.

Q2 `shows-deliverable`: **absent**. The only rendered output is a
self-awarded 100.00%, and the admissions on the page sit in FAQ copy, not
in anything the product produced.

Drift from the earlier prose: page height unchanged at 10760px. Two of
the eleven section pills have been renamed: "Content integrity &
detection" now reads "Content marking & detection", and "Compliance" now
reads "EU compliant" (both checked in served HTML; the old strings are
gone). The Meta / Microsoft / Adobe / "And more" row is captioned "Cited
by" (y=1093) and its marks link to arXiv 2308.12770, arXiv 2401.17264 and
IEEE 10447253, papers rather than customers. The hero phone, the four-card
use-case carousel and the two-card testimonial carousel (Jonathan
Mortensen, Arjun Gupta) still match. "There is no real product screenshot
anywhere on 10760px" still holds.
