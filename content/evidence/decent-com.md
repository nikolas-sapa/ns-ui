---
source: https://decent.com
kind: site
cohort: yc-current
verdict: mixed
studied: 2026-10-16
context: [nav, hero, testimonials, features, cta, footer]
signals:
  gradient-blob: absent
  three-card-row: present
  glass-card-overuse: absent
  emoji-as-icon: absent
  generic-sans-default: absent
  symmetric-everything: absent
  badge-pill-spam: absent
  generic-line-icon-set: absent
  testimonial-card-row: present
  indigo-violet-accent: absent
  gradient-fill-cta: absent
  scroll-reveal-blank: absent
  typewriter-headline: present
  stock-photo-generic: absent
  centered-hero-stack: absent
  hero-mockup-float: absent
  asymmetric-split: present
  single-optical-anchor: absent
  type-scale-high-contrast: absent
  editorial-grid-break: absent
  custom-type-pairing: present
  real-product-surface: absent
  shows-deliverable: absent
  density-variation: absent
  one-accent-discipline: absent
  live-claim-control: absent
materials: [single-theme, video-hero]
---

**Capture.** 1440x900. Reused the same-day walk at `~/scratch/antislop/s5/decent-com`:
8 tiles, `clamped: false`, `coverage: 1`, `docH_before` = `docH_after` = 4975,
scroller `window` (the only inner candidate is `html` itself, 4975/900). Re-stitched
with `NS_SESSION=s5`: 2 strips, 4975px against a 4975px page, zero drift. The last
strip ends in the footer (logo, `Decent Labs, Inc., 2261 Market Street STE 70552`,
`Nicholas Soman, California insurance license 0M88002`, About / Blog / Privacy /
Terms / Refer a company). A fresh live probe at 16:00 returned the same 4975px and
the same eight `<section>` boxes, so the walk still reflects the page: hero
y81-816, testimonials y816-1466, "Why small businesses pay too much" y1466-2088,
Reflex case study (navy) y2089-2763, `#rates` plan types y2762-3438,
`#optimization` (navy) y3439-4073, `#closing` y4073-4508, "Not ready yet?" (navy)
y4508-4827, footer to 4975. Single theme: emulating `prefers-color-scheme: dark`
leaves body `rgb(248,252,252)` and the H1 `rgb(21,58,89)`.

The hero's only media is a `<video>` at x820 y305, 508x286, `autoplay muted
controls`, `loop: false`, 41.797s (ffprobe, 1920x1080; the file I re-downloaded is
byte-identical to the walk directory's `dl/hero.mp4`). Because the walker disables
animations and a still shows one frame, the film was read separately: 42 frames at
1 fps. Its poster is `decent-launch-opening-frame.webp`, white type on near-black,
"Health insurance feels like a scam." with "scam." in coral. The live tile caught
it mid-type at "Want to switch plans?|" over a word cloud of plan acronyms.

**Slop signals present (3).**

`three-card-row`. Two instances. The testimonial section opens on three bordered
cards, each 389x331 at y950 (x112, x525, x939, `1px rgb(201,223,224)`); `#rates`
is a 3x2 grid of six plan-type cards (Fully insured / Level-funded / PEO / ICHRA /
Association plan / Self-funded), each about 394px wide, a 22px Fraunces head over
two lines of 14px grey.

`testimonial-card-row`. "What our clients say" is the three equal 389x331 quote
cards plus a "Read 7 more" button. Clicking it is not a carousel: no ancestor
overflows (`scrollWidth` never exceeds `clientWidth`), the document grows from 4975
to 6115px, and seven more cards drop into the same three-column grid at the same
389px width, ten in all. A featured case study follows two sections later (the
Reflex Careers band, one 840px quote under a 48px headline). As on railway-com,
which kept the signal present over a following marquee, the better device follows
the triplet; it does not replace it.

