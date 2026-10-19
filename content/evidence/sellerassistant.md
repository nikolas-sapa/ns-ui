---
source: https://sellerassistant.io/
kind: site
cohort: ai-builder
verdict: mixed
studied: 2026-10-19
context: [hero, nav, features, integrations, cta, footer]
signals:
  gradient-blob: absent
  three-card-row: absent
  glass-card-overuse: absent
  emoji-as-icon: absent
  generic-sans-default: present
  symmetric-everything: absent
  badge-pill-spam: absent
  generic-line-icon-set: present
  testimonial-card-row: absent
  indigo-violet-accent: present
  gradient-fill-cta: absent
  scroll-reveal-blank: absent
  typewriter-headline: absent
  stock-photo-generic: absent
  centered-hero-stack: absent
  hero-mockup-float: absent
  asymmetric-split: present
  single-optical-anchor: absent
  type-scale-high-contrast: absent
  editorial-grid-break: absent
  custom-type-pairing: absent
  real-product-surface: absent
  shows-deliverable: absent
  density-variation: absent
  one-accent-discipline: absent
  live-claim-control: absent
materials: [single-theme, illustration]
---

**Sampling: random draw.** One of twelve drawn with seed 20261019 from the twenty-two gallery sites left after the first draw (same pre-stated exclusions). `gunsvzombies`, drawn first, returned 404 (project deleted) and was replaced from the same seed by `openmark`. Not chosen on any signal.

Rated by two independent blind raters on 2026-10-19, neither reading the other's draft. Both reached `mixed`. They agreed on 26 of 26 signals. Both write-ups follow in full.

**Rater A.**

Rater A, blind. New page, no prior study, so no drift section.

**Capture facts.** 1440x900 viewport. `shoot-tiles.cjs` into `s5/sellerassistant-A`:
4 tiles, scroller `window`, `docH_before` 2145 = `docH_after` 2145, `innerCands` only
`html` (sh 2145), `clamped: false`, `coverage: 1`. Landings 0, 700, 1245, 1245: the last
two asks (1400, 2100) both stop at the max scroll of 1245, so tiles 02 and 03 are the
same frame (byte-identical, 395,661 B), which is the page ending, not a clamp. Stitched to
one strip, 1440x2145 against a 2145px page, `OK`, no drift. The strip ends in the footer
(`© 2026 AI Seller Assistant`, nine legal/info links, four social icons, payment marks,
`Powered by Stripe`).

One capture artefact: a fixed cookie banner (`<aside>`, 1440x121, bottom, `backdrop-filter:
blur(8px)`) paints into every tile, so the strip shows it three times and hides the
"Marketplaces" heading and the top of "Take AI Seller Assistant with you". I re-shot with
the banner dismissed (`Accept all`, page height unchanged at 2145) into
`s5work/sellerassistant/clean-00..02.png` and read those bands there. Everything numeric
below is from the DOM or CDP, not pixels.

