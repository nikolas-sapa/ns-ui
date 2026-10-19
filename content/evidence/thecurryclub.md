---
source: https://thecurryclub.lovable.app/
kind: site
cohort: ai-builder
verdict: mixed
studied: 2026-10-19
context: [hero, nav, features, empty-state, footer, dashboard, cta]
signals:
  gradient-blob: absent
  three-card-row: present
  glass-card-overuse: absent
  emoji-as-icon: absent
  generic-sans-default: absent
  symmetric-everything: absent
  badge-pill-spam: unresolved
  generic-line-icon-set: present
  testimonial-card-row: absent
  indigo-violet-accent: absent
  gradient-fill-cta: absent
  scroll-reveal-blank: absent
  typewriter-headline: absent
  stock-photo-generic: present
  centered-hero-stack: unresolved
  hero-mockup-float: absent
  asymmetric-split: unresolved
  single-optical-anchor: unresolved
  type-scale-high-contrast: present
  editorial-grid-break: absent
  custom-type-pairing: absent
  real-product-surface: unresolved
  shows-deliverable: unresolved
  density-variation: present
  one-accent-discipline: absent
  live-claim-control: unresolved
materials: [single-theme, stock-photo]
---

**Sampling: random draw.** One of twelve drawn with seed 20261019 from the twenty-two gallery sites left after the first draw (same pre-stated exclusions). `gunsvzombies`, drawn first, returned 404 (project deleted) and was replaced from the same seed by `openmark`. Not chosen on any signal.

Rated by two independent blind raters on 2026-10-19, neither reading the other's draft. Both reached `mixed`. They agreed on 19 of 26 signals; the 7 splits `badge-pill-spam` (A absent, B present), `centered-hero-stack` (A absent, B present), `asymmetric-split` (A absent, B present), `single-optical-anchor` (A absent, B present), `real-product-surface` (A present, B absent), `shows-deliverable` (A present, B absent), `live-claim-control` (A absent, B present) are recorded `unresolved`, which never counts toward a rule. Both write-ups follow in full.

**Rater A.**

**Capture.** 1440x900 viewport, `window` scroller (the only inner candidate is
`html.dark` itself, sh 3471), 5 tiles, `docH_before` 3471 = `docH_after` 3471,
`clamped: false`, `coverage: 1`, last landing 2571 for an asked 2800 (the bottom).
Stitched to 1 strip of 3471px against a 3471px page (`s5strips/thecurryclub-A-strip0`,
"0 slug(s) where stitched height != page height"); the strip ends in the footer
("CC.WORLD", "© 2026 CURRY CLUB INTERNATIONAL · ALL RIGHTS SPICED"). DOM: 3 `<img>`,
zero `<video>`, `<canvas>` or `<iframe>`, 14 inline SVGs, 78 text nodes. Single
theme: `<html class="dark">` is hard-set in the served HTML, and body
(`#090706`) and H1 (`#f4e3c7`) compute identically under `prefers-color-scheme:
light` and `dark`; no toggle. The "Edit with Lovable" badge is builder-injected
and excluded throughout. Probes, crops and response bodies:
`~/scratch/antislop/s5work/thecurryclub/`.

**The display face does not load, for anyone.** The stylesheet's
`@font-face` for Bricolage Grotesque points at a versioned gstatic file
(`bricolagegrotesque/v8/3y9U6as8…woff2`) that returns **404**, in three
separate browser walks and from a plain `curl`. `document.fonts` reports
`Bricolage Grotesque 100 900 error` and `check('800 96px "Bricolage Grotesque"')`
is `false`. Every node declared `"Bricolage Grotesque", system-ui, sans-serif`
therefore renders in the OS sans (SF Pro on the capture host). Space Grotesk
(`spacegrotesk/v16/…`) loads, 200. Ratings below score what renders.

Page, top to bottom: a nav (wordmark, DISCOVER / EVENTS / LEADERBOARD, "Sign in",
a marigold "Join the table"); a 1376x702 framed hero photo of eight laughing
diners over a curry spread, with a red "LIVE · 2,402 FEASTS THIS WEEK" pill, a
96px two-line H1 "KEEP CALM / AND CURRY ON" (second line orange italic), a 20px
subhead and two pill CTAs, all set bottom-left over a to-top scrim; a 728x90
dashed "PLACE YOUR ADVERTISEMENT HERE" slot; "THREE INGREDIENTS, ONE COMMUNITY." over
three equal icon cards; an "ACTIVE NOW" strip of six 220px review cards in a
horizontal scroller; "UPCOMING STEAMS" with an empty state; "TRENDING CHAPTERS",
two club cards in a three-column grid; a 970x250 ad slot; a 60px marquee of
taglines at 10% alpha; footer. Page height 3471px.

