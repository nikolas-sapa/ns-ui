---
source: https://web.archive.org/web/20141231215120/https://www.dropbox.com/
kind: site
cohort: pre-ai-2015
context: [hero, features, footer]
verdict: exemplar
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
  generic-line-icon-set: absent
  testimonial-card-row: absent
  indigo-violet-accent: absent
  gradient-fill-cta: present
  scroll-reveal-blank: absent
  typewriter-headline: absent
  stock-photo-generic: absent
  centered-hero-stack: present
  hero-mockup-float: absent
  asymmetric-split: present
  single-optical-anchor: present
  type-scale-high-contrast: absent
  editorial-grid-break: absent
  custom-type-pairing: absent
  real-product-surface: absent
  shows-deliverable: absent
  density-variation: present
  one-accent-discipline: present
  live-claim-control: absent
---
Capture year 2014 (Dec 2014 snapshot). Centered hero stack in its textbook
form: logo mark, then "Your stuff, anywhere" at roughly 28px, then one
filled blue button, then a text sign-in link, all on the vertical axis.

What keeps it from reading as slop is restraint elsewhere. One hue carries
the entire page — Dropbox blue on the CTA, the logo, and every link, with
no second accent anywhere. The four feature sections below alternate
illustration left / copy right then copy left / illustration right, which
breaks the symmetry the hero sets up. Line illustrations are hand-drawn in
a single consistent hand, not an icon set.

Whitespace is the dominant material: roughly 600px of empty vertical space
around the hero at 1440. Nothing competes with the one button.

No product screenshot anywhere on the page. The product is represented
entirely by illustration, which in 2014 was a defensible choice and today
would read as evasion.
**v3 re-pass.** `gradient-fill-cta` is present: the blue "Sign up" button runs
#158add to #0480e4 top to bottom. It is the shallowest of the three 2014 gradients
measured in this cohort — seventeen units against stripe's fifty-eight — and reads as
a bevel rather than a painted fill, so it is the file to revisit first if the signal
is given a depth threshold. Nothing else new fires: no photography, no indigo-violet,
no scroll-gated content.

**v4 change 3b surface re-pass**

Capture: the `/web/2014/` URL resolved to snapshot `20141231215120` (31 Dec 2014,
21:51:20). Walker: 4 tiles, `clamped: false`, `coverage: 1`, docH 2768 before and
after, scroller `window`, stitched to one 1440x2768 strip. The last strip ends in the
footer link row ("Pricing · Business · Mobile · Developers · Help · Blog · Jobs ·
Privacy & Terms", y2517). All y-coordinates below are document y and include the
Wayback band: `#outer-frame` starts at y97, and nothing above it is page content.
Every page image archived and decoded (non-zero natural size). The only failed or 404
requests are ad/analytics pixels (doubleclick, bing, facebook, adroll), so nothing
that could depict the product is missing from the archive.

Candidate product surfaces:
- Hero devices, y317-777, raster PNG (`devices-vfl3TTUs-.png`, 444x460): an empty
  line drawing of a laptop, tablet and phone.
- Hero screen-fill layers, y~357-753, raster PNGs (`doc_/graph_/photo_` x
  `comp/tablet/phone`, plus `tablet_bars`, `bg`, `flash`). These are `display:none`
  slides that page JS cycles onto the device screens. They did not run in the walker
  capture: the archive's dead tracking pixels hold `document.readyState` at
  `interactive`, so the load-triggered sequence never starts in a domcontentloaded
  walk (a separate probe that waited for `load` did see `photo_comp` laid out at
  y357). I downloaded all nine and forced each set visible. Contents: a hand-lettered
  document headed "The Forward story" with illegible scribble body text, a five-bar
  blue bar chart, and a cartoon of hot-air balloons over hills. They depict the
  user's files, drawn in the same hand as the rest of the page. No Dropbox chrome
  appears in any of them: no file list, sync badge, toolbar, sidebar or share dialog.
- Feature illustrations, raster PNGs: phone on a road (y1088), mailbox holding a photo
  (y1399), umbrella over a Golden Gate photo (y1774), monitor in a city skyline showing
  the Dropbox logo (y2110). The last is a logo on a drawn screen, not an interface.
- Hidden live forms in the DOM: the sign-up fields ("First name / Last name / Email /
  Password / I agree to Dropbox Terms", behind the y562 "Sign up" submit) and a
  `display:none` sign-in form with captcha and two-step code entry. Real Dropbox UI,
  but it is the account gate, not the product (file sync and sharing). Not credited:
  a login form says nothing about what the product looks like in use.

Q1 `real-product-surface`: **absent**, confirmed. Every depiction of the product is
hand-drawn illustration; the hero animation's screen content is illustrated user
files, not a capture or rebuild of the Dropbox client or web app. This is a page
choice, not an archive gap: all candidate assets archived and were inspected, so
`unresolved` is not warranted. Faithfulness check was against the assets themselves,
which contain no interface elements to compare to the 2014 client.

Embarrassing entry: none. Searched the full body text (four feature paragraphs, the
Business paragraph, CTAs, footer) and the nine hero slides. The closest candidates
fail the procedure: "Even if your phone goes for a swim, your stuff is always safe in
Dropbox and can be restored in a snap" (y1770) frames a loss scenario only to resolve
it in the vendor's favour; "Millions of people use Dropbox at work" (y2102) is a
vendor-aggregate that can only flatter by being larger; "Dropbox secures your files
with 256-bit AES encryption and two-step verification" (y1770) is a limit repeated as
a selling point. No price, quota, refusal or failure appears on the page. The hero
slides' document body is placeholder scribble, which disqualifies it as content
anyway.

Q2 `shows-deliverable`: **absent**, confirmed. No artefact on the page shows output
from a job, and nothing in the copy or illustrations could count against the vendor.

Drift from earlier prose: structure, copy and single-accent reading still match. Two
notes. (1) The earlier prose said the product is represented "entirely by
illustration" without mentioning the hero's cycling screen layers; they exist, and
they are illustration too, so the reading stands. (2) The v3 note recorded the CTA
gradient as #158add to #0480e4; the live DOM now reads `rgb(22, 138, 221)` to
`rgb(0, 126, 229)` (#168add to #007ee5) on both `#register-submit` (y562) and the
bottom "Sign up" (y2404). `gradient-fill-cta` was not re-rated here.

**`source` pinned to snapshot `20141231215120`.** It was `/web/2014/`, which resolves to
the nearest snapshot. That target can move as the archive adds captures, so two
raters following the same `source` could rate different pages and nobody would
see it. The pin is the snapshot this file's 3b re-pass landed on. A 2014 page
cannot have changed since, so any later re-rate that disagrees with this file
is disagreeing about the same bytes.