`typewriter-headline`, and this is the value most open to dispute. The H1 is
static: sampled 10 times at 1s intervals, the hero's text block took one state.
The hero's other element, the film, is a typewriter from end to end. Ten phrases
type in with a visible caret on a timer, unprompted: "Health insurance feels like
a scam." / "Your company's rates went up 18%. Again." / "Want to switch plans?
Good luck" / "Plan's not working in February? Fix it next year." / "Decent fixes it
now." / "We price every plan to find the best one for you." / "Then we keep making
it better, all year." / "For your company, and your team." / "Whichever plan you
choose, Decent is free." / "Health insurance is finally Decent." Frames show the
caret mid-word ("Decent |", "We price every |", "Whi|", "He|", "is finall|"). This
is neuron-industries' second clause, a hero panel cycling phrases on a timer, in a
different medium. It counts because the film is the vendor's own launch film
(`decent-launch-final-1080p-native.mp4`), a decision the page makes about itself,
not a product surface the page is showing. It plays once (`loop: false`) and ends
on the logo, so "cycling" here means a timed sequence, not a loop.

**Craft signals present (2).**

`asymmetric-split`. All 44 heading and paragraph blocks compute `text-align:
start`; none is centred. The hero opposes a 660px text column at x112 (H1 660x176,
dek 576px, booking bar 576x72) against the 508px film at x820, 1.3:1. The costs
table splits 486 / 728px (40/60); the Reflex band pins a 720px paragraph at x144
and leaves the right 40% of the band empty; the closing card puts its heading left
and its buttons right. Corpus convention (tsenta, financial-datasets at near-equal
widths) treats a page where nothing is centred and masses oppose across the column
as present. The hero ratio alone is mild; the zero-centred count carries it.

`custom-type-pairing`. Two faces load, `Fraunces Variable` and `Public Sans
Variable` (`document.fonts`, both `loaded`, 100-900). Fraunces, a high-contrast
display serif, carries every heading from the 60px H1 down to the 22px card heads
and the 16px booking-bar line; Public Sans carries body (16px), buttons, table
cells, labels and the 12px table heads. Divided by role and visible together in
every section. Both are open-source; as financial-datasets and railway established,
the licence is irrelevant, the dialogue is the signal. The same fact settles
`generic-sans-default` absent.

**Near-misses.**

- `one-accent-discipline` absent, and it turns on scope. The DOM alone passes: a
  coral `rgb(240,93,95)` on all four CTA fills, the `$4,000 for someone who'd left.`
  head and the 01-04 numerals; a darker tint of the same hue, `rgb(173,57,67)`
  (hue 355° against 359°), on "Not just once a year.", "14% more" and the three ✗;
  the logo's `rgb(230,115,86)`; and `rgb(35,101,66)` only on three ✓ marks paired
  with those ✗, a status pair. The film is not out of scope, for the reason given
  under `typewriter-headline`, and it runs a two-accent keyword system: coral on
  the problem phrases ("scam.", "Again.", "luck", "next year.") and a mint of about
  `rgb(132,216,168)` on the solution phrases ("now.", "for you.", "all year.",
  "team.", "free.", "Decent."), the "Save $11,750 a month" line, the `Saved so far`
  counter, the step-chart line and the Best-fit card border. Measured per 1 fps
  frame (hue 120-170°, chroma ≥60): mint in 17 of 42 frames (s14-36), coral in 19.
  Two hues doing emphasis work in the hero's most prominent object is two accents.
  A rater who scopes the film out gets present; the verdict does not move.
- `type-scale-high-contrast` absent at exactly the threshold. `ladder.cjs`:
  `ratio 3.75`, `maxFs 60`, `bodyFs 16`, `ratioSub 3` (20px hero dek). 3.75 is not
  below the cut, so the ratio does not rule it out; the ladder does. The top is
  flat: H1 60px, then 52px ("Then we keep improving"), 48px x4, 44px, 40px. The H1
  is 1.15x the next head down. Same shape as neuron-industries (60px H1, 57.6px
  section heads, 3.75:1, absent): six near-equal display moments make a two-tier
  scale, not a high-contrast one.
- `hero-mockup-float` absent. The film sits in a floated card (`border-radius:
  12px`, `box-shadow: rgba(0,28,61,.3) 0 20px 35px -20px`, `transform: none`), and
  from about s14 to s28 it shows stylised UI: white plan cards "Renewal / Your
  current plan / $39,180 / +18% this year", "PPO / Same doctors / $37,220", "PEO /
  Bundled with payroll / $34,480", "Level-funded / Refund if claims run low /
  $27,430 / Best fit", then a savings step chart. But the floated object is a film
  player with visible controls, its poster and its first 13s are typography, and
  the UI is a scene inside it rather than the framed thing the hero presents. A
  second rater could reasonably call it present; it is a pre-AI convention expected
  to fail eligibility either way.