What the page is: a TanStack-Start-style SPA (`createServerFn`, `~flock.js`, `/__l5e/`
asset paths) for a tool that prices and writes resale listings from photos. Four blocks
under a 45px indigo announcement strip ("AI Seller Assistant is now on Android / Google
Play") and a static 64px header (logo, language select, `Sign in`): hero (628px), a
Marketplaces + Languages band (689px), an Android-app promo band (485px), footer (234px).
282 words. **Thin page**: 2145px, three content bands, no testimonials, pricing, stats or
FAQ on the page, so most signals have nowhere to fire. The marketing claims point to
`/evaluate`, which is a separate route and not scored.

## Slop signals present (3)

**`generic-sans-default`.** The CSS names two Google faces and ships neither. Body
computes to `"Plus Jakarta Sans", ui-sans-serif, system-ui, sans-serif`, headings to
`Outfit, ui-sans-serif, system-ui, sans-serif`. But: zero font responses on the network
(no `.woff2`/`.ttf`, nothing from `fonts.googleapis`/`gstatic`); the one stylesheet
(`styles-BccYwqTj.css`, 108,358 B, same-origin and readable) contains **0 `@font-face`
and 0 `@import`**; `document.fonts` is empty. CDP `CSS.getPlatformFontsForNode` on the
H1, an H2, an H3, the hero paragraph, the primary CTA and a footer link returns `.SF NS`
(`.SFNS-Regular` / `-Bold` / the variable instance), `isCustomFont: false`, on every one.
So every visible node renders in the platform UI face (San Francisco here; Segoe UI or
Roboto elsewhere). That is the generic system sans, whatever the stack says. A trap for a
second rater: `document.fonts.check('600 48px Outfit')` returns `true`, but that is the
API's answer when no face needs loading, not proof one loaded.

**`generic-line-icon-set`.** 27 of 28 visible SVGs are `lucide lucide-*` (the exceptions:
the Google Play mark and a hand-drawn TikTok glyph). The feature set is the textbook case:
four cards, each a 20x20 lucide glyph at `stroke-width 2` in the accent, in an identical
tinted 14px-radius tile (`oklch(0.952 0.022 285)`), each restating its heading:
`camera` / "Photo analysis", `coins` / "Real price range", `list-checks` /
"Ready-to-post listing", `earth` / "12 languages". The Marketplaces grid extends the same
set: 15 lucide glyphs at 24x24, `stroke-width 2.2`, white on coloured discs, standing in
for marketplace brands they do not depict (`shopping-bag` for Allegro, `gavel` for Aukro,
`armchair` for Avito, `circle-dollar-sign` for eBay, `lamp-desk` for Etsy, `shirt` for
Vinted). They carry less than the label beside them. Telegram is `lucide-send`.

**`indigo-violet-accent`.** One accent hue does the page's work, and it is indigo:
`oklch(0.526 0.243 277)` = `#5347f1`, within 0.02 L/C and 0.1° hue of Tailwind v4
`indigo-600` (`oklch(0.511 0.262 276.966)`). It fills the announcement strip (pixel read
`rgb(83,71,241)` at x100 and x1400), all four filled buttons (`Sign in`, `Try it free`,
`Install`, `Accept all`), the 80x4 bar under "Marketplaces", the four feature-icon
strokes, and the privacy link; the full-bleed footer is `rgb(84,79,238)` (`#544fee`,
OKLCH hue 276.6). Inside the ~240-280° band the corpus uses; `#006bff` (hue 260) is the
blue comparison point and this sits 17° further toward violet.

## Craft signals present (1)

**`asymmetric-split`.** The app-promo band is an authored unequal split:
`lg:grid-cols-[minmax(0,1.4fr)_minmax(0,0.6fr)]`, computed `761.594px 326.406px`, a
762x372 image at x160 against a 326x239 text block at x954. 70/30, 2.34:1, written as an
arbitrary value rather than a Tailwind default. Counterweight, and the reason this is
flagged: the hero is `lg:grid-cols-2`, exactly `540px 540px`, and the Marketplaces band
is a full-container grid with a centred H2. One of two splits is asymmetric.

## Absent, with the measurement

- `gradient-blob`, `gradient-fill-cta`: zero elements page-wide with a `gradient` in
  `background-image`. All CTAs are flat fills. The purple glow is inside a raster image.
- `three-card-row`: the hero's feature cards are a 2x2 grid of four equal 262x186 cards
  (`262px 262px`), not a row of three. Marketplaces is 8-up.
- `glass-card-overuse`: one `backdrop-filter` surface (the cookie banner).
- `emoji-as-icon`: zero code points in the emoji/pictograph ranges. See near-misses for
  the footer X.
- `symmetric-everything`: `symmetry.cjs` share 0.2 (1 of 5 h1/h2 centred: "Marketplaces").
- `badge-pill-spam`: one decorative pill above the fold, the eyebrow "Photo in, listing
  out". The twelve language chips sit at y1281, below the fold, and list content.
- `testimonial-card-row`: no social-proof section.
- `scroll-reveal-blank`: 0 text leaves under 8% effective opacity at 1s, 4s and an 8s
  dwell without scrolling, and 0 after a full scroll; `document.getAnimations()` 0
  throughout. Nothing to gate.
- `typewriter-headline`: H1 text identical at 1s, 4s, 8s and after scroll.
- `stock-photo-generic`: the only photographic content is the promo band's 1024x500
  image, which is Google Play's feature-graphic format and is product-specific (the app's
  logo, its tagline, its icon on the phone). It could not belong to any company.
