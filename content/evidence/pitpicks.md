---
source: https://pitpicks.com/
kind: site
cohort: ai-builder
verdict: mixed
studied: 2026-10-19
context: [hero, nav, features, cta, footer, dashboard]
signals:
  gradient-blob: present
  three-card-row: absent
  glass-card-overuse: present
  emoji-as-icon: absent
  generic-sans-default: absent
  symmetric-everything: absent
  badge-pill-spam: absent
  generic-line-icon-set: absent
  testimonial-card-row: absent
  indigo-violet-accent: absent
  gradient-fill-cta: absent
  scroll-reveal-blank: present
  typewriter-headline: absent
  stock-photo-generic: absent
  centered-hero-stack: present
  hero-mockup-float: absent
  asymmetric-split: present
  single-optical-anchor: present
  type-scale-high-contrast: present
  editorial-grid-break: absent
  custom-type-pairing: present
  real-product-surface: present
  shows-deliverable: absent
  density-variation: present
  one-accent-discipline: present
  live-claim-control: absent
materials: [single-theme, commissioned-photo, illustration, dual-theme]
---

**Sampling: random draw.** One of twelve drawn with seed 20261019 from the twenty-two gallery sites left after the first draw (same pre-stated exclusions). `gunsvzombies`, drawn first, returned 404 (project deleted) and was replaced from the same seed by `openmark`. Not chosen on any signal.

Rated by three independent blind raters on 2026-10-19, none reading another's draft. Raters A and B split on the verdict, so a third was run, as for provenmetal. **Verdict settled 2-1 for `mixed`** (rater A said `exemplar`). Each signal takes the value at least two raters gave; 4 were 2-1: `badge-pill-spam` A present, B absent, C absent; `scroll-reveal-blank` A absent, B present, C present; `editorial-grid-break` A present, B absent, C absent; `real-product-surface` A absent, B present, C present. All three write-ups follow in full.

**Rater A.**

# PitPicks — new-page study, 2026-10-18

## Capture facts

