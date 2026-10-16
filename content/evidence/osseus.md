---
source: https://osseus.ai/
kind: site
cohort: yc-current
verdict: mixed
studied: 2026-10-14
context: [hero, nav, cta, footer, team]
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
  stock-photo-generic: present
  centered-hero-stack: present
  hero-mockup-float: absent
  asymmetric-split: present
  single-optical-anchor: present
  type-scale-high-contrast: absent
  editorial-grid-break: absent
  custom-type-pairing: absent
  real-product-screenshot: absent
  shows-deliverable: absent
  density-variation: absent
  one-accent-discipline: present
  live-claim-control: absent
materials: [single-theme, stock-photo]
---
Captured at 1440x900 in 700px steps with animations disabled; full page 2654px,
four tiles, stitched to one strip. The shortest page in this cohort and the one
that most sharply poses the question the net score cannot answer on its own:
whether a low slop count is restraint or just absence of surface area. Here it is
substantially the second, and the measurements say so.

**Read the strip with one correction.** `osseus-strip0.png` is 3000px for a
2654px page and contains a 346px duplicated band — "A continuous data flywheel"
appears twice in the strip and once on the page. The cause is the walk's final
step: max scroll is 2654-900 = 1754px, but the fourth step wanted 2100px, so the
tile was clamped and the stitcher removed its fixed 200px overlap instead of the
actual 346px. Row-signature matching confirms it: 159 duplicate rows at a
dominant offset of exactly 346 = 3000-2654. The DOM carries one flywheel heading,
at y1806. Strip coordinates below y2169 are page coordinates; everything after is
page+346.

## Slop signals present

**`stock-photo-generic`.** Three photographs, and that is every image on the
page: `hero-valley-full.webp` (1067x534 at y115, scaled
`matrix(1.15, 0, 0, 1.15, 0, 0)`), `reflecting-pool.webp` (992x410 at y908) and
`garden-labyrinth.webp` (992x320 at y2080). All three carry `alt=""` — declared
decorative by the page itself. All three are neoclassical-Arcadian scenery: a
colonnade over a hazy valley, an arcade over still water, a clipped formal garden.
None contains medicine, biology, data, a patient, a molecule, an instrument or a
product. The filenames are generic place-nouns and the copy never refers to
anything classical, so there is no brand metaphor being served here the way
railway's commissioned night-train sky serves one. This fires the signal's first
trigger — imagery that could front a hedge fund, a law firm or a meditation app
without a single edit — and it is worth being explicit that it fires on *that*
trigger alone.

The signal's second trigger, "stock the type cannot survive on so a scrim is
bolted over it", is not merely absent but inverted, and this is the page's most
skilful decision. The 60.8px headline sits in the gap between the two column
pairs, where the photograph is pale haze: the ground directly behind the type
measures (223,218,206) against a page field of (238,235,224), 15/255 darker,
while the column shafts to either side measure (169,158,134). The type is sited
where the image has no detail, so no scrim is needed. The image also feathers
rather than cropping — painted extent by row runs 918, 924, 922, 922, 915, 907,
887px and then nothing by y560, a soft mask with no hard edge anywhere. This is
v3's unadopted `type-sited-in-image` candidate, executed cleanly, on imagery that
says nothing.

**`centered-hero-stack`.** "We're building medical superintelligence." sets at
60.8px/400 Garamond, `letter-spacing: -2.128px`, `text-align: center`, x=368
w=704 in a 1440 frame, over a 20.8px centered subhead at x=432 w=576. Both share
the centre axis at x=720. There are no hero buttons, so the stack is two layers
rather than the usual three — but the shape is the shape, and it is the only
centred composition on the page. Note that this is the signal v3 expects to fail
rule-eligibility at 5/7 in `pre-ai-2015`, which leaves `stock-photo-generic` as
the page's only rule-eligible slop present.

## Craft signals present