- `centered-hero-stack`: H1 start-aligned at x160 in the left column of a two-column grid.
- `hero-mockup-float`: the hero's right column is the 2x2 card grid; no device, no UI.
- `type-scale-high-contrast`: `ladder.cjs` ratio 3.0 (48px H1 / 16px body), under 3.75.
- `editorial-grid-break`: all content inside the `max-w-6xl` container (x160-1280);
  only section backgrounds go full-bleed.
- `custom-type-pairing`: no face loads (above), so the rendered page is one family at
  weights 400-700. The pairing exists only as a declaration.
- `real-product-surface`: no product UI on the page. The only depiction is inside the
  promo raster: a phone viewfinder with corner brackets and three floating translucent
  cards whose text is grey bars. Stylised, invented UI: fails. The CTAs are doorways.
- `shows-deliverable`: no artefact of the product's output. The hero describes one ("Low,
  high and a suggested asking price, with the reasoning behind it") and shows none: no
  price, no condition report, no listing. No entry that could embarrass the vendor exists
  to name.
- `one-accent-discipline`: indigo is joined by an amber eyebrow (pill fill
  `oklab(0.752 0.016 0.124 / 0.2)`, icon stroke `oklch(0.28 0.06 75)`) and, in
  marketing chrome, a nine-fill disc palette across the 15 marketplace badges (OKLCH hues
  150, 322, 200, 265, 27, 350, 240, 277, plus black). The disc colours are not the
  marketplaces' brand colours (Allegro and Etsy, both orange brands, render green and
  red), so they are the page's own decoration, not data.
- `single-optical-anchor` (rule-ineligible, undefined; honest call): absent. In the
  first viewport the weight is split between two masses of equal width: the H1 block
  (540px column, 48px/600, three lines) and the 540x388 card grid beside it. The grid has
  more area, the H1 more contrast, and the full-width saturated strip at y0-45 competes
  with both. No mass dominates. This is not the "only one mass" case.
- `density-variation`: characters per 1000px of height run hero 1162, marketplaces 549,
  promo 309, footer 816, a 3.8x swing. It is three bands in one container at 96/56/56px
  vertical padding, each a different module, and none compresses or opens against a
  rhythm because there are too few bands to set one. Absent; flagged below.
- `live-claim-control`: nothing on the page lets a visitor test the claim. `Try it free`
  navigates to `/evaluate` (a doorway). The language select switches interface language,
  which is not the central claim.

## Near-misses

- **`generic-sans-default` / `custom-type-pairing` (the pair that matters most).** Read
  off `getComputedStyle`, this page has two named Google faces split by role (Outfit on
  every heading 18-48px, Plus Jakarta Sans on body), which is exactly the
  permit-guide-ai and deepmark shape for `custom-type-pairing: present` and dachly's
  basis for `generic-sans-default: absent`. `ladder.cjs` reports `bigFamilies:
  ["Outfit"]` for the same reason: it reads the declared family. What renders is neither.
  A rater who stops at computed style flips both, net 0 instead of +2. The rendered
  reading is the one a visitor sees.
- **`asymmetric-split`.** Present rests on one 70/30 band against a 50/50 hero. prilo-ai
  split on a comparable one-band case. Absent gives 3 slop, 0 craft, net +3.
- **`emoji-as-icon`.** The footer X logo is not an SVG: it is the text character U+1D54F
  MATHEMATICAL DOUBLE-STRUCK CAPITAL X, which CDP shows rendering in `STIX Two Math`. A
  Unicode glyph standing in for a logo, but not an emoji (no emoji presentation, a math
  text font). Absent.
- **`hero-mockup-float`.** The phone with floating glass cards is a textbook float, but
  it sits in the promo band at y1426-1911, not the hero, and inside a raster. Absent by
  location.
