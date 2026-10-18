---
source: https://sakura-name-sparkle.lovable.app/
kind: site
cohort: ai-builder
verdict: mixed
studied: 2026-10-18
context: [hero, footer]
signals:
  gradient-blob: present
  three-card-row: absent
  glass-card-overuse: present
  emoji-as-icon: absent
  generic-sans-default: present
  symmetric-everything: present
  badge-pill-spam: absent
  generic-line-icon-set: absent
  testimonial-card-row: absent
  indigo-violet-accent: present
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
  density-variation: absent
  one-accent-discipline: present
  live-claim-control: present
materials: [single-theme]
---

**Sampling: random draw.** One of eight drawn with seed 20261018 from the thirty remaining gallery sites (pre-stated exclusions only: unreachable, blank, sign-in wall). Not chosen on any signal.

Rated by two independent blind raters on 2026-10-18, neither reading the other's draft. Both reached `mixed`. They agreed on 26 of 26 signals. Both write-ups follow in full.

**Rater A.**

**Capture.** 1440x900 viewport, page height 900px (`docH_before` = `docH_after` =
900), 2 tiles, `clamped: false`, `coverage: 1`, one stitched strip of 1440x900,
stitched height equal to settled height. There is no scroll range: the walker asked
for 700 and landed at 0, and the two tiles are byte-identical (MD5
`1ae1baed...`), so the strip is the one viewport. `innerCands` is empty; no child
scroller. The page ends in a real `<footer>` (`border-t border-black/5`, y852):
"48 surnames · 48 given names · countless stories" left, "名 · a shōjo of names"
right. The bottom-right "Edit with Lovable" pill is the builder's injected
`<aside>`, not the page's chrome, and is excluded from every count below.

**What the page is.** A single-screen Japanese name generator. Header: a 36px
circled 名 mark, the 18px wordmark 名付け, and a 12px uppercase label "JAPANESE NAME
GENERATOR". Then one glass card (560x328 at x440, y121) holding a "• NEW NAME" pill,
"VOL. 03 · 128", the generated name at 96px Shippori Mincho (e.g. 小野 葵), the
romaji at 24px Kosugi Maru, and a 15px Inter gloss ("hollyhock in bloom — « small
meadow »"); a "Generate a new name" button; a "RECENTLY FLIPPED" list of three
52px rows; the footer. 30 visible text leaves in total. No images, canvas, video or
iframe; zero inline SVG outside the Lovable badge.

**Scope ruling I had to make.** The SCOPE rule excludes content "inside an embedded
product surface". Nothing here is embedded: the page *is* the product, with no
marketing wrapper around it. I scored the card's styling (glass, type, colour,
alignment) as the page's own decisions, because there is no other layer for those
decisions to live in. Read the other way (card = product surface, unscored), the
page would have almost nothing left to score: an 18px wordmark, a 12px label and a
footer. Flagged below as a vocabulary gap.

## Slop signals present (6)

**`gradient-blob`.** Three literal blurred discs behind the content, all
`rounded-full` with `filter: blur(110px)`: a 560px `bg-lavender/70`
(`rgb(210,199,234)`) at top-right (x1008, y-160); a 520px `bg-blossom/70`
(`rgb(239,199,217)`) at bottom-left (x-112, y572); a 420px `bg-mist/60`
(`rgb(201,227,236)`) centred at (x510, y300). Same mechanism as zingy-cannoli's
`blur-3xl` discs.

**`glass-card-overuse`.** Four `backdrop-filter` surfaces against the threshold of
3: an outer halo `-inset-6` (608x376, `bg-white/20`, `blur(8px)`), an inner halo
`-inset-2.5` (580x348, `bg-white/35`, `blur(12px)`), the card itself (560x328,
`bg-white/60`, `blur(24px)`), and the list container (560x188, `bg-white/45`,
`blur(12px)`). Present by the decided count. Three of the four are nested rings
around one card, so the page shows two glass *objects* built from four glass
*surfaces*; see near-misses.