The root URL is the live app's home route, not a separate marketing page. Six
Supabase REST calls (`profiles`, `events` x2, `reviews`, `clubs`, `profiles`) all
return 200 on load, and the "Active now", "Upcoming steams" and "Trending
chapters" modules render their rows; none of those rows exists as a literal in
the home chunk (`index-66mefrQc.js`). Under the SCOPE block's "page is the
product" note, the hero, feature row, ad slots, marquee and footer are marketing
chrome; the three live modules are product surface, their framing scored as
chrome and their rows treated as content.

### Slop present (3)

**`three-card-row`.** "THREE INGREDIENTS, ONE COMMUNITY." sits over a static grid
`grid-template-columns: 410.656px 410.672px 410.656px`: three equal 411x218 cards
(radius 20px, 1px border at 12% cream, fill `#14110e` at 50%), each a 48px round
orange-tinted chip holding one icon, a 24px/700 head ("Form your club", "Plan a
feast", "Eat. Rate. Repeat.") and one 16px sentence. The heading even names the
count. Not a carousel.

**`generic-line-icon-set`.** The three feature-card icons are Lucide
(`lucide-users`, `lucide-calendar`, `lucide-flame`), all 24x24, `stroke-width: 2`,
all orange `#ff6218`, each in the same 48px chip, each restating its head:
users for "Form your club", calendar for "Plan a feast", flame for "Eat. Rate.
Repeat." (the flame is also the wordmark glyph, so it carries the brand, not the
step). One set, one size, one stroke, nothing the heading does not already say.
The 14px `lucide-star` / `lucide-user-plus` in the feed cards and the 12px
`lucide-map-pin` on club cards are inside product modules and not counted.

**`stock-photo-generic`.** The hero is `/assets/hero-feast-CzRKMBFJ.jpg`, natural
1376x768, rendered 1376x702 `object-fit: cover`, alt "A diverse group of friends
laughing while sharing a feast of Indian curries, biryani and naan". Eight
people in a row of laughing three-quarter faces, candles, steam and neon rim
light. It shows no club, place, event or member of this product; it is the
"diverse friends laughing over food" frame any restaurant, delivery app or
supper-club brand could run. The second clause fires too: the H1 (y426-599),
subhead (y623) and CTAs (y711) sit over its lower half, and a 1376x702 scrim is
bolted over it for them, `linear-gradient(to top, #090706 0%, card/0.3 50%,
transparent 100%)`. Provenance is not established (no credit, no reverse-image
check run); the hashed bundled asset matches glowcase-A's `hero-team-…jpg`, which
was scored the same way. The two club cover images are different in kind: they
are user-supplied `cover_image` values from the `clubs` table (a Brick Lane
street sign, the Everest restaurant in Christchurch), hot-linked Google Images
thumbnails (`encrypted-tbn0.gstatic.com`, 300x168 and 256x197 upscaled to
409x230), product data, not chrome.

### Craft present (4)