- **`density-variation`.** A 3.8x character-density swing is in the range zingy-cannoli's
  raters split on (4.4x, A absent, B present). Present gives net +1.
- **`shows-deliverable`.** The Marketplaces band carries a genuine narrowing:
  "AI Seller Assistant is not affiliated with, endorsed by or partnered with these
  companies," under a grid that would otherwise imply partnership. It is page prose about
  a list, not the product's output, so it cannot carry the signal.
- **`materials`.** The promo image is a photoreal composite with invented UI overlays.
  Recorded `illustration`, following dachly's handling of generated photoreal renders;
  a second rater could pick `commissioned-photo`. `single-theme`: the CSS defines `.dark`
  rules, but there are 0 `prefers-color-scheme` rules and no toggle on the page, so
  nothing at rest applies them.

Recorded fact, no signal covers it: the four footer social links are bare domains
(`https://x.com`, `https://youtube.com`, `https://tiktok.com`, `https://telegram.org`),
no account paths.

## Verdict: `mixed`, net +2 (3 slop, 1 craft)

Net +2 sits inside the mixed band (-6..+3), below deepmark and stripe-2014 (+3). The
three slop presents are the cheap template layer: a system-font fallback behind
undeclared Google faces, a lucide feature set, Tailwind indigo-600. The things that make
the ai-builder slop files slop are missing: no centred hero stack, no symmetric page
(0.2), no blobs or gradients, no glass, no three-up feature row, no testimonial row, no
scroll gating, no stock photography. The one craft present is weak and flagged.

No reading reaches +4. Taking every contested call against the page (`asymmetric-split`
absent) gives +3, equal to the top mixed files and not above them. Taking the
computed-style reading of the fonts gives 0. Flipping `density-variation` gives +1.

Not `exemplar` either. The page is thin (2145px, 282 words, three content bands), and
most craft signals had nowhere to fire. It shows no product surface, no deliverable and
no control, and the one place it could have shown the product's output (the promo band)
holds a stylised phone with placeholder cards.

**Rater B.**

Rater B, blind. A short single-screen-and-a-half landing page for a photo-to-listing
tool for secondhand sellers: a two-column hero (copy left, a 2x2 grid of feature
cards right), a marketplace badge grid with a language chip row, a Play Store app
promo, and a solid indigo footer. Three slop signals, all of them measurable
defaults (a declared type pairing that never loads, a stock Lucide icon set, Tailwind
indigo-600), against one craft signal (an explicitly authored 1.4fr/0.6fr split).
Net +2, `mixed`. It is a thin page, and most of the vocabulary has nowhere to fire.

## 1. Capture

- Viewport 1440x900. `shoot-tiles.cjs` into `~/scratch/antislop/s5/sellerassistant-B/`:
  `docH` 2145 before and after, scroller `window`, 4 tiles, landings 0 / 700 / 1245 /
  1245, `clamped: false`, `coverage: 1`. `stitch.py`: 1 strip, 2145px against page
  2145px, OK. The strip ends in the footer.
- **Overlay, not duplication.** A consent `<aside>` ("We value your privacy") is
  `position: fixed`, 1440x121 at viewport top 779, `backdrop-filter: blur(8px)`. It
  sits on every tile, so the stitched strip shows it three times and it covers the
  "Marketplaces" heading and the app section's heading. I re-walked with the banner
  dismissed ("Reject non-essential") into
  `~/scratch/antislop/s5work/sellerassistant-B/clean/`: `full.png` is 1440x2145 (page
  height), painted, ends in the footer's payment row ("Powered by Stripe"). Strip
  readings come from that walk; numeric values come from Playwright DOM probes of the
  live page (scripts in `s5work/sellerassistant-B/bin/`).
- Page height 2145px. Bands: announcement bar 0-45, header 45-109, hero 109-737,
  marketplaces + languages 737-1426, app promo 1426-1911, footer 1911-2145.
