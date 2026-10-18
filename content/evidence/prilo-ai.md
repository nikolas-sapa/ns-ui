---
source: https://www.prilo.ai/
kind: site
cohort: ai-builder
verdict: slop
studied: 2026-10-18
context: [nav, hero, features, pricing, team, footer]
signals:
  gradient-blob: unresolved
  three-card-row: present
  glass-card-overuse: present
  emoji-as-icon: absent
  generic-sans-default: present
  symmetric-everything: absent
  badge-pill-spam: absent
  generic-line-icon-set: present
  testimonial-card-row: absent
  indigo-violet-accent: present
  gradient-fill-cta: present
  scroll-reveal-blank: absent
  typewriter-headline: absent
  stock-photo-generic: absent
  centered-hero-stack: absent
  hero-mockup-float: present
  asymmetric-split: unresolved
  single-optical-anchor: absent
  type-scale-high-contrast: absent
  editorial-grid-break: absent
  custom-type-pairing: absent
  real-product-surface: present
  shows-deliverable: absent
  density-variation: absent
  one-accent-discipline: absent
  live-claim-control: absent
materials: [single-theme, commissioned-photo]
---

**Sampling: screen-selected.** One of the five top-ranked of about forty showcase-gallery sites by a mechanical pre-screen. The screen ranked on, among others, `gradient-blob`, `three-card-row`, `glass-card-overuse`, `generic-sans-default` and `indigo-violet-accent`, so this file's values for those five are not independent of how it was chosen.

Rated by two independent blind raters on 2026-10-18, neither reading the other's draft. Both reached `slop`. They agreed on 24 of 26 signals; the 2 splits `gradient-blob` (A present, B absent), `asymmetric-split` (A present, B absent) are recorded `unresolved`, which never counts toward a rule. Both write-ups follow in full.

**Rater A.**

Study-prep SaaS for academic competitions (World Scholars Cup, DECA, FBLA,
NSDA), student-founded. One page, 5094px, eight sections and a footer: a
two-column hero (headline left, product capture right), an amber disclaimer
strip, a "Core Features" three-card row, three alternating 50:50 feature bands
each pairing a 2x2 icon list with a page-authored app card, a single-tier
pricing card, a founders band with two event photos, and a link-list footer.
Not thin: features, pricing and team all exist, so most slop signals had
somewhere to fire. Every value below is read from computed style, the network
log or canvas pixels, not from the strip.

**Capture.** Viewport 1440x900. Walked fresh into
`~/scratch/antislop/s5/prilo-ai-A`: 8 tiles, `clamped: false`, `coverage: 1`,
scroller `window`, `docH_before` = `docH_after` = 5094, no inner scroller
(`html` sh 5094 / ch 900). The last two landings both stopped at 4194, max
scroll, so tiles 06 and 07 are the same frame (93,813 bytes each); the
stitcher drops the overlap: 2 strips, 1440x4400 and 1440x694, 5094px against a
5094px page, 0 drift. The last strip ends in the footer (Navigation / Contact /
Social columns, "© 2026 Prilo LLC. All Rights Reserved." at y≈4993). Sections
from the DOM: hero `<section>` y0-850, disclaimer strip y850-904, Core Features
y904-1341, Study Guide y1341-1955, Master WSC y1955-2585, Topic Mastery
y2585-3171, pricing y3171-3797, founders y3797-4409, `<footer>` y4408-5094. The
only running CSS animation is `prilo-float` (6s, infinite) on two hero blobs
that paint nothing (see `gradient-blob`), so the walker's frozen animations hid
no content.

**Slop signals present (8)**

