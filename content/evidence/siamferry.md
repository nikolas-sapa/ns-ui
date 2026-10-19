---
source: https://siamferry.com/
kind: site
cohort: ai-builder
verdict: mixed
studied: 2026-10-19
context: [nav, hero, features, footer, cta]
signals:
  gradient-blob: absent
  three-card-row: present
  glass-card-overuse: absent
  emoji-as-icon: absent
  generic-sans-default: absent
  symmetric-everything: absent
  badge-pill-spam: absent
  generic-line-icon-set: present
  testimonial-card-row: absent
  indigo-violet-accent: absent
  gradient-fill-cta: absent
  scroll-reveal-blank: absent
  typewriter-headline: absent
  stock-photo-generic: present
  centered-hero-stack: absent
  hero-mockup-float: absent
  asymmetric-split: present
  single-optical-anchor: absent
  type-scale-high-contrast: present
  editorial-grid-break: absent
  custom-type-pairing: present
  real-product-surface: absent
  shows-deliverable: absent
  density-variation: unresolved
  one-accent-discipline: absent
  live-claim-control: absent
materials: [single-theme, stock-photo]
---

**Sampling: random draw.** One of twelve drawn with seed 20261019 from the twenty-two gallery sites left after the first draw (same pre-stated exclusions). `gunsvzombies`, drawn first, returned 404 (project deleted) and was replaced from the same seed by `openmark`. Not chosen on any signal.

Rated by two independent blind raters on 2026-10-19, neither reading the other's draft. Both reached `mixed`. They agreed on 25 of 26 signals; the 1 split `density-variation` (A absent, B present) are recorded `unresolved`, which never counts toward a rule. Both write-ups follow in full.

**Rater A.**

Rater A, blind. New page, no prior study, so no drift section.

## 1. Capture

Viewport 1440x900. `shoot-tiles.cjs siamferry-A`: `docH` 2905 before and after,
scroller `window`, 5 tiles, `clamped: false`, `coverage: 1`, max scroll landed at
2005 (= 2905 - 900). `stitch.py`: 1 strip, 2905px against page 2905px, OK. The
strip ends in the footer (`© 2026 Siam Ferry ... All rights ours, bruv.`). No
console errors. 11 requests at load: the document, one Vite bundle
(`index-C457Ockg.js`), one stylesheet, three self-hosted fonts, logo SVG, hero
webp, three JPEGs from `images.siamferry.com`.

The page is **thin**: 2905px, nav + four bands (hero, booking bar, "why", three
destinations) + footer, 78 text nodes in the ladder. Most signals have nowhere to
fire, and that cuts both ways in the count below.

At 390px: `scrollWidth` 390 (no horizontal scroll), page 5549px, h1 44.3px, the
"why" grid collapses to one 358px column. Dark emulation changes nothing (body
background transparent over the same paper, h2 still `rgb(11,29,36)`), so
`single-theme`.

The product behind the page is real. Filling the booking bar (Phuket to Phi Phi,
25 Oct 2026, 1 passenger) fires `GET api.siamferry.com/transfers?from=Phuket&to=Phi%20Phi`
and navigates to `/booking?...`, which lists 16 sailings with operator, duration
and price (`$19.99` to `$42.99` per person). None of that renders on the rated
page. It matters for sections 3 and 4.

## 2. Slop signals present (3)

**`three-card-row`.** "Ferry Hard, Party Harder" holds three photo tiles in a
`grid-template-columns: 384px 384px 384px` grid, each 384x511 at x=112, 528, 944,
same build: photo, to-top scrim, 12px eyebrow (`THE VIEWPOINT` / `PROMTHEP CAPE` /
`AO NANG`), 31px Fraunces title, one-line caption with an arrow. Equal weight,
equal size, the whole of the band's content. (The "why" trio above it is also
three 384px columns, but card-less: 1px top rule `rgb(207,223,228)`, no fill, no
radius, no shadow. The destination row settles the signal without it.)