- No `prefers-color-scheme: dark` response (body `oklch(0.995 0.003 285)` under both
  emulations, no theme control): `single-theme`. The one raster image beyond the logo is
  `android-app-banner.png`, `aspect-[1024/500]` (the Play Store feature-graphic ratio),
  a photoreal composite of a hand holding a phone over a vase, watches and a sweater.
  Recorded as `illustration` on dachly's precedent for photoreal generated renders; a
  second rater could pick `commissioned-photo`.
- Asset paths `__l5e/assets-v1/...` and an `og:image` keyed `lovp_...` are consistent
  with a Lovable build. Not load-bearing for any value.

## 2. Slop signals present (3)

**`generic-sans-default`.** The stylesheet declares a pairing:
`--font-sans: "Plus Jakarta Sans", ui-sans-serif, system-ui, sans-serif` for body and
`Outfit, ui-sans-serif, system-ui, sans-serif` for every heading. Neither face ships.
`styles-BccYwqTj.css` is 108,350 bytes with 0 `@font-face` and 0 `@import`; the
network log over the full load has 0 font responses; `document.fonts` holds 0 faces.
CDP `CSS.getPlatformFontsForNode` names the face that actually rendered: h1
`.SFNS-Regular_wdth_opsz300000_GRAD_wght2580000`, h2 and h3 `.SFNS-Bold`, hero
paragraph and footer link `.SFNS-Regular`, all `isCustomFont: false`. Every visitor
gets their OS sans (SF here) unless the two faces happen to be installed locally. This
is acyclic's precedent exactly (0 loaded faces, no `@font-face`, the named face
"appears only where the visitor already has it installed": present). prilo-ai's
"absent on face identity" reading of Outfit does not transfer, because the face
identity here is the system font, not Outfit.

**`generic-line-icon-set`.** Two runs of one set, Lucide (class `lucide lucide-*`):
- Hero feature cards: 4 glyphs, all 20x20, `stroke-width` 2, all `#5347F1` on the
  same `oklch(0.952 0.022 285)` (`#EDEDFE`) tile, each restating its heading:
  `camera` / "Photo analysis", `coins` / "Real price range", `list-checks` /
  "Ready-to-post listing", `earth` / "12 languages".
- Marketplace badges: 15 glyphs, all 24x24, `stroke-width` 2.2, white on a coloured
  circle, standing in for the marketplaces' own marks: Allegro `shopping-bag`, Aukro
  `gavel`, Avito `armchair`, Bazoš `tags`, DBA `bike`, eBay `circle-dollar-sign`, Etsy
  `lamp-desk`, Kleinanzeigen `store`, leboncoin `package`, OLX `shopping-basket`,
  Subito `watch`, Vinted `shirt`, Violity `gem`, Wallapop `gift`, Custom `plus`. The
  text label carries the identity; the glyph carries less than nothing (a desk lamp
  for Etsy).
Uniform stroke and size within each run, informationally empty against the adjacent
text. That is the definition, not glyph identity.

**`indigo-violet-accent`.** `--primary` computes to `oklch(0.526 0.243 277)` =
`#5347F1` (HSL hue 244°, chroma 170), within 0.015 L and 0.02 C of Tailwind
indigo-600 (`oklch(0.511 0.262 277)`). It fills all three filled buttons ("Sign in",
"Try it free", "Install"), the 1440x45 announcement bar (pixel-sampled `(83,71,241)`),
the 80x4 underline under "Marketplaces", and the four hero icon glyphs. The footer slab
is `rgb(84,79,238)` (`#544FEE`, hue 242°) at 1440x234. Flat fills, no gradient; this
signal is the hue in any fill.

## 3. Craft signals present (1)