- `gradient-blob`, present on what renders, not on what was authored. The page
  authors five textbook blobs, `rounded-full blur-3xl`: two 520x520
  `from-indigo-300/10 via-purple-300/...` with `animate-float-slow` in the
  hero, one `blur(40px)` indigo-purple-blue glow behind the hero capture, two
  384px `bg-blue-100/30` / `bg-indigo-100/30` in the founders band. **All five
  paint zero pixels**: each sits in a `-z-10` layer inside a section that forms
  no stacking context and has an opaque gradient background, so it paints
  under its own section. Hiding all five changes 0 pixels, max channel delta
  0, over the full 1440x900 hero viewport and the founders viewport. What does
  render is a pair of radial washes at the top of the Core Features band,
  `radial-gradient(at 100% 0%, rgba(165,243,252,0.4), transparent)` and
  `radial-gradient(at 50% 0%, rgba(191,219,254,0.3), transparent)`: max-min RGB
  chroma 41.8 mean (max 58, centre pixel `rgb(213,245,254)`) in the band's
  top-right corner, 34.1 at top centre, fading to 1.8 at bottom left; hiding
  the two layers changes 6.3% of the band's unoccluded pixels. A soft-edged
  corner bloom with no shape, openhack's "soft radial bloom" in a pale key.
  The hero wash itself (indigo-50 to white to sky-50, chroma 13-16 at the
  corners) is a page tint and is not what this call rests on.
- `three-card-row`. Core Features is a four-track grid (`284px` x4, 1280 wide):
  the heading takes one track, three equal cards take the other three, each
  316x245, white, 12px radius, `rgb(243,244,246)` border, the same shadow,
  and the same contents in the same order: a 56x56 gradient icon tile
  (blue-500→cyan-500, purple-500→indigo-500, rose-500→pink-500), a 24px/600
  H3 ("AI Tutor", "Topic Mastery", "Bowl Preparation"), one line of 16px grey.
  Three equal-weight cards forming the section's whole content.
- `glass-card-overuse`, exactly at the threshold, by the acyclic precedent
  (the decided rule counts surfaces). Three elements carry `backdrop-filter`
  over `rgba(255,255,255,0.8)`: the competition switcher (304x46 at 80,176,
  `blur(8px)`), the "See How It Works" button (208x50 at 245,522,
  `blur(8px)`) and the hero capture's frame (608x418 at 752,248, `blur(4px)`).
  None reads as glass: the first two sit over a near-uniform tint, and the
  frame is covered by its own opaque 606x416 screenshot, leaving a 1px ring.
- `generic-sans-default`. Inter carries every role: body computes `Inter,
  ui-sans-serif, system-ui, -apple-system, ...` at 16px, and the 56px/700 H1,
  all six 36px H2s and every H3 are Inter. `document.fonts` is empty, no
  `@font-face` is readable, and the network log has 0 font responses (no
  woff/woff2/ttf, no Google Fonts). Inter renders only where the visitor has it
  installed; elsewhere the page falls to `system-ui`. Same reading as
  neuron-industries.
- `generic-line-icon-set`. The three 2x2 feature lists carry twelve Lucide
  glyphs, every one `stroke-width="2"`, a 24px box, `rgb(59,130,246)`; six
  more from the same set, white at 24-28px, sit in the card tiles and app-card
  headers. Each list glyph restates the 16px/600 heading beside it: `target`
  on "Focus Areas", `star` on "Topic Rating", `trending-up` on "Study
  Planning", `clock` on "Self-paced support", `book-open` on "Custom
  Pathways". One set, one stroke, one size, nothing the heading lacks.
- `indigo-violet-accent`. The conversion path is indigo. The primary hero CTA
  "Start Free" is `linear-gradient(to right, rgb(79,70,229), rgb(147,51,234),
  rgb(37,99,235))` (indigo-600, purple-600, blue-600); the active "WSC" tab is
  indigo-600→purple-600; the pricing CTA "Start WSC now" is flat
  `rgb(79,70,229)`, 306px wide; the pricing card's 4px top bar runs
  indigo-500→purple-500→blue-500; the "PLANS" eyebrow, the "Seasonal access"
  pill and "Start monthly" are indigo-700 `rgb(67,56,202)`. The H1 itself is
  `bg-clip-text` gray-900→indigo-800 `rgb(55,48,163)`→blue-800, as is "Founded
  by Competition Winners".
- `gradient-fill-cta`. Two primary buttons are multi-stop gradient fills: the
  hero "Start Free" (149x50, three stops above) and the nav "Get Started"
  (219x52, `rgb(59,130,246)`→`rgb(34,211,238)`, fully rounded, coloured
  shadow).
