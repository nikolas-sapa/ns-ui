---
source: https://toolsapp.work/
kind: site
cohort: ai-builder
verdict: mixed
studied: 2026-10-18
context: [hero, features, footer]
signals:
  gradient-blob: absent
  three-card-row: absent
  glass-card-overuse: absent
  emoji-as-icon: present
  generic-sans-default: present
  symmetric-everything: unresolved
  badge-pill-spam: absent
  generic-line-icon-set: absent
  testimonial-card-row: absent
  indigo-violet-accent: absent
  gradient-fill-cta: absent
  scroll-reveal-blank: absent
  typewriter-headline: absent
  stock-photo-generic: absent
  centered-hero-stack: absent
  hero-mockup-float: absent
  asymmetric-split: absent
  single-optical-anchor: absent
  type-scale-high-contrast: absent
  editorial-grid-break: absent
  custom-type-pairing: absent
  real-product-surface: absent
  shows-deliverable: absent
  density-variation: absent
  one-accent-discipline: absent
  live-claim-control: absent
materials: [dual-theme]
---

**Sampling: random draw.** One of eight drawn with seed 20261018 from the thirty remaining gallery sites (pre-stated exclusions only: unreachable, blank, sign-in wall). Not chosen on any signal.

Rated by two independent blind raters on 2026-10-18, neither reading the other's draft. Both reached `mixed`. They agreed on 25 of 26 signals; the 1 split `symmetric-everything` (A absent, B present) are recorded `unresolved`, which never counts toward a rule. Both write-ups follow in full.

**Rater A.**

A free-tools directory ("41 free online tools": calculators, unit converters,
timers, generators), Next.js, set in a neo-brutalist kit whose own class names say
so (`brutalist-card`, `brutalist-heading`, `brutalist-button-primary`,
`-secondary`, `-accent`). Rated blind by rater A from the live page, light theme
(the default, `html.light`).

**Capture.** Viewport 1440x900. `docH_before` 5067 = `docH_after` 5067, scroller
`window` (the only inner candidate is `html.light` at sh 5067 / ch 900, i.e. the
window). 8 tiles, `clamped: false`, `coverage: 1`, `reachedPx` 5067. The last two
tiles both landed at y4167 (max scroll), which the stitcher absorbs: 2 strips,
1440x4400 + 1440x667 = 5067px against a 5067px page, no drift. The last strip ends
in the footer: `© 2024 toolsapp.work - Free Online Tools. All rights reserved.` /
`41 free calculators, converters, and specialized tools. No login required.`
The page is short (5067px) and has no photography, no icons, no testimonials and
no gradients, so most of the vocabulary has nowhere to fire in either direction.