**`generic-sans-default`.** Body computes `Inter, sans-serif` at 16px, and Inter
(400/500/600 from Google Fonts) carries every Latin UI and prose node: the gloss
line, the button, the eyebrow labels, the list meanings, the footer count. Running
copy is at `letter-spacing: normal`; the only tracking is on the uppercase labels
(1.54px, 1.92px, 2.4px). Same reading as the Lovable-starter precedents where a
distinct heading face did not rescue an Inter body.

**`symmetric-everything`.** Every block is centred on x=720: card x440-1000, list
x440-1000, button x605-836, header and footer both spanning x200-1240. The text-align
count is 9 of 30 leaves centred (all the display-scale text: the 96px name, 24px
romaji, 15px gloss, button), and the other 21 are `start`-aligned. But every one of
those 21 is one end of a `justify-between` row whose two ends mirror about the axis:
logo at x200 vs label ending x1240; "NEW NAME" pill starting x480 vs "VOL." ending
x960 (both 240px off-axis); list kanji at x466 vs meaning ending x974 (254px either
side). Nothing on the page is offset from the axis. Recorded present on mass
placement; the alignment count alone would read absent (see near-misses).

**`indigo-violet-accent`.** `--primary` is `oklch(0.55 0.1 310)` = `rgb(131,96,157)`,
`#83609d`, HSL hue 274.4°. That sits beside Tailwind purple-500 (270.7°) and above
violet-500 (258.3°). It carries the button fill, the 名 mark, every romaji line, the
"NEW NAME" pill text and (at 0.6-0.8 alpha) the three uppercase labels. The text
colour is `oklch(0.23 0.04 300)` = `rgb(32,24,45)` (hue 262.9°), the paper is a
lilac `#f4f0f8`, and the lavender blob sits at 258.9°, violet-500's own hue. Present
on hue. Chroma is low (61, against 142-169 for the Tailwind defaults): a dusty
mauve rather than the electric AI indigo, so this is the weakest of the six.

**`centered-hero-stack`** (recorded fact, expected rule-ineligible). Pill/volume row
(y161) → 96px name (y210) → 24px romaji (y317) → 15px gloss (y361) → CTA (y482), all
`text-align: center` on x=720.

## Craft signals present (6)

**`single-optical-anchor`** (rule-ineligible, honest call). The anchor I counted is
the 96px Shippori Mincho name, a ~303x91 box: the next-largest text anywhere is the
24px romaji directly under it, a 4:1 step, and the next mass, the list, is 188px of
14-20px type at lower contrast. It dominates partly because there are only two
masses on the page (card and list), and the card wins both by size and by holding
the only display type. I would not defend this as a design achievement on a page
this small.

**`type-scale-high-contrast`.** By the vocabulary's definition, 96px / 16px body =
**6.0:1**, above the 3.75 cut. The display tier is real: 96px, then 24px, then
11-20px for everything else. **The instrument disagrees and the instrument is
wrong here.** `ladder.cjs` returns `ratio: 1.5` (`maxFs 24`, the romaji "Ono
Kaede"), with `rawMax: 96`, because its letter test is `/[A-Za-z]/` (line 84), ASCII
only. The written rule is "largest text node containing at least one letter"; 小野
楓 is made of Unicode letters (category Lo), and the rule exists to exclude figures
like "$ 2.89", not headlines in a non-Latin script. A second rater running the
script unread will get 1.5 and score absent.

**`custom-type-pairing`.** Three faces, each with one job and no overlap: Shippori
Mincho (400-800, served from Google Fonts in ~25 unicode-range slices) on every
kanji node, the wordmark and the footer tagline; Kosugi Maru on the romaji only
(14px in the list, 24px in the card); Inter on Latin UI and prose. The serif/rounded
split between kanji and romaji is a decision tied to the subject, not a starter
default. Corpus precedent credited Plus Jakarta Sans + Inter on a clean role split;
this split is cleaner.

**`real-product-surface`.** The page is the shipped product, live: the card is the
generator's output and the button runs it. Under the databuddy precedent (shipped
app in the page) this is the strongest form; the doorway rule does not bite,
because the product has already answered when the page loads (a name is on screen).