**`type-scale-high-contrast`.** `ladder.cjs`: largest lettered node 96px ("KEEP
CALM", "AND CURRY ON") over a 16px body, **6.0:1**, well clear of 3.75. The H1 is
set apart, not merely large: it is the only 96px node, and the next step is the
48px section H2s, a 2.0x jump; the 60px marquee runs at 10% alpha. The ratio is
nominal font-size, so the fallback face does not move it. The H1 also carries
`letter-spacing: -4.8px` (-5%), weight 800, `line-height: 0.9`.

**`real-product-surface`.** The live modules are the product itself, not a
rebuild of it: the "Active now" cards are the five newest `reviews` rows joined
to `profiles` names, plus the newest profile ("CoTM / Joined CurryClub / JUL 3");
"Trending chapters" is the `clubs` table (`limit=6`, 2 rows returned) with each
card linking to a `/clubs/<uuid>` route whose id is the row's own; the bundle
defines the nav targets as app routes (`/auth` "Sign in · CurryClub", a "Plan a
curry feast" route, `/events/$eventId`), not marketing anchors. Not the
doorway: the review strip and club cards are the product answering (ratings,
names, restaurants, dates), not a sign-in form. The events module is an empty
state, but the surface does not rest on it. Recorded, as the SCOPE note says
every rater on a page-is-product page did, as firing largely by construction.

**`shows-deliverable`.** The deliverable of a club-and-review network is its
activity: reviews, events, clubs. The page's own live modules carry content that
counts directly against the page's own headline claim. Named entries:

> **Hero pill:** "LIVE · 2,402 FEASTS THIS WEEK" (10px/700, red, `animate-pulse`).
> In the bundle it is a string literal, `children:"Live · 2,402 feasts this week"`;
> no query feeds it.
>
> **"UPCOMING STEAMS":** "No upcoming events yet — be the first to host one."
> (16px, legible). The `events` query behind it is not merely date-filtered:
> the unfiltered `events?visibility=eq.public&limit=5` call also returns `[]`.
> The product holds zero public events of any date.
>
> **"ACTIVE NOW"** (pulsing red dot): all five reviews are of one restaurant,
> "Himalayas Indian Restaurant"; the newest is `2026-10-01T21:42Z` (shown "OCT 2"),
> 17 days before capture (`2026-10-19T04:16Z`); and five reviews come from four profiles, so "Eddie"
> appears twice on OCT 1 rating the same restaurant 10/10 and 8/10.
>
> **"TRENDING CHAPTERS":** two clubs, from a `limit=6` query, so the whole
> public club list is two, leaving the third column of the grid empty.

All of it is legible at page size (9-16px type, 14px names). It is the product's
own operation and unscrubbed output, and nothing on the page sells empty states,
data hygiene or freshness, so it is not "the capability being sold". It sits on
the same screen as a fabricated live count it falsifies, which is the grepjob-A
shape (feed content against the hero's own written claim) and the
correlation-studio-A shape (unscrubbed product output the page does not flag).
Present, and the softest craft call on the page; see near-misses. Provenance
`origin-captured`: live `reviews`, `events`, `clubs` and `profiles` responses
return exactly the rendered values. Not `anchored` (no external authority
checked) and not `disclosed` (nothing labels the modules as sample data).

**`density-variation`.** Measured the glowcase-A way over the stitched strip.
Ink (share of 2px samples more than 60 summed RGB units from the band's modal
background): footer 3.5%, both ad slots 4.0%, events 4.5%, active strip 5.6%,
feature row 7.1%, marquee 18.8%, chapters 27.2% (photo cards), hero 50.6%
(photo). Text characters per 1000px of height: hero 185, events 305, chapters
429, footer 513, ad 656, features 675, marquee 794, active strip **1497**; text
nodes per 1000px run 8.5 (hero) to 153 (active strip, 27 nodes in 177px at
9-14px). Roughly a 14x spread on ink and 8x on characters. Present on the number,
but thin in kind: see near-misses.

### Near-misses, each with what settled it

- **`shows-deliverable` → present, softest call.** The opposite reading: an empty
  events list is the product not having answered yet, the "doorway" case dachly-A
  applied to "Setup Required"; and a stale date is "a timestamp on content, not
  output on a job", dachly-A's ruling on a seeded note. Held present because
  (a) the `events` response is the product answering a query with zero rows, not
  a gate asking for setup; (b) the review strip is populated output, and its
  single-restaurant, double-posted, 17-day-old contents sit under a pulsing "ACTIVE
  NOW"; (c) both falsify a claim the page makes about itself in the same viewport
  scroll, which is what carried grepjob-A. None of this is a stance the vendor
  took: it is a demo of nothing being curated, and the vocabulary scores content,
  not intent. Absent gives net 0.
- **`density-variation` → present, second softest.** The ink spread is
  photo-driven (hero 50.6%, chapters 27.2%); the text-only sections sit in a narrow
  4.0-7.1% band, and the only change of text density is one 177px strip on a
  3471px page. Much of the airiness is missing data (an empty events box, an empty
  third club column) and two placeholder ad slots, not designed rest. Held present
  for method parity with glowcase-A, whose spread (2.9-61.5% ink, 7-40
  nodes/1000px) was scored present. A rater reading for designed rhythm scores
  absent: net 0.
- **`generic-sans-default` → absent, but the display voice IS the OS default.**
  Space Grotesk, loaded and non-default, sets 58 of 76 visible text nodes and 1093
  of 1551 characters (70%; scripts and the Lovable badge excluded): body, nav,
  wordmark, labels, buttons, footer. The 18 heading and display nodes (458
  characters) render in `system-ui` only because Bricolage's file 404s. The corpus fires this signal when the reading face is
  Inter or the OS stack (toolsapp-work, puzzlesbox; permit-guide-ai fired on an
  Inter body under a custom display face); dipole-labs is absent because neither
  shipped face is the default. The reading face here is not. A rater who takes the
  loudest voice (96px and 48px heads in SF Pro / Segoe UI) as decisive scores
  present: net 0.
- **`custom-type-pairing` → absent, on what renders.** As written, the CSS pairs
  Bricolage Grotesque (display, 18 nodes, 12-96px) with Space Grotesk (reading,
  56 nodes, 9-24px), each with a job and one crossing (the 24px/800 wordmark is
  Space Grotesk). Had Bricolage loaded, this would likely be present. It does not
  load for any visitor, so the page shows OS sans over Space Grotesk, and a
  platform default doing the display job is not a custom pairing. If the font URL
  is fixed this value should be re-checked: net -2.
- **`stock-photo-generic` → present.** Could go absent on subject: it is on-topic
  (curry, biryani, naan), unlike glowcase's office stock. Settled by the second
  clause, which needs no judgement of genericness: type over the photo's busy lower
  half, rescued by a bolted to-top scrim. Absent gives net -2.
- **`generic-line-icon-set` → present.** The literal case (three equal feature
  cards, one icon each, restating the head). The flame doubling as the brand glyph
  is the only argument against, and it does not change what the icon says in the
  card.
- **`badge-pill-spam` → absent.** Above the fold, the only decorative pill is "LIVE ·
  2,402 FEASTS THIS WEEK" (197x23). "Join the table", "Find a club" and "See
  upcoming events" are fully rounded but are CTAs, not badges. 1 < 3.
- **`one-accent-discipline` → absent.** Four chromatic hues with separate roles:
  orange `#ff6218` (13 text nodes including the H1's second line and every H2's
  italic half, 8 icons, 8 chip fills, 2 ad borders), marigold `#ffc100` (all 3 CTA
  fills, 2 link underlines), chili `#d6002e` (the LIVE pill, 2 pulse dots,
  "SCORCHING", "NEW", the wordmark flame), cardamom `#6d8e35` ("ACTIVE NOW"). The
  warm three read as one spice family, but marigold-for-action and orange-for-display
  are distinct jobs, and green is a fourth.
- **`indigo-violet-accent` → absent.** No violet anywhere in page chrome. The served
  `theme-color` meta is `#0B0B14` (a blue-black, not rendered in the page), and the
  `#575ECF` stop belongs to the Lovable badge's logo.
- **`asymmetric-split` → absent.** No two-column split exists. The hero copy block
  (`max-w-2xl`, 672px) sits bottom-left over a full-width photo: an overlay, not a
  column division. Section headers pair a left H2 with a right "ALL EVENTS" link: a
  header row. The empty third column under "Trending chapters" is missing data.
- **`single-optical-anchor` → absent (rule-ineligible, recorded honestly).** Counted
  in the hero. The framed photo fills 702 of 900 viewport px, so at card level it
  is one mass because it is the only mass, and I do not credit that. Inside it, the
  96px headline (the orange italic line is the most saturated thing in the frame)
  competes with eight lit faces across the full width and a bright food spread
  under the subhead. No single mass dominates.
- **`editorial-grid-break` → absent.** Two container widths, each used consistently:
  1376px (x32-1408) for the hero, both ad slots and the marquee band, 1280px
  (x80-1360) for every section. The marquee text overflows but is clipped
  (`overflow-hidden` band); the feed track (1380 in a 1280 clip) is a scroller.
- **`symmetric-everything` and `centered-hero-stack` → absent.** `symmetry.cjs`:
  basis h1-h2, n=4, centred 0, share **0.00**. The H1 computes `text-align: start`
  at x64, anchored bottom-left of the photo. The only centred content is the events
  empty state and the two ad slots.
- **`gradient-blob` → absent.** Six gradients, none a blob: the hero scrim, two ad
  slot washes (orange 10% to card 40%, `to right bottom`), two 1px diagonal hatch
  patterns inside the ad slots, and the 79x6 heat bar. Zero radial or conic
  gradients, zero elements with `filter: blur()`. The yellow smear behind the nav in
  tile 01 is the "Find a club" button seen through the nav's `backdrop-filter`.
- **`glass-card-overuse` → absent.** One `backdrop-filter` surface, the 1440x65 nav
  (`blur(12px)`).
- **`gradient-fill-cta` → absent.** All three primary buttons are flat marigold,
  `background-image: none`.
- **`scroll-reveal-blank` → absent.** 78 text nodes; 0 under 8% effective opacity
  (ancestor-multiplied) at rest, 0 after a 250px-step walk (6.0s), 0 after a matched
  6.0s dwell. The only animations are `pulse` (the LIVE pill and a dot) and the
  40s `scroll-x` marquee.
- **`typewriter-headline` → absent.** H1 text identical across 8 samples over 12s; it
  is a JSX literal. The marquee cycles taglines, but it sits above the footer at 10%
  alpha, not in the headline or a product panel.
- **`emoji-as-icon` → absent.** Zero pictographic characters in 78 text nodes.
- **`testimonial-card-row` → absent.** No quotes. The review cards carry a rating,
  a name, a restaurant and a date, no quoted text, and they are product rows.
- **`hero-mockup-float` → absent.** No UI image or drawn panel in the hero.
- **`live-claim-control` → absent.** Zero `input`, `select`, `textarea`, slider or
  switch on the page. The central claim ("Find your local spice community", "2,402
  feasts this week") can only be tested by leaving for `/discover` or `/events`.
  The live modules falsify the claim without any control, which is why that
  evidence is scored under `shows-deliverable`, not here.

Not signals, recorded as fact. At 390px the page has no horizontal overflow
(390 vs 390) but the hero shrinks to 358x224 and the absolutely positioned pill
and H1 fall outside it: the first phone viewport shows the subhead and CTAs over
the photo and no headline. Section H2 "UPCOMING STEAMS" (sic). Meta description
names the product "Curry Connect"; the title, nav and footer say "CurryClub" and
"CC.WORLD".

### Verdict: `mixed`, net −1

Slop present 3 (`three-card-row`, `generic-line-icon-set`, `stock-photo-generic`)
against craft present 4 (`type-scale-high-contrast`, `real-product-surface`,
`shows-deliverable`, `density-variation`): 3 − 4 = **−1**, mid-band mixed.

No path to `slop`. The three slop signals are the feature-triplet pair and a
hero photo; the page measures absent on the whole axis-locked, glassy, gradient
set that marks openhack and heroku-2014 (symmetry share 0.00, one blur surface,
flat CTAs, no blobs, no reveals, no violet). Flipping every flagged call toward
slop (`generic-sans-default` present, `shows-deliverable` absent,
`density-variation` absent) reaches **+2**, still below the +3 mixed files
deepmark and stripe-2014, and two short of the +4 gate.

No grounds for `exemplar` either, and the net should not be read that way. Two
of the four craft signals fire on the page's emptiness and on its being the app
itself: `real-product-surface` by construction, and `shows-deliverable` because
the live data contradicts a hard-coded "2,402 feasts" claim, which is a defect
the vocabulary happens to credit, not a stance. The page is 3471px with four
content sections, two of them near-empty (no events, two clubs), and two ad
placeholders, so several slop signals (testimonials, pill counts, card rows
beyond the one) had little room to fire. The single flip toward exemplar
(`custom-type-pairing` present, if the Bricolage URL is fixed) gives −2, the
exemplar band's edge, on a page whose craft count rests partly on empty data.
`mixed`.

**Rater B.**

# thecurryclub.lovable.app — CurryClub

## Capture

Viewport 1440x900. Page height 3471 CSS px, `documentElement.scrollHeight`
equal to the stitched height (3471 vs 3471, stitcher reported 0 drift).
Five tiles, `clamped: false`, coverage 1.0, last strip ends on a real
`<footer>` (113 px, "CC.WORLD / © 2026 Curry Club International · All rights
spiced"). No inner scroller. One 1440x3471 strip.

The page is a marketing landing page for a live product. It has a working
backend: six `supabase.co/rest/v1` calls return 200 during load (events,
clubs, profiles, reviews), and the review rail, the club cards and the
empty event state are all rendered from those responses, not from fixtures.
The `<html>` element carries `class="dark"`; there is no theme toggle and no
`prefers-color-scheme` listener, so the page is single-theme.

Three observations that are stated once and then left out of the signal
counts:
- **An "Edit with Lovable" badge is fixed to the viewport** and appears in
  every strip (123x24 at y=864, viewport-anchored). It is the site builder's
  chrome, not the page's. I treat it as absent for every signal.
- **Two ad placeholders are part of the page's design**, not missing content:
  a 728x90 at y=815 and a 970x250 at y=2774, each with "AD / 728 × 90 /
  320 × 50 / PLACE YOUR ADVERTISEMENT HERE" in 9-10 px micro-type, a 45°
  repeating-linear-gradient at `opacity: [0.08]`, and the premium one
  carrying "REACH THOUSANDS OF CURRY LOVERS · PARTNERS@CURRYCLUB". These are
  designed units. They count as chrome where signals look at chrome.
- **One console error, and it is a font**: the Bricolage Grotesque woff2 at
  `fonts.gstatic.com/s/bricolagegrotesque/v8/…` returns 404 and aborts.
  `document.fonts` reports `Bricolage Grotesque 100 900 status: "error"` and
  `Space Grotesk 300 700 status: "loaded"`. See `custom-type-pairing`.

## Slop signals present

**`three-card-row` — present.** The "Three ingredients, one community."
section is exactly three equal cards in one row: 411x218 each at x=80, 515,
949, filling the 1280 content width with a 24 px gap. They are links, they
share one icon-plus-heading-plus-body structure, and together they are the
whole of that section. No fourth item, no asymmetry within the row.

**`badge-pill-spam` — present, at the threshold, not by a wide margin.**
Three decorative full-radius pills sit above the fold (y < 900), outside any
embedded product surface:
1. `Live · 2,402 feasts this week`, 197x23, `border-radius: 3.36e7px`
   (full), solid `#ff6218`, y=387.
2. `Find a club`, 137x40, full radius, solid `#ffc100`, y=711.
3. `See upcoming events`, 211x40, full radius, 1 px `rgba(244,227,199,0.3)`
   ring, y=711.

The nav's `Join the table` (121x32, full radius, y=16) is a fourth and is a
CTA, not decorative. Two of the three counted are CTAs whose pill shape is
the page's button style; the one that is unambiguously decorative is the
`Live · 2,402 feasts` badge, which restates a number the page shows no
control over. At 3 exactly the threshold is met. Had the badge been a
rectangle the value would be absent, so this is recorded as the weakest of
the six present slop signals.

**`generic-line-icon-set` — present.** Three feature icons at y=1174: 24x24
glyph inside a 48x48 circular `oklab(0.70 0.161 0.135 / 0.15)` tile, one
uniform set, uniform stroke (2 px), uniform stroke colour `#ff6218`. Each
glyph (people, calendar, flame) is fully described by its adjacent heading:
"Form your club" / "Plan a feast" / "Eat. Rate. Repeat." Nothing in the
glyph adds information the heading does not. The nav logo flame (24x24,
2 px, `#df0025`) and the five 14x14 star glyphs in the review chips are the
same set extended, but the test is uniformity plus emptiness and the three
feature glyphs decide it on their own.

**`stock-photo-generic` — present, and on both limbs of the definition.**
The hero is one 1376x702 `<img>` (`/assets/hero-feast-CzRKMBFJ.jpg`, natural
1376x768) showing seven smiling diners around a candlelit table of curries.
It could belong to any restaurant, food-delivery or recipe page; nothing in
the frame is specific to this product. It also cannot survive its type, so
a scrim is bolted over it: a full-bleed `linear-gradient(to top,
lab(1.98 0.35 0.62) 0%, oklab(0.13 … / 0.3) 50%, transparent 100%)` at
1376x702 sits over the photo, and the cream body colour `#f4e3c7` is
readable only because of it. Both clauses of the v3 note are satisfied.

**`centered-hero-stack` — present.** The hero stack (badge at y=387,
headline at y=426-599, subhead at y=623, two CTAs at y=711) is a vertical
stack, not a two-column hero: the `h1` is 672 px wide inside a 1376 px
hero, so the stack occupies the left 49% and the photo is a full-bleed
background rather than a second column. Recorded as it is; the v3 note says
this signal is expected to fail eligibility, and no rule should be written
from it.

## Craft signals present

**`asymmetric-split` — present.** Hero `h1` 672 px wide against a 1376 px
hero image (0.49 of the band); content column 1280 px at x=80 against a
1440 px page; the "Upcoming Steams" heading is 434 px wide with its "All
events" link pushed to x=1280. The page is a left-aligned editorial column
with deliberate rightward white space, not a centred stack. Measured
heading centring: 0 of 4 section headings (`h1`, and the three `h2`s at
96/48/48 px) are centred on the page axis (`scripts/antislop/symmetry.cjs`:
`n: 4, centred: 0, share: 0`).

**`single-optical-anchor` — present, with the vocabulary's caveat stated.**
This signal is rule-ineligible and undefined in v4, so here is my honest
call and what I counted. The anchor is the hero photograph: 1376x702, the
only image above 200,000 px² on the page (the two club thumbnails are
409x230), the only full-bleed band, and the largest object on the page by
an order of magnitude. The stack in its lower left is read as text on that
mass rather than as a competing mass. "One mass dominates because there is
only one mass" is not what happens here: the page carries five other
sections, and the hero wins on size, not on being alone.

**`type-scale-high-contrast` — present.** `scripts/antislop/ladder.cjs`:
largest lettered text node 96 px (`KEEP CALM`), body 16 px, ratio 6.0:1.
The rung below is 48 px (2 of the 3 `h2`s), then 24 px `h3`, then 14 px
body-small, ending in 10 px and 9 px micro-labels. Twelve distinct sizes
(9, 10, 12, 14, 16, 18, 20, 24, 36, 48, 60, 96) — a wide ladder, and the
top rung is not a stray figure but the `h1` itself, at `font-weight: 800`,
`letter-spacing: -4.8px`, `line-height: 0.9`.

**`density-variation` — present.** Measured band heights down the page:
65 (nav), 702 (hero), 90 (ad), 314 (features), 177 (review rail), 262
(empty state), 476 (chapter cards), 250 (ad), 126 (marquee), 113 (footer).
The full-width 702 px hero against the 177 px rail and 113 px footer is a
6.2:1 spread, and the page alternates full-bleed bands (1376 px) with a
1280 px content column.

**`live-claim-control` — present, and it is the one craft signal that most
needs its evidence written down.** The v3 note asks for a control letting
the visitor falsify the page's central claim. Here the label is
`LIVE · 2,402 FEASTS THIS WEEK` (10 px, weight 700, letter-spacing 1 px,
uppercase, y=387), and the page's claim is that it is a running social
network. I loaded the page twice in fresh contexts 40 s apart and the
number read `2,402 FEASTS` both times, while the sections below it were
visibly different: "No upcoming events yet — be the first to host one",
and a review rail whose newest entry is `OCT 2`. The badge asserts a
week-on-week figure no request backs; it is static markup, not a live
counter. That is the falsification: the page's own label is checkable
against its own feed and the feed wins.

**The reverse reading, so a second rater can weigh it:** the rest of the
page's content IS live. Six `supabase.co/rest/v1` responses (events, clubs,
profiles, reviews, profiles-by-id) return 200 on load, and the empty state
is genuine. If `live-claim-control` is read as "at least one claim on the
page is falsifiable and the page lets you falsify it", the badge's
`2,402` against `No upcoming events yet` is that pair. I score present on
that basis and on the label being visible at page size. A rater who
requires an interactive control (a toggle, a slider, a switch) rather than
a visible label will score this absent; that would leave 5 slop against 4
craft, net +1, still far short of the +4 slop gate, so the verdict does
not turn on it.

## Near-misses

- **`one-accent-discipline` — absent, and this is the closest craft call on
  the page.** Two accents carry the hero by themselves, both at full
  chroma: `#ff6218` (chroma 231) on the words "AND CURRY ON" and on every
  small icon, and `#ffc100` (chroma 255) on every primary button. A third,
  `#df0025` (chroma 223) runs the logo's flame stroke, the `LIVE` badge
  fill and the heat bar. Yellow and orange-orange are different hues 28°
  apart, and the page uses them for different jobs, which is a system, not
  an accident. The v3 ruling is about a single accent, and the corpus
  treats a second accent hue as a breach even when each is disciplined
  within its role. Held absent. The heat bar's `linear-gradient(90deg,
  #ffd45f, #ff6218, #df0025)` is excluded from this count: it sits inside
  the review-rail's data display and encodes the 0-10 score, so it is data
  colour, not chrome.
- **`custom-type-pairing` — absent, on a defect.** The page declares
  `Bricolage Grotesque` (display, weights 100-900) over `Space Grotesk`
  (body, 300-700). Only Space Grotesk loads. The Bricolage woff2 404s and
  aborts; the face's status is `error`; and the `h1`'s rendered width
  (658 px for "AND CURRY ON") matches the `system-ui` probe exactly (652
  px measured with identical `font: 800 96px` + `-4.8px` tracking, against
  Space Grotesk's 614 px). What actually renders is OS default display
  over Space Grotesk body, which is one authored face, not a pairing. On
  intent the two families would be a pairing; on what the page shipped to
  this viewport, it is not. If the missing file is restored the signal
  should flip to present and the net falls to -1.
- **`shows-deliverable` — absent, and it is the most interesting absence
  on the page.** The review rail renders live unscrubbed rows: six chips,
  220 px wide at a 232 px pitch, `8/10 Jalfrezi · Himalayas Indian
  Restaurant · OCT 2`, `10/10 Eddie`, `8/10 Eddie`, `10/10 Rob Martin`,
  `8/10 Mike`, and a sixth whose profile name is NULL so it renders as
  `New / CoTM / Joined CurryClub / JUL 3`. Two of the six are the same
  person at the same restaurant within one day, and the NULL-name row is
  unscrubbed database output. Under the permissive reading — "the
  product's output with an entry that could embarrass" — the NULL-name
  card passes, and origin is `origin-captured` (the values arrive from a
  live REST call). I score absent on the stricter, load-bearing clause:
  the artefact must show the deliverable the product claims to make, and
  the page's only persistent output surface is an aggregate feed of other
  people's reviews, not a curry club's page, a leaderboard or a rating
  card produced for a visitor. The NULL-name row is evidence of a live
  feed, not of a deliverable. Taken together with the `2,402` finding in
  `live-claim-control`, the reader already has the unflattering entry;
  scoring both present would double-count the same observation.
- **`real-product-surface` — absent.** No screenshot, iframe, canvas or
  drawn UI of the dashboard, `Leaderboard` or the review form. The nav
  links to `/discover`, `/events`, `/leaderboard`, `/auth` — all
  doorways. `/auth` targeted by "Join the table" and "Sign in" would fail
  the doorway rule even if captured.
- **`generic-sans-default` — absent, deliberately.** Space Grotesk is a
  real authored face and its webfont loads (200). The Bricolage failure
  does not reach this signal; a custom face that fails to load leaves the
  body face authored.
- **`gradient-blob` — absent.** Six background-images on the page: the
  hero scrim, two diagonal two-stop tints inside the ad units (10% alpha),
  a 45° repeating hairline texture on the ad units, and the heat bar. No
  free-floating radial or blurred blob.
- **`glass-card-overuse` — absent.** One `backdrop-filter: blur(12px)`
  surface in total, on the sticky nav (`bg-background/80`). Every card
  fill is opaque-ish `oklab(0.18 … / 0.5)`: 50% alpha of a near-black,
  with no blur behind it.
- **`indigo-violet-accent` — absent.** Every chroma ≥18 colour on the page
  converts, via `chroma = max(r,g,b) − min(r,g,b)`, to: `#ffc100` (255),
  `#ff6218` (231), `#df0025` (223), text `#f4e3c7` (45), text-secondary
  `#f1e3c7` (42). No blue-violet anywhere. A useful side note for the
  colour block: every computed colour on this page is emitted as
  `lab()`/`oklab()`, so a regex-for-`rgb` chroma probe reads zero and must
  be converted, not trusted.
- **`gradient-fill-cta` — absent.** Both hero CTAs and the nav CTA are
  flat `#ffc100`, `border-radius` full, no gradient. The one gradient
  button-adjacent element is the heat bar, which is a bar.
- **`scroll-reveal-blank` — absent.** One text node on the whole page is
  below 0.95 opacity after a full walk: the `Live · 2,402 feasts` span at
  0.949, present at load with the same string. No dwell control was
  needed; nothing was gated.
- **`typewriter-headline` — absent.** `h1` is static markup. No cycling.
  (The marquee at y=3152 scrolls horizontally, but it is a strip, not a
  headline, and it is not timer-cycled text.)
- **`testimonial-card-row` — absent.** No testimonials section exists.
- **`emoji-as-icon` — absent.** Glyph census across all text nodes: zero
  characters in U+1F300-1FAFF, U+2600-27BF, U+2B00-2BFF, U+FE0F or
  U+2190-21FF. The `Lovable` badge carries its own logo, outside the page's
  chrome and excluded above.
- **`hero-mockup-float` — absent.** The hero is a photograph; no fake UI
  floats in it.
- **`editorial-grid-break` — absent.** The single deliberate break is the
  review rail extending past the 1280 content edge to x=1440, and the two
  club thumbnails are hotlinked `gstatic.com` images at 300x168 and
  256x197 rendered at 409x230 (upscaled 1.36x and 1.60x, visibly soft in
  the strip), with a plain 2-up grid and no overlap. Not a grid break.

## Verdict

Slop present: 5 (`three-card-row`, `badge-pill-spam`,
`generic-line-icon-set`, `stock-photo-generic`, `centered-hero-stack`).
Craft present: 5 (`asymmetric-split`, `single-optical-anchor`,
`type-scale-high-contrast`, `density-variation`, `live-claim-control`).
Net = 5 − 5 = **0**.

That is `mixed` (the mixed band runs -6..+3). The brief requires net ≥ +4
plus prose a second rater can check separating the page from the +3 files,
and I cannot honestly write that prose. Compared signal for signal:

- Against **deepmark (+3)**: both carry `badge-pill-spam`,
  `generic-line-icon-set`, `stock-photo-generic`, `centered-hero-stack`.
  Deepmark additionally carries `generic-sans-default` and
  `hero-mockup-float`; this page carries none of those and instead earns
  `type-scale-high-contrast` (6.0:1 vs deepmark's absent),
  `single-optical-anchor` and `live-claim-control`.
- Against **stripe-2014 (+3)**: stripe carries `gradient-blob`,
  `three-card-row`, `indigo-violet-accent`, `gradient-fill-cta`,
  `generic-line-icon-set`, `hero-mockup-float` (six slop) against three
  craft. This page carries five, and its composition differs (an editorial
  left column over a photo rather than a centred product mock).

The thing that separates this page from the slop band is not a single
signal but the top of the ladder and the feed: a 96 px headline at 6:1 with
-4.8px tracking, a 12-rung scale with 9 px micro-labels, and a live
Supabase feed that renders a NULL name and an empty state rather than a
grid of flattering cards. The page is a designed object with a real
backend and a stock hero; the two sides balance, which is a net of 0 and
the middle of `mixed`.

## Drift

No prior study — this is a new page.

## Notes for a second rater

1. `live-claim-control` is scored present on the badge's own falsification
   (`2,402` against "No upcoming events yet") and also takes
   `shows-deliverable: present` in the permissive reading of the NULL-name
   review row. That second call would make the net -1. I scored the
   deliverable absent and gave the reason. Check the two against each
   other, do not score both.
2. The Bricolage 404 is reproducible (fonts.gstatic.com, HTTP 404, then
   `net::ERR_ABORTED` on the same URL); re-check it before a re-pass. If it
   ever loads, `custom-type-pairing` flips to present and the net falls
   to -1.
3. The `Edit with Lovable` badge is pinned to the viewport and appears in
   every tile. Exclude it from pill and icon counts.
4. Colour on this page is authored in `lab()`/`oklab()`. A probe that
   matches `rgb(` reads zero accent and will produce a false
   `one-accent-discipline: present`.
