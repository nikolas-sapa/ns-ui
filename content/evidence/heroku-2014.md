---
source: https://web.archive.org/web/20150101032244/https://www.heroku.com/
kind: site
cohort: pre-ai-2015
context: [hero, features, testimonials, cta, footer]
verdict: slop
studied: 2026-10-11
materials: [single-theme, illustration]
signals:
  gradient-blob: present
  three-card-row: present
  glass-card-overuse: absent
  emoji-as-icon: absent
  generic-sans-default: absent
  symmetric-everything: absent
  badge-pill-spam: absent
  generic-line-icon-set: present
  testimonial-card-row: absent
  indigo-violet-accent: present
  gradient-fill-cta: absent
  scroll-reveal-blank: absent
  typewriter-headline: absent
  stock-photo-generic: absent
  centered-hero-stack: present
  hero-mockup-float: present
  asymmetric-split: absent
  single-optical-anchor: absent
  type-scale-high-contrast: absent
  editorial-grid-break: absent
  custom-type-pairing: absent
  real-product-surface: present
  shows-deliverable: absent
  density-variation: absent
  one-accent-discipline: present
  live-claim-control: absent
---

**Re-pass, 2026-10-18: `symmetric-everything` present → absent; verdict stays slop, at the floor.** Under the `symmetric-everything` procedure in `lib/antislop-vocab.ts` (share of h1/h2 section headings centred, run by `scripts/antislop/symmetry.cjs`; present at 0.85 or more), 3 of 4 h1/h2 compute `text-align: center` (0.75) and 1 of 4 sits on the axis; the mirrored panels' headlines are links, not section headings. Net +5 → +4. **Separation from stripe-2014 (+3), checkable:** the slop sets differ by one (`centered-hero-stack` here, `gradient-fill-cta` there), and stripe-2014 carries two craft decisions this page lacks: an asymmetric hero split and varied section density. This page has neither; its one extra craft value is a single accent.

Capture year 2014 (Jan 2015 snapshot). The control cohort's proof that the
slop template is not an AI invention. This page runs seven of the sixteen
slop signals simultaneously, in 2014. (Six when first rated against the v1
list; indigo-violet-accent was added in the v3 re-pass and is present —
#5b4e91 hero field, #6e5baa CTA.)

Centered hero: "Focus on the app" at roughly 30px over a purple gradient
field, one centered ghost button beneath it. The headline is barely twice
the body size, so the type carries no hierarchy and the button has to do
all the work.

Two mirrored panels below, each with its own centered headline, centered
subhead and centered arrow link — symmetry for its own sake, with device
mockups floating in both.

Then three stat columns — 5 Billion Requests per Day, 4+ Million Apps
Created, 150+ Add-on Services — each under a line illustration in the same
purple at the same weight. Then a greyscale logo wall of roughly forty
marks. Then a full-width purple testimonial band with decorative quote
glyphs. Then five feature rows, each under an isometric purple line icon
from one set.

One hue does carry the page, which is the single piece of discipline here.
Everything else is the template: centered stack, gradient field, mirrored
panels, three stats, identical icons, logo wall, quote band, icon list.
**v3 re-pass.** `indigo-violet-accent` is present, and this is the cohort's proof that
the hue is not an AI invention either: the hero field samples #5b4e91 to #61519c, the
bottom CTA is a flat #6e5baa, and the testimonial band, every stat illustration and
every feature icon sit in the same violet. One hue, eleven years before the palette
became a tell. `gradient-fill-cta` is absent — the CTA fill is flat.

**v4 hole-7 deliverable re-pass**

`shows-deliverable` stays `absent` (confirmed, not flipped). No entry on the page could
have embarrassed the vendor.

Capture: reused `s5/heroku-2014`, 6 tiles, `clamped: false`, `coverage: 1`, docH 3544
before and after (no drift), stitched to one 1440x3544 strip. The strip ends in the
footer (`heroku.com Legal Privacy Policy`). Wayback snapshot landed on
`20150101032244`. A separate Playwright DOM probe of the same snapshot read docH 3513;
the y values below are its DOM coordinates.

Candidates weighed:
- y446-620, inside a product capture (hero left panel): the dashboard screenshot
  (`Heroku Dashboard`, 317x178 shown at natural size). Under a 4x upscale it carries a
  dyno formation and an add-on list with plan prices (`Free`, `$200.00`, `$35.00`,
  `$29.00`, `$15.00`). On the page the glyphs are about 3-4px and unreadable, and the
  terminal overlay covers the top of the price column. Unreadable content is
  disqualified, so it is not scored. Even read at 4x, it is a price list with no
  refusal, error or failed row.
- y490-588, inside a product capture: `Heroku Dashboard Metrics`, a stepped line with
  no axis, no labels and no values. Placeholder.
- y485-587, inside a product capture: `Heroku CLI Toolbelt`, `git push heroku master`
  and nothing after it. This is input with no output, so no build log and no result.
- y490-740, inside product captures (hero right panel carousel): customer app
  screens. Macy's renders. Scoot and Lutron did not archive on this snapshot: their
  `src` was not rewritten and loaded at 0x0. Read from a 20150215 capture instead:
  Scoot's ride map (`0:05`, `23mi`) and Lutron's `My Home` lights and shades. All
  three are customers' own apps, so they show the customers' work, not anything
  Heroku's output did on a job. Every value is flattering. Their absence from the
  render is an archive failure, not a choice the page made.
- y889-1097, page's own canvas: `5 Billion Requests per Day`, `4+ Million Apps
  Created`, `150+ Add-on Services`. These are vendor-aggregate odometers. Each one
  measures customer activity and can only flatter by being larger, so it is absent
  under the railway-com precedent.
- y728, page's own canvas: the slide `Heroku Performance Dynos: Now generally
  available in Europe`. This is an announcement, not an artefact.
- y1578-1918, page's own canvas: the Ello testimonial. This is prose, not an
  artefact, and it is wholly favourable.
- y2016-2781, page's own canvas: five feature rows of one-line claims. Not an
  artefact.

Searched: every `img`, `svg`, `video`, `iframe` and `canvas` in the DOM, every
background image, and all body text. Nothing readable shows Heroku's product
declining, erroring, costing or refusing.

Verdict: absent. The only readable product chrome is a command with no output, plus
customer marketing screens. The one artefact with potentially exposing content (the
priced add-on list) is unreadable at the size it is shown. The numbers are odometers.

Studied-page check: the snapshot matches the prose: centred `Focus on the app` hero,
mirrored panels with device mockups, three stat columns, purple quote band, five
feature rows, flat purple CTA. One rendering gap: the strip shows blank space at
about y1183-1603 where the prose puts the logo wall. The DOM still holds it there as
a `skrollable` background (`bg-logos`, archived at 20150101060826). The walker's
animation freeze hid the parallax layer, so this is not drift. Result: unchanged.

**`source` pinned to snapshot `20150101032244`**, the one this file's hole-7 re-pass
landed on. `/web/2014/` resolves to the nearest capture and can move as the
archive adds captures; a pin means every later rater reads the same bytes.