**`one-accent-discipline`.** Per-element decomposition, not a threshold. A chroma
scan of the strip (every second pixel, chroma = max-min RGB, gate 25) puts the
card, list and button only in the 270° bucket (the `#83609d` purple at full or
reduced alpha) and nothing else. The only other chroma is in the background field:
240° (lavender blob, header band) 2.07+1.03% and 300-330° (blossom blob, footer
corner) ~3.2% of sampled pixels, all from the 110px-blurred discs; the mist blob
blends below chroma 25. Every foreground element carries one hue; the blobs are
field. Same construction as the precedent that kept `present` with a blue blob at
25% opacity.

**`live-claim-control`.** The page's claim is "JAPANESE NAME GENERATOR", quantified
in the footer as "48 surnames · 48 given names · countless stories". The labelled
"Generate a new name" button lets a visitor falsify the quantified half, and it
does: 61 draws gave **12 distinct surnames, 12 distinct given names, 47 distinct full
names, the first exact repeat at draw 5** (in an earlier run, 星野 凛 Hoshino Rin at
presses 3 and 11). The bundle confirms it: `routes-BITAoMhT.js` holds two arrays of
exactly 12 `{kanji, romaji, meaning}` entries each, so 144 combinations, not 2,304.
Same shape as vizleads, whose query field returned 0 rows against "Search any
job". Weaker than vizleads: there is no visitor input, only resampling.

## Absent, with the reading that settled it

`three-card-row`: the only repeated units are three stacked rows, a vertical list.
`emoji-as-icon`: the button's ↻ is U+21BB, computed `"Shippori Mincho"`, and CDP
`getPlatformFontsForNode` resolves it to Menlo-Bold, a text glyph, not a colour
emoji. `badge-pill-spam`: one decorative pill ("• NEW NAME", 110x25); the 名 disc is
the logo mark and the rounded button is the CTA. `generic-line-icon-set`: zero icons.
`testimonial-card-row`: no social proof section. `gradient-fill-cta`: button
`background-image: none` at rest and on hover, flat `oklch(0.55 0.1 310)`.
`scroll-reveal-blank`: nothing to scroll; the only animations are one-shot load
entrances (`soft` 0.5s on the card, `stamp` 0.5s on the name, `rise` 0.45s on list
rows), time-gated, not scroll-gated. `typewriter-headline`: name identical at t=0,
t=6s and t=20s with no input; it changes only on click. `stock-photo-generic`: no
images. `hero-mockup-float`: the haloed card floats, but it is the live product, not
a mockup of one. `asymmetric-split`, `editorial-grid-break`: one centred 560px
column, no break. `density-variation`: one texture, card and three list rows on one
measure; no table, spec, log or dense band to read against an airy one.
`shows-deliverable`: see near-misses.

## Near-misses

- **`shows-deliverable` absent.** The deliverable is the generated name with its
  gloss. I cannot name an entry that could embarrass the vendor: every output is a
  curated name with a flattering gloss, nothing declines, fails or costs. Two
  candidates failed. (a) The first capture's "Recently flipped" showed 陽菜 Hina
  twice in three rows (Akimoto Hina, Mizuhara Hina) with the identical gloss, the
  product's own output exposing its 12-name pool; but that is a random draw, not on
  the page at rest in the other four loads, and a repeat is not a failure. (b) The
  only self-limiting statement ("48 surnames · 48 given names") is footer prose,
  outside the artefact, and it over-claims rather than narrows.
- **`symmetric-everything`** goes absent if a rater uses the text-align count (9/30
  centred) as edotenv/tsenta/deepmark did. I scored mass placement because every
  start-aligned node is half of a mirrored `justify-between` pair.
- **`glass-card-overuse`** goes absent if nested halo rings count as one surface (2
  glass objects).
- **`indigo-violet-accent`**: hue 274.4° is in band, chroma 61 is well under the
  archetype's 142-169. Absent if the signal means the saturated AI indigo.
