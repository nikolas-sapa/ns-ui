---
source: https://web.archive.org/web/20150101060225/https://basecamp.com/
kind: site
cohort: pre-ai-2015
context: [hero, features, testimonials, cta, footer]
verdict: mixed
studied: 2026-10-11
materials: [single-theme, illustration]
signals:
  gradient-blob: absent
  three-card-row: absent
  glass-card-overuse: absent
  emoji-as-icon: absent
  generic-sans-default: present
  symmetric-everything: absent
  badge-pill-spam: absent
  generic-line-icon-set: absent
  testimonial-card-row: absent
  indigo-violet-accent: absent
  gradient-fill-cta: absent
  scroll-reveal-blank: absent
  typewriter-headline: absent
  stock-photo-generic: absent
  centered-hero-stack: present
  hero-mockup-float: absent
  asymmetric-split: absent
  single-optical-anchor: absent
  type-scale-high-contrast: absent
  editorial-grid-break: absent
  custom-type-pairing: absent
  real-product-surface: present
  shows-deliverable: absent
  density-variation: present
  one-accent-discipline: present
  live-claim-control: absent
---
Capture year 2014 (Jan 2015 snapshot). The most alien page in the cohort
measured against 2026 convention, and the one that best answers "how were
people building before".

A single centered column roughly 600px wide holds the entire page. The hero
is a hand-drawn cartoon of three people at a desk, then a one-line claim
carrying a hard number — 285,000 companies, 2,000,000 projects — then one
blue button.

Then prose. Six headed sections of genuine running body copy, paragraphs of
four to six lines, set at 14px. No cards, no icons, no columns, no pull
quotes. The page argues in sentences. A 2026 page carrying this much text
would break it into feature cards and lose the argument.

Product shown as nine unretouched screenshots in a loose grid across
desktop, tablet and phone, overlapping at slight angles like photos on a
table — not an isometric device mock.

The same blue CTA repeats three times down the column at reading intervals.
Customer logos are drawn into a crowd illustration rather than set in a
grey grid. System sans throughout, no webfont.

**v4 hole-7 deliverable re-pass**

Studied 2026-10-11; re-passed 2026-10-16. `shows-deliverable` stays
**absent** (confirmed). Front-matter unchanged.

*Capture.* Reused the s5 walk: 7 tiles, `clamped: false`, `coverage: 1`,
`docH_before` 4774 = `docH_after` 4774, stitched to 2 strips (4400 + 374px),
4774px vs page 4774px OK. The last strip ends in the footer: "Not-so-fine
print: Terms of service, privacy policy, refund policy, security
information, % uptime, system status." then "Enjoy the rest of your
Thursday!". Snapshot landed on: `20150101060225` (the `web/2014/` URL
redirects there). Archive failures, not page choices: the hero cartoon is a
JS-assigned CSS background on an un-rewritten cloudfront URL and renders
blank in the walk (`cartoon-meeting` archived, inspected: a hand-drawn
meeting, "HOW'D YOU GET THE PROJECT DONE WITH THAT TIGHT DEADLINE?" /
"BASECAMP!"); `companies.jpg` (the crowd illustration, 800x495) is missing
from the walk but loaded in a separate DOM read at y3173 (docH 5269 there,
+495); `screenshot-03` renders 0x0 at y2401 in both (src left as a raw
cloudfront URL), archived at `20141231174437` and inspected directly. The
JS-filled values are empty in the archive: `<span data-uptime>` in "a %
uptime record over the last 12 months", `<span data-response-time>` in
"We've been responding to emails in lately", and the count in "Just last
week, another companies started using Basecamp." The screenshots carry
`data-retina` @2x versions (2000x800, archived `20150106020340` etc.); the
walk at DPR 1 shows the 1x assets.

