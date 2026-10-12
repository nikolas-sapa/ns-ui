---
title: "Heroku's 2014 homepage runs seven of the sixteen slop signals. Nobody prompted it."
date: 2026-10-12
description: "I built a 2014 control cohort to test whether AI flattened web design. Across 25 sites the template turns out to predate the accusation by about a decade, and the cleanest result I had at n=20 did not survive finishing the corpus."
---
"AI makes every website look the same" is the most repeated claim in design right now, and as stated it cannot be tested.

The problem is the missing control: if you only look at pages built in 2026, you cannot separate "models flattened web design" from "web design was already flat and the template changed". Both predict what you are looking at.

So I built one. Twenty-five homepages, each captured in a single 1440x900 viewport, scored against a closed list of 26 signals: 16 I expected to mark slop, 10 to mark craft. Three cohorts:

- **7 pages from 2014**, from December 2014 and January 2015 Wayback snapshots. Heroku, Stripe, GitHub, Dropbox, Mailchimp, Basecamp, Squarespace.
- **8 current YC Fall 2026 company sites.**
- **10 current developer-tool sites**: Vercel, Stripe, Linear, Anthropic, Modal, Railway, Clerk, Resend, Browserbase, Cursor.

Seven, eight and ten. I will keep repeating those: every number below is a count out of a single digit, not a rate with an error bar.

## The control cohort already runs the template

The clearest single result is Heroku's 2014 homepage, which runs **seven of the sixteen slop signals at once**.

A centered hero, "Focus on the app" at roughly 30px, one centered ghost button, over a purple gradient field. Two mirrored panels below it, each with its own centered headline, centered subhead and centered arrow link, with a device mockup floating in both. Then three stat columns, each under a line illustration in the same purple at the same weight. Then a greyscale logo wall of forty marks. Then a full-width purple testimonial band with decorative quote glyphs. Then five feature rows, each under an isometric line icon from the same set.

The hue is the part I did not expect. The hero field samples #5b4e91 to #61519c, the bottom CTA is a flat #6e5baa, and the testimonial band, every stat illustration and every feature icon sit in the same violet. One accent, eleven years before indigo-violet became a tell people screenshot as proof of generated design.

Stripe's 2014 page is close behind at six: multi-hue gradient under the whole viewport, a tablet and a credit card floating clipped at the right edge, three feature cards each under a circular green line icon, a grey logo wall, a rotating hero carousel.

Nobody prompted either page.

## Nine signals, counted out of 7, 8 and 10

Present out of the cohort:

| signal | 2014 (n=7) | YC Fall 2026 (n=8) | dev tools (n=10) |
|---|---|---|---|
| `centered-hero-stack` | 5/7 | 2/8 | 3/10 |
| `generic-line-icon-set` | 3/7 | 2/8 | 2/10 |
| `three-card-row` | 2/7 | 1/8 | 5/10 |
| `gradient-blob` | 2/7 | 3/8 | 2/10 |
| `hero-mockup-float` | 3/7 | 5/8 | 1/10 |
| `type-scale-high-contrast` (craft) | 3/7 | 7/8 | 5/10 |
| `one-accent-discipline` (craft) | 5/7 | 7/8 | 6/10 |
| `asymmetric-split` (craft) | 3/7 | 5/8 | 10/10 |
| `editorial-grid-break` (craft) | 0/7 | 3/8 | 7/10 |

Not one slop signal in the vocabulary rises across twelve years. The ones that move, move down. The craft signals climb instead, and `editorial-grid-break`, an element pinned outside the content column, fires zero times in 2014 and seven times out of ten now.

Four of the sixteen slop signals fired zero times in 25 sites. Those four describe something I believed rather than something I found.

## Centering is not the defect

Mailchimp's 2014 page is centered, and it is the strongest page in the control cohort.

"Send Better Email" sits at roughly 52px against 17px body copy, close to 3:1, the highest ratio in the cohort. Under it is the actual product as a real screenshot: small, unglamorous, no device frame, no tilt, no floating shadow. The page's whole surface is one commissioned still life, a framed chimp print, a live canary, pencils, an espresso cup, lit as one continuous scene the content sits inside rather than on top of. One orange CTA is the only saturated element. Nothing about it is reusable by anyone else, which is what makes it work.