- **`type-scale-high-contrast`**: 6.0 by the written rule, 1.5 by `ladder.cjs`.
- **`live-claim-control`**: absent if a resample-only button on a tool page does not
  count as a control "over the claim". On a page that is a single-action tool, the
  product and the control are the same object, so every working tool page earns
  this.
- **`single-optical-anchor`**: one mass among two.

## Outside the vocabulary, recorded because a second rater will see it

The page's only quantified claim is false by 4x on each axis: "48 surnames · 48
given names" against 12 and 12 in the shipped bundle. "VOL. 03 · 128" is a
hard-coded start (`generation:128`, incremented per click), and "Recently flipped"
is seeded on load with three random names before the visitor has flipped anything:
invented history. None of this maps to a signal (it is hole 8's axis, provenance,
and that applies only to `shows-deliverable: present`), and none of it moved a
value above.

## Verdict: mixed, net 0

Slop present 6, craft present 6, net **0**. The +4 bar for `slop` is not close.

This is a thin page and both counts should be read that way: 900px, 30 text leaves,
no sections. Most slop signals have nowhere to fire (no card grids, testimonials,
icon sets, pill rows), and three of the six craft signals (`real-product-surface`,
`live-claim-control`, `single-optical-anchor`) fire largely *because* the page is
nothing but the product. What is there splits cleanly: the surface is the AI-builder
kit (three 110px-blurred pastel discs, four stacked glass layers, Inter body, a
purple primary, one centred axis), while the type decisions are specific to the
subject (Mincho for kanji, Kosugi Maru for romaji, a 96px display tier) and the
colour is held to one hue.

Sensitivity, so the call can be checked: reaching +4 needs four of the six craft
calls to flip with every slop call holding. The four most contestable craft calls
are `type-scale-high-contrast` (instrument), `live-claim-control` (tool page),
`single-optical-anchor` (rule-ineligible) and `one-accent-discipline` (pastel
field); even if all four flipped, the page would sit at +4 with
`symmetric-everything` and `glass-card-overuse` both on contestable readings
themselves, and I could not then write the prose separating it from deepmark (+3)
or stripe-2014 (+3). Mixed holds.

## Vocabulary faults found

1. `ladder.cjs` line 84 tests `/[A-Za-z]/`, so on a CJK page it skips the headline
   and reports the romaji: 1.5:1 instead of the rule's 6.0:1. The written rule
   ("at least one letter") is right; the regex should be `\p{L}` with the `u` flag.
2. SCOPE has no case for a page that *is* the product with no marketing wrapper.
   Read literally it excludes the whole card and leaves nothing to score; I scored
   the card as the page's own design decisions.
3. `live-claim-control` and `real-product-surface` fire almost by construction on a
   single-action tool page, so `ai-builder` tool pages will collect craft credit
   their marketing-page peers have to earn.

**Rater B.**

Rater B, blind (no other rater's draft opened). New page, no prior study, so no drift section.

**Capture.** Viewport 1440x900. Walk `~/scratch/antislop/s5/sakura-name-sparkle-B`: 2 tiles,
`clamped: false`, `coverage: 1`, scroller `window`, `docH_before` 900 = `docH_after` 900, both
landings at 0. Stitched to 1 strip of 900px against a 900px page, no drift. The strip ends in the
footer (`48 surnames · 48 given names · countless stories` / `名 · a shōjo of names`, y831-868).
No inner scroller: `html` and `body` both report 900, the probe found no `overflow:auto|scroll`
element taller than its box, and a 1440x1600 viewport reports 1600 (the root is `min-h-screen`).
Mobile 390x844 is also exactly one viewport (844). With JS disabled the SSR body renders 355
characters, the same content with different random names. **A thin page**: one viewport, about
350 characters, three blocks (name card, button, three-row list) between a logo bar and a footer.
No pricing, testimonials, features, imagery or icons, so most slop signals and several craft
signals have nowhere to fire, in both directions.

Lovable's injected chrome (`ASIDE#lovable-badge` "Edit with Lovable", and the `author=Lovable`
meta) is excluded from every signal, as in permit-guide-ai. `context` omits `nav`: the header
bar holds a logo and a non-link `JAPANESE NAME GENERATOR` label, no navigation.