*Candidates weighed (page y, DOM; identical in the walk above y3173).*
- Hero claim, page canvas, y~575: "Last year alone, Basecamp helped over
  285,000 companies finish more than 2,000,000 projects." Vendor-aggregate
  odometer: counts customers' activity, can only flatter by being larger.
- `screenshot-01`, inside a product capture, y1594-1981 (968x387 from a
  1000x400 asset): desktop Projects grid (project names and avatars only),
  iPhone Progress feed, Android `REMOTE: The book` to-dos where every
  visible row reads `✓ DONE`.
- `screenshot-02`, inside a product capture, y1998-2385: iPad "Daily
  Progress" feed from the vendor's own account, and a desktop Calendar of
  on-call and training bars (`Trevor on call`, `XO Maintenance`, `TG
  training in Chicago`). Nothing in the calendar counts against anyone.
- `screenshot-03`, inside a product capture, y2401 (failed in capture):
  desktop Text Docs of `REMOTE: The book`, a tablet showing `Typeset #4.pdf`.
  Nothing unflattering.
- Uptime sentence, body copy, y~2573: value missing; body copy cannot carry
  the entry, and an uptime % is a bounded figure that can only flatter.
- "A touch over 15,000,000 people have used Basecamp", body copy: odometer.
- Crowd illustration with drawn logos (Etsy, NASA, Nike, ...): adoption, no
  output.

*The entries that could have embarrassed the vendor exist, inside the
captures, and are not readable at page size.* Read off the @2x assets at
native resolution:
- iPad, project `QA: Bug Mash`, y~2172: "Jeffrey H. commented on
  Investigate possible dupe attachment keys: We're up to 8 failures now. Not
  too bad considering how long the bug existed. I'll work on restoring these
  while we work through the rest of the queue."
- iPad, `Heartbeats` / `Support :heart_pulse: 23 July`, y~2247: "Still only 8
  of about 40 attendees actually showed up, and only one asked a question."
  (Natalie K. above it, y~2215: "Not many people showed up.") This is about
  the vendor's own classes, which the page sells at y~2911 under "Free weekly
  classes + live Q&A.;". On stance it would pass Part A cleanly, the same
  class as railway-com's own log.
- iPhone, `Marketing`, y~1843: "Jason F. commented on Discount explanation
  doesn't fit in boxes: We can condition the boxes to be taller on these
  accounts if we wanted. I still wonder how clear this all is to people."

Measured in the @2x asset, comment lines run at a 13px pitch with 8-9px
glyph runs; displayed at 968/2000 that is a ~6.3 CSS px line pitch and ~4.4
CSS px glyph height. In the 1x asset (what DPR-1 visitors, and this walk,
get) the glyphs are ~4 image px: illegible. On a retina screen the @2x swap
makes them pixel-legible, but at roughly 4pt physical size, a third of the
page's body size. The page presents the screenshots as a collage of the
product in use, not as documents to read.

*Verdict: absent.* Part B disqualifies unreadable content, and the bar used
elsewhere (aviern) is "readable as an image at page size". These lines fail
it: they can only be read by pulling the asset out of the page. Everything
readable at page size is an odometer, a body-copy claim, or a capture whose
legible content (project names, `✓ DONE` rows, calendar bars) is all
flattering. Borderline, stated plainly: if the threshold is legibility in
the shipped @2x asset rather than at page size, this flips to present on
the classes line, which is the strongest entry.

*Studied-page check: unchanged.* Same Wayback snapshot as the study ("Jan
2015 snapshot"); an archive cannot redesign. Minor discrepancy with the
prose above: it says "nine unretouched screenshots"; the page has three
composite images holding seven device screens (desktop Projects, iPhone,
Android; iPad, desktop Calendar; desktop Text Docs, tablet). Not drift.

**`source` pinned to snapshot `20150101060225`**, the one this file's hole-7 re-pass
landed on. `/web/2014/` resolves to the nearest capture and can move as the
archive adds captures; a pin means every later rater reads the same bytes.