**`asymmetric-split`, measured four times.** Every body section pins a heading
block at x=256, w=293 and runs body at x=597, w=587 — a 1:2 ratio inside a 928px
content column (x=256 to x=1184), repeated at y956 ("Health, biology and
alignment"), y1366 ("More diverse data, better models"), y1806 ("A continuous
data flywheel") and y2128 ("Our team"). The narrow column is never balanced and
never filled; two of the four sections wash a photograph behind it at low
contrast, two leave it bare. Seven of the page's eight headings are
`text-align: start`; the one centred heading is the hero. The closing CTA is
asymmetric too: the two-line invitation sits left at x=256, the button right at
x=993-1183.

**`one-accent-discipline`, with the whole chroma budget accounted for.** A real
chroma scan of the strip (480,000 samples at every third pixel, chroma = max-min
in RGB, threshold 25) resolves to four non-empty hue buckets, and each one maps
to a named element:

- 30-60 deg, 22,927 samples (4.776%), bbox x270-1161 y126-2676 — the three photographs
- 90-120 deg, 974 samples (0.203%), bbox **x993-1182 y2826-2871** — the CTA button, independently measured at x993-1183 y2825-2872, 191x48px
- 0-30 deg, 39 samples (0.008%) — the 17x17 YC mark at y51, plus a handful of hero-image pixels
- 60-90 deg, 2 samples — noise

That is one accent: a flat dark green sampling (87,102,80) at hue 101 deg,
occurring exactly once on the page, on the single conversion button,
right-aligned flush to the content column's edge. Everything else chromatic is a
photograph. Body and heading ink is one desaturated near-black green family —
rgb(23,27,20) primary, rgb(64,72,59) body, rgb(91,99,87) for the eyebrow and the
YC line — on a warm paper field of (238,235,224). The YC mark's orange is
third-party attribution at 289px2 on a 3.8M px2 page and is not counted against
the signal, on the same reading that excluded railway's in-capture chart palette.

**`single-optical-anchor`.** The first viewport contains the 60.8px display line,
a 20.8px subhead, a 16.8px nav pair and a 14.4px YC line. Nothing else: zero
buttons, zero pills, zero mockup, one 17x17 SVG. The next type size down anywhere
on the page is 30.4px, a 2:1 step, and it is below the fold. There is no second
mass competing with the headline.

## Near-misses and what settled them

**The probe's 89.8% saturation is a measurement artifact, not a coloured field.**
`probe3.cjs` computes HSL saturation as (mx-mn)/(255-abs(mx+mn-255)), which
diverges near white: a cream at (232,232,216) is 16/255 off neutral and scores
0.258, over the 0.18 threshold. So 89.75 of the 89.8 landing in one warm bucket
records only that the paper is warm. Real chroma puts 82.3% of the page at chroma
8-15 and only 5.0% above chroma 25. The saturation is a background field — cream
paper — and it is emphatically not an accent. lumHist agrees: 69.7% of pixels at
luminance 224-239, 87.4% above 192, lumMax 234.5.

**`indigo-violet-accent` absent at zero.** Hue buckets 8 and 9 (240-300 deg)
contain 0 and 0 samples. Not low — zero.

**`custom-type-pairing` absent, and `generic-sans-default` absent, from the same
fact.** `faces` lists exactly two entries and they are the same face: `garamond`
and `garamond Fallback`, resolving through
`garamond, "garamond Fallback", "EB Garamond", Garamond, "Times New Roman", serif`.
One family carries the entire ladder — 60.8px display, 30.4px section heads,
25.6px subsection heads, 20.8px lead, 19.2px body, 17.6px eyebrow, 16.8px nav,
14.4px attribution — at weight 400 throughout, with one 20.8px run at 500. A
serif body at 19.2px is not a default grotesque, so `generic-sans-default` is
absent; but one voice is not two in dialogue, so `custom-type-pairing` is absent
as well. Both confirmed off the ladder rather than inferred from the face list.
Setting a frontier-AI landing page in EB Garamond is a real decision and the
vocabulary currently cannot credit it, because the slot it would occupy requires
a second family the page deliberately does not have.

**`type-scale-high-contrast` absent at 3.17:1.** 60.8px display against 19.2px
body; 2.92:1 against the 20.8px hero subhead. Below railway, which scored absent
at 3.4:1 against body.

**`three-card-row` absent on both count and construction.** The one row structure
on the page is a 2-up at y655 with equal 464px widths ("Datasets" / "Interactive
environments"). Two is not three. It is also not cards: the columns are separated
by a hairline vertical rule under a hairline horizontal rule, with no fill, radius
or shadow — the probe records `card: "|B"` before the scroll walk and `"|"` after,
a border, not a surface.

**`editorial-grid-break` absent by measurement, not impression.** Nothing on the
page paints outside the 928px content column. The hero image is the only
candidate: its element box is 1067x534 scaled 1.15 = 1227px, which would bleed to
roughly x107-1334, but the painted extent never exceeds x258-1181 at any row, so
the image is clipped to the column with the scale absorbed inside it. Nav runs
x256-1184, the CTA button ends at x1183, the footer links sit at the same two
edges. The margins are empty and stay empty.

**`scroll-reveal-blank` absent, confirmed from both sides.** `hiddenText` is 0
before the walk and 0 after; `docH` is 2654 before and after; `innerTextLen` is
3301 before and after. Independently, the server HTML with scripts and styles
stripped yields 3324 characters against 3301 rendered, so effectively all of the
page's text ships in the initial document. Nothing is gated behind scroll, and
nothing is gated behind JS either.

**`hero-mockup-float` absent at `shadow=none`** on the single transformed element,
and there is no product UI anywhere to float.

**`real-product-screenshot` and `artifact-not-dashboard` both absent, which is
the finding.** This is not the mutual-exclusion convention firing; neither
condition is met. The page shows no UI and no deliverable. Osseus sells medical
datasets, evaluations and RL environments, and the page contains no dataset
sample, no eval, no benchmark, no refusal transcript, no schema, no chart and no
number of any kind — the strongest discriminator in the vocabulary has nothing to
grade. `live-claim-control` is absent on `controls: []`; there is no interactive
element on the page other than seven text links and one button.

**`density-variation` absent.** Section heading gaps run 410, 440 and 322px and
every body block is 19.2px prose in one or two paragraphs at a single 587px
measure. There is no dense passage anywhere to contrast with the airy ones — no
table, list, code block, caption or small print. The page has one texture.

**`symmetric-everything` absent** despite the centred hero: four left-weighted
1:2 splits, seven of eight headings start-aligned, and an asymmetric closing CTA.

**Everything else is absent at zero, and the zeros are the honest story.**
`glass: 0` backdrop-filter surfaces. `bigGrad: []`, `btnGrad: []`, `gradText: []`
— no gradient anywhere on the page, blob or fill. `pills: []`. `emoji: []`.
`svgCount: 1`, a 17x17 YC mark, so `generic-line-icon-set` cannot fire for want
of a set. `setInterval: 0` and `heroTextStable: true`. `pcsRules: 0` and
`darkHooks: 0`, single theme. No testimonials section, no logo wall, no pricing,
no FAQ — these are `absent`, not `unresolved`, because the page is 2654px and
fully readable top to bottom in one strip; there is no section I could not read.

## Why `mixed` and not `exemplar`

Net is -1: two slop present against three craft present. That falls inside the
`mixed` band (-5..+4) and outside `exemplar` (-7..-2), so the distribution
settles it without a judgment call. The qualitative reading agrees, and it is
worth stating plainly because the signal profile looks exemplary at a glance:
**seven of ten craft signals are absent.** The page declines the template and
substitutes very little. 2654px of page, 3301 characters of text, eight headings,
one row, three decorative photographs, one SVG, one button, zero numbers.

Most of the thirteen absent slop signals are absent for want of surface area
rather than for restraint — there are no cards to be generic, no icon set to be
uniform, no testimonials to be a triplet, no product panel to float. Set against
railway at 12212px with four real product captures and a split-flap telemetry
board, Osseus has not solved the problems those signals detect; it has not
reached them. Two things here are genuine craft rather than vacancy and would
survive on a longer page: the fully-accounted single-accent chroma budget, and
siting 60.8px type in the one part of a photograph that has no detail. The serif
is a third, which the vocabulary cannot currently credit.