**Scope decision, stated so it can be checked.** The page is not a marketing page with an
embedded product surface; it *is* the product, a client-side Japanese name generator (one route,
`routes-BITAoMhT.js`, 6,600 bytes). The SCOPE rule excludes content inside an embedded surface
because it is "a thing the page is showing, not a decision the page is making about itself".
Here nothing is embedded: the glass card, the blobs, the violet, the centring and the type are
all decisions the maker made about this one page. So I score the whole page as page decisions,
and I credit `real-product-surface` because the visitor is using the real product. The
vocabulary has no rule for a page that is its own product; see the vocabulary note at the end.

## Slop signals present (6)

**`gradient-blob`.** Three absolutely positioned `rounded-full` divs blurred `blur(110px)`:
560x560 `bg-lavender/70` at top-right (x1008 y-160), 520x520 `bg-blossom/70` at bottom-left
(x-112 y572), 420x420 `bg-mist/60` centred behind the button (x510 y300). Tokens:
`--lavender: oklch(85% .05 300)`, `--blossom: oklch(87% .05 350)`, `--mist: oklch(90% .03 220)`.
Pixel chroma (max-min RGB) at their centres in the capture: 27 (top-right), 28 (bottom-left), 20
(centre), against 8 for the plain field (`rgb(244,240,248)`) and 4 inside the card. On an 8px
grid, 35.5% of the viewport sits at chroma 10-29 and 63.5% under 10. Low chroma, but this is the
construction the signal names: coloured circles, blurred, pushed half off-canvas.

**`glass-card-overuse`.** Four `backdrop-filter` surfaces against a threshold of 3: the card
`bg-white/60` `blur(24px)` (560x328), its inner halo `-inset-2.5 bg-white/35` `blur(12px)`
(580x348), its outer halo `-inset-6 bg-white/20` `blur(8px)` (608x376), and the "Recently
flipped" container `bg-white/45` `blur(12px)` (560x188). The two halos are visible surfaces with
their own `ring-white/60` and `ring-white/40` rims.

**`generic-sans-default`.** Body is Inter 16px (`getComputedStyle(body).fontFamily` =
`Inter, sans-serif`), default tracking, and every Latin text node that is not romaji is Inter:
the 12px eyebrows, the 11px pill and counter, the 15px meaning line, the 14px button, the 13px
list meanings, the 12px footer statistic. The display face is a Japanese serif and does not
cancel this, the financial-datasets reading (Literata over Inter, both values present).

**`symmetric-everything`.** Every content block is centred on x720 = 1440/2: card x440-1000,
button x605-836 (centre 720.5), list x440-1000. The only off-axis elements are the logo bar and
footer, `justify-between` across x200-1240, which mirror each other. Nothing in the main column
breaks the axis.