- `hero-mockup-float`. The hero's right column is a real dashboard capture
  (`/mockups/wsc/wsc-homepage.png`, 2939x1657) shown at 606x416 inside a
  `rounded-3xl` translucent frame with `shadow-xl shadow-blue-500/5`, and a
  second capture (`wsc-analytics.png`, 2939x1658) at 230x140 in a white card
  with `shadow-lg`, `rotate(-4deg)` (matrix `0.9976, -0.0698`), pinned
  `-bottom-8 -left-6` so it overhangs the frame by 28px left and about 40px
  below. Tilted, shadowed, layered: the float, built from real captures, as on
  heroku-2014 and openhack.

**Craft signals present (2)**

- `real-product-surface`. The hero capture is a genuine screenshot of the
  product in use, not a doorway: a sidebar of ten product routes (Home,
  Practice, Analytics, PriloGPT, Progress, Explore, Leaderboard, Writing,
  Debate, Challenge), a "Welcome to WSC Practice" header with `Questions 317`
  / `Accuracy 7%`, a Performance Summary (`7% Average`, `41 Total`, `Last: May
  21, 2025`), a "Rate this question from unit 6" widget ("What are the three
  elements of the fire triangle?") and a Top Scholars list with the viewer at
  rank 6. A 7% accuracy and a stale 2025 date have no authored purpose; no
  designer picks them. The analytics inset carries a charting defect a mockup
  would not: the x-axis label "Date" collides with the legend line ("Unit 2:
  The Date Best is Yet..."). Caveat recorded, not scored: the capture renders
  at 0.206 of its natural width, so its body text lands at roughly 3-4 CSS px.
  The vocabulary puts no legibility clause on this signal. The three
  lower-band app cards (AI Study Guide, PriloGPT, Topic Mastery) are
  page-authored HTML with invented content and earn nothing here; the PriloGPT
  answer is a static `<p>` whose numbered list has collapsed into one run-on
  paragraph, so it is not a faithful rebuild of a chat surface.
- `asymmetric-split`, on one band of eight. Core Features sets its heading
  column (284px: "Core Features" 36px/700 over a two-line subtitle, about 85px
  of text vertically centred in a 245px column) against the 948px card row, a
  23/77 split with vacancy above and below the heading. That is the
  dipole-labs reading (363 against 789, 32/68, heading column with vacancy).
  Recorded with its context: the band is one cell of a four-equal-track grid,
  and every other split on the page is exact 50:50 (hero 608/608; Study Guide,
  Master WSC, Topic Mastery and founders all 616/616).

**Near-misses**

- `shows-deliverable`, absent, and the call most likely to split raters. The
  entry that might embarrass: the hero capture's `Accuracy 7% Average` beside
  `41 Total` sessions, legible at page size (about 11px rendered): the
  product's own user at 7% after 41 sessions, under a headline promising "the
  easiest way to prepare". Excluded under WHOSE FAILURE COUNTS: it is the
  student's score, and surfacing a student's weak score is the capability the
  panel sells (the inset's alt text is "WSC analytics view highlighting
  performance insights"; the Topic Mastery band sells "identify areas that
  need more focus"). That is papaya's and linear-app's exclusion, not
  clerk-com's inclusion. The stronger entries fail legibility: the leaderboard
  (`You` rank 6 at `7% accuracy · 317 questions` under `Focused Achiever` at
  `83% accuracy · 12 questions`) renders at about 5px, and the analytics
  inset, whose chart carries a curve falling from 43% to 0% and the
  "Date"/legend collision, renders at 230x140, 0.078 scale. The amber "Not
  affiliated with World Scholars Cup." strip is a genuine narrowing, but it is
  page prose, not inside an artefact. Pricing is one tier, $30/season or
  $5/month, with no refusal. Flipping this present takes net to +5.
- `symmetric-everything`, absent on alignment counts, the corpus procedure:
  107 text leaves start-aligned, 20 centred, 0 end; the centred ones are the
  four competition tabs, nav items, two button labels, the disclaimer strip,
  the pricing block and the copyright. By mass placement it reads the other
  way: five of the six split bands are exact 50:50 mirrors. That is the
  standard-machines vocabulary gap again. Flipping it present takes net to +7.
- `single-optical-anchor`, absent, honest call: the hero holds two masses of
  equal width, the H1 block (608px column, 476x178 gradient headline at 56px)
  and the capture frame (608x418 plus the rotated inset). Neither dominates;
  this is not "one mass because only one mass". Page-wide, each band leads with
  the same 36px H2.
- `type-scale-high-contrast`, absent: `ladder.cjs` gives 56/16 = 3.50:1
  against body (2.80:1 against the 20px subhead), below the 3.75 floor. The
  next nodes are a 48px price figure "$ 30" and five 36px H2s.
- `density-variation`, absent. Ink (pixels summing under 600 of 765, every 3rd
  px) by band: hero 5.04%, disclaimer 3.14%, Core Features 3.54%, Study Guide
  4.76%, Master WSC 4.87%, Topic Mastery 3.00%, pricing 3.08%, founders 23.17%.
  Six of seven non-photographic bands sit inside 3.0-5.0% on the same
  `py-24` rhythm and the same 50:50 layout; the one spike is two photographs.
- `one-accent-discipline`, absent: high-chroma (over 120) fills and text in
  seven hue families: blue-500/600 links and icons, indigo-600 CTAs, cyan-400
  and cyan-500 in the nav button and an icon tile, purple-500/600 in gradients,
  rose-500 and pink-500 in an icon tile, green-600 checkmarks, amber-700 text
  in the disclaimer and the "Need More Practice" panel.
- `badge-pill-spam`, absent: one decorative pill above the fold, the "New"
  badge on Resources (38x20, blue-500). The DECA / WSC / FBLA / NSDA switcher
  is a functional 8px-radius segmented control (clicking DECA navigates to
  `?platform=deca` and retitles the H1 "...for DECA™"). Below the fold:
  "Seasonal access", "About Prilo".
- `scroll-reveal-blank`, absent: 0 of 134 text nodes under 8% opacity at load,
  0 after a full 700px-step walk, 0 after a 4s dwell control.
- `typewriter-headline`, absent: the H1 read identically in six samples over
  12.5s with no interaction; the switcher changes it only on click.
- `editorial-grid-break`, absent: all content sits in the `max-w-7xl` 1280px
  container at x80-1360. The only element crossing a column edge is the
  rotated inset (x724 against the column's 752), which is the float.
- `live-claim-control`, absent: the only control is the competition switcher,
  which changes which competition is named, not whether a claim holds.
- `stock-photo-generic`, absent: the two photos are the co-founder at named
  events (`alt` "Timmy speaking at Stanford", a talk slide reading "Basics of
  cryptocurrency"; "Timmy at DCBKK", a stage screen). Specific, not stock.
  Materials gap: they are neither `stock-photo` nor `commissioned-photo`
  (one is literally `Screenshot-2025-01-01-at-7-05-59-PM.png` on i.ibb.co), so
  no photo material is recorded. `single-theme`: emulating
  `prefers-color-scheme: dark` returns the same light gradients.

**Verdict: slop, net +6** (8 slop present, 2 craft present).

This is the highest net in the corpus: above heroku-2014 (+5) and openhack
(+4), three counts above the +3 mixed ceiling. What separates it from the +3
mixed files, checkable by diffing front-matters and re-running the
measurements above:

- **Against stripe-2014 (6 slop, 3 craft): prilo's slop set contains
  stripe-2014's entire slop set** (gradient-blob, three-card-row,
  generic-line-icon-set, indigo-violet-accent, gradient-fill-cta,
  hero-mockup-float) **and adds two**, `glass-card-overuse` (3
  `backdrop-filter` surfaces) and `generic-sans-default` (Inter only, 0 faces,
  0 font requests). Its craft set is stripe-2014's minus `density-variation`,
  which fails here by measurement (six of seven non-photo bands at 3.0-5.0%
  ink).
- **Against deepmark (7 slop, 4 craft):** deepmark's craft includes two
  page-wide colour and type decisions, `custom-type-pairing` and
  `one-accent-discipline`. Prilo fails both by instrument: one family with no
  `@font-face`, and seven authored hue families above chroma 120.
- **Prilo's two craft signals are each local and contradicted by the page's
  own system**: `asymmetric-split` holds on one band while five splits measure
  exactly 50:50, and `real-product-surface` is a capture rendered at 20.6% of
  its width. It scores 1 of the 7 layout, type and colour craft signals
  (asymmetric-split, single-optical-anchor, type-scale-high-contrast,
  editorial-grid-break, custom-type-pairing, density-variation,
  one-accent-discipline); deepmark scores 4 of the 7.

Robustness, stated so the verdict is not over-read. Three of my calls lean
toward slop and could go the other way: `glass-card-overuse` (at exactly 3,
none reading as glass), `gradient-blob` (the authored blobs are dead; the call
rests on a pale corner bloom, chroma 42), and `shows-deliverable` (the 7%
entry). Any two of those flipping leaves net +4, still at the slop floor; the
stripe-2014 superset relation survives unless `gradient-blob` is one of the
two. All three flipping gives +3, and the verdict should then be `mixed`. Two
calls lean the other way and would raise net: `symmetric-everything` by mass
placement (+7) and `asymmetric-split` withdrawn for being one grid cell (+7).

The page being AI-builder-made is not the basis. The basis is that it ships
the stripe-2014 slop combination in full, plus glass and a default sans, while
declining every type, colour and density decision the +3 files make.

**Rater B.**

Captured at 1440x900, DPR 1. Page 5094px, scroller `window`, 8 tiles, `clamped:
false`, `coverage: 1`, `docH` 5094 before and after the walk. Two strips, 5094px
stitched against 5094px settled (stitcher: OK). The last two tiles both landed at
4194 (docH − 900), so tile 07 duplicates tile 06; the stitcher absorbed it and the
total matches. The last strip ends in the footer (`© 2026 Prilo LLC. All Rights
Reserved.`). `https://prilo.ai/` 301s to `www.prilo.ai`, and the client then sets
`?platform=wsc`; four fresh contexts (two en-US, two en-GB) all landed on WSC, so
the rated page is the World Scholars Cup default. Mobile not studied.

What it is: a single-theme Tailwind build (Vite `assets/index-*.css`, `lucide`
classes on every icon, framer-motion inline styles on the hero). A four-way
`role="tablist"` (DECA / WSC / FBLA / NSDA) rewrites the hero headline, both hero
images and the feature cards; the other three platforms were read only to rule out
`typewriter-headline` and `live-claim-control`. Builder origin is context here, not
a signal: every value below is scored on what is measurably on the page.

## Slop signals present (7)

**`three-card-row`.** Core Features is three equal cards, 316x245 at x412 / 728 /
1044 (`md:grid-cols-3` inside an `lg:col-span-3`): white, 1px `rgb(243,244,246)`
border, 12px radius, each a 56x56 gradient icon chip, a 24px/600 title and one
16px line. "AI Tutor / Ask questions about WSC topics and concepts", "Topic Mastery
/ Track what you know and what needs more focus", "Bowl Preparation / Practice
Scholar's Bowl questions and review feedback".

**`glass-card-overuse`, at exactly the threshold.** Three `backdrop-filter`
surfaces, all `rgba(255,255,255,0.8)`: the platform tablist (304x46, `blur(8px)`),
the "See How It Works" button (208x50, `blur(8px)`) and the hero screenshot's frame
(608x418, `blur(4px)`). Present by the decided count (3+). It is a CSS fact, not a
visual one, the databuddy shape: the hero field under all three paints chroma 7 or
less, and the third frame is entirely covered by the opaque 606x416 screenshot it
holds, so nothing visibly frosts.

**`generic-sans-default`.** 128 of 128 visible text leaves compute `Inter,
ui-sans-serif, system-ui, -apple-system, "system-ui", "Segoe UI", sans-serif`.
`document.fonts` holds 0 faces, and the network log has 0 font responses (6 script,
6 image, 1 stylesheet). Inter is never downloaded: a visitor without it installed
gets the OS UI face. Same stack and same finding as acyclic.

**`generic-line-icon-set`.** Twelve Lucide glyphs in three identical 2x2 lists, one
beside each 16px/600 sub-heading: `lucide-brain`, `sparkles`, `target`,
`book-open`, `brain`, `clock`, `message-square`, `zap`, `bar-chart3`, `target`,
`star`, `trending-up`. All `w-6 h-6` (24px box), stroke `rgb(59,130,246)`,
`stroke-width: 2px`. Each repeats its heading: a target beside "Topic Connections"
and "Focus Areas", a trending-up beside "Study Planning", a clock beside
"Self-paced support". Two glyphs recur (brain and target, twice each), so the set
is not even unique per item. The three Core Features chips add a second tier of the
same set (28px, white on gradient).

**`indigo-violet-accent`.** Indigo-600 `rgb(79,70,229)` is the primary hue: the
hero CTA runs `linear-gradient(to right, rgb(79,70,229), rgb(147,51,234),
rgb(37,99,235))` (indigo-600 → purple-600 → blue-600), the active WSC tab
`rgb(79,70,229) → rgb(147,51,234)`, and the pricing CTA "Start WSC now" is a flat
`rgb(79,70,229)` fill. The "Seasonal access" pill sets indigo-700 on indigo-50, the
Topic Mastery chip runs purple-500 → indigo-500, and the H1 itself is
`bg-clip-text text-transparent` over `rgb(17,24,39) → rgb(55,48,163) →
rgb(30,64,175)` (gray-900 → indigo-800 → blue-800).

**`gradient-fill-cta`.** Both primary buttons above the fold are multi-stop
gradients: "Start Free" (149x50, 12px radius, the three-stop indigo gradient quoted above) and the nav "Get
Started" (52px tall, 9999px radius, `rgb(59,130,246) → rgb(34,211,238)`, blue-500
→ cyan-400). Only the pricing CTA is flat.

**`hero-mockup-float`.** The main screenshot sits in a `rounded-3xl` frame with
`shadow-xl` (`rgba(59,130,246,0.05) 0 20px 25px -5px`) over a `blur-2xl` gradient
halo (608x418; indigo/purple/blue at 10% alpha). A second screenshot
(`wsc-analytics.png`, 232x143) hangs off the frame's lower left (`-bottom-8
-left-6`) in a `rotate-[-4deg]` wrapper (computed `matrix(0.9976, -0.0698, ...)`),
with `shadow-lg` (`rgba(0,0,0,0.1) 0 10px 15px -3px`), protruding 28px into the
gutter. Tilt, shadow and overlap. The UI in both is genuine (below); this signal is
about the staging, and the corpus fires it on real captures (cursor-com, grep-ai,
neomatter, sentient-os, stripe-2014).

## Craft signals present (1)

**`real-product-surface`.** Both hero images are captures of the WSC app at
`wsc.prilo.ai`, which is the "Start Free" target (200, `<title>Prilo WSC - World
Scholars Cup Practice</title>`). `wsc-homepage.png` is 2939x1657 and
`wsc-analytics.png` 2939x1658, roughly 2x captures of a ~1470px viewport. Their
content carries detail no designer authors for a hero: "Accuracy 7% Average" over
a near-empty progress bar, "Practice Sessions 41 Total / Last: May 21, 2025", a
leaderboard putting "You" sixth at "7% accuracy · 317 questions" under "Focused
Achiever 83% accuracy · 12 questions", a question-rating card ("Rate this question
from unit 6 / What are the three elements of the fire triangle?"), and an accuracy
chart in which Unit 2 goes 0% → 43% → 0% across May 10-21 and Unit 7 sits at 0%.
The eleven-item sidebar (Home, Practice, Analytics, PriloGPT, Progress, Explore,
Leaderboard, Writing, Debate, Challenge, ...) matches the page's own feature names.
The product in use, not the doorway. Rendered 606x416 with `object-fit: cover;
object-position: 50% 0`, a 0.251 scale cropping about 66 CSS px off each side. The
three page-authored panels further down (AI Study Guide, PriloGPT chat, Topic
Mastery) were not checked against the app and are not relied on.

## Near-misses

- **`gradient-blob`, absent: declared, not painted.** The hero markup holds the
  generator's blob kit: two 520x520 `rounded-full blur-3xl animate-float-slow`
  divs at top right (x1016, y−101) and bottom left (x−96, y417), filled
  `linear-gradient` indigo-300 → sky-300 and purple-300 → sky-300 at 0.1 alpha,
  plus the 10% halo behind the screenshot. On the painted tile they are
  invisible: 9x9-averaged pixels at the two blob centres read `rgb(253,254,255)`
  and `rgb(253,253,255)`, chroma 2, against chroma 6-7 at the hero's own centre,
  which is the linear wash (`indigo-50 → white → sky-50`) and not the blobs. 86% of
  hero pixels sample under chroma 12, and nothing clusters into a blob shape. The
  vocabulary scores what the page shows, so absent. A rater scoring the markup gets
  present (+1).
- **`symmetric-everything`, absent on alignment counts**, the corpus method
  (acyclic, edotenv, neuron-industries): 107 of 128 leaves and 29 of 31 headings
  are `start`; the centred ones are button labels, the disclaimer banner and the
  pricing card ("Choose your plan", "WSC plan"). The counter-case is strong: every
  two-column band splits exactly even. The hero is 608/608 at x80 and x752,
  mirrored about x=720; four more bands are 616/616; the footer is four 280px
  columns. neuron-industries held absent on three symmetric two-ups; this page has
  five. Present gives +1.
- **`asymmetric-split`, absent.** The one unequal split is Core Features: a 284px
  heading cell (vertically centred, `items-center`) against the 948px card row,
  23/77. databuddy counted a heading-column split of that shape, but alongside
  others; here the hero and four of five two-column bands are exactly 50/50, and
  acyclic's ruling applies ("the content differs; the proportion does not").
  Present gives −1.
- **`glass-card-overuse`**: at exactly 3, one surface a button and one fully
  covered. A reading that demands visible frosting gives absent (−1).
- **`shows-deliverable`, absent. The entry named and excluded:** "Accuracy 7%
  Average" in the hero capture's Performance Summary, glyphs about 11 CSS px tall
  and legible, beside an H1 promising "The easiest way to prepare". It is
  unflattering, but it is the customer's score shown by the analytics the page
  sells: the page itself pitches "Identify knowledge gaps", "Prioritize weak areas"
  and a "Need More Practice" panel. Under the papaya / linear-app ruling, catching
  the customer's weakness is the pitch, so it does not count. The leaderboard's
  "7% accuracy · 317 questions" renders at about 5px and fails legibility. Nothing
  else inside an artefact could count against Prilo: the chat answer, study-guide
  card and topic panel all flatter. The "Not affiliated with World Scholars Cup"
  banner narrows a claim but is chrome prose, not artefact content. Present gives −1.
- **`badge-pill-spam`, absent.** One decorative pill above the fold ("New", 38x20,
  on Resources). The DECA/WSC/FBLA/NSDA control is a functional tablist of 36px
  buttons with 8px radius, not pills. Page-wide there are three ("New", "Seasonal
  access", "About Prilo").
- **`type-scale-high-contrast`, absent.** `ladder.cjs`: 56px H1 over a 16px body
  = 3.5:1, under the 3.75 cut. Next sizes are "$ 30" at 48px, then the 36px h2s.
- **`one-accent-discipline`, absent and not close.** Marketing chrome alone
  carries blue-500 → cyan-400 (nav CTA), indigo-600 → purple-600 → blue-600 (hero
  CTA), flat indigo-600 (pricing CTA), three different chip gradients (blue-500 →
  cyan-500, purple-500 → indigo-500, rose-500 → pink-500), an amber-50 / amber-900
  banner and green-600 checks.
- **`density-variation`, absent.** Ink per band (pixels more than 40 levels off the
  band background, every second pixel): hero 5.11%, Core Features 4.08%, study
  guide 5.61%, PriloGPT 6.18%, topic mastery 3.55%, pricing 3.66%, footer 1.37%.
  That is a 2.6pp spread across the text bands. The about band reads 27.57% only
  because of its two photos (provenmetal's "one image panel existing"). Three
  consecutive bands run one module (36px h2, 18px dek, a 2x2 Lucide list, a 616px
  demo card), each at `py-24`. Characters per vertical pixel swing 0.33 → 1.69,
  but the swing comes from one chat paragraph, not from a dense passage set against
  an established rhythm.
- **`scroll-reveal-blank`, absent.** 0 of 128 text nodes under 8% effective
  opacity at t=0.8s, after an 8s dwell without scrolling, and after a full walk.
  The hero has a framer-motion entrance (the tablist moves 10px between 0.3s and
  1.8s): time-gated, done before 1s, and never hiding text behind scroll.
- **`typewriter-headline`, absent.** The H1 is identical across an 8s dwell and
  five 1s samples. The tabs swap it on click only.
- **`live-claim-control`, absent.** The tabs rewrite the hero (DECA: "The easiest
  way to prepare for DECA™"; FBLA: "Prepare for FBLA with one clean workflow.";
  NSDA: "The AI debate platform for NSDA competitors."). A product selector, not a
  control that can falsify the claim.
- **`stock-photo-generic`, absent.** Two photos hosted on i.ibb.co: "Timmy
  speaking at Stanford" (a 2106x1186 screenshot of a talk) and "Timmy at DCBKK"
  (1200x1121). Company-specific. `commissioned-photo` is the nearest material
  token; they are first-party event photos, not a commissioned shoot.
- **`single-optical-anchor` (rule-ineligible), absent.** I counted two masses of
  equal width in the first viewport: the 56px H1 block (608x168, the darkest ink)
  and the screenshot composition (608x418 plus the 232x143 tilted inset). Neither
  dominates. This is not a "one mass because there is only one mass" case.
- **`editorial-grid-break`, absent.** The tilted inset pokes 28px into the gutter
  as part of the float, and the founder photos stack in a two-column checkerboard
  (image over card, card over image) inside one 616px column. Nothing leaves the
  grid.

## Verdict: slop, net +6

7 slop present, 1 craft present. Net +6, above the slop files (heroku-2014 +5,
openhack +4) and the highest in the corpus.

**What separates it from the +3 mixed files, measurably:**

- **stripe-2014 (+3)** shares five of these seven slop values exactly:
  `three-card-row`, `generic-line-icon-set`, `indigo-violet-accent`,
  `gradient-fill-cta`, `hero-mockup-float`. What holds stripe-2014 at mixed is
  three craft signals: `asymmetric-split`, `real-product-surface`,
  `density-variation`. Prilo keeps only `real-product-surface`. Its splits are five
  exact 50/50s, and its text bands sit inside a 2.6pp ink spread. On top of that it
  adds `glass-card-overuse` and `generic-sans-default`.
- **deepmark (+3)** has seven slop values, like prilo, against four craft:
  `asymmetric-split`, `custom-type-pairing`, `density-variation`,
  `one-accent-discipline`. All four measure absent here: one family (128/128 leaves,
  no webfont), seven accent hues in chrome, the 2.6pp spread, the even splits.
- **The checkable line:** both +3 mixed files carry three or four craft signals
  offsetting the template. Prilo carries one. The two slop files carry two each
  (heroku-2014 and openhack: `real-product-surface` and `one-accent-discipline`).
  Prilo sits with the slop files on craft count and above both on slop count.

**Robustness, so a second rater can locate a disagreement.** Any single adverse
flip from the near-misses leaves net ≥ +5; any two leave ≥ +4. Only three at
once (`glass-card-overuse` → absent, `asymmetric-split` → present and
`shows-deliverable` → present) reach +3 and mixed. Two of those three would have
to overturn a decided rule (the 3+ surface count; the papaya / linear-app exclusion).
The flips the other way (`gradient-blob` from markup, `symmetric-everything` from
column geometry) would put it at +8.

What the page does well, recorded so the verdict is not read as a judgement on the
product: its hero shows the real app with a real account's unflattering numbers
left in, a disclaimer bar says plainly it is not affiliated with the competition,
and the founder photos are their own. That is one craft signal's worth of honesty
inside an otherwise stock Tailwind template. Page height 5094px: not thin enough
for empty space to explain the low craft count, since every craft signal had a
section where it could have fired.