**What the page is, in numbers (Playwright DOM read).** Six bands inside a 1152px
container at x144: an H1 box (y32, 1152x198), a 542-character run-on paragraph
listing tools (y246), a search card (y418), five equal category columns (y561,
`grid-template-columns` 5 x 217.6px, h1419), an "All 41 Tools" card holding a
4 x 262px grid of **42** tool cards (y2029, h1924), and a 2 x 564px pair ("Why
Choose Our Tools?", "Popular Categories", y4001). Footer y4504, 1408px wide, 7 x
144px link columns. Every box is the same unit: `4px solid #000`, radius 0,
`box-shadow: 8px 8px 0 0 #000` (53 elements carry that exact shadow). Zero
`background-image` on any element, zero `backdrop-filter`, zero `<img>`,
`<canvas>`, `<video>` or `<iframe>`, one inline SVG (the 24px moon in the theme
toggle), zero running CSS animations.

## Slop signals present (2)

**`emoji-as-icon` present, one instance.** "Popular Categories" (y≈4050) opens
with `📚 How-to Guides & Tutorials`, an `<a href="/blog/">` whose first glyph is
U+1F4DA. CDP `CSS.getPlatformFontsForNode` on that link: `Inter Black` 26 glyphs,
**`Apple Color Emoji` 1 glyph**. It is the only item in that list with a leading
glyph, and it stands where an icon would. It is marketing chrome, not captured
output. The five ✓ (U+2713) bullets in "Why Choose Our Tools?" were checked the
same way and do NOT count: each renders `Inter Black` + **`Lucida Grande Bold`**
(Inter lacks the glyph; a text face supplies it), which is decent-com's precedent
for ✓/✗ dingbats in a fallback text face. The `→` in six "Browse All ... →"
buttons is Courier text. So the call rests on exactly one emoji. The signal has no
threshold by design (v2 doc: "unambiguous definition, no threshold needed"), so
one instance is present. It is the thinnest call on the file, and as far as I can
tell from the front-matters it is the first `emoji-as-icon: present` in the corpus,
which a merger should know.

**`generic-sans-default` present.** `document.fonts` reports one loaded family,
`__Inter_81887d` (next/font Inter). Of 220 visible text nodes, 179 are Inter (146
at weight 700, 33 at 900; no node anywhere is set at 400) and 41 are the UA
`monospace` generic. Every heading (H1 48px, H2 32px and 18px, H3 16px) and every
body and link node is Inter.

## Craft signals present (0)

None. Each is argued under near-misses below.

## Near-misses

- **`symmetric-everything` absent, on the corpus alignment-count method (acyclic,
  edotenv, osseus).** Every section-level heading is `text-align: start`: the H1
  and all 8 H2s (9/9), and the 7 footer H3s. The H1 is left-ragged in a full-width
  box ("WITHOUT LOGIN" stops at x≈565 of a box ending at x1296); the hero is not
  mirrored. Leaf count: 127 centred, 93 start, and every centred leaf sits inside
  a card or button (42 H3 tool titles, 44 descriptor/caption P, 41 button labels).
  The counter-case is real and a second rater could weigh it the other way: every
  multi-column band is equal tracks (5 x 217.6, 4 x 262, 2 x 564, 7 x 144px),
  there is no unequal split anywhere, and the one centred control (the 448px
  search input at x496) sits on the axis. Held absent because the corpus method
  keys on alignment and mirroring, and equal tracks holding left-aligned content
  are neither. Flipping it gives net +3, still `mixed`.
- **`custom-type-pairing` absent.** There is a role split: the 41 category
  buttons, the search input and the toggle are `font-family: monospace`,
  uppercase, 16px 700; everything else is Inter. But the second slot names no
  face. It is the UA generic keyword, which this Chromium resolves to **Courier
  Bold** (CDP: `Courier`, `isCustomFont: false`), and nothing but Inter is loaded.
  vizleads scored "a system stack ... behind a single loaded family" absent;
  permit-guide-ai's `present` was two named, loaded families (Plus Jakarta Sans +
  Inter). This is the vizleads case at a higher node count. Flipping it gives
  net +1.
- **`indigo-violet-accent` absent.** The purple-ish fill is pure magenta
  `rgb(255,0,255)`, hue 300°, on 12 button backgrounds. It is one leg of an RGB/CMY
  neon rotation (green `rgb(0,255,0)`, magenta, cyan `rgb(0,255,255)`), not the
  indigo/violet band (~240-280°) the signal names. referable-dev recorded a
  magenta (hue 318) separately from the violet that fired the signal; same call.
- **`three-card-row` absent.** Card rows are 5-up, 4-up and 2-up. There is no
  three.
- **`badge-pill-spam` absent.** Above y900 there are 15 saturated blocks (162x81
  each), but they are radius-0 `<button>`s that navigate to tools, not decorative
  pills; no element on the page has a non-zero border radius.
- **`scroll-reveal-blank` absent.** Visible text measured three ways with the
  product of ancestor opacities: on load, after an 8s dwell with no scroll, and
  after a 700px-step walk. 4695 characters and **0** text nodes under 8% opacity
  in all three. No animations run; transitions are hover-only (`all 0.1s` /
  `0.3s`, `color 0.3s`).
- **`one-accent-discipline` absent.** Three accent fills: green x12, magenta x12,
  cyan x17 backgrounds, each with a matching 3px border and `4px 4px 0` shadow in
  its own colour, plus green link text in "Popular Categories" and the whole
  footer. The colour is assigned by position, not meaning: in the Math column
  Basic = green, Scientific = magenta, Percentage = cyan, Circumference = green,
  Date = magenta; Health restarts the cycle at BMI = green. 11.6% of first-viewport
  pixels are chroma > 200.
- **`type-scale-high-contrast` absent.** `ladder.cjs`: largest letter-bearing node
  is the H1 at 48px over body 16px, **ratio 3.0**, below the 3.75 gate. Ladder
  48 / 32 / 20 / 18 / 16 / 14.
- **`single-optical-anchor` absent (rule-ineligible; honest call).** Candidate
  anchor: the H1 box, 1152x198 with a 6px border and 8px shadow, the largest single
  object in the first viewport. It does not dominate: from y685 the first viewport
  also holds 15 equal neon blocks in five columns, and below the fold there are 42
  equal tool cards and no mass larger than another. Not the "one mass because only
  one mass" case: there are dozens of equal masses.
