---
source: https://correlationstudio.com/
kind: site
cohort: ai-builder
verdict: mixed
studied: 2026-10-18
context: [nav, dashboard, footer]
signals:
  gradient-blob: absent
  three-card-row: absent
  glass-card-overuse: absent
  emoji-as-icon: absent
  generic-sans-default: present
  symmetric-everything: absent
  badge-pill-spam: present
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
  real-product-surface: present
  shows-deliverable: present
  density-variation: absent
  one-accent-discipline: absent
  live-claim-control: absent
materials: [single-theme, video-embed, origin-captured, anchored]
---

**Sampling: random draw.** One of eight drawn with seed 20261018 from the thirty remaining gallery sites (pre-stated exclusions only: unreachable, blank, sign-in wall). Not chosen on any signal.

Rated by two independent blind raters on 2026-10-18, neither reading the other's draft. Both reached `mixed`. They agreed on 26 of 26 signals. Both write-ups follow in full.

**Rater A.**

**Rater A**, blind, new page. Every value above was set from the capture and
the DOM. No other rater's draft was opened.

## What this page is, and how scope was applied

The root URL is not a landing page. It serves the product itself: a logged-out
app shell (fixed 65px header with logo, search, `Pricing` / `Login` / `Sign Up`;
fixed 256px left rail with `Home` / `Topics` and a "FEATURED ON" badge marquee;
fixed 37px status bar `Ready · $CORRIE $0.00998 ▲ 0.0% · Correlation Studio
v2.8.0`) around an infinite feed of the product's output: discoveries,
experiments and dataset cards fetched live from `/api/homefeed/v2?page=1&pageSize=20`.
There is no hero, no features band, no testimonials, no pricing table, no CTA
band. `<title>` is "Correlation Studio — Discovery Mining • Causation Analysis";
meta description "Upload datasets and find statistically significant
correlations across every col[umn]".

The SCOPE rule excludes content inside an *embedded* product surface. Here
nothing is embedded: the page is the surface. I applied it as follows, so a
second rater can check each call against one line:

- **Scored as the page's own decisions:** type, colour, gradients, blur,
  layout and section styling of the shell and the feed (section borders,
  headings, chips, filter bar), and the marketing chrome that exists (header
  CTA, badge rail, pinned vendor posts).
- **Treated as content (not scored for marketing signals):** the data the
  product renders: scatter thumbnails, `r = …` value chips, CSV previews,
  feed-item cover images. These are what `real-product-surface` and
  `shows-deliverable` are about.
- **Position-defined signals** (`three-card-row`, `generic-line-icon-set`,
  `testimonial-card-row`, `centered-hero-stack`, `hero-mockup-float`) are
  absent because the marketing positions they are defined over (feature band,
  hero, quote section) do not exist, not because of the scope rule.

The thin-page caveat applies in its sharpest form: the page is tall (6070px
for the first feed page, unbounded after) but carries almost no marketing
chrome, so most slop signals have nowhere to fire. That is why the net is 0,
and it is not a reason to read the page as an exemplar.

Stack, for the record only: Vite bundle `/assets/index-Uf0djzIp.js`, the
vendor's own API on the same origin, images on `images.correlationstudio.com`,
`meta author` "Matthew Meadows (Rango)". No Lovable/Bolt marker is served; the
builder is not identifiable from the page and plays no part in the verdict.

## Capture

1440x900. Walk `correlation-studio-A` (`~/scratch/antislop/s5/correlation-studio-A/`):
9 tiles, `clamped: false`, `coverage: 1`, scroller `window`, every landing
exact (0, 700 … 4900, then 5600 asked → 5170 landed = `walkHeight` 6070 − 900).
`docH_before` 6070, `docH_after` 10334.

**The growth is infinite-scroll pagination, not reveal-gating.** A 16s dwell at
the top holds `scrollHeight` at 6070 throughout. Scrolling grows it stepwise
only on reaching the bottom: 6070 → 10334 → 14037 → 19402, and 27394 after 40
steps; each increment appends another "What's New / 5× Trending / Earlier from
the community" block. The feed claims "24,564 items" (24,565 on a later load).
No in-flow footer exists at any depth I reached (27394px): the only `<footer>`
is the fixed status bar, which is in every tile. So the "last strip ends in a
footer" check cannot be met by any capture of this page; the first feed page is
the unit rated.