**`asymmetric-split`, on one section.** The app promo grid is authored as
`lg:grid-cols-[minmax(0,1.4fr)_minmax(280px,0.6fr)]`, computing to 761.6px / 326.4px,
2.33:1: the 762x372 feature graphic against a 326px copy column ("Take AI Seller
Assistant with you", 30px). The hero is `lg:grid-cols-2`, 540px / 540px, a hard 1:1.
So one of the page's two splits is unequal, by an explicit template rather than by
content width. aastudioweb set the precedent for crediting one section at 3.33:1 with
every other split at 1.0-1.22 (and flagged it as the stock "photo beside bio" shape,
which this is too: image beside copy). The counter-precedent is prilo-ai's absent on a
single 23/77 heading-cell split where the hero and four of five bands were 50/50; here
the unequal band is half the page's splits, not a fifth, and it is a media/copy split
rather than a heading cell. Weakest value in the file (see near-misses).

## 4. Absent, with the measurement

- `gradient-blob`: 0 visible elements carry a CSS `gradient` in `background-image`.
  The only glow is painted inside the raster feature graphic.
- `three-card-row`: the hero's cards are a 2x2 grid of four, each 262x186, not a row
  of three. No other card group exists.
- `glass-card-overuse`: 1 `backdrop-filter` surface on the page (the consent aside,
  `blur(8px)`), 0 once it is dismissed. Threshold is 3.
- `emoji-as-icon`: 0 text nodes in the emoji ranges. The eyebrow's sparkle is
  `lucide-sparkles`, an SVG.
- `symmetric-everything`: `symmetry.cjs` basis `h1-h2`, n=5, centred 1, share 0.20.
  The only centred heading is "Marketplaces"; the count includes the consent heading,
  and without it the share is 1/4 = 0.25. Cut is 0.85.
- `badge-pill-spam`: one pill above the fold, the eyebrow "Photo in, listing out"
  (28px tall, `rounded-full`, amber tint at 20%). The 12 language chips sit at y=1281-1331
  and are a list of supported languages, not decoration.
- `testimonial-card-row`: no testimonials section exists.
- `gradient-fill-cta`: all four filled or bordered buttons report
  `background-image: none`.
- `scroll-reveal-blank`: 74 lettered text nodes; 0 under 8% effective opacity at 1.5s
  after DOMContentLoaded, 0 crossing to visible on a 300px-step scroll walk, 0 on the
  dwell control of equal elapsed time.
- `typewriter-headline`: the h1 read 6 times at 1.5s intervals returned one string.
- `stock-photo-generic`: the one photographic image carries the product's name, logo
  and tagline lettered into it. It cannot belong to another company.
- `centered-hero-stack`: the hero is a two-column grid; the h1 is
  `text-align: start` at x=160.
- `hero-mockup-float`: the hero's right column is four feature cards, no device and no
  UI. The floating phone is in the app band at y=1483 (see near-misses).
- `single-optical-anchor` (rule-ineligible; my honest call): no single mass dominates.
  In the first viewport the h1 block (540px wide, 48px, three lines) shares the hero
  with a 540x388 card grid of equal width. Page-wide, the heaviest mass is the
  saturated 762x372 feature graphic, but it sits below the fold and is matched in hue
  and weight by the full-bleed footer slab (1440x234, 99.3% ink) and the announcement
  bar. "One mass dominates because there is only one mass" does not apply: there are
  at least three.
- `type-scale-high-contrast`: `ladder.cjs` ratio 3.0 (48px h1 over 16px body;
  ratioSub 2.67 against the 18px subhead). Below 3.75.
- `editorial-grid-break`: every content box sits in the `max-w-6xl` container,
  x=160 to x=1280. Full-bleed band fills are backgrounds, not breaks.
- `custom-type-pairing`: the declared Outfit + Plus Jakarta Sans pairing never
  renders (section 2). One rendered family.
- `real-product-surface`: no capture and no rebuild of the product anywhere. The
  feature graphic's phone shows a stylised viewfinder (corner brackets, a shutter
  dot), and its three floating cards hold an item thumbnail plus blank lavender bars
  where text would be. Invented UI. "Try it free" is a link to `/evaluate`: the doorway.
- `shows-deliverable`: the page promises an identification, a condition report, a
  price range and a listing, and shows none of them. The only artefact-shaped content
  is the feature graphic's placeholder cards, which Part B disqualifies as placeholder.
  Entry that could have embarrassed the vendor: none to name.