- `gradient-blob` absent. The hero field `div.hero__sea-glass` is
  `linear-gradient(118deg, rgb(217,240,241), rgb(236,247,245) 47%,
  rgb(252,246,240))`: one linear wash, peak chroma 24, no blur filter, no gradient
  pseudo-element, no radial shape.
- `density-variation` absent. Ink coverage per section from the stitched strip
  (pixels more than 40 levels off the band's background): testimonials 4.53%,
  costs 3.73%, Reflex 5.84%, plan types 3.43%, `#optimization` 4.70%, closing
  4.37%, "Not ready yet?" 3.26%, footer 3.12%: a 2.7 pp spread. The hero reads 22%
  only because of two dark fills (the film card, 29.8% on its own half, and the navy
  booking bar), not compressed information. Every section has the same build: a
  44-52px heading, a one- or two-line dek, one module of 14-16px text at similar
  padding. No spec table, no small print, no passage that compresses or opens
  against that rhythm (dipole-labs and osseus, not railway or sentient-os).
- `shows-deliverable` absent. The deliverable is a priced plan comparison and
  year-round savings, and it is now shown only inside the film. Every entry there
  flatters: all three alternatives undercut the renewal, the Best-fit card is the
  cheapest, and the savings line only steps down (−$11,750, −$3,200, −$1,800,
  −$3,500/mo) while `Saved so far` only climbs ($512 to $191,100). The costs table
  is ✗ for the reader's old habits and ✓ for Decent's, three rows each. The page's
  two refusals are prose, not artefact: "If your broker already does all this, keep
  them." (the closing heading) and the conflict disclosure "The insurance company
  pays us, so we're free to you." (hero dek). I cannot name an entry inside an
  artefact that could have embarrassed the vendor.
- `real-product-surface` absent. The product is the brokerage plus the `/quote`
  tool. Neither appears: the film's plan cards are stylised motion graphics with
  counter-animated values ("Save $11,396" becomes "$11,750" two frames later), and
  none of their labels ("Same doctors", "Bundled with payroll", "Refund if claims
  run low", "Best fit") occurs in the `/quote` page HTML or its script chunk. The
  testimonials, table and plan-type cards are marketing copy.
- `live-claim-control` absent. On the page the only controls are CTAs, the film's
  native player controls, "Read 7 more" and a renewal-reminder form (work email,
  renewal month). "See real prices in minutes." sits under the CTA, but the tool is
  on `/quote`, a separate page; a same-day capture in the walk directory
  (`dom/q2.png`, not re-run here because the tool saves details as you go) shows
  three non-identifying fields returning "Fully insured plans start at $528 a
  month." with every team-level price behind name and work email. The central
  claim, a better plan for less, cannot be falsified from this page.
- `emoji-as-icon` absent. CDP `getPlatformFontsForNode`: the ✗ renders in Zapf
  Dingbats, the ✓ in Lucida Grande Bold, both fallback text faces coloured by CSS
  (`text-ploy-text-negative` / `-positive`), `aria-hidden`. Dingbats in a
  comparison table, not emoji.
- `badge-pill-spam` absent. Zero pills above y900. The only two pills on the page
  are "YC W22" and "YC P26" in testimonial cards at y1180. "Backed by Y Combinator"
  is a 20px logo image beside text, not a pill.
- `scroll-reveal-blank` absent. 147 text nodes. Walk (700px steps, 900ms settle) and
  dwell (same 8.1s, no scroll) run in parallel after an 8s load: 19 nodes under 8%
  opacity or hidden at load in both (scripts, the 14 `<option>`s of the
  renewal-month select, one visually-hidden "15 minutes to help make your plan
  better"), zero crossing to visible in either, zero transformed.
- `glass-card-overuse` absent: zero `backdrop-filter` surfaces. `gradient-fill-cta`
  absent: all four primary buttons `background-image: none`, flat coral.
  `indigo-violet-accent` absent: the navy `rgb(21,58,89)` is hue 207°.
- `single-optical-anchor` absent, an honest call on an undefined signal. I counted
  three masses in the hero: the H1 (660x176, 60px navy serif), the film card
  (508x286, a near-black or navy fill on the pale wash, the darkest and largest
  solid block above the fold) and the navy booking bar (576x72) under the coral
  CTA. Two of comparable weight compete across the split; no single mass dominates,
  and not for lack of others.

**Verdict: mixed, net +1** (3 slop present, 2 craft present), nowhere near the +4
floor for `slop`. The two scope-sensitive calls do not move it: scoping the film out
turns `typewriter-headline` absent and `one-accent-discipline` present, net −1,
still mixed. Not exemplar either: four of the eight absent craft values are content
choices (no product surface, no deliverable that can count against the vendor, no
claim control, no density contrast), not signals with nowhere to fire. The page is
4975px and fully populated, so thinness is not a factor. It keeps restrained type
and candid prose; it no longer shows the reader anything they could check.

**Drift from the 2026-10-10 study**

Opened only after the front-matter and everything above were written. The old
file profiles net −5 (2 slop, 7 craft present), `exemplar`; this one is net +1
(3 slop, 2 craft), `mixed`. Nine values and the verdict changed. The old file's
own 2026-10-16 re-pass section independently matches this capture (same 4975px,
8 tiles, same film, same `/quote` result, same Q2 absence), so the redesign is
established, not inferred.

- **verdict `exemplar` → `mixed`. Page changed.** The exemplar case rested on the
  "Every option you can get, priced." carrier table (two of six rows `Not
  allowed` / `Too small`), the claims-by-date table ending "$48,000" and the
  "Once, at renewal" / "Year-round" table. All three are gone; the slot holds six
  plan-type glossary cards. Four of the old seven craft values leaned on them.
- **`shows-deliverable` present → absent. Page changed.** The named entry no
  longer exists ("Not allowed", "Too small", "Every option", "Illustrative" all
  return no match, per the re-pass and my own reading). Nothing on the new page
  replaces it; the film's plan cards are all wins.
- **`density-variation` present → absent. Page changed.** The dense passages were
  the three tables; the replacement cards and lists hold 3.1-5.8% ink across every
  body section.
- **`editorial-grid-break` present → absent. Page changed.** The old break was the
  case-study band's pull-statement against a 01-04 list whose top rule hung into
  the gutter. The Reflex band is now a single left-pinned text column, and the
  01-04 list moved into `#optimization`, where its rules start at x740 with its
  own column.
- **`one-accent-discipline` present → absent. Page changed, plus a scope call.**
  The DOM's accents are what the old file described (one coral, navy as ground).
  What is new is the hero film's mint second accent on 17 of 42 seconds. The old
  hero panel was a typed DOM panel with no green that the old prose records. If
  the film is scoped out, this reverts to present.
- **`three-card-row` absent → present. Page changed.** The six plan-type cards
  (3x2) replaced the carrier-table band, and the testimonials became one row of
  three. The old 3x2 testimonial grid might itself have qualified, but that page
  cannot be re-measured, so I attribute this to the redesign.
- **`testimonial-card-row` absent → present. Page changed, and the old call is
  doubtful.** The section went from six cards in a 3x2 grid to three in a row plus
  "Read 7 more" (ten in all when expanded). Separately, the old reasoning, "six
  cards in a 3x2 grid ... not a triplet", answers the pre-v3 `testimonial-card-
  triplet` question; v3's definition is "3+ equal-weight quote cards", which a
  3x2 grid of six equal cards also meets. That page cannot be re-measured, so
  this is flagged, not ruled.
- **`hero-mockup-float` present → absent. Page changed.** The old hero panel was a
  black card holding a white "Your 2027 rates / $36,678 / per month" UI card with
  a "+18%" chip, a mock product card floated in the hero. The panel is now a film
  player with native controls whose UI scenes run about s14-28 of 41.8s. I record
  it as a near-miss; a second rater could keep it present.
- **`type-scale-high-contrast` present → absent. Old rating most likely wrong.**
  The H1 was 60px then and is 60px now; the old prose gives "roughly 60px against
  17px" (3.5:1) and no other criterion. Today's `ladder.cjs` reads 3.75:1 against
  16px body, the threshold itself. The vocabulary already lists decent-com among
  the five files at exactly 3.75 that split 3-2 with no stated reason. At that
  ratio, with section heads at 44-52px, the call follows neuron-industries
  (identical 60px / 3.75:1 shape, absent). Not attributable to the redesign: the
  old page's section-head sizes are unrecorded, so I cannot prove its top was
  equally flat, but nothing in the old prose argues past the ratio.
- **`typewriter-headline` present → present, basis changed.** Then a DOM panel
  typing "went up 18%. Again." on a loop; now the same lines typed inside a
  41.8s film that plays once. Same signal, different medium.
- **Unchanged:** the other 13 slop values absent, `asymmetric-split` and
  `custom-type-pairing` present (same Fraunces + Public Sans, same left-weighted
  hero), `single-optical-anchor`, `real-product-surface` and `live-claim-control`
  absent. `context` holds the same six values.
- **`materials`: `video-hero` added (page changed); `commissioned-photo` dropped,
  which is a convention difference, not a page change.** The founder photo the old
  file cited is still there, now 48x48 in the booking bar, beside four 48px
  customer headshots. Following railway-com and clerk-com, which list no photo
  material for quote avatars, I do not count avatars as a material; the corpus
  files that carry `commissioned-photo` (mailchimp-2014, squarespace-2014,
  stripe-com, neuron-industries) each have an editorial photograph. Orchestrator's
  call if the convention should go the other way.

**Superseded study (2026-10-10, verdict `exemplar`).** Everything below describes the page as it was before the redesign that forced the re-study above, and is kept as the record of that page. Its signal values, which the front-matter no longer carries:

```
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
typewriter-headline: present
stock-photo-generic: absent
centered-hero-stack: absent
hero-mockup-float: present
asymmetric-split: present
single-optical-anchor: absent
type-scale-high-contrast: present
editorial-grid-break: present
custom-type-pairing: present
real-product-surface: absent
shows-deliverable: present
density-variation: present
one-accent-discipline: present
live-claim-control: absent
```

AI-native health insurance brokerage for small businesses, YC F26. Three colours,
two families, and a page that runs on tables instead of feature cards.

The hero is a 55/45 split, unequal and left-weighted: a three-line display serif
headline with the third line ("Not just once a year.") in coral, a four-line body
paragraph at a tight measure, a coral CTA, and a navy bar carrying the founder's
actual photograph, name and title ("Nick Soman · Founder & CEO") with a "Book 15
minutes" button. The right side holds a black panel that is not a dashboard: a
small white card reading "Your 2027 rates / $36,678 / per month" and a line of
white text being typed in. Across two captures the panel reads "$36,678 … went u|"
and "$39,180 … went up 18%. Again." with a "+18%" chip, so it is a timed typewriter
loop — a product panel cycling phrases, recorded as typewriter-headline present.
live-claim-control is absent: nothing on the page lets a visitor test the rate
claim; the CTA opens a quote flow elsewhere.

Type is a high-contrast transitional display serif against a humanist sans for body
and all table text. Both families appear throughout; headline to body is roughly
60px against 17px.

The case-study band is where the grid breaks. A huge serif pull-statement sits in
the left column ("Reflex was facing a 15% rate increase. We found them a richer
plan for 10% less than they pay today.") against a numbered 01-04 list in the
right, with the rule above the list hanging into the gutter rather than aligning to
the text column.

real-product-screenshot is recorded absent deliberately: the page shows the
deliverable rather than a product UI. "Every option you can get, priced." renders a
six-row comparison table with real carrier names (Anthem Blue Cross, Blue Shield of
California, UnitedHealthcare, Aetna, Kaiser Permanente, Sutter Health Plus, Chinese
Community Health Plan, Health Net through CaliforniaChoice), a "Who and why" column
of plain-language reasoning, and a result column that includes two refusals ("Not
allowed", "Too small") alongside four "Quoted". It is labelled "Illustrative
report only. Availability varies by company." A second table lists a plan year of
claims by date, type and amount ending at "$48,000", and a third compares timing
("Once, at renewal" against "Year-round"). That is far more density than a
screenshot would carry, and it is not a dashboard.

Testimonials are six cards in a 3x2 grid with named titles and companies, not a
triplet.

One accent, a single coral, on CTAs, the emphasis line and the numbered step
markers. Navy is a ground for full-bleed bands and headline ink, not a second
action colour. Single theme: the light-scheme and dark-scheme captures differ only
in the typewriter's frame, so the site ignores prefers-color-scheme rather than
shipping a neglected dark mode.

**v4 change 3b surface re-pass**

Re-rated 2026-10-16 from the live page. Final values: real-product-surface
`absent` (unchanged), shows-deliverable `absent` (flipped from `present`). The
flip is drift, not a reinterpretation: the deliverable band recorded above has
been removed in a redesign.

Capture: shoot-tiles walk, scroller `window`, 8 tiles, `clamped: false`,
`coverage: 1`, docH_before 4975 = docH_after 4975, stitched to 2 strips
(1440x4400 + 1440x575) matching page height. The last strip ends in the footer
(logo, "Decent Labs, Inc., 2261 Market Street STE 70552, San Francisco, CA 94114",
"Nicholas Soman, California insurance license 0M88002", About / Blog / Privacy /
Terms / Refer a company). Text and y-coordinates read from the DOM with
Playwright; the hero video is frozen in the stills, so it was downloaded and
stepped at 1 fps with ffmpeg.

Candidate product surfaces:
- y=305, x=820, 508x286, video: the hero `<video>` (autoplay, muted, controls,
  no loop), `decent-launch-final-1080p-native.mp4`, 1920x1080, 41.8 s, its
  aria-label carrying the script. A kinetic-type motion graphic: "Health insurance
  feels like a scam.", a white card "Your 2027 rates / $39,160 / per month"
  counting up, "Your company's rates went up 18%. Again.", an acronym cloud under
  "Want to switch plans?" ending "Good luck", a Feb-to-Jan month strip with "Plan's
  not working in February? Fix it next year.", then four plan cards (t≈17-20 s):
  "Renewal / Your current plan / $39,180 / per month / +18% this year", "PPO /
  Same doctors / $37,220", "PEO / Bundled with payroll / $34,480", "Level-funded /
  Refund if claims run low / $27,430 / Best fit", over "Save $11,750 a month";
  then a step-down savings line (t≈20-27 s) with chips "Better plan at renewal
  -$11,750/mo Lower deductibles", "Surgery center contract -$3,200/mo $0 out of
  pocket", "New imaging network -$1,800/mo $0 out of pocket", "Smarter Rx sourcing
  -$3,500/mo Lower drug copays", its counter ending "Saved so far: $191,100";
  closes on "Whichever plan you choose, Decent is free." and "Health insurance is
  finally Decent." Not faithful. Checked against the real product, the public
  quote tool at /quote: step 1 driven with ZIP 94114, 2-10 employees, January 1,
  2027 ("Fully insured plans start at $528 a month."), stopped at step 2 because
  it asks for name and work email. The tool is set in Fraunces + Public Sans; the
  video's cards are in a geometric sans. The tool's inline results renderer labels
  its options "Payroll companies with group plans / PEOs", "Plans with money back
  / Level funded", "A monthly allowance / ICHRA", "Trade group plans", "Paying
  claims yourself / Self funded" and totals as "Total a month"; "Same doctors",
  "Bundled with payroll", "Refund if claims run low", "Your current plan", "Best
  fit" and "Saved so far" occur 0 times in /quote's HTML or its JS bundle. The
  /about launch cut (`decent-launch-a9.mp4`, 55.6 s) reuses the same cards with
  other figures ($38,180 / $36,300 / $33,600 / $26,730), so they are animated
  assets with per-cut numbers, not a product screen. The savings line has no
  chrome and depicts a year-round service, not a UI.
- y=1724, DOM: "What costs you more / What we do" two-column table. Marketing
  comparison, not product.
- y=3021, DOM: "We check all six for you:" six plan-type cards (Fully insured,
  Level-funded, PEO, ICHRA, Association plan, Self-funded). Glossary, not product.
- y=3711, DOM: "$4,000 for someone who'd left." card. Anecdote, not product.
- No raster screenshot and no capture of /quote or of a report anywhere. The only
  images are the founder photo and four testimonial headshots.

Q1 verdict: absent. The one product-looking surface is the hero motion graphic,
and every check against the real product (typeface, option labels, figures that
change between cuts) marks it as an illustration of the pitch, not a capture or a
faithful rebuild. A real product UI exists publicly at /quote, so this is a page
choice, not a category fact.

Q2: searched the full DOM text and every second of the hero video for an entry
that counts against Decent (a declined option, an option that cannot be had, a
cost, a miss). None. The hero's plan cards crown the cheapest option "Best fit";
the only coral figure, "+18% this year", is aimed at the incumbent renewal, not at
Decent; the savings line only steps down and its counter only rises. The y=1724
table puts ✗ on every left cell and ✓ on every right. The Reflex case study
(y=2185, "Texas startup Reflex Careers faced a 15% increase. Now they pay 10% less
than last year.") and "$4,000 for someone who'd left." are wins. "If your broker
already does all this, keep them." (y=4218) is the nearest thing to a concession,
but it is page copy rather than an artefact and reads as a differentiator ("We'd
like to meet them. If not, let's get you a better plan."), so it does not count.
The hero video is a readable page-authored rendering of the output, so the medium
qualifies; it fails on stance, every value a win.

Q2 verdict: absent, flipped. The entry the earlier prose named, two of six carrier
rows reading "Not allowed" / "Too small" under "Every option you can get,
priced.", no longer exists: "Every option", "Not allowed", "Too small", "Quoted",
"Illustrative", "48,000", "Anthem", "Kaiser" and "Who and why" all return no match
in the live DOM or the raw HTML. Refusals survive only in the quote tool's
renderer, off this page ("Not a fit at your size.", "Not a fit. Too few people
enrolled.", "Not available in " + state, "Not a fit. Too few people to absorb a
bad year."), and are not scored here. Audio of the hero video was not transcribed
(no speech-to-text available); it plays muted by default and its aria-label
matches the on-screen text.

Drift from the earlier prose (redesign since 2026-10-10):
- Gone: the "Every option you can get, priced." band, its carrier table, "Who and
  why" column and "Illustrative report only. Availability varies by company."
  label, the claims-by-date table ending "$48,000", and the "Once, at renewal" /
  "Year-round" table. The slot now holds "One comparison, every kind of plan."
  with six plan-type cards.
- The hero's right panel is now the launch video, not a typed panel; "Your 2027
  rates" and "went up 18%. Again." survive inside it, typed on.
- Testimonials are three cards in one row plus "Read 7 more", not six in a 3x2
  grid.
- The case-study headline now reads "Texas startup Reflex Careers faced a 15%
  increase. Now they pay 10% less than last year."; the 01-04 list now sits in
  "Then we keep improving your plan, all year." beside the "$4,000" card.
- New: "Why small businesses pay too much for insurance" (KFF, "14% more") with
  the ✗/✓ table, and a "Not ready yet?" renewal-month form above the footer.
- Not re-rated here: other signals (testimonial-card-row, typewriter-headline,
  density-variation and others) and the `exemplar` verdict were set against the
  old page; the exemplar rationale leaned on the removed band.

**Orchestrator ruling on the re-pass above — `shows-deliverable` restored to
`present`, and the section above kept as a dated drift record.** The re-pass
rated the 2026-10-16 redesign, while this file's verdict and every other signal
rate the page as studied on 2026-10-10. Flipping one signal to the redesign
would leave the file describing two pages at once. The rule for every re-pass
from here: **a re-pass re-interprets the page as studied; a redesign triggers a
full re-study (all signals, verdict, `studied` date), never a single-signal
flip.**

Under that rule the question is whether the 2026-10-10 content passes the new
procedure, and it does: the carrier table answers "Every option you can get,
priced." with two of six rows `Not allowed` / `Too small`, an entry that narrows
a claim the page would rather leave broad. The independent hole-2 audit reached
the same verdict, SURVIVES, from this file's prose.

**Queued: a full re-study of decent-com.** The redesign removed the band that
carried this file's `exemplar` case, so the verdict may not survive it.
