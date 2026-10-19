---
source: https://www.openmark.co/
kind: site
cohort: ai-builder
verdict: mixed
studied: 2026-10-19
context: [hero, features, cta, footer]
signals:
  gradient-blob: absent
  three-card-row: absent
  glass-card-overuse: absent
  emoji-as-icon: absent
  generic-sans-default: absent
  symmetric-everything: present
  badge-pill-spam: absent
  generic-line-icon-set: present
  testimonial-card-row: absent
  indigo-violet-accent: absent
  gradient-fill-cta: absent
  scroll-reveal-blank: absent
  typewriter-headline: absent
  stock-photo-generic: present
  centered-hero-stack: present
  hero-mockup-float: absent
  asymmetric-split: absent
  single-optical-anchor: absent
  type-scale-high-contrast: present
  editorial-grid-break: absent
  custom-type-pairing: absent
  real-product-surface: present
  shows-deliverable: absent
  density-variation: absent
  one-accent-discipline: present
  live-claim-control: absent
materials: [single-theme, video-hero]
---

**Sampling: random draw.** One of twelve drawn with seed 20261019 from the twenty-two gallery sites left after the first draw (same pre-stated exclusions). `gunsvzombies`, drawn first, returned 404 (project deleted) and was replaced from the same seed by `openmark`. Not chosen on any signal.

Rated by two independent blind raters on 2026-10-19, neither reading the other's draft. Both reached `mixed`. They agreed on 26 of 26 signals. Both write-ups follow in full.

**Rater A.**

**Rater A.**

Rater A, blind. New page, no prior study, so no drift section.

**Capture facts.** Viewport 1440x900. Walk: `docH_before` 3611, `docH_after`
3611, scroller `window`, 6 tiles, landings 0 / 700 / 1400 / 2100 / 2711 / 2711,
`clamped: false`, `coverage: 1`. The last two tiles both land at 2711 (the
bottom clamp), so tiles 04 and 05 are the same final viewport (identical file
size, 70,365 bytes); the stitcher handled it: one strip, 3611px against a
3611px page, OK. The strip ends in a footer: Resources / Legal / About columns,
a TinyLaunch "No.3 Product of the Week" badge, `© 2026 Openmark`, X and
Pinterest icons.

**What the page is.** A Vite SPA (`assets/vendor.js`, `assets/main2.js`, gtag)
with assets in a Supabase storage bucket: a free logo catalogue (164 marks at
`/gallery`) plus a paid custom-design inquiry form at `/contact` (budget select
from "Under $500" to "$5,000+"). The home page has **no nav at all**: zero
`header`/`nav` anchors, and the wordmark at the top of the hero is an unlinked
SVG (`h-9 mx-auto mb-32`). Six bands: hero (724px), "Latest Additions" logo
grid (1107), "Everything You Need" feature row (553), a one-sentence CTA band
(449), "Stay Updated" newsletter (365), footer (413). About 1,490 lettered
characters in all.

**Thin page, and it is doing work in the score.** No pricing, testimonials,
stats, FAQ or nav exists, so `badge-pill-spam`, `testimonial-card-row`,
`glass-card-overuse` and `hero-mockup-float` have almost nowhere to fire, and
neither do `asymmetric-split`, `editorial-grid-break` or `shows-deliverable`.