Basecamp 2014 is centered too, and stranger: one 600px column holding the whole page, then six headed sections of running prose at 14px, no cards and no icons anywhere. Same signal as Heroku's hero, opposite outcome. The defect was never the centering. It is what gets stacked on top of it.

## hero-mockup-float fires on exemplars and slop alike

I spent a while thinking `hero-mockup-float` was the one slop move genuinely rising, 3/7 to 5/8. It does not survive the control.

`hero-mockup-float` fires on three of the seven 2014 pages: one rated slop, two rated mixed. In the YC cohort it fires on five of eight: two exemplars, two mixed, one slop. It fires on good and bad pages alike, and was already standard in 43% of the 2014 cohort.

Squarespace 2014 is the clearest case: a MacBook floating dead centre with a real customer site on its screen, where the signal does real work, because the product is websites.

That is not a declining trend with one exception. It is a signal that measures "is this a website" rather than "is this slop", and it should never have been in the list.

## What the dev-tools cohort actually shows

The tempting story is that the strongest current builders dropped the template. The counts do not say that. `three-card-row` is 5/10 in the dev-tools cohort against 2/7 in 2014, which is up, and `centered-hero-stack` is 3/10 rather than zero.

What moved is the composition around them. Mean slop signals per page runs 3.14 in 2014, 2.62 in the YC cohort, 2.40 in dev tools: barely a slope. Mean craft runs 3.71, 5.38, 5.90. Those pages did not abandon the conventional moves. They stopped running them bare.

## At 25 files the slop band sits inside the mixed band

At 20 files I had a clean separation: exemplars at 0 to 2 slop signals, mixed at 0 to 4, the two slop pages at 5 and 6. I wrote it up as the central finding.

Finishing the corpus to 25 and completing a vocabulary re-pass broke it. Exemplars now run 0 to 3, mixed runs 1 to 7, and the two slop pages sit at 6 and 7. The slop band is now entirely inside the mixed band.

Railway's homepage carries seven slop signals, the same count as Heroku 2014, and was rated mixed, because it also pins a 1px rail with a travelling illustrated train down all 12,212px outside the content column and renders its deploy count as a mechanical split-flap departure board.

Two things moved the bands: five new files, and two signals added in a re-pass that raised Heroku from six to seven. Both, not just the files.

And the separation was never independent evidence anyway. The signals and the verdict were set by the same rater in the same pass, so "slop is a density" is partly circular by construction: it may be measuring rater consistency rather than a property of the pages. The blind re-rate, one agent setting signals and a second assigning verdicts without seeing them, has not run. Until it does, the density pattern is a hypothesis.

The honest state of what I am building from this: the pipeline that turns these evidence files into rules an agent can read currently authors **zero** rules. All 26 signals report the same reason, that the corpus holds 2 pages rated slop and the separation test requires 3. The build passes empty, which is the gate working.

## What seven 2014 pages bought, and what they cannot settle

Everything above is 25 pages, one viewport each, no narrow-width capture at all, so `asymmetric-split` at 10/10 may not survive at phone width. One rater produced the 2014 cohort with no second read.

What the control bought, for seven pages of work, is the ability to tell two explanations apart. "AI flattened web design" predicts a 2014 cohort that looks varied. Mine, at n=7, has the highest mean slop count of the three, 3.14 against 2.62 (n=8) and 2.40 (n=10).

Treat the ordering as weak: that is a half-signal gap across samples of 7, 8 and 10, and it would flip if one 2014 page were re-rated. The cohort also contains a page running seven template moves at once, and that is the part that does not depend on the average.

So the convergent template is not a model artifact. It is 2014-era marketing-site convention, learned by the models from the pages I just screenshotted, and the strongest current builders are measurably further from it than their predecessors were.

That is a smaller claim than the accusation. It is also the one I can show you the counts for.

Registry: [github.com/nikolas-sapa/ns-ui](https://github.com/nikolas-sapa/ns-ui) (MIT)
Live: [design.helpmarq.com](https://design.helpmarq.com)