- **`density-variation` absent.** Characters per vertical px by band: hero 1.18
  (590 chars / ≈500px), categories 0.75 (1064 / 1419), all-tools 0.82 (1574 /
  1924), why/popular 1.78 (669 / 375), footer 1.91 (1014 / 531). A 2.5x swing, but
  one texture at different packings (zingy-cannoli's reading): the same bordered,
  hard-shadowed bold box carries every band, and there is no quiet band for a
  dense one to read against.
- **`real-product-surface` absent.** The product is 41 (or 42) single-purpose
  tools, each on its own route. The home page shows none of them in use. Its one
  working control, the search box, live-filters the directory (typing `json`
  yields `Found 1 tool matching "json"` and a one-card "Search Results" panel):
  that is the doorway, not the surface.
- **`shows-deliverable` absent.** No artefact of any tool's output is on the page,
  so there is no entry that could have embarrassed the vendor. No provenance
  tokens are recorded.
- **`live-claim-control` absent.** The central claim is "Free online tools,
  unlimited usage without login". Nothing on this page tests it; the tools that
  could are one click away, off-page. The search filter cannot falsify it.
- **`centered-hero-stack` absent.** H1 and paragraph are `start`-aligned at x144;
  only the search input is centred, inside its own card.
- `asymmetric-split`, `editorial-grid-break`: absent. Every split is equal tracks,
  and nothing crosses the 1152px container except the footer box (1408px), which
  is a wider container, not a break.
- `gradient-blob`, `glass-card-overuse`, `generic-line-icon-set`,
  `gradient-fill-cta`, `typewriter-headline` (the search placeholder is static),
  `stock-photo-generic`, `hero-mockup-float`, `testimonial-card-row`: absent with
  nothing to fire on (zero gradients, zero blur, one SVG, zero images, zero
  animations, no social-proof section).

**Facts with no slot in the vocabulary**, recorded so they are not lost. The
section heading reads **"All 41 Tools" over a grid of 42 distinct cards** (42
unique titles, 42 unique hrefs), and the hero paragraph and footer also say 41:
the page's one countable claim about itself does not match its own content. The
page's `<nav>` element contains only the theme toggle; there is no navigation, so
`nav` is not in `context`. `dual-theme`: the toggle works (dark background
`rgb(26,26,26)`, borders turn green, yellow replaces green in the button rotation).

## Verdict: `mixed`, net +2 (2 slop present, 0 craft present)

Net +2 is below the +4 that `slop` requires, so the verdict is `mixed` without
needing the separation argument. For the record against the +3 mixed anchors:
deepmark carries 7 slop signals against 4 craft, stripe-2014 5 against 4. This
page carries far fewer slop signals than either (2) and no craft at all. It is a
thin page in the sense the brief warns about: 5067px, and most template signals
(gradients, glass, icon sets, testimonials, stock, mockups, reveals) have nowhere
to fire, but nor do the crafts. Both slop calls are narrow (one emoji; Inter).
Its sameness is real (one bordered, hard-shadowed bold box repeated 53 times, with
fills in a fixed positional colour rotation), but the vocabulary records that
only as craft absences (`density-variation`, `one-accent-discipline`,
`single-optical-anchor`), not as slop. Flipping the contested value toward slop
(`symmetric-everything`) gives +3; flipping the contested value toward craft
(`custom-type-pairing`) gives +1; flipping the emoji call gives +1. Every reading
stays `mixed`.

**Rater B.**

**Rater B.**

**Capture facts.** 1440x900 viewport, page height 5067px, 8 tiles, 2 strips
(1440x4400 + 1440x667). `clamped: false`, `coverage: 1`, `docH_before` 5067 =
`docH_after` 5067, scroller `window` (only candidate `html.light`, sh 5067).
The last two landings are the same frame (asked 4200 and 4900, both landed
4167); the stitcher gives the duplicate no band and reports 5067px stitched
against 5067px page, no drift. The last strip ends in the footer: seven link
columns, a 4px rule, `© 2024 toolsapp.work - Free Online Tools. All rights
reserved.` and `41 free calculators, converters, and specialized tools. No
login required.` Next.js app (`/_next/static/...`), Inter via `next/font`
(`__Inter_81887d`), one GA tag. 0 `img`, 0 `video`, 0 `canvas`, 0 `iframe`,
1 `svg` (the theme-toggle glyph).

**The page.** A free-tools directory in a neo-brutalist idiom: every block is
a white box with a 4-6px black border and a hard `8px 8px 0` black shadow, zero
border-radius on every element (radius census: empty). Top to bottom: an H1 box
("FREE ONLINE TOOLS, UNLIMITED USAGE WITHOUT LOGIN", 48px/900, uppercase), a
5-line 20px/700 keyword paragraph listing the tools, a full-width box holding a
centred search input, a band of five equal category columns (Math / Health /
Financial / Unit Converters / Digital & Productivity) each stacking neon link
blocks in generic `monospace`, an "ALL 41 TOOLS" box re-listing the same 41
tools as a 4-up grid of bordered cards, a two-up of "WHY CHOOSE OUR TOOLS?" /
"POPULAR CATEGORIES", and a seven-column footer of the same tool names again.
The only nav is a fixed 48x48 theme toggle top-right (`NAV.fixed`, no links), so
`nav` is not in `context`. The toggle works: `html.light` to `html.dark`, body
`rgb(255,255,255)` to `rgb(26,26,26)`, H1 black to white, borders turn green,
hence `dual-theme`. Everything below is scored on the default light theme.

**Slop present (3).**

- **`generic-sans-default`, present.** Body computes to
  `__Inter_81887d, __Inter_Fallback_81887d` at 16px; 179 of 220 text-bearing
  elements are Inter (33 at 900, 146 at 700), every heading and paragraph. The
  remaining 41 are the neon button labels in the bare generic `monospace`
  keyword (Courier on this host); `document.fonts` holds only Inter. Inter body
  is the corpus-standard `present` (aviern, sona8, permit-guide-ai).
- **`symmetric-everything`, present.** On the corpus alignment-count method
  (acyclic, prilo-ai, neuron-industries): 127 of 215 text leaves compute to
  `text-align: center` (41 BUTTON, 42 H3, 44 P), 88 to `start`, 0 to `end`.
  Mass agrees: every division on the page is an equal split mirrored about
  x=720. Category band, five columns on a 233.5px pitch (H2 at x172 / 406 /
  639 / 873 / 1106); tool grid, four on a 278px pitch (x200 / 478 / 756 /
  1034); the two-up, 508 / 508 at x172 / x760; footer, seven at 168px; the
  H1 box, search box and grid box all 1152 wide at x144. No unequal split exists
  at any level. The only off-axis decision is start-aligned headings inside
  full-width boxes, and the H1's first line spans 955px (x166-1121) of the
  1152px box, so even it sits nearly centred as a mass; its second line,
  "WITHOUT LOGIN" (x166-565), is the page's one left-weighted shape.
- **`emoji-as-icon`, present, one instance.** `📚` (U+1F4DA) leads "How-to
  Guides & Tutorials", the first of seven links in the Popular Categories box
  (`<A>` at x760, y4128, 14px, `color rgb(0,255,0)`). The element's font is
  Inter, which has no U+1F4DA, so it falls back to the system colour-emoji face
  and renders as coloured books (visible in tile 05). It is in marketing chrome,
  prefixing a link exactly where an icon would sit, and it is the only
  pictograph on that list. Not counted alongside it: the five `✓` (U+2713) in
  "Why choose" are text-presentation dingbats set in Inter 14px black as list
  bullets, not emoji; `©` is the copyright line. This is the first `present`
  for this signal in the corpus, on a single glyph; see near-misses.

**Craft present (0).** Every craft signal is `absent`, each on a measurement:

- `type-scale-high-contrast`: `ladder.cjs` 48px H1 / 16px body = **3.0:1**,
  under the 3.75 cut. Ladder 48 / 32 / 32 / 32 / 20, one family.
- `one-accent-discipline`: three full-chroma accents, each chroma 255:
  `rgb(0,255,0)` (12 fills, 12 borders, 139 text colours: every link),
  `rgb(255,0,255)` (12 fills), `rgb(0,255,255)` (17 fills), rotating green /
  magenta / cyan down each column with matching 4px neon offset shadows. Dark
  theme swaps in a fourth, yellow.
- `real-product-surface`: no tool renders on the page. Every neon block and
  every grid card is an `<a>` to a tool route (`/math/basic/`,
  `/math/scientific/`, ...). The search input is functional but filters the
  index ("loan" collapses the page to a "SEARCH RESULTS" group headed "Health &
  Finance"; "spreadsheet" returns the heading and no groups). That is the
  doorway: the product is the 41 calculators, and none answers here.
- `shows-deliverable`: no computed value, result, chart or output anywhere in
  5067px. The only claims are vendor assertions ("Privacy Focused - No data
  tracking or storage", while a GA tag `G-DNRVJRXP4M` loads; that is prose, not
  an artefact entry, so it does not score). Nothing that could embarrass the
  vendor exists to name.
- `live-claim-control`: the central claim is "Unlimited usage without login" /
  "All tools work instantly in your browser". The one control, the search box,
  tests catalogue membership of a list the subhead already enumerates; it
  cannot test free, unlimited, no-login or instant. Same shape as
  permit-guide-ai's search.
- `custom-type-pairing`: Inter plus the unloaded generic `monospace` keyword.
  The second face is the browser default, not a chosen face; no role-split
  pairing.
- `density-variation`: ink per band (pixels more than 40 levels off white or
  chroma over 40, every 2nd px, x144-1304): hero 21.3%, category band 44.5%,
  tool grid 17.0%, why/popular 18.3%, footer 11.9%. The category spike is neon
  fill (33.8 of the 44.5 points is chroma over 60); dark ink alone runs 21.3 /
  10.7 / 17.0 / 14.7 / 6.3%, all of it the same 4-6px borders and 8px shadows.
  One texture, a bordered box listing tool names, repeated in three bands that
  carry the same 41 names (category columns, 4-up grid, footer). No table,
  spec, code or small print.
- `asymmetric-split` and `editorial-grid-break`: every band is an equal division
  inside the same 1152px container; nothing crosses a box edge.
- `single-optical-anchor` (rule-ineligible; my honest call): I counted the H1
  box (1152x198, 6px border, 8px shadow) as the candidate. It does not dominate:
  the 5-line 20px/700 paragraph directly under it is a comparable dark mass, the
  search box carries the same border and shadow at 1152 wide, and from y685 the
  neon blocks enter the first viewport at full chroma. The page has many masses
  of equal frame weight, so "one mass because only one mass" does not apply.

**Near-misses.**

- `emoji-as-icon` (present on one 14px glyph). A rater requiring a repeated
  pattern would score absent; nothing in the vocabulary sets a count, and the
  glyph is used exactly as the signal describes. Absent takes net to +2.
- `symmetric-everything` (present). Against it: 0 of 9 section-level headings
  (H1 + 8 H2) are centred, which is permit-guide-ai's criterion read the other
  way. For it: the corpus method is leaf alignment counts (127/215 centred) and
  mass placement agrees. Absent takes net to +2.
- `three-card-row`, absent: the rows are 5-up, 4-up (41 cards, last row 2),
  2-up and 7-up. No 3-up anywhere, and the corpus requires exactly three
  (zingy-cannoli, tsenta).
- `indigo-violet-accent`, absent: the hues are 120, 300 and 180. Magenta
  `#ff00ff` at 300 sits outside indigo-violet; no blue-violet anywhere.
- `badge-pill-spam`, absent: zero non-zero border-radius on the page, so zero
  pills. The neon blocks are square-cornered links, not labels.
- `scroll-reveal-blank`, absent: an effective-opacity census over every text
  element in the document at load (above and below the fold) found 0 under 8%,
  and `docH` is stable at 5067, so no text can cross from hidden to visible on
  scroll. Dwell control not needed: there is nothing to recover.
- `typewriter-headline`, absent: H1 and the input placeholder ("Search tools...
  (e.g., calculator, converter, timer)") identical across four samples 1.5s
  apart.
- `centered-hero-stack`, absent: H1 `text-align: start` at x166; the paragraph
  is start-aligned; only the search input is centred inside its own box.
- `gradient-blob`, `gradient-fill-cta`, `glass-card-overuse`: 0 gradient
  backgrounds, 0 `backdrop-filter`. `generic-line-icon-set`: one SVG on the
  page. `stock-photo-generic`, `hero-mockup-float`: 0 images, no mockup.
  `testimonial-card-row`: no testimonials section.

**Verdict: mixed. Net +3** (3 slop present, 0 craft present). That ties
deepmark and stripe-2014, the top of `mixed`, and is under the +4 gate, so
`slop` is not available. The two contested calls above can only lower it: if
either goes absent the net is +2, both +1. No reading of this page reaches +4.

What the count does not say, and a second rater should check: this is a thin
page in signal terms. Thirteen of sixteen slop signals are absent on measured
zeros, because the page has nowhere for them to fire (no images, no icons, no
gradients, no testimonials, no pills, no radius). It is not the Lovable/shadcn
template the ai-builder cohort's slop files run; it is a hand-styled brutalist
directory whose only template residue is Inter and grid symmetry. It also earns
nothing: 0 of 10 craft signals, a 3.0:1 scale, three competing neon accents,
the same 41 tool names listed three times, and no tool, output or answer on the
page. A low-slop, zero-craft page at 5067px. `mixed` records that honestly;
`exemplar` is ruled out by the empty craft column and `slop` by the count.