- `density-variation`: text characters per 1000px of band height: hero 1145,
  marketplaces + languages 546, app promo 305, footer 816 (a 3.75x swing). Ink per band
  (luminance under 200, every third pixel): hero 5.02%, marketplaces + languages 5.15%,
  app 39.68%, footer 99.30%. The two text bands are the same ink to a tenth of a point;
  the swing comes from the app band's raster image displacing text and from the solid
  footer, not from any sparse statement band alternating with dense ones.
- `one-accent-discipline`: beyond indigo, the 15 marketplace circles use hues 150
  (green), 322 (magenta), 200 (teal), 265 (blue), 27 (red), 350 (pink), 240 (sky), 277
  (violet) and black, and the eyebrow pill is an amber tint (`oklch(0.28 0.06 75)` text
  on a yellow-axis fill). These are not the marketplaces' brand colours (Allegro is
  orange, rendered green; Vinted is teal, rendered pink; Etsy is orange, rendered red),
  so they are decorative chrome, not data colour.
- `live-claim-control`: the central claim ("Know what your secondhand find is
  worth") is testable one click away (2 free evaluations a day, no account), but on
  this page there is no control: "Try it free" is `<a href="/evaluate">` and navigates.

## 5. Near-misses

- `asymmetric-split` (present, could be absent). It rests on one band, the stock
  image-beside-copy shape, while the hero, the page's principal composition, is a hard
  1:1. Absent gives net +3, still `mixed`.
- `density-variation` (absent, could be present). On the aastudioweb bar of "more
  than one texture" the page has three (prose + card grid; badge grid + chips; image +
  copy), and the 3.75x character swing is real. I held absent because the ink reading
  puts the two text bands at 5.02% and 5.15%, and the swing is an image, not a decision
  about type. Present gives net +1.
- `one-accent-discipline` (absent, could be present only if the marketplace circles
  were read as data colour). The mismatch against the brands' real colours settles it.
  Present would give net +1.
- `hero-mockup-float` (absent by scope). The app band does carry exactly the shape the
  signal names: a phone held at an angle with three glassy placeholder cards floating
  around it. It is at y=1483 in the third band, not the hero. A page-wide reading would
  fire it and give net +3.
- `three-card-row` (absent by count). The hero's 2x2 of equal icon cards is the same
  template unit, one card short of and arranged differently from a row of three.
- `gradient-blob` (absent by medium). The feature graphic's violet glow is a raster
  painting inside a promo image, not page chrome.
- `generic-line-icon-set` is not a near-miss: 19 Lucide glyphs in two uniform runs,
  both empty against their labels.

The calls that turn on judgment (`asymmetric-split`, `density-variation`,
`one-accent-discipline`) move net between +1 and +3. The three settled by scope or
count (`hero-mockup-float`, `three-card-row`, `gradient-blob`) are definitional, not
judgment calls; I record them so a second rater can see what the vocabulary's scope
lines did on this page.

## 6. Verdict: `mixed`, net +2

3 slop present (`generic-sans-default`, `generic-line-icon-set`,
`indigo-violet-accent`), 1 craft present (`asymmetric-split`). Net +2 is below the
+4 that `slop` requires, so no separation argument is owed and none is attempted.
Against the named +3 files: stripe-2014 carries 6 slop and deepmark 6 (its
front-matter in this worktree reads 6 slop, 4 craft, +2, not the +3 the brief
lists); this page carries half that. Its slop is all measurable default (an unshipped
font stack, Lucide at stock stroke, indigo-600), with none of the decorative layer
(blobs, glass, gradient CTAs, scroll reveals, centred stacks) the confirmed ai-builder
slop files share.

Thinness, stated so it is not read toward anything: 2145px, four content bands, no
testimonials, pricing, stats, FAQ or product capture. Roughly a third of the slop list
(`testimonial-card-row`, `three-card-row`, `typewriter-headline`, `stock-photo-generic`,
`scroll-reveal-blank`, `badge-pill-spam`) had little surface to fire on, and the
craft side is near-empty for the same reason. The page's honesty notes (the
"No account needed for your first 2 evaluations a day" limit, the marketplace
non-affiliation disclaimer) are FAQ-style prose, not artefacts, and score nothing.