**`stitch.py` failed on it, correctly loudly:** it computes landings from the
settled 10334px height, so it placed tile 8 at y5600 instead of the recorded
5170 and asserted `MISMATCH (page 10334, covered 6500)`. The two strips it
still wrote to `~/scratch/antislop/s5strips/correlation-studio-A-strip{0,1}.png`
contain a 430px duplicated band and should not be used. I re-stitched from
`walk.json`'s recorded landings at the pre-pagination height
(`~/scratch/antislop/s5work/correlation-studio-A/stitch_landed.py`): 3 strips,
3000 + 2800 + 270 = **6070px = page, no drift**
(`s5work/correlation-studio-A/strip{0,1,2}.png`). The last strip ends mid-card
at the point page 2 mounts, with the fixed status bar under it. The left rail
repeating in every band is a `position: fixed` element (256x836 at x0), not
duplicated content.

Mobile 390x844: `scrollHeight` 10070, `scrollWidth` 390, no horizontal
overflow. Theme: `<html data-theme="dark">` is served under an emulated
`prefers-color-scheme: light` (`matchMedia` dark = false, body
`rgb(15,23,42)`); the CSS carries light variants but there is no visitor
control, so `single-theme`.

## Slop signals present (2)

**`generic-sans-default`.** Inter (400/500/600/700, loaded) sets every display
and body node. `ladder.cjs`: `bigFamilies: ["Inter"]`, `smallFamilies:
["Inter", "JetBrains Mono"]`. The largest text, the pinned post's 30px/700
"Google Ads", is Inter; so are the 20px logotype and every 16px/600 card
title. JetBrains Mono (400/500) appears only in data (CSV previews, `r =` chips;
1481 text nodes), never as a display or chrome voice.

**`badge-pill-spam`.** The left rail's "FEATURED ON" block (`.cs-rail-track`,
CSS animation `cs-rail-scroll` 90s) is a vertical marquee of launch-directory
badges: **58 `<img>`, 29 distinct** (Nick Launches, LaunchPanda, Twelve Tools,
Wired Business, Launch List, SumoDir, Launch, Findly.tools, startuups,
Startup Fast, Similarlabs, DeepLaunch.io, Uno Directory, SaaSBison, EasyLaunch,
LemonLaunch, Fazier, Aura++, Starter Best, DailyPings, ListBulb, Launchit,
Smol Launch, KittyLaunch, neeed.directory, Turbo0, OpenHunts, DanielLaunches,
Founder.best, the last a 404 rendering at 0x0). The rail window sits at y682, 210px tall, so **3 full badges and
a fourth partial are above the fold at every moment** (at load: Launchit, Smol
Launch, KittyLaunch, neeed), each a ~26px-tall badge image in a 44px rounded
tile. Purely decorative social proof in marketing chrome: each says only that a
directory listed the product. Counted as pills on the corpus precedent that
counted a YC badge image (123x44) as one. A second, zero-size copy of the same
29 badges sits at y≈6069 rendering at 1x0 (a hidden backlink block); not
counted, it is invisible.

## Craft signals present (2)

**`real-product-surface`.** The page is the live product answering, not a
doorway to it. The feed is fetched at runtime from `/api/homefeed/v2`; its
dataset previews are real series checked value by value against FRED (see
`anchored` below); each discovery card renders the product's own scatter
thumbnail and coefficient. Zero `<canvas>`, one YouTube `<iframe>` (the pinned
promo), 441 SVGs (the scatter thumbnails are inline SVG, 318x179 and 159x89).
Header search is live too: typing `gold` hits
`/api/discoveries/search?query=gold&pageSize=20` and lists discoveries with
coefficients; `zzqqxxvv` returns "No results found".

**`shows-deliverable`.** The deliverable is the mined correlation, and the
page's own "Trending" band carries one that counts against a product titled
"Causation Analysis":

> **Trending: Gold price pullback** → card 2 of 8, visible without scrolling
> the carousel: "Gold - DataHub Gold Prices Monthly vs Total Revenue for Court
> Reporti…" · `r = 0.7976` · "Gold prices star experiment." · Experiment ·
> by Corrie · 0 / 0 votes