**`generic-line-icon-set`.** One set (Lucide, `class="lucide lucide-shield"`,
`lucide-clock`, `lucide-anchor`), all 24x24, same stroke colour
`rgb(11,29,36)`, `fill: none`, one per column of the "why" trio. Each carries
nothing its heading does not: shield over "Solid Crews Only" (body: "safe and
sound"), clock over "Easy Peasy Booking" (body: "in a flash"), and an anchor over
"Wallet-Friendly Vibes", which does not even match its heading. Nautical
decoration on a feature trio.

**`stock-photo-generic`.** The hero, `andaman-dusk-wide-1600.webp` (1440x810,
shown 1440x702, `object-fit: cover`), alt "A traveller sitting under a beach shack
roof at dusk, watching the boats moored off an Andaman island": a silhouetted
man in a cap under thatch, sea and an island behind. Both clauses, read on
content:
1. Nothing in the frame is Siam Ferry's: no ferry, pier, ticket, operator or
   route. Any Andaman hostel, tour desk or resort could run it.
2. The type cannot survive on it unaided. `div.hero-scrim` is
   `linear-gradient(to top, rgba(11,29,36,.9) 0%, .8 30%, .62 55%, .25 80%, 0)`;
   the h1 occupies roughly 26-49% from the hero's bottom edge, so it sits on
   about 0.66-0.81 ink. The photo also carries `filter: saturate(1.04)
   contrast(1.03)` and a CSS `grain` class.
Provenance is not established: all four photos have metadata stripped to an HP
sRGB ICC profile, no EXIF, XMP or C2PA strings. The call rests on content, as
glowcase's did. See near-misses.

## 3. Craft signals present (3)

**`type-scale-high-contrast`.** `ladder.cjs`: largest lettered node "Island-Hop
Like a Badass" 80px Fraunces / body 16px = **5.0:1**, clear of the 3.75 cut.
The ladder has real tiers, not one jump: 80 (h1) / 48 (two h2) / 30.96 (h3s) /
20 (ledes, all three) / 16 body / 14 nav / 12 eyebrows at 1.92px tracking. The
threshold is necessary, not sufficient. What settles it here: one face carries
the three display tiers at weights 700/700/600 with tracking tightened in
proportion (-1.6px, -0.72px, -0.31px, i.e. -0.02em, -0.015em, -0.01em), so the scale is
built, not just large.

**`custom-type-pairing`.** `document.fonts`: Fraunces (variable, 400-800,
`loaded`, self-hosted `fraunces-var-latin.woff2`) and IBM Plex Sans 400/600
(`loaded`, self-hosted). Split by role with no crossing: Fraunces sets every
heading h1-h3, from the 80px h1 to the 31px card titles; Plex Sans sets body, ledes,
nav, buttons, inputs, eyebrows and the footer's 12px h2 labels. IBM Plex Mono
500/600 is declared but `unloaded` and renders nowhere. Precedent: decent-com's
Fraunces + Public Sans, split the same way, is `present`.

**`asymmetric-split`.** The "why" band is a 12-column grid (79.3px tracks, 24px
gap). The left child spans 4 columns, 389px at x=112 (the `WHY ROLL WITH SIAM
FERRY?` eyebrow and the rotated stamp). The right child spans 8, 803px at x=525
(h2 "Ride Fast, Spend Less" and 20px lede). That is **1:2.06**. The narrow side is
content, not navigation: an eyebrow and a 273x43 claim stamp, the same shape as
the FAQ split elsewhere in the corpus (395px `lg:col-span-4` heading column against
837px), which scored `present`. The hero repeats the left weighting. Eyebrow, h1
and 576px lede start at x=112 and leave the right ~55% of the 1440px photo empty.
Caveat: only one body band splits, and it stacks to one column at 390px.

## 4. Near-misses

- **`stock-photo-generic` (present, the likeliest to flip).** A rater who reads a
  photo of the Andaman coast as the service's subject matter, not "any company",
  scores it absent. The three destination photos are place-specific (Phi Phi
  viewpoint, Promthep Cape, Ao Nang longtails). I did not rest the signal on them,
  though they carry the same to-top scrim (`.82` to `0` at 70%). Provenance is
  unresolvable from bytes. Flip: net -1. The `stock-photo` material follows this
  call and is content-judged.
- **`one-accent-discipline` (absent).** Two saturated hues act as accents in
  chrome. Rust `rgb(190,64,26)` (chroma 164, hue 14°) fills all three CTAs ("Snag a
  Ride", "Let's Ride", "Book the Ride") and sets "Ferry" in the wordmark, with a
  lighter `rgb(232,117,80)` for the footer wordmark. Teal (hue 169-171°) is the
  logo mark's accent (`#12907E`, chroma 126) and the colour of all 15 footer links
  (`rgb(111,198,182)`, chroma 87). The page's neutrals are a separate blue-slate
  ramp (ink `rgb(11,29,36)` 197°, eyebrows `rgb(39,84,95)` 192°), so teal is not
  the ink ramp. A rater who treats on-dark link colour as a tint rather than an
  accent gets present. Flip: net -1. A third tint, the stamp's `rgb(251,231,191)`
  fill, is one element.
- **`single-optical-anchor` (absent; rule-ineligible, honest call).** I counted
  the h1 block (about 600x145 at x=112, y=445) as the candidate anchor. It is the
  strongest type on the page, but it does not dominate the first viewport. The
  booking card straddling the hero edge is 1216x203 (about 2.8x the headline's
  area) in paper `#FDFBF7` on ink, the highest luminance contrast in the frame. The
  silhouetted head (y≈205-330) is a third focus above the headline. This is not
  "one mass dominates because there is only one mass": there are at least two.
  A rater who weights type over area holds present. Flip: net -1.
- **`editorial-grid-break` (absent).** Two candidates. The booking section is
  `-translate-y-[7.5rem]` with a matching negative margin, so the card straddles the
  hero/body boundary by 120px. The "OPERATORS WE'VE ACTUALLY MET" stamp is rotated
  -3.0° (`matrix(0.99863,-0.052336,...)`), 12px Plex on `rgb(251,231,191)` with a
  1px rust border. Neither breaks the 1216px container. The straddling search widget
  is the default shape of a travel-booking page, and databuddy's lone tab strip
  straddling a band boundary scored absent. The stamp is a 273x43 gesture inside
  its own column. Two stacked would-bes, not a break.
- **`real-product-surface` and `live-claim-control` (absent).** The booking bar is
  genuine. Real `<select>`s (`aria-label` "Travelling from" / "Travelling to") over
  four ports, a react-datepicker, and a submit that queries a live API and returns
  priced sailings. But it answers on `/booking`, not here. On the rated page the
  product has not answered yet: the doorway, not the surface (acyclic,
  dropbox-2014). Clicking "Let's Ride" without a date only opens the date picker.
  "Killer prices, no sneaky fees" can be tested one URL away, not in place. vizleads
  passed because its panel printed the falsifying `0 rows` on the page itself. Score
  at rest.
- **`shows-deliverable` (absent).** No entry on the page could embarrass the
  vendor: no price, timetable, rating, delay, refusal or fee line. The footer's
  "CREWS WE RIDE WITH" roster (11 operator names) can only flatter. The 16 priced
  sailings, where Phi Phi Cruiser at $30.99 and Sea Angel at $26.99 could start to
  count, live on `/booking`.
- **`density-variation` (absent).** Both body bands use the same `py-16 md:py-24`
  (96px top and bottom) and the same build: eyebrow, 48px h2, 20px lede, then a
  three-up. No table, list or data passage anywhere. The densest block is the
  footer's four link columns (31 links incl. the operator roster), which is footer
  convention, not a dense band set against an airy one.
- **`badge-pill-spam` (absent).** Above the 900px fold the only `9999px`-radius
  elements are "One Way Vibe" / "Round Trip Chill", a segmented trip-type toggle
  (`<button>`s, one filled `rgb(11,29,36)`), so controls. The eyebrow is plain
  tracked text. The stamp is below the fold (y=993) and rectangular. Decorative
  pills above the fold: 0.
- **`scroll-reveal-blank` (absent).** Walk vs dwell: 0 text nodes cross from
  <8% opacity to visible on a 500px-step walk, and 0 recover in a 6s no-scroll
  dwell. No element below 0.9 opacity at rest. The only motion is 33 color
  transitions at 0.12s. A separate robustness fact, not this signal: with
  JavaScript disabled the page renders nothing (28 elements, `innerText` empty,
  height 900). It is a client-rendered SPA.
- **`generic-sans-default` (absent).** Body is IBM Plex Sans, self-hosted, behind a
  `system-ui` fallback that never shows. Not a default face.
- **`symmetric-everything` / `centered-hero-stack` (absent).** `symmetry.cjs`:
  0 of 3 h1/h2 centred (share 0.00). The hero stack is `text-align: start` at x=112.
- **`typewriter-headline` (absent).** h1 text identical at load and 8s later. Nothing
  cycles.
- **`gradient-blob` / `gradient-fill-cta` / `glass-card-overuse`** all have
  nothing to fire on. The only gradients are four single-hue ink scrims over photos.
  CTAs are flat rust. `backdrop-filter` count is 0.

## 5. Verdict: `mixed`, net 0

Slop present 3 (`three-card-row`, `generic-line-icon-set`, `stock-photo-generic`)
minus craft present 3 (`type-scale-high-contrast`, `custom-type-pairing`,
`asymmetric-split`) = **0**.

The middle of the mixed band (−6..+3). Every near-miss above moves the net by one
in the craft direction (stock-photo to absent, accent or anchor to present), and
none of them brings it near +4. Taking every slop-leaning reading at once still
leaves net 0, because the slop near-misses do not exist: the page has no gradient,
glass, pill, emoji, centred stack, testimonial row or reveal gate to argue over. It
is not `exemplar` either. The craft is type and layout only (a serif/sans pairing,
a measured ladder, one 4/8 split). The product's real output, a priced and named
timetable from a live API, is kept off the page, so the three craft signals that
would separate it from a template (`real-product-surface`, `shows-deliverable`,
`live-claim-control`) all read absent. A thin page (2905px, four bands) where the
score is as much about where signals cannot fire as where they do.

**Rater B.**

A short marketing home page for a ferry-booking service, Vite/React SPA on
Cloudflare Pages. Top to bottom: a full-bleed photographic hero with its copy
left-aligned over a scrim; a booking bar that overlaps the hero's bottom edge by
120px; a "why us" intro split 1:2 with a rotated rubber-stamp label on the left; a
three-up feature row; a three-up destination-photo row; a dark four-column footer.
**2905px** at 1440x900, 1968 characters of visible text, 26 links. This is a thin
page. There are no testimonials, no pricing, no FAQ, no team, no stats and no product
capture, so roughly a dozen slop signals have nowhere to fire. That thinness is
recorded here and is not read as restraint.

**Capture.** Viewport 1440x900. Fresh walk into `~/scratch/antislop/s5/siamferry-B`
by `shoot-tiles.cjs`: 5 tiles, `clamped: false`, `coverage: 1`, scroller `window`,
`docH_before` = `docH_after` = 2905, no inner scroller candidate (`html` 2905/900
is the only one). Landings 0 / 700 / 1400 / 2005 / 2005: the repeat is the
browser's clamp at maxScroll 2005, not a sticky element. A `position: fixed|sticky`
census finds 0 elements. `stitch.py` (NS_SESSION=s5): one strip, 1440x2905, 0px
drift against the page height. The strip's last band is the footer (y2313-2905,
ending "© 2026 Siam Ferry … All rights ours, bruv."). `document.getAnimations()`
returns 0 at rest and no node sets `animation-name`, so the walker's animation kill
hid nothing. The hero `<section>` holds one `<picture>` whose `<img>` renders at
1440x702, opacity 1; there is no video, canvas or iframe anywhere on the page.
Section map from the DOM: `nav` y0-81, hero y81-783, `#booking-bar` y663-866
(`-translate-y-20`, i.e. 120px up into the hero), "why us" y866-1408, destinations
y1408-2314, `footer` y2313-2905. With JS disabled the body renders 0 characters
(client-rendered SPA). That is a robustness fact, not a signal.

**The booking bar is the product's doorway, not its surface.** The form works: on
submit it navigates to `/booking?from=…&to=…&date=…`, which calls
`api.siamferry.com/transfers` live. For Phuket → Phi Phi on 2026-11-02 that page
lists 15 sailings, each with a time, type, operator and price ("08:30 · 2 hours ·
Ferry · Phi Phi Cruiser · $30.99"). For a pair with no route it says so: "Nothing
sailing that way. We haven't got a direct sailing between Phuket and Krabi on this
route." None of that renders on the home page. Here the product appears as two
empty selects, a date field, a passenger field and a "Let's Ride" button. Under
`real-product-surface`'s doorway clause, a form the product has not yet answered
fails, so the value is absent on this URL. `/booking` is a different page, and this
file does not score it.

**Slop signals present (3).**

`three-card-row`. Two literal three-ups. Both sit on the 1280px container's
inner grid at x112 / x528 / x944: each column is 384px wide, with a 32px gap.

- Feature row, y1154-1311: three `border-t border-ink-200 pt-5` columns. Each has
  a 1px `rgb(207,223,228)` top rule at y1154, a 24x24 icon at y1175, an h3 at
  30.96px Fraunces 600 at y1215 ("Solid Crews Only", "Easy Peasy Booking",
  "Wallet-Friendly Vibes") and a two-line 16px paragraph.
- Destination row, y1706-2217: three 384x511 linked photo cards ("Phi Phi Islands",
  "Phuket", "Krabi"). All share one top edge and one bottom edge, a 478px image, a
  scrim, a 12px overline, a 31px name and a 13px caption with an arrow.

Equal width, equal structure, equal weight, and neither row is a carousel. The
destination cards carry real photography of real places rather than icons. Under
the aviern precedent that makes them a better-dressed three-up, not a different
pattern.

`generic-line-icon-set`. The feature row's three glyphs are one set: lucide
`shield`, `clock` and `anchor`, each 24x24 with `stroke-width="1.75"`,
`fill="none"`, `currentColor` ink. Size and stroke are uniform. The shield
restates "Solid Crews Only … safe and sound" and the clock restates "Snag your
spot in a flash". The anchor over "Wallet-Friendly Vibes" restates nothing: it is
nautical decoration. None of the three carries a fact its heading lacks, which is
the definition. The other lucide glyphs on the page are functional affordances, not
feature icons: two nav chevrons, a `ship` in each of two CTAs, and arrows on
"Let's Ride" and the card captions. The signal rests on the feature row alone.

`stock-photo-generic`. The hero is a 1600x900 WebP of a traveller in a cap,
silhouetted under a palm-thatch roof at dusk, with moored boats and a headland
behind. The alt text is careful and the file is served from the site's own origin
(`/hero/andaman-dusk-wide-1600.webp`, no EXIF). Its licensing is not verifiable
from the page. Both limbs of the definition hold anyway. First, it could belong to
any Thailand hostel, airline or tour operator: nothing in the frame is this
company, its boats or its crews. Second, the type cannot survive on it without
help. The hero carries a 1440x702 `linear-gradient(to top, rgba(11,29,36,0.9) 0%,
rgba(11,29,36,0.8) 30%, rgba(11,29,36,0.62) 55%, …)`, and the 80px h1 sits at
y440-592, inside the 0.62-0.8 alpha band. The same device recurs on all three
destination cards (`rgba(11,29,36,0.82)` to transparent at 70%). The destination
photos (Phi Phi viewpoint, Promthep Cape, Ao Nang longtails) are specific to the
product's places, but they do not change the hero, which is the page's largest
mass.

**Craft signals present (4).**

`asymmetric-split`. The "why us" band is a 12-column grid split 4 / 8. On the
left, a 389px column at x112 holds the 12px eyebrow "WHY ROLL WITH SIAM FERRY?"
and the rotated stamp, whose right edge is at about x384. On the right, an 803px
column at x525 holds the 48px h2 "Ride Fast, Spend Less" and a 20px lede. Column
widths run 1 : 2.06, the left column's content leaves about 140px empty before the
h2, and both columns top-align at y962. The destination band follows the same
left-pinned logic in a lighter form: its 816px lede stops 400px short of the
container's right edge. This is one deliberate split, not a card grid. It is
narrow evidence for a page-wide signal, and a second rater could reasonably score
it absent. That would move the net to 0 and leave the verdict unchanged.

`type-scale-high-contrast`. `ladder.cjs`: the largest lettered text node is the h1
"Island-Hop Like a Badass" at **80px** Fraunces. `getComputedStyle(document.body)
.fontSize` is **16px**. Ratio **5.0:1**, clear of the 3.75 cut, not a borderline
case. The ladder underneath is a stepped scale with no orphans: 80 (display), 48
(both section h2s), 30.96 (all six card h3s and the footer wordmark), 20 (hero
subhead and section ledes), 16 (body), 13-14 (captions, footer links), 12
(tracked overlines). Subhead ratio 4.0.

`custom-type-pairing`. Two self-hosted faces, each with one job, and both loaded
(`document.fonts`: Fraunces variable 400-800 loaded, IBM Plex Sans 400 and 600
loaded; IBM Plex Mono 500/600 declared but unloaded, carrying no visible text).
Fraunces, a soft high-contrast serif at weight 600-700, sets the h1, both h2s,
all six h3s and both wordmarks, and nothing else. IBM Plex Sans sets every
paragraph, eyebrow, nav link, form control and footer link. A metric-matched
`Fraunces Fallback` on `local("Georgia")` (`size-adjust: 115.6%`) is declared for
the swap. This is a display/text pairing a default stack does not produce, on the
same structure the corpus scored present on dachly, permit-guide-ai and deepmark.
`generic-sans-default` is correspondingly absent.

`density-variation`. Measured per band two ways. Text leaves per 1000px of band
height: hero 5.7 (4 leaves in 702px), booking bar 4.9, "why us" 18.5,
destinations 13.2, footer 67.6. Ink, meaning pixels more than 60 summed RGB units
off the band's modal background, read from the strip: hero 85.9% (photograph),
booking bar 25.1%, "why us" 9.2%, destinations 45.3% (photo cards), footer 7.4%.
The sequence alternates texture: a photo-filled dark hero with four lines of text,
a white form slab, an airy type-only band at 9.2% ink, a photo-card band at 45.3%,
then a dense four-column footer listing 11 operators and 16 links at 67.6 leaves
per 1000px. The two content bands are close to each other (13.2 against 18.5
leaves per 1000px), so much of the spread comes from the hero and footer. That is
real variation but not large, the same register as glowcase's present.

**Near-misses, each with what settled it.**

- `one-accent-discipline` → **absent**, and the closest craft call. Vermilion
  `rgb(190,64,26)` (chroma 164) is the one fill accent: all three CTAs at y16,
  y785 and y2538, the "Ferry" half of the nav wordmark, and the footer wordmark's
  `rgb(232,117,80)` tint. The stamp's `rgb(154,49,19)` is a darker step of the same
  hue. The neutrals are warm paper (`rgb(253,251,247)`, `rgb(247,241,231)`,
  `rgb(237,227,212)`) and a dark teal ink (`rgb(11,29,36)`, with `rgb(27,61,72)`
  and `rgb(39,84,95)` as its text tints). On that much alone it would be present.
  What settles it absent is the mint `rgb(111,198,182)` (chroma 87, hue about
  169°, against the ink's 197°). It colours all 15 links in the footer, including
  the mailto, and nothing else, while vermilion stays on the footer's button. That
  is a second saturated hue with a text role, the glowcase reading. Counter-reading,
  recorded for the second rater: the mint is confined to links on the dark band and
  could be the ink theme's link state rather than an accent. If so, the value goes
  present, craft rises to 5 and the net to −2, and the verdict does not move.
- `editorial-grid-break` → **absent**. Three candidates, none decisive. (1) The
  rotated stamp, a `<p>` at `rotate(-3deg)`, 273x43 at y993, with an ink border on
  `rgb(251,231,191)`: one sticker inside its own column, not something that crosses
  the grid. (2) The "why us" eyebrow column: that is the 4 / 8 split already scored
  under `asymmetric-split`, and scoring it here too would count one decision
  twice. (3) The booking bar overlapping the hero's lower edge by 120px: it crosses
  a band boundary but stays on the 1280px container (x80-1360), and a search slab
  over a hero photo is the stock travel-booking layout, not an editorial break.
  Every content block sits on the container. No pull-quote, hanging rule, gutter
  overhang or off-grid image exists.
- `single-optical-anchor` → **absent** (rule-ineligible, undefined; honest call).
  First viewport, masses counted: the two-line 80px headline block (768x152 at x112,
  cream on the scrim's dark band), the 1440x702 dusk photograph behind it, and the
  1216x203 cream booking slab overlapping the photo's lower edge at y663. The slab
  is the highest-contrast object on the screen, and the vermilion "Snag a Ride" and
  "Let's Ride" fills add two small hot spots. Three masses compete. Not one mass
  dominating because only one exists.
- `badge-pill-spam` → absent. Above the fold there is one pill shape: the One Way /
  Round Trip segmented toggle, a 265x46 shell at `border-radius: 9999px` with two
  38px segments. It is a working control, not a decorative pill. The stamp is
  below the fold (y993), and it is a `rounded-sm` rectangle.
- `centered-hero-stack` → absent. Every hero text node is `text-align: start` at
  x112, and the h1 is 768px wide in a 1280px container.
- `symmetric-everything` → absent. `symmetry.cjs`, basis `h1-h2`, n=3: 0 of 3
  centred, share 0.00.
- `glass-card-overuse` → absent: 0 `backdrop-filter` surfaces in the full census.
- `gradient-blob` → absent. All four gradients on the page are photo scrims (`to
  top`, the ink at 0 to 0.9 alpha). No radial, conic or blurred field.
- `gradient-fill-cta` → absent. All three CTAs are flat `rgb(190,64,26)`,
  `background-image: none`.
- `hero-mockup-float` → absent. No device frame or fake UI. The booking bar is a
  real form.
- `scroll-reveal-blank` → absent on the walk-vs-dwell procedure. Nodes with text
  under 0.08 opacity: 0 at rest, 0 at each step of a 400px walk, and 0 after a
  fresh load and a 12.6s dwell matched to the walk's elapsed time. Visible text was
  1968 characters in every state.
- `emoji-as-icon` → absent. No emoji. Every glyph is a lucide SVG.
- `indigo-violet-accent` → absent. No hue in the 230-290° range on any fill or
  text.
- `testimonial-card-row`, `typewriter-headline` → absent: the page has no
  testimonials section and no cycling text.
- `real-product-surface` → absent: the doorway reasoning above.
- `shows-deliverable` → absent, procedure run. Name the entry that could have
  embarrassed the vendor: there is none on this URL. The three feature paragraphs
  are vendor claims ("Killer prices, no sneaky fees"). The destination cards are
  photographs with flattering captions ("Epic cliffs, clear waves"). The footer
  lists islands and operators. No price, timetable, refusal, sold-out route or
  comparison renders on the 2905px. The honest "Nothing sailing that way" notice
  exists, but only on `/booking` after a search.
- `live-claim-control` → absent. The booking bar changes the visitor's own query.
  It does not let them falsify a claim the page makes. "Wallet-Friendly", "no
  sneaky fees" and "Operators we've actually met" cannot be checked from this page.

**Verdict: mixed, net −1** (3 slop: `three-card-row`, `generic-line-icon-set`,
`stock-photo-generic`; 4 craft: `asymmetric-split`, `type-scale-high-contrast`,
`custom-type-pairing`, `density-variation`).

Not near `slop`. −1 is five points under the +4 floor, and the slop present is
template furniture (a 3-up feature row, its icon set, a generic hero photo with a
scrim), not template theatre. There is no gradient, glass, pill wall, centred
stack, scroll gating or violet. The voice is loud ("Island-Hop Like a Badass",
"bruv") but voice is not a signal. Under the worst plausible reading for the page
(`asymmetric-split` absent and `custom-type-pairing` absent), net goes to +1. That
still sits in the middle of the mixed band, two points short of deepmark and
stripe-2014 at +3.

Not `exemplar` either. A 2905px page with 1968 characters scores well partly
because most slop signals have nowhere to fire. Of the four craft signals,
`asymmetric-split` rests on one band and `density-variation` leans on the footer.
The three craft signals that would mark the page as substantive are absent on the
merits, not the layout: `real-product-surface`, `shows-deliverable` and
`live-claim-control`. A ferry site's strongest material (timetables, fares,
operators and an honest "no route" answer) exists one click away, and none of it
is on the page rated. `mixed` is the honest call.

**Context.** `hero, nav, features, cta, footer`. The booking bar has no context slot
and is described in prose. `pricing` is deliberately omitted: no price renders on
this URL. `testimonials`, `faq`, `team`, `stats`, `security`, `integrations`,
`dashboard` are absent sections, not unresolved ones.

**Materials.** `single-theme`: the 64,199-byte stylesheet has 0
`prefers-color-scheme` rules and the page is one light paper ground with dark ink
bands. `stock-photo`: four photographs, the hero plus three destination stills.
Provenance is unverified (self-hosted, no EXIF), and they read as library images
rather than commissioned work. No `origin-*` token: `shows-deliverable` is absent,
so there is nothing to carry provenance.
