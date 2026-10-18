---
source: https://web.archive.org/web/20141231191003/http://mailchimp.com/
kind: site
cohort: pre-ai-2015
context: [hero, cta, footer]
verdict: exemplar
studied: 2026-10-11
materials: [single-theme, commissioned-photo]
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
  gradient-fill-cta: absent
  scroll-reveal-blank: absent
  typewriter-headline: absent
  stock-photo-generic: absent
  centered-hero-stack: present
  hero-mockup-float: absent
  asymmetric-split: absent
  single-optical-anchor: present
  type-scale-high-contrast: present
  editorial-grid-break: absent
  custom-type-pairing: present
  real-product-surface: present
  shows-deliverable: absent
  density-variation: present
  one-accent-discipline: present
  live-claim-control: absent
---
Capture year 2014 (Dec 2014 snapshot). Centered, and the strongest page in
this cohort, which is itself the useful finding: centering is not the
defect.

"Send Better Email" sits at roughly 52px against 17px body copy, a ratio
near 3:1 — the highest in this cohort. Below it, the actual product UI as a
real screenshot, small and unglamorous, no device frame, no perspective
tilt, no floating shadow.

The page's whole surface is one photographic still life: a framed chimp
print, a live canary, pencils, a stack of books, an espresso cup, a
succulent, lit as a single continuous scene that the content sits inside
rather than on top of. Commissioned photography, not stock. Nothing about
it is reusable by anyone else, which is precisely what makes it work.

One orange CTA is the only saturated element on an otherwise neutral page.
The wordmark is a custom script paired with a geometric sans, two voices
used deliberately.

**v4 hole-7 deliverable re-pass**

Capture: reused `~/scratch/antislop/s5/mailchimp-2014`, 2 tiles, `clamped: false`,
`coverage: 1`, `docH_before` 1203 = `docH_after` 1203, scroller `window`.
Stitched to one 1440x1203 strip. The last strip ends in the footer
(`©2001-2014 All Rights Reserved. MailChimp® is a registered trademark of The
Rocket Science Group. Privacy and Terms`, y≈1170; `logo-dark` svg at y1081).
Wayback snapshot landed on: `20141231191003`. The Wayback toolbar (y0-65) was
ignored. The walked strip shows the hero band (y128-947) as flat grey: the
walker disables animations, and both the desk photograph and the hero figure
sit behind the `animated` class. Neither is a missing archive asset. A
live load of the same snapshot renders the still life, and the figure was
read from the DOM and by seeking its CSS animations (11 animations, all
`delay=500 dur=5000`, end 5500ms) across 13 frames. No `<video>` on the page.

Candidates weighed:

1. The hero figure, y321-757 (`piece app-chrome`, 700x436), on the page's own
   canvas under `Send Better Email`. A page-authored animated rendering of the
   product: SVG app chrome, JPG campaign pieces, HTML text injected from
   `data-text`. Readable, so part B admits the medium. It shows the
   drag-and-drop editor building a fictional merchant's email: chrome reads
   `J.R. Flourence` / `1 Editing` / `Help` / `Preview and Test` / `Save and
   Exit`, tabs `Content` `Design` `Comments`, step bar `Recipients > Setup >
   Template > Design > Confirm`. A cursor drags a text block and an image
   block into place; the campaign fills in with `FITTED FOR FALL`, "'Tis the
   season at J.R. Flourence for fitted long sleeve button downs! ... mailing
   list members get early online access." and `Designs By Deidre Visits J.R.
   Flourence`, then a round `IN STORE EVENT` image lands. Every drop lands, no
   validation warning, no preview or test result, no send, open or bounce
   figure, nothing undone. It is the customer's work made with the product,
   and every value in it is the flattering one. Fails on stance.
   (The source `data-text` nests `<b><i><u>` and closes them out of order;
   the browser renders it as intended, so it is not content a reader sees.)
2. `animation-fallback.jpg`, 700x436, `display: none` in this load. The same
   scene as a still; not scored separately.
3. The stat line, y≈915, on the page's canvas beside `Sign Up Free`: "Join
   more than 7 million people who use MailChimp to design and send 500
   million emails every day." Vendor-aggregate: both numbers can only flatter
   by being larger and both count customers' activity, not the product's
   output on a job. An odometer, absent by precedent.
4. Nav and footer: links and legal text only. No pricing table, no FAQ, no
   limits stated anywhere on the page to test as a refusal.

Entry that could have embarrassed the vendor: none. Searched the full DOM
text, the figure's markup and every `data-text` string, and all 13 seeked
animation frames plus the settled frame.

Verdict: `shows-deliverable` stays `absent`. The page does show a deliverable
in a readable medium (the composed campaign inside the editor demo), so this
is not a medium failure. It fails because the demo is all wins, the
browserbase-com / sentient-os shape, and the only number is an odometer.

Studied-page check: unchanged. The prose's Dec 2014 snapshot, `Send Better
Email` hero, product UI below it, desk still life and single orange CTA all
match snapshot `20141231191003`. One precision note, not drift: the prose
calls the product UI "a real screenshot"; the DOM shows it is an animated
composite of chrome SVG and campaign JPGs, whose settled frame reads as a
screenshot.

**`source` pinned to snapshot `20141231191003`**, the one this file's hole-7 re-pass
landed on. `/web/2014/` resolves to the nearest capture and can move as the
archive adds captures; a pin means every later rater reads the same bytes.