**`indigo-violet-accent`.** `--primary: oklch(55% .1 310)` = `#83609d`, HSL hue 274.4°, chroma
61. OKLCH hue 310 is above the ~277 indigo reference permit-guide-ai used, so violet. It fills the
only CTA and tints the `NEW NAME` pill, and colours every romaji line, the three eyebrows, the
`Vol. 03 · 128` counter and the `名` logo mark. Muted (chroma 61 against sona8's 136), but the
signal reads the hue in any fill.

**`centered-hero-stack`.** Pill (`NEW NAME`) over a 96px headline over a 24px romaji line over a
15px meaning line, then one centred CTA, all on the vertical axis. That the headline is generated
output rather than a slogan does not change the stack.

## Craft signals present (6)

**`single-optical-anchor`** (rule-ineligible, undefined; honest call). I counted the 96px kanji
name as the anchor: ink box 303x139 at x569 y198 (width varies with the draw), near-black
`oklch(0.23 0.04 300)` on a near-white card, four times the next-largest text (24px). The violet
button (231x48) is the only competing mass and is a fraction of its area. Present partly because
"one mass dominates because there is only one mass": the page has no image, chart or second
card, so the test discriminates little here.

**`type-scale-high-contrast`.** Ratio 96 / 16 = **6.0:1**, above the 3.75 cut. The largest text
node with a letter is the kanji name, Shippori Mincho 600 at 96px (`text-8xl`); body is 16px.
Kanji are letters (`/\p{L}/u` matches `藤`), and the "at least one letter" rule exists to exclude
figures like `$ 2.89`, not CJK headlines. **`ladder.cjs` reports 1.5:1** (24 / 16, on the romaji
line) because its letter test is `/[A-Za-z]/`; that is an instrument fault, not a reading of the
page. The ladder below the display term: 96 / 24 / 20 / 15 / 14 / 13 / 12 / 11. Mobile drops the
name to `text-6xl`, 60px, exactly 3.75:1.

**`custom-type-pairing`.** Three Google families, each with a role: Shippori Mincho (Japanese
mincho serif, 400-800 loaded) for the 96px name, the 20px list kanji, the logo and the footer
sign-off; Kosugi Maru (rounded gothic) for every romaji line at 24px and 14px; Inter for UI text.
The mincho for kanji is a subject-led choice, not a default.

**`real-product-surface`.** The page is the running product, not a rebuild or a capture: the
generator in `routes-BITAoMhT.js` draws with `Math.random()` from two arrays and renders the
result, SSR'd with a first name already drawn, so the product has answered before the visitor
acts. Not a doorway: no sign-in, no install step, and the output is on screen at load.

**`one-accent-discipline`.** One accent token. Every chromatic foreground element (CTA fill,
pill, romaji, eyebrows, counter, logo glyph) resolves to `--primary: oklch(55% .1 310)` or an
alpha of it. Per-element decomposition per the COLOUR block: the three blob hues (OKLCH 300, 350,
220) are a background field at chroma 20-28 after blur, carried by no text, border or control.
The shadcn `.dark` block is defined and never applied (no toggle, no `prefers-color-scheme`).

**`live-claim-control`.** "Generate a new name" is a visible, labelled control over the page's
claim, and it does falsify one. The footer states `48 surnames · 48 given names · countless
stories`. The bundle holds **12 surnames and 12 given names** (144 combinations). Driving the
control 300 times returned exactly 12 distinct surnames and 12 distinct given names, the first
repeated given name at draw 5 and surname at draw 7. A visitor clicking a handful of times sees
`黒木` come back (it did three times in my first six clicks). Same standing as vizleads, whose
hero search falsified "Search any job" with 0 rows.

## Absent, with the reading

- `three-card-row`: the three "Recently flipped" items are a vertical list (540x52 each), not a row.
- `emoji-as-icon`: the only glyph-icon is `↻` U+21BB in the button; not
  `\p{Extended_Pictographic}`, and CDP `getPlatformFontsForNode` resolves it to Menlo-Bold, not
  an emoji face. Zero SVG icons outside the Lovable badge.
- `badge-pill-spam`: one decorative pill (`NEW NAME`, 110x25 at y161). `Vol. 03 · 128` has no
  fill; the 36px `名` circle is the logo mark; the 24px `↻` circle sits inside the CTA. 1 < 3.
- `generic-line-icon-set`: no icon set; 2 SVGs on the page, both in the Lovable badge.
- `testimonial-card-row`: no social-proof section.
- `gradient-fill-cta`: the button is flat `oklch(55% .1 310)`, `background-image: none`. No CSS
  gradient anywhere on the page.
- `scroll-reveal-blank`: the page cannot scroll. Load-time keyframes (`soft`, `stamp`, `rise`)
  hold the card and list text at opacity 0 from about 600ms to 1500ms after commit; by 2500ms
  everything is visible with no input. Time-gated, so absent by the dwell rule.
- `typewriter-headline`: 20s dwell, 10 samples, 1 distinct state. The name changes only on click.
- `stock-photo-generic`: zero `img`, `video`, `canvas`, `iframe`.
- `hero-mockup-float`: no mockup. The floating glass card is the live UI, scored under
  `glass-card-overuse`.
- `asymmetric-split`, `editorial-grid-break`: one centred column, nothing breaks it.
- `density-variation`: one band, one rhythm. The densest unit is a three-row list at 52px rows;
  there is no section-to-section change to read against.
- `shows-deliverable`: see near-misses.

## Near-misses

- **`shows-deliverable`, absent, the closest craft call.** The artefact is the product's own
  output (the name card and the three history rows), so "whose work" passes. The procedure then
  asks for the entry that could embarrass the vendor, inside the artefact. I cannot name one that
  is a property of the page. Every value is a draw from 24 hand-written entries chosen to
  flatter ("lotus rising from still water", "a waterway between the tides"). Two candidates,
  both rejected: (1) my capture happened to show `陽菜 Hina` twice in four names (`藤原 陽菜`,
  `黒木 陽菜`), the 12-name pool showing through, but it is a random draw another load will not
  show, not content the page carries; (2) the data glosses `佐藤 Satō` as « wisteria village »,
  which is wrong (`佐` is "assist"), but it is an authoring error a non-Japanese reader cannot
  see, not a narrowing the page chose. The footer's `48 / 48` is marketing prose, not inside the
  artefact, and it is false rather than a refusal.
- `live-claim-control` → absent if a rater holds that a tool's own primary control is not a
  "claim control". Kept present on the vizleads precedent and because it demonstrably falsifies
  the footer claim. Flip: net +1.
- `type-scale-high-contrast` → absent if the ladder's 1.5:1 is taken literally. Flip: net +1.
- `real-product-surface` → absent on "the page shows no product surface; it is one". Flip: +1.
- `one-accent-discipline` → absent if the three blob hues count as accents. Flip: net +1.
- `single-optical-anchor`: rule-ineligible, present mostly because there is one mass. Exclude
  or flip: net +1.
- `gradient-blob` → absent if read on chroma (20-28) rather than construction. Flip: net -1.
- `glass-card-overuse` → absent if counted by visible object (2 glass cards, one wearing two halo
  layers) rather than by surface (4). Flip: net -1.
- `centered-hero-stack` → absent if a generated name is held not to be a hero headline. Flip: -1.

## Verdict: mixed, net 0

Net = 6 slop present − 6 craft present = **0**. That sits mid-band in `mixed` (-6..+3), well
below the +4 that `slop` needs, so the separation argument the rules demand for `slop` does not
arise.

How robust: reaching +4 needs four of the six craft presents to flip with no slop flip. The four
cheapest are each a defensible alternate reading (`live-claim-control`, `type-scale-high-contrast`
on the instrument, `real-product-surface` on scope, `single-optical-anchor` excluded), and all
four together land exactly at +4, the necessary-not-sufficient floor, with three downward slop
near-misses unspent. Even there I could not separate this page from deepmark (+3) or stripe-2014
(+3) in checkable terms: on the slop side it carries the template palette (blobs, glass, violet,
Inter, centring) but none of the multi-section template furniture those signals usually ride
with (card rows, pill runs, icon sets, testimonial rows, gradient CTAs), because the page is too
small to hold any. The six slop presents are real and measured; the page is also a working,
specific product whose type choices fit its subject.

Not an exemplar either: a 900px page scores well on the slop side partly because ten slop
signals have nowhere to fire.

**Recorded fact, not a signal.** The footer's `48 surnames · 48 given names · countless stories`
is false by a factor of four: the shipped arrays hold 12 and 12, confirmed by 300 driven draws.
The `Vol. 03 · 128` counter starts at 128 on every load (`generation: 128` in the initial state)
and increments per click, so it is decoration dressed as a running total.

**Vocabulary note.** Three signals had to be read through a scope the vocabulary does not cover,
a page that is its own product: `real-product-surface` (built to credit a page *showing* its
product), `live-claim-control` (any working tool trivially has one) and the SCOPE rule itself
(which, read literally, would exclude almost the whole page). Separately, `ladder.cjs`'s
`/[A-Za-z]/` letter test misses CJK display type and reports 1.5:1 where the stated procedure
gives 6.0:1.