1440x900 viewport, page height 5929px. 9 tiles, `clamped: false`, `coverage: 1`, every landing pixel matches the requested one except the last (asked 5600, landed 5029, the browser's max scroll). Stitched to 2 strips (1440x4400 and 1440x1529); stitched height 5929 equals settled page height exactly. Strip 2 ends in the footer: "PITPICKS © 2026 · All rights reserved" at y≈5797 under a checkered zigzag rule.

The page is a client-rendered single-page app: the raw document is 3466 bytes with no body copy and a 203KB bundle. That matters only for the "reading without JS" claim, which belongs to no signal here (see `scroll-reveal-blank` below).

## Slop signals present (4)

**`glass-card-overuse` — present, 234 `backdrop-filter` surfaces.** Threshold is 3+. Marketing chrome accounts for the nav pill (`blur(24px)` on `bg-card/60` at y24), the "See how it works" pill (`blur(24px)` at y409) and 21 line-up chips at y1044-1300 (`blur(24px)` each, one per team logo and driver portrait). The other ~210 are inside the three product panels, which SCOPE excludes from chrome scoring, but the signal is already past its threshold on chrome alone. All 234 share `blur(24px)`; none is a different blur, so this is one component repeated, not a material experiment.

**`centered-hero-stack` — present.** H1 "PitPicks" renders 1392x507 at x24, centred (`text-align: center`, glyph mass on x=720). The 18px two-line subhead is centred on the same axis. The CTA pair (dark "Join for free", translucent "See how it works" with a 16px arrow) sits centred below at y409-454. Nothing else in the 900px hero: no product, no illustration, about 55% of the viewport is empty field. Text-book stack.

**`gradient-blob` — present, marginal.** The hero carries two stacked `radial-gradient`s in the `background-image` of the 1440x900 section: `circle at 76% 18%` in `rgba(212,2,41,0.18)` to transparent at 34%, plus a second stop. Sampled off the hero crop, the rose field peaks at chroma 35 on the right third (y150, x1120) and at chroma 16 bottom-left (y700, x240) against a base field of chroma 2-3 (`rgb(246,247,249)`). Two soft-edged ornamental colour fields in one hue, no content role, no hard edge. The chroma is far below the `databuddy` case (blurred ribbon at stroke-width 166-257) and below `luna-vos` (peak 50); it sits in that file's "present, could be absent" band, and it named the value present there. I follow it. The 208 other gradient declarations are team-livery radial glows behind the line-up chips and driver headshots: role-bearing content colour, not chrome.

**`badge-pill-spam` — present.** Decorative pills above the fold: "How it works", "2026 Season", "Log in" in the floating nav bar; "Join for free" and "See how it works" below it. That is 5 pills in the first 900px. The nav is one rounded capsule containing all three nav items; the hero pair is two independent capsules. Counting the nav capsule as chrome furniture rather than a decorative pill still leaves the hero pair plus "Log in" at 3, which meets "3+ decorative pills in marketing chrome above the fold" at its threshold. Near miss: a reader who excludes the hero CTA pair (they are primary actions, not decoration) and treats the nav as one control drops this to 1 and flips it to absent; the two hero pills are also the page's two primary actions, and the Log in pill is the only real navigation affordance. I keep the value at threshold with that objection on record rather than as a hidden judgment.

## Slop signals absent (12)

**`three-card-row`.** The three numbered feature sections (`01 · PREDICT`, `02 · COMPETE`, `03 · PROFILE`) run as three full-width 1080px sticky sections, not a row: each is a 423px text column plus one product panel, alternating sides, and "05" is the furthest any section reaches past the half-width split. The three "RACE FORMAT" steps (Pick your Top 5 / Lock the bonuses / Beat your league) do form a row, but they are text labels on one horizontal tab strip, not equal-weight cards carrying a section.

**`emoji-as-icon`.** None. The one candidate glyph, U+2764 in "MADE WITH ❤ IN ITALY", is text punctuation in a Space Grotesk run; it renders as a monochrome `rgb(212,2,41)` character at the text baseline, not as a colour emoji icon. Every other icon is inline SVG.

**`generic-sans-default`.** Body is `"Space Grotesk", sans-serif` (1272 nodes), display is `"Titillium Web", sans-serif` at weight 900 (540 nodes). Neither is a builder default. Space Grotesk's geometry is legible in the paragraph copy (single-storey feel in the "a", wide, low-contrast); Titillium's angular terminals show in the footer and micro-caps.

**`symmetric-everything`.** `scripts/antislop/symmetry.cjs` reports 2 of 7 visible h1/h2 headings centred (`The 2026 Line-up`, `Five places. One predict.`), share 0.29, basis h1-h2. The hero H1 is 1392px wide, over 90% of the viewport, and is skipped by construction; the three feature headings and the calendar heading all render `text-align: start` at x184 or x208. Far below the 0.85 cut.

**`generic-line-icon-set`.** 19 inline SVGs, 2px stroke, 9-16px. 15 of them sit inside the product panels (chevrons, per-row markers, a trophy). In marketing chrome exactly one icon appears: the 16px arrow beside "See how it works". A set cannot be generic with one member in chrome, and the in-panel glyphs carry position/marker meaning the adjacent rows need.

**`testimonial-card-row`.** No testimonials section anywhere. Absent.

**`indigo-violet-accent`.** DOM census: ink `rgb(21,24,30)`, muted `rgb(96,104,118)`, accent `rgb(212,2,41)` / `rgb(211,2,42)` (chroma 210). The only violet-family fill on the page is `rgba(140,48,232,0.15)` on one bonus-point pill inside the profile panel, which is product data colour, not chrome.

**`gradient-fill-cta`.** "Join for free" is flat `rgb(21,24,30)`, "Log in" flat `rgb(212,2,41)`, "See how it works" flat `rgba(255,255,255,0.6)` over blur. Zero gradient fills on any button at any altitude.

**`scroll-reveal-blank`.** Measured with a text-node walk: 483 text nodes total, 0 at computed opacity below 0.08 on load. A 300px-step walk to the bottom saw no node cross from under 8% to visible; the dwell equivalent is moot because nothing was hidden to begin with. The three sticky panels use `position: sticky` on a 900px inner viewport inside 1080px sections, which changes what is on screen while scrolling but gates no text. 221 of 226 images carry `loading="lazy"`, which the rule explicitly does not count.

**`typewriter-headline`.** Headlines are static. The only animation on the page at rest is three 1.6-2s opacity pulses on status dots (`.live-dot` and two `animate-pulse` spans).

**`stock-photo-generic`.** 226 `<img>` elements, all AVIF team logos (182x40) and driver portraits (48x48). No photography. The portraits are licensed F1 headshots, a fixed library, not stock that could belong to any company.

**`hero-mockup-float`.** Absent on the DOM: the hero section contains no `img`, `svg` panel, or CSS-drawn mockup, only the wordmark, subhead and CTA pair. The phone-shaped profile panel at y4436 is inside feature section `03`, not the hero.

## Craft signals present (7)

**`asymmetric-split` — present.** Three feature sections, each a 423px text column and a product panel on the opposite side, alternating (text left at x184 for 01 and 03; text right at x833 for 02). The panel occupies the other ~800px. The calendar section is the same shape: heading block at x208-522 with a right-aligned "MELBOURNE → ABU DHABI" label at x1068-1335, then a 12-column tile grid that runs off the right edge.

**`single-optical-anchor` — present, honest call under a rule-ineligible signal.** What I counted as the anchor: the 192px / weight 900 wordmark in the first viewport, which is 3.6x the next largest heading (120px) and has no peer in the hero. The page has four other large headings, but none in the same viewport, and the hero is not "one mass dominating because there is only one mass": the nav capsule at the top and the CTA row below are both visible and both subordinate by an order of magnitude. The mockup panels further down take over their own viewports, so the anchor-local reading is what I scored.

**`type-scale-high-contrast` — present, measured 12:1.** `scripts/antislop/ladder.cjs`: largest lettered node 192px, body computed 16px, ratio 12.00 (subhead 18px, ratio 10.67). Well past the 3.75 necessary threshold. The ladder is also real: 192 / 120 / 72 / 36 / 30 / 18 / 16 / 12 / 10px steps, not three sizes stretched.

**`custom-type-pairing` — present.** Titillium Web 900 set at -5% tracking (-9.6px at 192px) against Space Grotesk at normal tracking for body, the micro-caps "GRID" / "RACE FORMAT" / "CALENDAR" labels and the nav wordmark. Two families with distinct jobs: the display face is doing the brand work in the hero and every section head; the text face is doing the reading and the labelling. Not the same family at two weights.

**`density-variation` — present.** Section heights 900 / 439 / 637 / 1080 / 1080 / 1080 / 491. Density swings from the lone 507px wordmark with 500px of white under it, to the 41-item line-up marquee, to 423px single-column prose with a single panel, to the 23-tile calendar grid with 10px labels. The profile panel inside section 03 packs four labelled sub-blocks at 10-12px type.

**`one-accent-discipline` — present.** Chrome accent is one red, `rgb(212,2,41)` (chroma 210), on the Log in pill, the "PIT" half of the wordmark, the accent word in section heads, the footer rule, and the active calendar chip. Ink is near-black `rgb(21,24,30)`, paper `rgb(246,247,249)`, muted `rgb(96,104,118)`. The other 11 colours in the census are team-livery fills on line-up chips and driver cards and the per-position hit colours inside the profile panel, all content.

## Craft signals absent (3)

**`editorial-grid-break`.** The line-up marquee runs edge to edge at x0-1440 in strips, breaking the page's boxed rule: the hero is inset 24px, the feature text columns start at x184 or x208, the calendar heading is at x208, and the calendar grid itself runs to x1335 while the marquee ignores all of it and clips team and driver chips at both viewport edges. That is a band that breaks the grid, visible in strip 1, not a 1440 canvas with one full-bleed decoration. Present, with the caveat that a reader who treats a logo marquee as furniture rather than an editorial break flips it and moves net to -2, still exemplar.

**`real-product-surface`.** The three panels are page-authored HTML/CSS mockups of the app, not captures and not a live rebuild: the profile panel is a static card with no interactive control, and the race panel's standings are a fixed DOM list. The live app behind the login redirect exists (the race URL returns the sign-in screen at 900px), but the page does not show it. The doorway does not count, and neither does a stylised panel.

**`shows-deliverable`.** Applying the procedure: name the entry that could have embarrassed the vendor. The standings panel shows "Michael 38 pts" with a breakdown of five races and "21 POLE 3 FL 5 DNF 4 SC 5", and the profile shows "AlexF1, Ferrari, joined Mar 2026, 0 total points, 14 picks, 17.6 avg, 93% on-time". Every value is a plausible, rounded, flattering number; no row shows a miss, a wrong pick, a lockout, or a pick the user got wrong. The one genuinely odd value ("0 total points" beside "14 picks 17.6 avg") is a contradiction, not a concession, and it does not narrow a claim. A profile panel whose own accuracy panel only shows hits is the "failure" case in the vocab: it fails on stance.

**`live-claim-control`.** No control on the marketing page lets a visitor falsify the claim. The hero's "Join for free" leads to a sign-in form, not a demo; the calendar tiles link under `/race/` and land on the same sign-in form. There is no sample league to try, no "pick a driver" playground, no slider. The page asks for an account before the product does anything.

## Materials

`single-theme` with a dark scheme implemented. `prefers-color-scheme: dark` flips `html.theme-dark`, body to `rgb(9,10,12)` and the H1 to `rgb(243,245,247)`; the marketing page itself has no toggle, so in the vocabulary's terms it is one theme with a dark variant declared. `commissioned-photo`: 203 AVIF driver portraits and team logos, a licensed F1 library, arranged by the page rather than stock. `illustration`: the wordmark and the checkered-flag rule are page-authored vector/mask art. No `origin-captured`, `origin-authored`, `anchored` or `disclosed`: those four tokens appear only on files scoring `shows-deliverable: present`, and this page does not.

## Near misses

- **`badge-pill-spam`, the only value that could go the other way at a different count.** 5 above-fold pills, of which 2 are the hero CTA pair. I keep present at exactly the threshold and record the exclusion argument. This is the slop value most vulnerable to a second rater.
- **`gradient-blob`.** Chroma peak 35 against base 2-3. `luna-vos` scored present at peak 50 and its own near-miss section flagged it as "present, could be absent"; the same shape here. A rater reading faintness alone flips it, and net goes to -3 with no other change.
- **`centered-hero-stack`.** Present and load-bearing for the count, but the vocab says it is expected to fail eligibility as a pre-AI convention. It is still the honest value: the hero is a centred wordmark/subhead/CTA stack with nothing else. Not scoring it because the signal is rule-ineligible would be the error `heroku-2014`'s file warns against; the eligibility table and the value are separate things.
- **`single-optical-anchor`.** Four 72-120px headings and a 192px one, in five different viewports. If a rater counted page-wide rather than per-viewport, the page has several masses and the value would be absent; the hero still has exactly one.
- **`editorial-grid-break`.** Present, on the full-bleed marquee breaking the page's boxed 24-208px margin rule. A reader who treats a marquee band as furniture rather than an editorial break flips it and moves net to -2, still exemplar.
- **`generic-line-icon-set`.** 19 SVGs is enough to be a set; only 1 renders in chrome. If product-panel glyphs counted, it would be present, but SCOPE forbids that.

## Verdict

4 slop present − 7 craft present = **net −3 → exemplar**.

The corpus band is exemplar at −2..−8, so −3 sits one step inside the top edge, not deep inside it. Saying so: the page has 5929px of real content in 8 sections, so it is not one of the thin pages that scores well because most signals have nowhere to fire. The slop it carries is concentrated in one decision (the glass pill language) and the hero gradient; the craft is spread across typography, layout, colour and rhythm. The AI-builder cohort does not change that: it is a sampling source, and this page does not read as builder-default. The slop value most exposed is the badge-pill call: with it flipped to absent the net is −4, still exemplar. The page would need two more slop flips and the loss of one craft value to reach +0, and nothing on the page is within one inch of that.

Why not `mixed`: `mixed` is net −6..+3, and this page clears that band by its measured type ratio (12:1), its two-family pairing, and an accent that never leaves one hue in marketing chrome. Why not `slop`: it lacks the density that requires — no three-card row, no testimonial grid, no violet, no gradient CTA, no scroll-gated text, no emoji icons, and its headline is static.

## Open defects (recorded, not scored)

Not signals, but the second rater should see them because they bear on whether "no failures shown" is a stance or an oversight: the line-up marquee renders `GABRIEL BORTOLETO` and `CHARLES LECLERC` twice with different team chips, and `MCLAREN` / `ALPINE` twice; the calendar shows 23 tiles (R01-R23) under the heading "22 races. One season." and the copy "across all 22 rounds"; R16 links to the same UUID series as R23; the profile panel shows `TOTAL POINTS 0` beside `14 picks, 17.6 avg` and a hits-per-position row summing to 17. These are content errors in an AI-built page, and the evidence file should not read them as design. They are the reason `shows-deliverable` is absent rather than unresolved: the artefact is populated, and its population is the flattering version.

**Rater B.**

# PitPicks, 2026-10-18, rater B

## Capture facts

Viewport 1440x900. Page height 5929px, `docH_before` 5929 = `docH_after` 5929, scroller `window`, `clamped: false`, `coverage` 1.0, 9 tiles landing at their requested offsets with the last landing at 5029 of an asked 5600 (clamped by design at the page end). Stitched to 2 strips totalling 5929px against a 5929px page, no drift reported. The last strip ends in the footer: wordmark, "© 2026 · All rights reserved", "MADE WITH [heart] IN ITALY", Terms / Privacy / Contact, X / Instagram / Discord icons, and a one-paragraph disclaimer that the project is an independent fan project unaffiliated with Formula 1, the FIA and FOM. 226 `<img>` elements, all `.avif`, all driver headshots (48x48 rendered) or team marks (182x40 rendered); the largest source is a 1336x3840 headshot (`ver-*.avif`). No `<video>`, `<canvas>` or `<iframe>`. The pink wash that appears in both strips is one `div.fixed.inset-0.landing-hero-bg` layer, so its repetition across tiles is a capture artefact, not duplicated content.

The page is 5929px, 20th of 42 by height and close to the corpus median, in seven sections: a 900px hero, a 439px marquee band, a 637px race-format band, three 1080px sticky feature sections, a 491px calendar and a 222px footer. The `materials` list is `single-theme` alone: there is no photography, no illustration and no video, and the 226 rasters are official driver headshots and team marks rather than stock. Two slop signals have no surface here at all (no testimonials section, no photography), so a good net partly reflects missing opportunity, and I say so below.

## Slop signals present

**`gradient-blob`.** A fixed, `pointer-events-none`, 1440x900 layer behind the whole page carries two radial gradients of the single accent: `radial-gradient(circle at 76% 18%, rgba(212,2,41,0.18), transparent 34%)` and `radial-gradient(circle at 18% 82%, rgba(212,2,41,0.09), transparent 32%)`. No disc, no blur filter, an elliptical wash. It paints: the hero background samples as a pink field with the denser lobe upper right, plainly visible in `crop-hero.png` and in the first tile. The template ornament, in the same class as glowcase's four blurred discs and openhack's pair, scored present on both of those on the same mechanism.

**`glass-card-overuse`.** 233 elements carry a non-`none` `backdrop-filter`, every sampled one `blur(24px)`: the floating nav pill (428x38 at y24), the "See how it works" pill (178x46 at y409), and 231 cards in the line-up marquee, each 200-274x74 at y1044 and its repeats. Threshold is 3+, and the count clears it by two orders of magnitude. The marquee is marketing chrome: a decorative, infinitely repeating roster band with no product function, so the SCOPE rule that excludes embedded product surfaces does not apply to it.

**`scroll-reveal-blank`.** Measured with a per-text-node instrument and a matched dwell control, not with a capture diff. At rest, 92 of 594 text nodes sit at a computed cumulative opacity below 0.08. A 9-second dwell with no scrolling recovered 0 of them (`recoveredByDwell: 0`). A 250px-step walk recovered 92 of 92, each crossing from under 0.08 to 0.5 or more (`gatedByScroll: 92`). So the gate is scroll, not time. What is gated is the marketing copy itself: the wrappers are `md:col-span-5 md:order-1` at opacity 0 with `transform: matrix(1,0,0,1,0,40)` and `md:col-span-7 md:order-2` at opacity 0 with `matrix(0.9,0,0,0.9,0,60)`, and they hold "Build the grid in your head.", "Climb the standings, lap by lap.", "Wear your team colors.", their body paragraphs and the three product panels beside them. The one other gated unit is the `RACE FORMAT` eyebrow at y1456, and it is the only part of that band gated: the tab row, the 120px "Five places. / One predict." headline and its subhead measure opacity 1.00 at rest. The calendar band is not gated either; its heading and grid read 1.00 at rest at every scroll offset. What becomes visible where: the eyebrow at scroll 900, the predict section across 1600-2200, the standings section across 2600-3400, the profile section across 3800-4400. So a no-JS reader and a print get the hero, the marquee, the race-format band, the calendar and the footer, and lose the three feature sections that carry the product.

**`centered-hero-stack`.** The hero is the textbook stack on the vertical axis: floating centered nav pill, "PitPicks" at 192px centered, the 18px subhead centered at x432 inside a 576px column, and the two CTAs centered side by side at y410 and y409. Every hero element is centered on the page axis.

## Craft signals present

**`type-scale-high-contrast`.** Largest text node with a letter, nominal font-size 192px, against `getComputedStyle(document.body).fontSize` 16px: **12.0:1**, from `ladder.cjs`. The threshold is 3.75:1. Secondary: the section headlines run at 120px and 72px, the hero subhead at 18px, section body at 16px.

**`custom-type-pairing`.** Two faces, each with a job, assigned by role. Titillium Web (400/600/700/900, loaded from Google Fonts) carries every display size, 192, 120, 72, 36, 30 and 16px, at weights 900 and 700; Space Grotesk (300/400/500/600/700) carries all body copy and every label, at 16px/300, and 7-14px at 400-700 for the micro-labels. The rule that decided deepmark applied here without strain: no display face absent, two faces, assigned by role.

**`real-product-surface`.** Three feature sections each carry a page-authored, live-DOM rebuild of a real product screen: the predict card (y2407-2510: OPEN badge, "RACE · AUSTRALIA", "YOUR TOP 5" with per-row driver headshot, team stripe, P1/P2/P3, code chip and remove control), the standings card (y3302-3790: league list of five, one expanded row with a POS/POLE/FL/DNF/SC points breakdown and five per-GP rows), and the profile card (y4453-4790: team crest, "TOTAL POINTS 247", "14 picks / 17.6 avg / 93% on-time", a 5-cell P1-P5 grid and a 4-cell bonus grid). These are faithful rebuilds of the shipped surface and not stylised or invented: the calendar below them links `/race/c1000000-00NN-4026-8000-0000000000NN`, and the same UUIDs return sessions from the live Supabase table on page load (`rest/v1/sessions?gp_id=in.(...)`, HTTP 200), so the page's own data model matches the product's. The panels are interactive rather than images: the standings rows are 310x39 buttons, and the calendar cells are 88x88 anchors. The product itself sits behind `/login` (both `/login` and `/race/<uuid>` load a sign-in screen), so faithfulness is checked against the route and data contract rather than against a signed-in session; I record that as the limit of the check, not as a failure.

**`asymmetric-split`.** The three feature grids are 12-column with a measured 5/7 split and alternating sides: predict at `col-span-5` x184 w423 / `col-span-7` x678 w548; standings mirrored at `col-start-8 col-span-5` x833 / `col-start-1 col-span-7` x214; profile back to the first arrangement. The 637px race-format band is a different animal, a centered 1024px stack, and the calendar is a full-width 11-column grid.

**`density-variation`.** Section heights on 5929px: 900, 439, 637, 1080, 1080, 1080, 491, 222. Two text-light bands (marquee 439, calendar 491) bracket three text-plus-panel 1080s; the hero is a single line of display type over nothing. The page alternates void and matter rather than running at one density.

**`one-accent-discipline`.** Every chrome decision uses one hue, `#D40229` (measured 212,2,41): the PICKS half of the wordmark, the GRID / RACE FORMAT / 01-02-03 / CALENDAR eyebrows, the emphasis words "Line-up", "One predict.", "grid", "standings", "team colors" and "One", the Log in pill, the active race-format tab, the calendar's NEXT marker and the footer heart. Everything else is near-black `rgb(21,24,30)`, grey `rgb(96,104,118)` and translucent white. The other hues on the page are keyed to data, not chosen by the page. In the line-up marquee each card's radial wash and team name take that team's livery (McLaren `rgb(235,118,0)`, Alpine `rgb(0,147,213)`, Aston Martin `rgb(31,140,104)` and so on, ten of them), and under DATA IS NOT CHROME that is the same call as railway-com's series palette: the card's glass framing is the page's style and is scored (see `glass-card-overuse`), the per-team hue inside it is the value. The panel chips (POLE violet, DNF red, SC yellow) sit inside the product rebuilds and SCOPE excludes them.

**`single-optical-anchor`** (rule-ineligible; honest call only). The 192px "PitPicks" wordmark is the only mass in the first 900px: the next-largest hero text is the 18px subhead (10.7:1), and the only other objects are two 44-46px-tall CTA pills. One mass dominates largely because there is only one mass, which is exactly the reading the brief flags. Below the fold the section headline is always the largest thing on screen, one per viewport, with the panel beside it. Counted as present, with the caveat this signal is undefined.

## Near-misses

- **`gradient-fill-cta`, absent.** One gradient-filled control exists: the active "Pick your Top 5" tab at 139x40, `linear-gradient(135deg, rgb(212,2,41) 0%, rgba(212,2,41,0.85) 100%)`. It is a single-hue alpha ramp on a selection indicator, not a multi-stop gradient on a primary button. Both CTAs in the hero are flat fills (`rgb(21,24,30)` and `rgba(255,255,255,0.6)`). Flipping this to present takes the net to -2 cleanly, so the verdict does not rest on it.
- **`badge-pill-spam`, absent.** Three rounded pills above the fold, and all three are the nav's "Log in" (67x28, `bg #D40229`), the primary CTA "Join for free" (132x44, `bg rgb(21,24,30)`) and the secondary CTA "See how it works" (178x46, `rgba(255,255,255,0.6)` with a 1px border). They navigate; none names a section the adjacent heading names again. Deepmark's eleven section labels are the case the threshold was written for, and these are not that.
- **`one-accent-discipline`, present, and the closest call on the craft side.** A rater who reads the marquee's ten team hues as the page's own palette, not data, scores it absent (net −2). I held it present because the hues follow the data one-to-one: every team colour appears only on that team's card and nowhere in headings, CTAs or labels.
- **`indigo-violet-accent`, absent.** Violet appears on the page: `rgb(192,132,252)` and `rgb(140,48,232)` on the POLE label and value, inside the standings and profile cards. Those are content inside an embedded product surface, excluded by SCOPE, and they are the product's category colour for a bonus type. No violet in chrome.
- **`editorial-grid-break`, absent.** The 5/7 alternation is a two-column split, which is `asymmetric-split` and already scored. Nothing crosses the page margin: every block, including the 1152px feature grids and the 1024px race-format and calendar blocks, sits inside one centered container with generous gutters.
- **`three-card-row`, absent.** The feature trio is three full-width sections, not a row of cards. The only three-up is the race-format tab row, which is a switcher (3 buttons 139-153x40) whose click changes the H2 text, verified: "Five places. One predict." -> "Bonuses. Big swings." -> "Friends. Leaderboard". Not three equal cards.
- **`generic-line-icon-set`, absent.** 19 inline SVGs, all 9-16px, in four jobs: a right-arrow in the secondary CTA, small glyphs inside the standings and profile panels, a heart in "MADE WITH [heart] IN ITALY" (a 12x12 filled heart at `rgb(212,2,41)` on white, not an emoji and not U+2665 in the source: the footer HTML contains no heart character and no emoji codepoint, so the glyph is an SVG), and three 12-14px social marks in the footer. No set of decorative glyph chips beside headings.
- **`shows-deliverable`, absent.** The product's output is on the page, so the near-miss is the interesting one. Checking the procedure's test, an entry that could count against the vendor, I find one candidate inside the predict card: the counter reads 0/5 against an OPEN race, and the rows are P1-P3 only. That is an incomplete draft, not a refusal or a failure. Everything else flatters: the standings leader has 38 pts and the five picks break down to 21+3+5+4+5 = 38 exactly, the profile reports 93% on-time and 17.6 average with 247 points, the calendar marks the next round and nothing else. Nothing shows the product declining, erring, costing or losing. Under Part A's refusal clause, which is the load-bearing half, absent. One internal contradiction is worth recording separately: the copy says "across all 22 rounds" and the calendar heading says "22 races", while the calendar itself renders **23** cells, R01 through R23. That is a copy error against the product data, not an artefact entry that shows the product failing, so it does not move the signal; but a second rater reading the grid will see it.
- **`hero-mockup-float` and `stock-photo-generic`, absent:** there is no hero mockup (the first panel is 2407px down, inside a feature section), and there is no photography. All 226 rasters are driver headshots or team marks, both official-brand assets that could not belong to another company.

## Verdict

Slop present 4 (`gradient-blob`, `glass-card-overuse`, `scroll-reveal-blank`, `centered-hero-stack`), craft present 7 (`asymmetric-split`, `single-optical-anchor`, `type-scale-high-contrast`, `custom-type-pairing`, `real-product-surface`, `density-variation`, `one-accent-discipline`). Net **−3**. Verdict **`mixed`**.

−3 is a value where the bands overlap, so the number does not decide by itself. In the live corpus five files sit at −3: one exemplar (modal-com, 3 slop / 6 craft) and four mixed (provenmetal, cursor-com, neuron-industries, tsenta). Three facts a second rater can check put this page with the four:

1. **No exemplar carries four slop signals present.** All thirteen carry three or fewer (the highest are neomatter and modal-com at 3). This page carries 4.
2. **One of the four is a real defect, not a convention.** `scroll-reveal-blank` gates all three feature sections, which is every section that shows the product: 92 text nodes at opacity 0 at rest, 0 recovered by a 9 s dwell, 92 recovered by scrolling. A no-JS or print reader gets the hero, the roster, the format band, the calendar and the footer, and never sees what the product does.
3. **Two of the other three are the soft-palette template ornament**: the accent-tinted radial wash behind the whole page, and `blur(24px)` glass on 233 surfaces. glowcase (+4, mixed) was kept out of `slop` on the same family of tells.

The craft is genuine and it is why the page sits low in the mixed band rather than in the middle of it: a 12:1 type ratio, two faces split by role, three faithful rebuilds of the product's own screens bound to the product's own race IDs, alternating 5/7 splits and red-only chrome. I did not round it up to `exemplar` on that strength, because the brief rules that out and because the closest-call craft value (`one-accent-discipline`) is the one most exposed to a second reading.

Not `slop`, and not close: +4 needs seven flips from here. Single flips land in −4..−2. Flipping `gradient-fill-cta`, `badge-pill-spam`, `indigo-violet-accent` or `one-accent-discipline` gives −2; flipping `shows-deliverable` or `editorial-grid-break` to present, or either background ornament to absent, gives −4. All three doubtful slop flips together reach 0.

The thin-page caveat applies in part. At 5929px the page is median length (20th of 42), not short, but it has no testimonials, pricing, team, FAQ, integrations, blog or photography, so `testimonial-card-row`, `stock-photo-generic` and `typewriter-headline` have nothing to fire on. The net would likely be worse on a page with more surfaces, and that is one more reason not to read −3 as `exemplar`.

The flips a second rater is most likely to want:
- **`exemplar`** on the band alone. It is defensible arithmetic (modal-com is exemplar at −3). It fails the composition test in point 1.
- **`shows-deliverable` to present.** It would need an entry that embarrasses, and the nearest is "0/5" on an open race, which is an unfinished pick, not a refusal. I would keep absent.
- **`single-optical-anchor` to absent** under the "only one mass" reading. It moves the net to −2 and does not change the verdict.

## Vocabulary note

`scroll-reveal-blank` is the one signal where the page's own animation state fought the instruments and the brief's warning mattered. The walker disables animations, so the stills show every gated block as visible; the thumbnail strips therefore cannot see this signal at all. It took the per-node opacity census plus the dwell control to see it, and the dwell control is what proves the gate is scroll rather than time. That is the doc's stated procedure and it worked exactly as written.

`real-product-surface` on a login-gated product is a borderline case the vocabulary has not settled. The rule allows a faithful live rebuild and asks only about the SURFACE; but where the real surface is behind auth, "faithful" rests on inference from the route contract, which is weaker than a capture. I have recorded the evidence and my call (present), but a rule written off this signal on auth-gated products would be resting on a match that no rater can see directly.

## Drift

Not applicable: this is a new page with no prior study.

**Rater C.**

Rated blind by rater C on 2026-10-19 (front-matter `studied` set to 2026-10-18 per the new-page brief). No other rater's draft or capture was opened. Probe scripts and outputs: `~/scratch/antislop/s5work/pitpicks-C/`.

**Capture.** Viewport 1440x900. Page height 5929px (docH before and after the walk). 9 tiles, `clamped: false`, `coverage: 1`, scroller `window`, stitched to 2 strips totalling 5929px against a 5929px page (no drift). The last strip ends in the footer (wordmark, "MADE WITH ♥ IN ITALY", Terms / Privacy / Contact, X / Instagram / Discord, and the F1 trademark disclaimer). Built on Lovable (`lovable` appears 21 times in `assets/index-Cjx8Z6W-.js`), Vite bundle, Supabase backend.

Capture caveat: the three feature bands are `section.relative.h-[120vh]` (1080px each) with pinned, scroll-scrubbed content, so the stitched strip shows each scene's phone and copy at a different offset per tile, with long empty runway between. Those bands were read from 14 live viewport shots taken every 450px with animations on (`live-*.png`) and from the DOM, not from the strip. The hero's lower half (y455-900) is genuinely empty: no element over 100x50px starts in that range, and the page has zero `video`, `canvas` or `iframe`.

**Slop signals present (4)**

- `gradient-blob`. A `fixed inset-0 landing-hero-bg` layer sits behind the whole page with two radial gradients of the accent, `rgba(212,2,41,0.18)` at 76% 18% and `rgba(212,2,41,0.09)` at 18% 82%. On top of it: three 792x792px discs at `blur(140px)`, one per feature scene (y2030, 3110, 4190); one 720x147px `blur(100px)` wash behind the calendar (y5216); and 198 team-coloured radial glows (`blur(40px)`, opacity 0.25) behind the line-up cards. The pink fog is in every viewport of the walk, and in the dark scheme it turns into a red bloom on near-black.
- `glass-card-overuse`. 235 elements carry `backdrop-filter: blur(24px)` or `blur(12px)`. Outside the phone frames: the nav pill, the "See how it works" button, every line-up card (198 nodes: about 19 distinct cards, repeated for the marquee loop), the "RACE FORMAT" pill, the 3-tab segmented bar and all 23 calendar cells. That clears the 3-surface threshold many times over without counting anything inside a product surface.
- `scroll-reveal-blank`. Walk vs dwell, measured per the brief (`reveal.cjs`): 300px steps, 600ms settle, 12.0s total. The dwell page waited the same 12.0s without scrolling. **16 marketing-chrome text nodes** start at effective opacity 0 and reach 1 during the walk. **The dwell recovers 0 of them.** They are all the copy for the three feature scenes: eyebrows `01 · PREDICT`, `02 · COMPETE`, `03 · PROFILE`; H2s "Build the grid in your head.", "Climb the standings, lap by lap.", "Wear your team colors." and their red highlight spans; the three body paragraphs; the three phone label pills (`PREDICT · RACE`, `STANDINGS · ROUND 5`, `PROFILE · YOU`); plus `RACE FORMAT`. Separately, 33 phone-interior nodes cross the same way and 46 more phone rows mount only on scroll (`P1 Lando Norris` mounts at scrollY 1500, P3/P4 at 2100). Under SCOPE those are excluded and are not needed for the call.
- `centered-hero-stack`. The 192px wordmark "PitPicks" (`text-align: center`), an 18px two-line subhead and two CTAs ("Join for free", "See how it works") are stacked on the page axis, with nothing beside them.

**Craft signals present (7)**

- `asymmetric-split`. All three feature scenes sit on a 12-column grid at 1152px (40px gap, 0 40px padding). Copy spans 5 columns (423px) and the phone column spans 7 (548px). That is 5:7, about 42/58, and the sides alternate (copy left, right, left). Present on the referable-dev precedent (55/45 alternating counted) and financial-datasets (575/637). The near-miss is listed below.
- `single-optical-anchor` (rule-ineligible). What I counted as the anchor: the hero wordmark, 192px Titillium Web 900 at `letter-spacing: -9.6px`, about 630x140 CSS px. Honest answer to the brief's question: yes, it dominates partly **because it is the only mass** in the hero. The rest is an 18px subhead, two 46px buttons and about 445px of empty fog. Each later band repeats the pattern with its own single headline (120px "Five places." and 72px section heads). My call is present, at hero altitude.
- `type-scale-high-contrast`. `ladder.cjs`: largest lettered node "PitPicks" 192px over body 16px = **12.0:1** (10.67:1 against the 18px subhead), far above the 3.75 cut. It is not a single outlier: a second rung at 120px ("Five places." / "One predict.", 7.5:1) and a third at 72px (4.5:1) both clear the cut, over 16-18px body and 8-10px tracked labels.
- `custom-type-pairing`. Two Google faces with distinct jobs. Titillium Web 900 sets every display size (192, 120, 72, 36, 30px) and the line-up names. Space Grotesk 300-700 sets every paragraph (16-18px light), nav links, both hero CTAs, the section eyebrows and the footer. There is some overlap on micro-labels (Titillium on the marquee's 8px `DRIVER`/`TEAM` and on `RACE FORMAT`; Space Grotesk on `GRID` and the calendar months). Present on the deepmark / permit-guide-ai role-split precedent.
- `real-product-surface`. The product is behind auth: `/race/<id>` and `/login` both land on the sign-in form, so no capture of the live app is possible. The instrument is the shipped bundle. It contains both the app's real components and the landing page's miniatures, and they match label for label and class for class:
  - app `text-[8px] … Per Grand Prix` rendering `sessions` against landing `text-[7px] … Per Grand Prix` with a hardcoded `{gp:'Australian',badge:'POLE'}`;
  - app `Your Top 5` with an `m.length<5` `status-closing` badge against landing `Your Top 5` with `t<5`;
  - app `r.onTimeRate.toFixed(0)% on-time` against landing `93% on-time`;
  - app `Hits per Position` in a `grid-cols-5` against landing `{k:'P1',v:4}…`;
  - onboarding "Pick your team / The app theme will match your colours." against the landing `grid-cols-4` team picker.

  So this is a faithful live rebuild of the real screens populated with invented data. That is `present` by the vocab's own wording. It is not the doorway: the prediction picker, league standings and profile are the product in use.
- `density-variation`. Chrome text leaves per band, phone interiors excluded: hero 10 leaves / 196 chars in 900px; line-up 399 DOM leaves in 439px (about 38 visible: three rows of driver/team cards at 8 and 14px); race-format band 7 leaves in 637px; each feature scene 5 chrome leaves in 1080px; calendar 74 leaves in 491px (23 cells of round, flag, day, month at 7-13px). That swings by more than 10x between adjacent bands.
- `one-accent-discipline`. The page's own colour decisions use one hue, `rgb(212,2,41)`: the "Log in" fill, every eyebrow, the highlighted word in each heading ("Line-up", "grid", "standings", "team colors", "One"), the active tab, the NEXT calendar cell, the footer heart, and the background fog itself (the same red at 0.09-0.18 alpha). The other saturated text in the chrome is 9 team liveries (Ferrari red, McLaren `rgb(235,118,0)`, Alpine `rgb(0,147,213)`, Mercedes `rgb(34,225,194)` …), 18 nodes each, colouring driver and team names in the line-up. I read that as data colour: each hue encodes the team attribute, as the railway-com chart palette did. Purple (POLE), yellow (SC) and the other chips appear only inside phone frames and are excluded by SCOPE. This is the most contestable craft call; see the near-misses.

**Absent, with the reading**

- `three-card-row`: no 3-up card band. The three race-format items are a segmented tab control, and the feature bands are alternating splits.
- `emoji-as-icon`: the text walk finds one pictographic character, `©`. The calendar flags are `flagcdn.com/*.svg` images and the footer heart is not a text glyph.
- `generic-sans-default`: Titillium Web plus Space Grotesk, loaded from Google Fonts. Neither is a system or Inter default.
- `symmetric-everything`: `symmetry.cjs` share **0.29** (2 of 7). Even counting the hero H1 as centred and dropping "AlexF1" (an H1 inside the profile phone), it is 3/7 = 0.43, under 0.85.
- `badge-pill-spam`: above the fold (y<900) there is the nav container, "Log in" and two CTAs. All are functional, none decorative. The decorative pills ("RACE FORMAT", the phone label pills) sit at y1437 and below.
- `generic-line-icon-set`: there is no feature icon set. The page's icons are a CTA arrow, the back-to-top arrow, three footer socials and the heart.
- `testimonial-card-row`: no social-proof section.
- `indigo-violet-accent`: the accent is red. Violet appears only on the POLE chip inside phones.
- `gradient-fill-cta`: "Join for free" is flat `rgb(21,24,30)`, "Log in" flat `rgb(212,2,41)`, and "See how it works" `rgba(255,255,255,0.6)`. All have `background-image: none`.
- `typewriter-headline`: 32 samples at 500ms (16s) of the "Five places. One predict." H2 and the tab states returned one string and no tab change.
- `stock-photo-generic`: the photography is named F1 driver portraits and team car renders, specific to the subject. They are third-party editorial images, not the vendor's own, so no photo material token is recorded.
- `hero-mockup-float`: the hero holds no mockup. The shadowed phones float in the feature scenes, not the hero.
- `editorial-grid-break`: nothing leaves or overlaps a column. The line-up marquee runs edge to edge as a band (same reading as aastudioweb's marquee), and every other block sits in the 1024-1152px container.
- `shows-deliverable`: **I cannot name an entry that could embarrass the vendor.** The picker shows a user's 4/5 picks, the standings show friends at 38/34/31/27/22 pts (other users losing is the pitch), and the profile shows 247 pts, 17.6 avg, 93% on-time. Every value is the user's, and the product never declines, errs or costs anywhere.
- `live-claim-control`: none. The calendar is live: Supabase `grand_prix?season=eq.2026`, with NEXT computed from `date=gte.2026-10-19` and landing on R18 25 OCT. Its cells link to `/race/<id>`, but that is auth-gated, and nothing lets a visitor test "beat your friends, live every lap".

**Near-misses**

- `one-accent-discipline` (present → absent if team colours count as chrome accents): 9 extra saturated hues on 162 chrome text nodes, plus their glows. I held data colour because each hue is the team's identity colour attached to that team's name. Flip: net −2.
- `asymmetric-split` (present): the grid says 5:7, but the visible mass in the 7-column cell is a 342px phone frame, narrower than the 423px copy block. Read by mass rather than by `grid-column`, the split is close to balanced. I followed the corpus precedent, which reads columns. Flip: net −2.
- `single-optical-anchor` (present, rule-ineligible): "only one mass". Flip: net −2.
- `custom-type-pairing` (present): two stock Google faces that a builder theme could ship, with micro-label overlap. Flip: net −2.
- `shows-deliverable` (absent): the live calendar renders **23** rounds (R01-R23, R23 06 DEC alone on a third row) under the vendor's own headline "22 races. One season." and subhead "all 22 rounds". That is unscrubbed product data contradicting the page's claim, legible at page size. I held absent because the calendar is the sport's schedule, an input the product consumes, not the product's output on any job. Railway's scanner probe counted because it was the product's own operation log. A second rater could reasonably score this present (net −4).
- `scroll-reveal-blank` (present): firm. 16/16 gated chrome nodes, 0 recovered by the dwell. Only the 12s window is a parameter.
- `glass-card-overuse`, `gradient-blob`: firm, by counts.

**Verdict: `mixed`, net 4 − 7 = −3.**

`slop` is out by the necessary condition: net −3 against a gate of +4. Even flipping all four contested craft calls toward slop (one-accent, asymmetric-split, single-optical-anchor, custom-type-pairing) gives +1. That still sits below every slop file in the corpus as it stands today (heroku-2014 +4 is the lowest) and under the +3 mixed files (stripe-2014, referable-dev, vizleads, openhack).

`exemplar` is also wrong, and the band overlap needs saying: −3 is level with exemplars dropbox-2014 (−2) and modal-com (−3), and also with mixed cursor-com, neuron-industries, provenmetal and tsenta (−3). Three things decide it:

1. **It is a thin page.** It is 5929px tall but has six content bands, with no pricing, testimonials, FAQ, feature-card grid or icon set. So `three-card-row`, `testimonial-card-row`, `generic-line-icon-set` and `badge-pill-spam` have nowhere to fire, and their absence is not restraint.
2. **The builder signature is fully present** and measured hard: an accent-red fog layer plus 792px blurred discs in every scene, 235 `backdrop-filter` nodes, all feature copy gated at opacity 0 behind scroll with a zero-recovery dwell, and a centred wordmark hero.
3. **Four of the seven craft presents rest on generous readings.** A 5:7 zigzag, a stock Google pair, a data-colour exemption, and a rule-ineligible anchor. The firm craft is real: a 12:1 type scale with three rungs over the cut, a bundle-verified rebuild of the actual app screens, and a real density swing. That is a well-executed AI-builder page, not an exemplar.