Title Inter 16px/600; coefficient `0.7976` JetBrains Mono 16px/600 in `rgb(22,163,74)` on a white chip: legible at page size.
The full title (API) is "…vs Total Revenue for Court Reporting and Stenotype
Services, All Establishments, Employer Firms (REVEF561492ALLEST)". The API's
`experimentMiniCharts` carries the 25 points drawn on the card; I recomputed
Pearson r from them, **0.7976 at n = 25**: gold's annual price against an
annual revenue series, both trending upward over 1998-2022. It is the textbook
spurious correlation, surfaced as a trending discovery by the house account
with nothing on the card flagging it, on a page whose only stated purpose is
finding significant correlations and analysing causation. Nothing on the page
sells catching spurious pairs, so this is unscrubbed product output, not the
capability being sold.

Secondary, not load-bearing: the same band leads with "FreeGoldAPI –
Comprehensive Historical Gold Price Dataset (1258…" `r = 0.9999`, which the API
names as a correlation against "DataHub Gold Prices Monthly", i.e. two copies of
the gold price reported as a discovery. Its partner series is clipped by
`line-clamp`, so it fails the legibility test and I do not rest on it. The 76
"by Corrie" bylines (every card, including "Fresh from the community") and the
vote counts (73 × `0`, 3 × `1`, 1 × `2`) are vendor-aggregate engagement, which
the procedure excludes.

Provenance (hole 8), recorded in `materials`:
- `origin-captured`: the card's value is the API's `"correlationCoefficient":
  0.7975537879492263`, returned live by the vendor's own `/api/homefeed/v2`.
- `anchored`: all 25 `datapointsY` values equal FRED's REVEF561492ALLEST
  1998-2022 (1050, 1136, 1250 … 2977, 3653), and the page's CSV previews match
  FRED to the digit: DCOILBRENTEU 1987-05-20..27 `18.63, 18.45, 18.55, 18.6,
  18.63, 18.6`; OHMFGN 1990-01..06 `1036.5, 1053.7, 1059, 1065.7, 1074.9`.
- not `disclosed`: nothing labels the feed as an example.

## Near-misses (each could have gone the other way)

- **`glass-card-overuse` (absent; the largest risk to the count).** A literal
  `backdrop-filter` census finds **94 surfaces**, all `blur(4px)`: 41
  `r = …` chips (`rgba(255,255,255,0.9)`, 120-130x37), 19 "N discoveries"
  chips (`rgba(0,0,0,0.6)`, 99-113x36), 34 "2 cols 157 rows CSV" chips
  (`rgba(15,23,42,0.8)`, ~125x19); 15 above the fold. Every one is a
  value label overlaid on a data thumbnail inside a feed card; none is a card,
  panel or nav; the tallest is 37px. I classed them as part of the data
  thumbnail (content), on the same footing as the corpus file that held four
  sub-40px blurred controls absent. Read as chrome by the literal rule, this
  flips to present and the net becomes +1. Still `mixed`.
- **`badge-pill-spam` (present).** If launch-badge images are not "pills",
  only the 61x21 `Pinned` pill remains above the fold and the value is absent.
  The 7 filter chips (`All` … `Datasets`, 34px tall, 8px radius) are
  functional controls and were not counted.
- **`one-accent-discipline` (absent).** Two non-semantic accent hues. Blue
  family: `Sign Up` / `All` chip / logo tile `rgb(0,120,212)` (#0078D4, h206),
  logotype and `Home` `rgb(147,197,253)` (h212), "Updated Oct 17" and the
  What's New icon `rgb(56,189,248)` (h198). Orange: the five "Trending:" topic
  headings `rgb(251,146,60)` (h27), flame icons `rgb(249,115,22)`,
  `rgba(124,45,18,0.5)` section borders and a `rgba(67,20,7,0.3)` wash. Green
  and red (`r` sign, `▲ 0.0%`, the `Ready` dot) read as data semantics, not
  accents. If the feed's section styling were excluded as product surface, the
  chrome alone is blue only and this flips to present (net −1, still `mixed`).
- **`live-claim-control` (absent).** The header search is a working live
  control, and `gold` put "DataHub Commodity Prices v2 (Bananas) vs DataHub
  Gold Prices Monthly (Price) r=0.999" third in its results. But the page states
  no central claim in its own visible copy for the control to test (the claim
  lives in `<title>` and meta), and the input is labelled as site search
  ("Search experiments, discoveries, datasets, portfolios — Enter to see all
  results"), not as a demo of a claim. A rater who takes the title as the claim
  would score it present (net −1, `mixed`).
- **`asymmetric-split` (absent).** The shell is 256 / 1184 px, but the narrow
  side holds two nav links and the badge rail: a navigation rail, the default
  shape of an app shell, not a composed content split.
- **`generic-line-icon-set` (absent).** Lucide throughout at stroke 2, mostly
  14px (thumbs-up/down 77 each, calendar 76, refresh 62, database 35, lightbulb
  23, flask 20). The filter chips pair a glyph with its own word, which is the
  "carries nothing" half of the definition, but no glyph sits in a
  feature-icon position; they label controls and card metadata.
- **`stock-photo-generic` (absent).** The pinned "Getting Started" portfolio
  cover (one 640x360 PNG rendered 361x203) puts two generic neon finance panels
  ("S&P 500" candlesticks, "OIL PRICES"), each ~180x101 CSS px, above two real
  product screenshots. It is a feed item's cover image, half of it the product's
  own UI, nowhere near page scale and under no scrim. Provenance unverified.
- **`three-card-row` (absent).** Each band shows three full cards and a
  clipped fourth, but the tracks are carousels: `scrollWidth` 2672 (8 cards) or
  4256 (13 cards) against a 1102px clip, `overflow-x: auto`, `snap-x`. The
  community block is a 3-column grid of 11+ dataset cards, a list layout.
- **`scroll-reveal-blank` (absent).** Walk vs dwell, two fresh loads, 8s
  pre-wait, 7 steps at 900ms (7383ms walk, 7301ms dwell), text census with
  opacity multiplied up the ancestor chain, header/nav/footer excluded:
  2640 nodes at t0 in both, **0 below 8% opacity, 0 newly visible** in either.
  The walk stopped at y4900 so as not to trigger pagination. Page 2 mounting at
  the bottom is a data fetch for more feed, not text hidden in the first page.
- **`typewriter-headline` (absent).** Carousels stay at `scrollLeft: 0` after
  ~8s idle; no headline exists to cycle. The badge rail animates, but it is
  images, not phrases.
- **`indigo-violet-accent` (absent).** No chrome colour falls in the indigo or
  violet range. The only purple is a `rgba(88,28,135,0.2)` → `rgba(30,58,138,0.2)`
  wash behind the YouTube embed, mostly covered by the iframe; the `Pinned`
  border `rgb(30,64,175)` is h226 on a 61x21 pill.
- **`gradient-blob` (absent).** 8 `linear-gradient` fills (7 section washes at
  0.3 alpha inside bordered panels, one 0.2-alpha card backdrop), zero
  `filter: blur`. No blurred disc.
- **`gradient-fill-cta` (absent).** `Sign Up` is solid `rgb(0,120,212)`,
  `background-image: none`.
- **`emoji-as-icon` (absent).** The only pictographic character is U+25B2 in
  "▲ 0.0%", set in Inter in the price readout, a direction sign. The flame is a
  lucide SVG.
- **`type-scale-high-contrast` (absent).** `ladder.cjs`: largest lettered node
  30px ("Google Ads") over body 16px = **1.88:1**, well below 3.75.
- **`custom-type-pairing` (absent).** Inter + JetBrains Mono, but the mono
  never leaves the data; there is no second voice in display or chrome, which
  is the tsenta reading.
- **`single-optical-anchor` (absent; rule-ineligible, undefined; honest
  call).** What I counted: in the opening viewport, three masses compete: the
  30px white "Google Ads" headline over a YouTube embed with a red play button
  (pinned card, 362px wide), the saturated S&P/OIL thumbnail beside it (361px),
  and the What's New band's white `r` chips below. None dominates; this is not a
  case of one mass dominating because it is the only one.
- **`density-variation` (absent).** One density throughout: a pinned row, then
  seven bands of identical 488px height and structure, then a grid of
  identically built CSV cards. No airy section anywhere in 6070px.
- **`symmetric-everything` / `centered-hero-stack` (absent).** 86 of 86
  `h1`-`h3` are `text-align: start`; no hero exists.

## Verdict: `mixed`, net 0 (2 slop, 2 craft)

Net 0 is nowhere near the +4 the `slop` verdict needs, and the call survives
every near-miss above: the worst case for the page (`glass-card-overuse`
present) gives +1, the best case (`one-accent-discipline` and
`live-claim-control` present) gives −2. It is not an exemplar either, and
should not be read as one. The low slop count is mostly the absence of anything
to score: the page has no hero, features band, quote section or CTA band, and
its marketing chrome is a header button, a 29-badge launch marquee and a pinned
promo post. What it does carry is real: a live product surface whose
deliverable is reproducible against FRED, including a spurious gold vs
court-reporting coefficient (r = 0.7976, n = 25) promoted as trending on a site
that sells causation analysis. That is the one honest thing the page does that
most landing pages never do, and it comes from the page being the product,
not from a design decision.

Page height for the record: 6070px for the first feed page at 1440x900,
unbounded below it.

**Rater B.**

**Rater B**, blind, 2026-10-18. Slop 2, craft 2, net **0**. `mixed`.

**What the page is.** There is no marketing page. The logged-out homepage is
the product's own home feed: a fixed app shell (65px header with logo, search,
Pricing / Login / Sign Up; a 256px sidebar with Home, Topics and a "FEATURED
ON" badge rail; a fixed 37px status-bar `<footer>`) around a feed served by
`/api/homefeed/v2?page=1&pageSize=20`. The feed opens on two pinned items (a
"10-Second Promo / Google Ads" post with a YouTube embed, and a "Getting
Started" portfolio), then seven 488px carousel modules ("What's New", five
"Trending: ..." modules, "What's New" again), then a three-column masonry of
dataset cards ("Fresh from the community"). Title and meta claim "Discovery
Mining • Causation Analysis" and "statistically significant correlations".

**Scope line used throughout, stated so a second rater can apply it.** The
page's own self-presentation is the app shell plus the feed's framing (filter
bar, item count, module headings, module frames). The CONTENT of each feed
item (thumbnails, scatter plots, data-preview tables, r-value chips and the
chips overlaid on thumbnails, generated titles, vote counts) is the product
rendering its output, and per the SCOPE block it is not scored for marketing
signals. It is scored for `real-product-surface` and `shows-deliverable`,
which is what those two signals are for.

This is a **thin page** in the restudy brief's sense: no hero, no feature
section, no testimonials, no CTA band, no pricing on the page. Most slop
signals (`centered-hero-stack`, `hero-mockup-float`, `typewriter-headline`,
`testimonial-card-row`, `three-card-row`, `generic-line-icon-set`,
`stock-photo-generic`) have no section to fire on, and the craft signals that
reward composition (`asymmetric-split`, `editorial-grid-break`,
`type-scale-high-contrast`) have nothing to reward either.

## Capture

- Viewport 1440x900. Scroller `window` (no inner scroller; `innerCands` html
  6070/900).
- **The feed is infinite scroll.** The stock `shoot-tiles.cjs` walk reached the
  bottom sentinel and the feed appended page 2: `docH_before` 6070,
  `docH_after` 10334, and `stitch.py` asserted MISMATCH (6500 covered of
  10334). Six forced appends took it to 32194px; the API reports `totalPages:
  1229`, `totalCount: 24565` (the page renders "24,564 items"). No walk can
  reach a settled bottom.
- Re-walked with a byte-for-byte copy of `shoot-tiles.cjs` that adds one line,
  a `page.route` aborting `/api/homefeed/v2?page=N` for N >= 2
  (`~/scratch/antislop/s5work/correlation-studio-B/walk-nopage2.cjs`; 1
  request blocked). Result: 9 tiles, `clamped: false`, `coverage: 1`,
  `docH_before` 6070 = `docH_after` 6070, landings exact except the last
  (asked 5600, landed 5170 = max scroll). `NS_SESSION=s5 stitch.py`: 2 strips,
  1440x4400 + 1440x1670 = 6070px vs page 6070px, OK. The first, failed walk is
  kept in `s5work/correlation-studio-B/first-walk/`.
- **Footer.** The last strip ends on the feed's "Loading..." chip (page 2
  blocked) over the fixed `<footer>` (position fixed, 1184x37 at x256 y863:
  "Ready | $CORRIE | $0.00998 | ▲ 0.0% | Correlation Studio v2.8.0"). That
  status bar is the page's only footer at any depth. The fixed header, sidebar
  and footer reprint in every band of the strips; that is fixed chrome, not
  duplicated content.
- No `<video>`, no `<canvas>`; one `<iframe>` (YouTube embed 327x184); 441
  inline SVGs (scatter thumbnails and Lucide icons). Page text is the same at
  2639 text nodes / 36795 characters at rest, after the walk and after a dwell
  control, so the stills are not missing gated text.
- Theme: body computes `rgb(15, 23, 42)` under both `colorScheme: light` and
  `dark`, no toggle control, no theme key in `localStorage`. Single dark theme.

## Slop signals present (2)

**`generic-sans-default`.** Body computes `Inter, -apple-system, system-ui,
"Segoe UI", Roboto, sans-serif` at 16px. Inter (400/500/600/700 loaded) sets
every chrome string: the 30px/700 H1, the 20px logotype, 16px module headings,
14px filter tabs and nav. 1099 text nodes in Inter. No tracking table, no
second display face. The other loaded face, JetBrains Mono, appears only in
feed-item content (below).

**`badge-pill-spam`.** The sidebar's "FEATURED ON" rail is a CSS marquee
(`.cs-rail-track`, `animation: cs-rail-scroll 90s`, track 3124px inside a
210px `overflow: hidden` viewport at y682-892) of **29 launch-directory badges,
duplicated to 58 `<img>` nodes** for the loop: Nick Launches, LaunchPanda,
twelve.tools, Wired Business, Launch List, SumoDir, Launch, Findly.tools,
startuups, Startup Fast, Similarlabs, DeepLaunch.io, Uno Directory, SaaSBison,
EasyLaunch, LemonLaunch, Fazier, Aura++, Starter Best, DailyPings, ListBulb,
Launchit, Smol Launch, KittyLaunch, neeed.directory, Turbo0, OpenHunts,
DanielLaunches, Founder.best. Each is third-party badge artwork, 62-145 x 26px,
rounded, linking out (most with a `utm_source` backlink). **Four are in frame
at every moment, all above the fold** (y692-888 in the 900px viewport, in a
fixed sidebar so they never leave it). None carries product information.
Counted as pills on the aviern precedent, where a YC badge image (123x44) was
counted as "one pill above the fold". Four is over the 3+ threshold.

## Craft signals present (2)

**`real-product-surface`.** The page is the live product, not a picture of
it: 20 items from a live `GET /api/homefeed/v2?page=1` (304,658 bytes, curl
reproduces it), 21 discovery scatter thumbnails rendered on load by `POST
/api/discoveries/<id>/render-thumbnail`, data-preview tables with row counts
("2 cols 26,405 rows CSV"), most cards stamped "Updated Oct 18" (today). Not a
doorway: the product has answered, with correlation coefficients, discovery
counts and dataset previews, which is the product in use.

**`shows-deliverable`.** The deliverable is a correlation the engine reports.
**The entry that could have embarrassed the vendor**, legible in frame at rest
(16px Inter title, 16px JetBrains Mono chip), is the first card of "Trending:
Gold price pullback" (y≈2700, strip 0):

> `r = 0.9999` / FreeGoldAPI – Comprehensive Historical Gold Price Dataset
> (1258-2025) (price) vs DataHub Gold Prices Monthly (Price)

The gold price correlated with the gold price, presented as a trending finding
on a page that claims "Causation Analysis". Its neighbour in the same module
is the opposite failure, a spurious pairing: `r = 0.7976` Gold - DataHub Gold
Prices Monthly vs Total Revenue for Court Reporting and Stenotype Services.
The same shape repeats at the head of three more modules, all in frame:
gasoline vs gasoline (`r = 0.9995`, GASREGCOVW vs GASREGW), S&P 500 vs S&P 500
(`r = 0.9988`), NASDAQ Composite vs NASDAQ-100 (`r = 0.9984`); and in the
"What's New" carousel `r = 0.9996` Bitcoin - Bitcoin Historical Price USD
(Habrador) vs Bitcoin to USD Historical Price, labelled "Experiment" with "1
discovery". Unscrubbed output is visible too: generated titles doubling their
own IDs ("(CES3133440001) (CES3133440001)", "(DSPIC96) (DSPIC96)"), the same
"Gold vs Brent r = 0.6416" card twice in a row, three `r = 0.5444` cards that
are one pairing against three copies of the Shiller CPI series. This is the
product's own operation, and nothing on the page sells duplicate detection,
so it is not excluded as "the capability the panel is selling".

Provenance, for the materials tokens:
- `origin-captured`: the values arrive in a live request. The Bitcoin pair's
  `correlationCoefficient` is `0.9996232799764029` in the
  `/api/homefeed/v2?page=1` response, displayed rounded to `r = 0.9996`.
- `anchored`: dataset previews check against FRED, which the vendor does not
  control. CUSR0000SETA02 on the page reads 28.7, 28.7, 28.4, 28.3, 27.5,
  26.9 for 1953-01..06; `fred.stlouisfed.org/data/CUSR0000SETA02.txt` reads
  28.700, 28.700, 28.400, 28.300, 27.500, 26.900. DFF reads 1.13, 1.25, 1.25,
  1.25, 0.88, 0.25, 1, 1.25 for 1954-07-01..08 on both. (A direct curl to FRED
  timed out; the check went through WebFetch.)
- Not `disclosed`: nothing labels the feed as example or estimated content.

## Absent, with the measurement

- `scroll-reveal-blank`: 0 of 2639 text nodes under 8% effective opacity at
  rest, 0 after a 9-step walk, 0 in a dwell control waiting the same 17.8s
  without scrolling. Characters identical at 36795 in all three.
- `typewriter-headline`: no cycling text; the search placeholder sampled 6
  times over 6s returns one value.
- `emoji-as-icon`: 0 `Extended_Pictographic` code points in any text node.
  The status bar's "▲" (U+25B2) is a geometric shape in Inter as a ticker
  arrow, not an emoji.
- `indigo-violet-accent`: primary blue is `rgb(0, 120, 212)` (Sign Up fill,
  logo tile, active "All" tab), hue ≈206°. The light logotype is
  `rgb(147, 197, 253)`, hue ≈213°. Neither is indigo/violet.
- `gradient-fill-cta`: Sign Up `background-image: none`, flat fill.
- `gradient-blob`: 8 gradients on the page, none radial, none blurred: seven
  module frames with a horizontal tint wash (`linear-gradient(to right,
  rgba(8,47,73,.3) | rgba(67,20,7,.3), rgb(30,41,59))`) and a 20%-alpha
  blue→purple fill behind the portfolio thumbnail, covered by the image.
- `symmetric-everything`: fixed left sidebar, all module headings left-aligned
  at x=323, carousels clip at the right edge, the pinned row leaves the third
  column empty.
- `type-scale-high-contrast`: `ladder.cjs` ratio **1.88** (largest text node
  "Google Ads", 30px, over 16px body), far below 3.75. The ladder is
  30 / 20 / 16 / 14.
- `editorial-grid-break`: everything sits inside the 1136px feed column at
  x=280; nothing breaks it.
- `custom-type-pairing`: JetBrains Mono 400/500 is loaded, but it appears only
  in feed-item content: 1369 `<td>` + 71 `<th>` in data previews and 41 r-value
  chips. Every chrome string is Inter. One chrome face, and it is the one
  `generic-sans-default` fires on (neuron-industries' coherence argument).
- `density-variation`: the seven modules are identical: 488px tall at a 512px
  pitch, each a `snap-x` track of 320x410 cards (13, 8, 8, 8, 8, 8, 13 cards),
  then a `columns-3` masonry of equal-width cards. One module, repeated.
- `one-accent-discipline`: two hue families in the page's own framing. Blue
  (`rgb(0,120,212)` CTA/logo/active tab, sky-900 borders on both "What's New"
  frames) and orange (`rgb(251, 146, 60)`, hue ≈27°, on all five "Trending:"
  headings, with `rgba(124,45,18,.5)` borders and an orange-tinted wash on
  those five frames). Plus green `rgb(74, 222, 128)` "▲0.0%" in the status
  bar. Green/red r-values inside cards are data colour and are not counted.
- `asymmetric-split`: no split composition. The sidebar/feed division is the
  app shell, and the pinned row is two 361px cards in a three-column grid with
  the third column empty, an unfilled row rather than a split.
- `single-optical-anchor`: honest call absent. Candidates counted: the 30px
  "Google Ads" H1 (inside one of two equal 361px pinned cards), the 20px
  logotype, the blue Sign Up button. None dominates; below the fold every mass
  is a repeat of the 320x410 card. This is not "one mass dominates because
  there is only one mass"; it is many equal masses.
- `live-claim-control`: the controls are a search box, seven feed filter tabs
  and vote buttons. Cards link out to their own pages. Nothing on this page
  lets the visitor test the "statistically significant" / "causation" claim
  in place.
- `three-card-row`, `testimonial-card-row`, `centered-hero-stack`,
  `hero-mockup-float`, `stock-photo-generic`, `generic-line-icon-set`: no
  section of that kind exists (see near-misses for the closest shapes).

## Near-misses: values that could have gone the other way

- **`glass-card-overuse`, the largest scope call.** A raw count finds **94**
  `backdrop-filter: blur(4px)` elements, far over the 3+ threshold. All 94 are
  Tailwind `backdrop-blur-sm` chips inside feed items: 34 "2 cols / N rows /
  CSV" chips on data previews, 22 `bg-white/90` r-value chips and 19
  `bg-white/90` bottom-left chips on scatter thumbnails, 19 `bg-black/60` "N
  discoveries" chips. Largest 130x37. Zero sit on the header (solid
  `rgb(30,41,59)`), sidebar, footer or module frames, and none is a card. Held
  absent on the scope line. A rater scoring the whole page as chrome gets
  present: slop 3, net +1.
- **`generic-line-icon-set`.** One Lucide set, uniform 2px stroke: seven 14px
  filter-tab glyphs (star, star, feather, briefcase, flask-conical, lightbulb,
  database), each beside a label that names the same thing, and 20px house /
  network in the nav. That matches the definition's letter, but these are
  controls and nav in an app shell, not a feature-icon set, and the page has
  no feature section. Held absent (aviern: a Lucide link affordance is not a
  feature icon set). Flipping it: net +1.
- **`badge-pill-spam`.** If badge images are not "pills", this goes absent and
  net falls to -1. Held present on the aviern counting precedent, and because
  a 29-badge looping rail is the clearest decorative-badge mass in the corpus.
- **`one-accent-discipline`.** If the "Trending" modules are read as product
  content rather than framing, the chrome holds one blue accent and the
  value is present (net -1). Held absent: module headings and frames are the
  page arranging its own feed, the same level as section headings on a
  marketing page.
- **`shows-deliverable`.** A rater could read gold-vs-gold as deliberate
  source validation. Held present: it heads a module titled "Trending: Gold
  price pullback", is styled like every other finding, and the stenotype
  pairing beside it has no validation reading at all. Flipping it: net +1.
- **`three-card-row`.** Each carousel shows 3.3 cards in its 1102px clip, the
  deepmark trap; the tracks hold 8 or 13 cards. The community block is
  `columns-3` masonry over 20 items. Neither is a row of three.
- **`stock-photo-generic`.** The "Getting Started" portfolio thumbnail (640x360
  source, 361x203 rendered) is a 2x2 collage: two neon finance graphics ("S&P
  500" over a candlestick field, "OIL PRICES" over a magenta line) and two app
  screenshots. Stock-looking, but it is a user portfolio cover inside a feed
  item, and its source cannot be shown to be stock. Absent; not added to
  materials.

## Verdict

Slop 2 (`generic-sans-default`, `badge-pill-spam`), craft 2
(`real-product-surface`, `shows-deliverable`). **Net 0. `mixed`.**

Not `slop`: net 0 is four points short of the +4 floor, and it stays short
under every near-miss flip at once. Taking every flip that raises the net
(glass present, icon set present, deliverable absent) gives slop 4, craft 1,
net +3: level with deepmark and stripe-2014, still not past them.

Not `exemplar` either, and it should not be rounded there. The two craft
values come from the product being the page, not from composition decisions:
type ratio 1.88, one module repeated seven times, two accent families, no
anchor. The low slop count is partly the thin-page effect: with no hero,
features, testimonials or CTA band, most slop signals have nowhere to fire.
Page height as captured: 6070px for the first feed page, with the feed
continuing for 1229 pages.

What the page does that the template pages in this cohort do not: it puts the
engine's raw output in front of the visitor, failures included. The template
tells it carries are the stock Inter stack and a 29-badge launch-directory
rail, which is the cohort's signature rather than a design choice.