Colour tokens are shadcn's zinc dark theme unmodified (`--background: 240 10%
3.9%`, `--foreground: 0 0% 98%`, `--accent` / `--muted` / `--border: 240 3.7%
15.9%`). `html.dark` is hard-coded, the stylesheets carry 0
`prefers-color-scheme` rules, and emulating a light scheme leaves `body` at
`rgb(9,9,11)`: `single-theme`.

**Hero video, measured, because three signals turn on it.** One `<video>`,
`background.mp4` from the Supabase `videos/` bucket: 1920x1080, 15.0s,
`autoplay loop muted`, 19.8MB, rendered 1440x724, fading in on load
(`transition-opacity duration-500`). Over it sits `div.absolute.inset-0.bg-black/85`,
`rgba(0,0,0,0.85)`, the full hero. I pulled frames from the raw clip through
Chromium (ffmpeg on this machine is broken, a missing `libx265` dylib, so no
container metadata). The raw clip is an iridescent liquid-chrome render with no
relation to logos. Of pixels with raw chroma > 40 (82-91% of the frame), 30°
hue buckets at t = 4 / 7.5 / 11 / 14s: 240° 0.43-0.50, 210° 0.26-0.29, 270°
0.12-0.16, 180° 0.04-0.05, 300° 0.02-0.07. Raw mean chroma 89-102, p95 166-175.
Under the 85% scrim (each channel x0.15) the rendered field is mean chroma
13.3-15.3, p95 24.9-26.3, max 35.1-35.7.

**Slop signals present (4).**

- `symmetric-everything`. `symmetry.cjs`: basis `h1-h2`, n = 4, centred 4,
  share **1.00**, against the 0.85 cut. Headings: the H1, "Latest Additions",
  "Everything You Need", "Stay Updated". The only non-centred blocks on the
  page are the logo-card name labels (product content) and the footer columns.
- `generic-line-icon-set`. "Everything You Need" is four lucide glyphs,
  `lucide-palette`, `lucide-zap`, `lucide-shield-check`, `lucide-sparkles`,
  each `h-8 w-8` (32x32), `stroke-width 2`, each in an identical 64x64 tile
  `rgb(39,39,42)` radius 8px, above the titles "Professional Design", "Instant
  Download", "Commercial License", "Custom Branding". One set, uniform stroke
  and size, and each glyph restates its title's keyword (palette = design, bolt
  = instant, shield = license, sparkles = custom). Nothing the heading doesn't.
- `stock-photo-generic`. The hero clip fires on both prongs of the definition.
  "Could belong to any company": an iridescent liquid render has no relation to
  logos, open source or design. "Stock the type cannot survive on so a scrim is
  bolted over it": the scrim is literal, an 85% black layer over the full
  1440x724 hero, which cuts mean chroma from 89-102 to 13-15 so the white 72px
  H1 can sit on it. Provenance is unproven, as on sona8, whose present also
  rests on "could belong to any company" rather than on a licence trace. The
  medium is video, not a photograph; the definition's two tests are about the
  imagery's role and both apply unchanged.
- `centered-hero-stack`. The hero holds exactly four things, all on the page
  axis: the wordmark (`mx-auto`), the H1 (72px, `text-align: center`, box 896
  wide at x272, centre offset **0px** from 720), the subhead (20px,
  `rgb(161,161,170)`, centred) and one CTA, "Browse Gallery" 182x44, centred.

**Craft signals present (3).**

- `type-scale-high-contrast`. `ladder.cjs`: ratio **4.5** (72/16),
  `ratioSub` 3.6 (72/20). Ladder 72 / 36 / 30 / 30 / 24 / 20 / 16, one family
  (Outfit). The H1 is set as display: weight 700, tracking -1.8px, line-height
  72px (1.0). Present on precedent: toppic and permit-guide-ai both sit at
  exactly 4.5 off a 72px H1 over 16px body and both read present, each with the
  same caveat I record here, that the step is a stock Tailwind `text-7xl` and
  the next size down (36) is exactly half.
- `real-product-surface`. The "Latest Additions" grid is the live catalogue,
  not a picture of it. Its 8 cards carry the same class string as `/gallery`'s
  cards (`group border border-zinc-800 hover:border-zinc-700 transition-colors
  relative`), show the same 8 slugs in the same order (flagmark, blocb,
  pixelbird, aetheris, optura, ignara, linkora, arboris = gallery positions 1-8
  of 164), load the same SVGs from the Supabase `logos/` bucket, and each links
  to `/logo/<slug>`. Rendered 288x349 here against 312x373 on `/gallery` (a
  narrower container). The doorway test passes: browsing the marks is the
  product in use, not a sign-in, an install snippet or an empty command line.
- `one-accent-discipline`. Zero accents, which counts as present. Over every
  visible element, no text colour and no background colour has chroma > 20.
  The whole UI is zinc: body `rgb(9,9,11)`, text `rgb(250,250,250)`, muted
  `rgb(161,161,170)`, borders and icon tiles `rgb(39,39,42)`. The buttons are
  `rgb(250,250,250)`, `rgb(255,255,255)`, or `rgb(9,9,11)` with a 1px
  `rgb(39,39,42)` border. The only chroma on the page is the hero video, one
  element, a background field under an 85% scrim (see `indigo-violet-accent`).

**Absent, with the measurement.**

- `gradient-blob`: one gradient declaration on the page, the H1's
  `bg-gradient-to-r` text fill, `rgb(250,250,250)` to `rgba(250,250,250,0.9)`
  to `rgb(250,250,250)`, chroma 0. Zero chromatic CSS gradients, zero blur
  filters. The video is the near-miss (below).
- `three-card-row`: the feature row is four 280px columns at x112 / 424 / 736 /
  1048, each with background `rgba(0,0,0,0)`, border 0, shadow none. That's four
  bare columns, not three cards. The 4x2 logo grid is catalogue records, which SCOPE excludes.
- `glass-card-overuse`: 0 elements with a `backdrop-filter`.
- `emoji-as-icon`: 0 emoji or dingbat code points in any text node.
- `generic-sans-default`: Outfit carries every text-bearing element (400 x93,
  500 x17, 600 x6, 700 x5). Not Inter, Geist or a system stack; absent on face
  identity, as dachly (Outfit) was.
- `badge-pill-spam`: the pill detector (radius >= height/2, height < 60,
  carrying text) matched 0 elements on the home page.
- `testimonial-card-row`: no testimonial section. The TinyLaunch badge (250x76,
  footer) is an award, not a quote.
- `gradient-fill-cta`: six buttons, every one `background-image: none`, fills
  listed above.
- `scroll-reveal-blank`: 40 lettered text nodes, effective opacity taken as the
  product over ancestors. Dwell control (load + 1.5s, then 6s still): 0 under
  8% at either point. Walk (0 to 3600 in 600px steps, 850ms each, same elapsed
  time): 0 under 8% at the start, 0 crossed, 0 left under 8%.
- `typewriter-headline`: H1 sampled six times over 6s, one distinct string.
- `hero-mockup-float`: no mockup; the hero is the four items above plus video
  and scrim.
- `asymmetric-split`: no two-column split in any band; the footer's 288 / 288
  / 608 columns are link lists.
- `single-optical-anchor` (rule-ineligible; my honest call). Counted as the
  anchor: the H1, 896x196, the only mass in the first 900px beside a 182x44
  button and a texture at 15% strength. **One mass dominates because there is
  only one mass.** Below the fold there is no anchor at all: eight equal tiles,
  then four equal columns. Absent.
- `editorial-grid-break`: every band's content sits in one centred container;
  nothing crosses it. The full-bleed video is a background band, not a break.
- `custom-type-pairing`: one family.
- `shows-deliverable`: **I cannot name an entry that could embarrass the
  vendor.** The deliverable is the logos; the eight shown are clean marks at
  120px, and "Commercial License: Perfect for all uses, no attribution
  required." is the broadest possible claim, not a narrowing.
- `density-variation`: ink coverage per band off the strip (pixels more than
  40 levels from the band's modal background, decent-com's method): Latest
  Additions 4.12%, Everything You Need 2.22%, CTA 2.94%, Stay Updated 2.82%,
  footer 5.53%. Each band below the hero uses the same template: a centred h2,
  a grey subhead, one block. decent-com read absent at 3.43-5.84%. The hero is
  excluded because the method fails on it: its modal colour came back
  `rgb(250,250,250)`, the H1's ink, not a background.
- `live-claim-control`: the central claim is "free, open-source logos". At
  rest, nothing on the home page lets a visitor test it. The cards link out to
  `/logo/<slug>`, where "Download Original Logo", "Change Color" and "Add
  Business Name" live.

**Near-misses.**

- `indigo-violet-accent` (absent, could be present). "The hue, in any fill":
  the hero is the page's only colour and it is blue-violet. Held absent on two
  measurements. (1) The dominant bucket is 240° (0.43-0.50), which is blue, not
  indigo or violet; the 270° bucket is 0.12-0.16. (2) Per element, all of the
  page's chroma comes from one background element scrimmed to p95 chroma 25.
  No CTA, link, heading or surface carries it. That is the glowcase reasoning:
  lilac fills absent because the hue never reaches a CTA or link.
- `gradient-blob` (absent, could be present). The video is an amorphous
  ornamental colour field with no content role, the blob's job done in
  footage. Held absent because the corpus reads this signal off CSS gradients
  (sentient-os, browserbase-com, decent-com), and because the same element is
  already scored under `stock-photo-generic`. Counting it again would score
  one decision twice, the hazard the vocabulary names for
  `symmetric-everything`.
- `stock-photo-generic` (present, could be absent). It rests on the role tests,
  not on provenance, and the medium is video. A rater who reads the signal as
  photographs only would move the net to 0.
- `type-scale-high-contrast` (present, could be absent). It clears 3.75 by
  0.75, but the step is a template default. Dropping it gives net +2.
- `real-product-surface` (present, could be absent). Someone could argue the product's working
  surface is `/logo/<slug>` (recolour, add a name, download) and that the grid
  is the shelf, not the tool. Held present because the catalogue is what the
  product presents in use, rendered live from the same records and component.
- `shows-deliverable` (absent). The grid is a recency feed, not a curated set:
  the image filenames carry upload timestamps, newest `1757653214890` =
  2025-09-12 and oldest of the eight `1757044447935` = 2025-09-05. So "Latest
  Additions" is 13 months stale against the footer's `© 2026`. That fact could
  count against the vendor, but it lives only in image URLs, not legible at
  page size, so it does not count. `/gallery`'s "Exclusive" filter, which
  narrows "free", is a page away and not scored at rest.
- `three-card-row` (absent). Four-up, zero card chrome. The corpus has
  already held four-up rows short of the signal.
- `materials`: the eight SVG marks could be read as `illustration`. I left it
  out because they are the product's catalogue content, not artwork the page
  uses to present itself.

**Verdict: `mixed`, net +1** (4 slop present, 3 craft present). That is two
below deepmark and stripe-2014 (+3, mixed), so no separation prose is owed. I
checked how far the most slop-ward reading goes. Add `gradient-blob` and
`indigo-violet-accent` (both off the hero video) and `three-card-row` (the
feature row): 7 slop. Drop `type-scale-high-contrast` and
`real-product-surface`: 1 craft (`one-accent-discipline` survives even then,
since one hue in one element is still one accent). That reaches net +6. I
cannot defend it in terms a second rater could check. Three of its five moves
re-count a single element, the scrimmed video already scored under
`stock-photo-generic`. The fourth contradicts the four-up precedent on columns
with no card chrome. The fifth reads the doorway rule against a live
catalogue. What the page measurably is: a shadcn zinc-dark template, every
heading centred, a stock lucide row, a stock-looking liquid clip under an 85%
scrim, and against that a real, live product grid and a palette with no accent
at all. On this vocabulary that is `mixed`.

**Rater B.**

Rater B, blind. New page, no prior study, so no drift section.

**Capture.** 1440x900 viewport, window scroller (no inner-scroll candidate above
docH). Page height 3611px, unchanged before and after the walk. 6 tiles, the last two
clamped at y2711 as expected; `clamped: false`, `coverage: 1.0`. Stitched to one strip
of 1440x3611, matching settled height with zero drift. The strip ends in the footer
(Resources / Legal / About columns, TinyLaunch badge, `© 2026 Openmark`, X and
Pinterest glyphs). No header or nav: the only top chrome is a 183x36 SVG wordmark
centred inside the hero. A thin page: five sections and a footer, 42 visible text
nodes in all, so many signals have nowhere to fire.

Sections (DOM): hero y0 h724; "Latest Additions" logo grid y724 h1107; "Everything
You Need" feature row y1831 h553; one-sentence CTA band y2384 h449; "Stay Updated"
newsletter y2833 h365; footer y3198 h413.

The hero carries a `<video>` (autoplay, loop, muted, 1920x1080, 15s,
`.../videos/background.mp4` on the site's Supabase bucket) under a `bg-black/85`
scrim. The walker freezes animation, so I read it separately: with the scrim hidden
and the video seeked to 1s, 7s and 13s, frames are an iridescent liquid-chrome render
in blue, violet, magenta and cyan, mean RGB chroma 82-94 and max 231-235 (180x90
downsample). As rendered under the scrim the same region reads mean chroma 13, max
35: a dark field with faint violet swirls.

## Present slop signals (4)

**`symmetric-everything`.** `symmetry.cjs` on h1/h2: 4 of 4 section headings centred
("Professional Open-Source Logos for Visionaries", "Latest Additions", "Everything You
Need", "Stay Updated"), share 1.00 against the 0.85 cut. Not borderline: the
one-sentence CTA band (24px) and the subscribe form are centred too, and the only
left-set text on the page is inside the logo cards' name strips and the footer.

**`generic-line-icon-set`.** The feature row is four lucide icons from one set:
`lucide-palette`, `lucide-zap`, `lucide-shield-check`, `lucide-sparkles`, all
`stroke-width="2"`, all 32x32, each in an identical 64x64 `rgb(39,39,42)` tile at
`border-radius: 8px`. Each restates its heading and nothing more: palette over
"Professional Design", zap over "Instant Download", shield-check over "Commercial
License", sparkles over "Custom Branding". Uniform stroke and size, carrying nothing
the adjacent heading doesn't.

**`stock-photo-generic`.** Both clauses of the definition are measured on the hero
video. "Stock the type cannot survive on so a scrim is bolted over it": the authored
frames run mean luminance 97-106 with cyan and white streaks behind the 20px grey
subhead, which is illegible on the raw frames I shot, and the page answers with a
literal `rgba(0,0,0,0.85)` full-bleed overlay, discarding about 85% of the asset to
make the type readable. "Could belong to any company": an abstract holographic-liquid
loop has no relation to logos, the catalogue, or Openmark. Caveat a second rater
should weigh: the signal's examples are photographs and this is a CGI loop, and I did
not establish stock provenance (local ffmpeg was broken, so no frame-level reverse
search). I score the decision the signal names (generic imagery needing a scrim), not
the medium. For the same reason it is not recorded as `stock-photo` in materials;
`video-hero` is the material.

**`centered-hero-stack`.** Wordmark, 72px h1, 20px subhead, one 14px "Browse Gallery"
button, all on the vertical axis, nothing else in the 724px hero.

## Present craft signals (3)

**`type-scale-high-contrast`.** `ladder.cjs`: largest lettered node 72px Outfit 700
over body 16px, ratio 4.50 (3.6 against the 20px subhead). Ladder 72 / 36 / 30 / 30 /
24 / 20 / 18 / 16 / 14, with a clean 2:1 at the top step. Above the 3.75 threshold,
and it sits with the calibration group read present at 4.5:1 (linear-app, and
dipole-labs at an identical 72/16) and at 4:1 (sona8, truemile, squarespace-2014).
Tracking is set on the display steps only (-1.8px at 72, -0.9px at 36; every other
size `normal`), the stock `tracking-tight` utility, which is why this is listed as a
near-miss below.

**`real-product-surface`.** The product is a catalogue of free logos. The "Latest
Additions" grid is the product's own card component, not a rendering of it: the
home's first card and `/gallery`'s first card have byte-identical markup (`a.group
border border-zinc-800 ...`, `img.w-[7.5rem] ... brightness-0 invert opacity-80`), and
the home's eight hrefs (`/logo/flagmark` through `/logo/arboris`) are `/gallery`'s
first eight of 164. Images are live SVGs from the site's `logos` storage bucket
(timestamped filenames, `logo-157` to `logo-164`). That is the product presenting
itself in use, browsing the catalogue, not a doorway: no sign-in, no install step.

**`one-accent-discipline`.** Zero accents, which the decided rule counts as present.
Every computed foreground, background and border colour in the marketing chrome is
zinc/neutral: the highest chroma anywhere is `rgb(161,161,170)` muted text at chroma
9; buttons are `rgb(250,250,250)` with `rgb(24,24,27)` text or the inverse. The only
hue on the page is the scrimmed video (rendered mean chroma 13), a background
material, not an accent in any fill.

## Near-misses

- **`gradient-blob`, absent.** The obvious competing home for the hero video. It is a
  full-bleed texture, not a blurred disc or soft gradient field: zero `filter: blur`
  discs, and the only CSS gradient on the page is one h1 span running white to
  white-at-0.9 to white (invisible). Scoring the video here as well as under
  `stock-photo-generic` would count one asset twice, the double-count the
  `symmetric-everything` procedure warns against. A rater who reads the video as a
  colour field rather than as generic imagery would move it here instead; the count
  is unchanged either way.
- **`stock-photo-generic`, present.** Could go absent on the "it is not a photograph"
  reading or for lack of a proven stock source. Net then 0.
- **`indigo-violet-accent`, absent.** The raw video is the archetypal blue-violet
  palette, but it renders at mean chroma 13 behind an 85% scrim and appears in no UI
  fill, text or border.
- **`generic-sans-default`, absent on face identity.** One family, Outfit 400/500/600/
  700 loaded from Google Fonts (`family=Outfit:wght@300;400;500;600;700`), carries
  everything. Not Inter, Geist or a system stack; dachly reads Outfit absent on the
  same basis. The railway discriminator (a default face with no compensating tracking
  table) is triggered by a default face, which this is not. A rater treating Outfit
  as an AI-builder default would flip it.
- **`type-scale-high-contrast`, present.** 72px over 16px is Tailwind `text-7xl` over
  `text-base`, a template step rather than an authored scale, and the threshold is
  necessary, not sufficient. Held present because the ratio and the 2:1 top step match
  pages scored present; the five files at exactly 3.75 that split are well below this.
- **`real-product-surface`, present.** Could go absent if the product is read as the
  per-logo detail flow (`/logo/flagmark`: "Change Color", "Add Business Name",
  "Download Original Logo") and the grid as a shop window onto it. Held present
  because browsing the catalogue is the product's primary use and the cards are its
  real component with live data, the stripe-2014 Checkout logic.
- **`three-card-row`, absent.** The feature row is four items with no card chrome (no
  background, no border). The logo grid is 4x2 product content, out of scope.
- **`density-variation`, absent.** Ink by band (pixels more than 60 summed RGB levels
  off the band's modal colour, every third pixel), non-hero bands: logo grid 5.4%,
  features 4.8%, CTA 3.7%, newsletter 5.5%, footer 6.2%. Five bands inside 3.7-6.2%,
  each a centred heading over content on a 96px pad (the CTA band 128px). One texture
  at one rhythm. The hero is a video frame and was not read.
- **`single-optical-anchor`, absent (rule-ineligible, honest call).** What I counted
  as the anchor: the 72px two-line h1. It dominates the fold only because it is the
  only mass there (the rest of the hero is a 36px-tall wordmark, one 20px line and a
  40px button): "one mass dominates because there is only one mass". Page-wide, the
  largest mass is the uniform 4x2 logo grid, in which no tile leads.
- **`shows-deliverable`, absent.** The eight logos are the deliverable, and no entry
  could embarrass the vendor: each is a polished mark, and CSS (`brightness-0 invert
  opacity-80`) renders all eight in the same 80% white, so they do not even differ in
  colour. The one narrowing on the page, the footer's "concepts created by a
  professional designer ... a fast, functional starting point", is prose outside the
  artefact.
- **`live-claim-control`, absent.** The central claim (free, open-source, no
  attribution, instant download) is checkable one click away on a logo detail page,
  but nothing on this page at rest lets the visitor test it; the controls are links.
- **`scroll-reveal-blank`, absent.** 42 visible text nodes, 0 under 8% effective
  opacity at rest, 0 after a 9s dwell, 0 after a stepped scroll to the bottom. 9
  elements carry an opacity transition (card hover states); none gate text.
- **`asymmetric-split`, absent.** Nothing on the page is a split; the only uneven
  columns are the footer's 288 / 288 / 608px.
- **`typewriter-headline`, absent.** h1 and subhead text identical across four reads
  over 6s.
- **`glass-card-overuse`, `badge-pill-spam`, `emoji-as-icon`, `gradient-fill-cta`,
  `hero-mockup-float`, `testimonial-card-row`**: zero `backdrop-filter` surfaces, zero
  pills, zero emoji (the "№3" is inside the TinyLaunch badge SVG), every button a flat
  fill, no mockup, no testimonial section.

## Verdict: mixed, net +1

Slop 4 (`symmetric-everything`, `generic-line-icon-set`, `stock-photo-generic`,
`centered-hero-stack`) minus craft 3 (`type-scale-high-contrast`,
`real-product-surface`, `one-accent-discipline`) = +1.

The verdict survives every near-miss above taken singly. Moving the video from
`stock-photo-generic` to `gradient-blob` leaves +1; dropping it gives 0; adding
`generic-sans-default` gives +2; losing `real-product-surface` gives +2. Reaching the
+4 the slop rule requires takes three contested calls stacked: the video counted
twice (blob and stock), Outfit as generic, and the catalogue grid rejected as a
product surface. I would not defend that combination, and even there the page would
still need prose separating it from deepmark and stripe-2014 at +3, which I cannot
write: like them it pairs template moves with real craft (here a live product slice
and total colour restraint).

What the page is: a template-shaped dark marketing shell (centred stacks, a lucide
feature row, a scrimmed abstract video) wrapped round a real, live product slice, in
one considered face with no accent at all. Part of the restraint is a thin page with
nowhere to go wrong (3611px, 42 text nodes), and it should not be read toward
`exemplar`.
