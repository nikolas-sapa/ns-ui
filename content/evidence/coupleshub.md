---
source: https://coupleshub.io/
kind: site
cohort: ai-builder
verdict: slop
studied: 2026-10-19
context: [hero, features, stats, cta, footer, blog-index]
signals:
  gradient-blob: present
  three-card-row: unresolved
  glass-card-overuse: present
  emoji-as-icon: present
  generic-sans-default: present
  symmetric-everything: present
  badge-pill-spam: absent
  generic-line-icon-set: present
  testimonial-card-row: absent
  indigo-violet-accent: absent
  gradient-fill-cta: absent
  scroll-reveal-blank: present
  typewriter-headline: absent
  stock-photo-generic: absent
  centered-hero-stack: present
  hero-mockup-float: absent
  asymmetric-split: absent
  single-optical-anchor: absent
  type-scale-high-contrast: absent
  editorial-grid-break: absent
  custom-type-pairing: absent
  real-product-surface: present
  shows-deliverable: absent
  density-variation: absent
  one-accent-discipline: absent
  live-claim-control: absent
materials: [single-theme]
---

**Sampling: random draw.** One of twelve drawn with seed 20261019 from the twenty-two gallery sites left after the first draw (same pre-stated exclusions). `gunsvzombies`, drawn first, returned 404 (project deleted) and was replaced from the same seed by `openmark`. Not chosen on any signal.

Rated by two independent blind raters on 2026-10-19, neither reading the other's draft. Both reached `slop`. They agreed on 25 of 26 signals; the 1 split `three-card-row` (A absent, B present) are recorded `unresolved`, which never counts toward a rule. Both write-ups follow in full.

**Blindness note.** The two raters shared one probe folder (`s5work/coupleshub/`; since fixed: each rater now gets its own). Rater B read rater A's raw DOM measurements in one overwritten file, with no ratings in it, then moved to a separate folder and re-measured every value used. Neither saw the other's draft. Rater A finished first, so A's rating is unaffected.

**Rater A.**

**Rater A**, blind, new page. Every value above was set from the capture and
the DOM. No other rater's draft for this page was opened.

## Capture

1440x900. Walk `coupleshub-A`: 9 tiles, scroller `window`, `docH_before`
6172 = `docH_after` 6172, `clamped: false`, `coverage: 1`, landings exact
through y4900, last tile clamped to 5272 as expected (6172 - 900). Stitched
to 2 strips (1440x4400, 1440x1772), 6172px against a 6172px page, no drift.
**The last strip ends in the footer**: a navy band with "Quick Links"
(Privacy Policy / Terms of Service / Blog / Contact Us), "© 2026 Couples Hub.
All rights reserved." and "Made with ♥ by MD Meets Techie". The round
scroll-to-top button recurs in every tile. It is a `fixed` element, not
duplicated content. Zero `canvas`, `video` or `iframe`. No inner scroller:
the only inner candidates are the hero's blob layer (2357px, `overflow-hidden`)
and a section at 1154px.

The page has **no nav and no header element**. Bands, top to bottom: hero
(0-900), "Common Challenges in Modern Relationships" (900-1728), "Everything
You Need in One Place" with a laptop render and a 4-up stat row (1728-2868),
"Powerful Features for Modern Couples" (2868-3616), "Latest from Our Blog",
six post cards and "View all posts" (3616-5242), "Discover Activities That
Bring You Closer" CTA (5242-5810), footer (5810-6172). The blog teaser has no
exact `context` slot; `blog-index` names the index page, so it is omitted, as
toppic omitted its blog teaser.

**Capture defect, and it is a finding:** the strip shows the stat row as three
cards with an empty fourth slot at x1096. The DOM holds a fourth card, "200+ /
Total Activities", which reads effective opacity 1 after a scroll walk. The
walker caught a scroll-reveal mid-gate. See `scroll-reveal-blank`.

Dark mode: emulating `prefers-color-scheme: dark` leaves body `rgb(255,255,255)`,
the wrapper gradient and the h2 colour unchanged. `single-theme`.

## Slop signals present (8)

**`gradient-blob`.** The hero's background layer is one
`absolute -top-1/2 -left-1/2 w-[200%] h-[200%]` element, 2302x3345px,
`linear-gradient(to right bottom, rgba(50,93,121,.2), rgba(242,114,33,.1),
rgba(155,215,209,.2))`, `rounded-full`, `filter: blur(64px)`, with an inline
transform that animates (`scale(1.09296) rotate(83.664deg)`, `border-radius:
33.944%` at sample time). Over it sit three `w-64 h-64 rounded-full blur-3xl`
discs (225-254px, navy, orange and teal at `/10`, opacity 0.29-0.38, each
translating). A blurred coloured disc with no content, four times.

**`glass-card-overuse`.** 12 `backdrop-filter: blur(4px)` surfaces: the 4
challenge cards (432x236, `bg-white/80 backdrop-blur-sm`), the 4 stat cards
(296x276, same classes) and 4 overlays behind the feature cards (616x148,
`absolute inset-0 bg-gradient-to-br from-white/80`, blur 4px). That is four
times the decided 3+ threshold.

**`emoji-as-icon`.** The four challenge cards each open on one emoji in a
white disc: U+1F494 broken heart, U+23F0 alarm clock, U+1F914 thinking face,
U+1F504 anticlockwise arrows, 24px. The span's `font-family` is Inter, which
has none of these glyphs, so all four render through the system colour-emoji
fallback (Apple Color Emoji in the capture). They sit in the icon slot above
each card's 20px heading. They are not terminal output and not product chrome.

**`generic-sans-default`.** `document.fonts` holds only `__Inter_d65c78`
(next/font Inter, variable 100-900) and its fallback. 93 of 93 text-bearing
`h1-h3/p/span/a/li` compute to Inter. `ladder.cjs` reports `bigFamilies`
and `smallFamilies` both `["__Inter_d65c78"]`. No display face, no second
family.

**`symmetric-everything`.** `symmetry.cjs`: basis `h1-h2`, **7 of 7
centred, share 1.00**, well above the 0.85 cut. The h3s agree everywhere
except inside the stat and feature cards, which are `text-align: start`
inside equal-width grid cells.

**`generic-line-icon-set`.** One set, Lucide (`class="lucide lucide-*"`), 18
SVGs, every one `viewBox 0 0 24 24`, `fill: none`, stroke 2px. The eight
that carry the section modules are 24px, one per tile: stat row `video` /
`gamepad` / `gift` / `star` in 48px navy squares; features `heart` / `users` /
`calendar` / `book-marked` in 56px white squares. Each restates its heading
and adds nothing: video for "Virtual Date Activities", gamepad for "Games for
Two", gift for "Gift Recommendations", calendar for "Date Night Planner",
users for "Community-Driven". The feature icons are tinted in three hues
(orange, navy, teal). Stroke and size stay uniform, so the tint is colour,
not information. The rest are 9 `arrow-right`s and one footer `heart`.

**`scroll-reveal-blank`.** Measured against the dwell control the brief
requires. Leaf text nodes (`h1-h4/p/li/a/span` with no element children, 3+
characters, non-zero box): **66**. At the rest sample, at scroll 0, **59**
read effective opacity (product of ancestor opacities) under 0.08.
- **Dwell, 14s, no scroll:** 4 recover: the two headline lines, the subhead
  and the CTA. That is a load-time fade (a time gate), so it is not counted.
- **Walk, 0→6200 in 350px steps:** **49** more recover. Scrolling recovers
  them and waiting does not.
- **6 never match:** the blog dates, whose text changes on hydration
  (server-rendered `Mar 31, 2025` becomes `Apr 1, 2025` on the client, a
  UTC/local shift). The keys don't match, so these are not a gate.

Paired on fixed nodes in a second run:
- `Distance Creates Barriers`: 0 at 7s, still 0 at 17s without scrolling,
  1 after `scrollTo(700)`.
- `Curated Activities` and `Latest from Our Blog`: stay 0 until
  `scrollTo(3000)`.

The wrappers carry inline `style` opacity plus a translate. Two signs:
section-level opacity reads 1 while the inner motion divs read 0, and node
y-positions shift by the translate once revealed. That is the
`whileInView` shape. The strip's missing fourth stat card is the
consequence on paper.

**`centered-hero-stack`.** 100svh hero: a 122px logo, the brand name as a 24px
`h1`, the 48px two-line headline (`h2`, line two orange), an 18px subhead and
a 308x56 pill CTA, all `text-center` inside `max-w-7xl mx-auto`, stacked on
the page axis. A mouse-scroll glyph sits at the bottom centre.

## Craft signals present (1)

**`real-product-surface`.** `coupleshub.png`, 2400x1350, rendered 896x504
at y1964. A 3D-rendered copper laptop at an angle, with the app's Discover
screen composited onto it:
- a tab bar `Discover` (selected) / `For You` / `Favorites` / `Schedule` /
  `Profile`;
- the line "Explore curated activities and resources for couples";
- six category tiles;
- three activity cards (`Bunch`, `Truth or Dare`, `2 Truths 1 Lie`), each
  with tier chips and a vote counter.

`app.coupleshub.io` is a sign-in wall ("Welcome back / Sign in to access your
account"), so the live screen could not be laid beside it. Instead I checked
its one shipped bundle (1.35MB), which carries the screen's strings:
- `label:"For You"`;
- the Discover tab's `description:"Explore curated activities and resources
  for couples"`;
- `"free with paid options":{icon:"💰",label:"Free + Premium"}`, which is
  the chip on the Bunch card;
- a `"Virtual Date Activities"` filter button.

The category tile names are not in the bundle. They are database content.
The card images are themselves screenshots of the third-party products listed
(Bunch's app art, a browser capture of a Truth or Dare game, Crowdparty's
"Two Truths & A Lie"). So this is a genuine capture, composited into a device
frame, which is stripe-2014's Checkout case. Flagged: at page size the screen
renders about 450px wide, so its text is about 4 CSS px.

## Near-misses

- **`three-card-row` (absent, could be present).** The blog teaser is three
  416px flex columns of masonry, six cards: column heights 502+684 / 517+515
  / 438+497. The top row aligns at y3856, but the bottoms stagger by up to
  79px and the section is six cards, not three. "Literally three" (session 4)
  and toppic's `present` rested on exactly three equal cards forming the
  section. The stat row is 4-up and both other card bands are 2x2. Flip:
  net +8.
- **`hero-mockup-float` (absent, could be present).** The laptop is a device
  render floated at an angle, which is the mechanism. But it sits at y1964,
  1064px below the hero's bottom edge, in the third band, and the signal is
  named for the hero. Flip: +8.
- **`gradient-fill-cta` (absent, could be present).** All three CTAs are
  solid: `Sign In to Access Resources` and `View all posts` are
  `rgb(50,93,121)`, `Start Your Journey` is `rgb(242,114,33)`, and all three
  are `background-image: none`. `Sign In` holds a child
  `bg-gradient-to-r from-[#325D79] via-[#457B9D] to-[#325D79]` at opacity 0,
  shown on hover only. Scored at rest. Flip: +8.
- **`glass-card-overuse` (present; the count is firm, the look is not).**
  `bg-white/80` with `blur(4px)` over a near-white field
  (`from-white to-[#FAE8E0]`) is visually almost opaque white. The decided
  rule counts `backdrop-filter` surfaces, and there are 12. Not a real flip
  under the rule.
- **`single-optical-anchor` (absent; rule-ineligible, undefined; honest
  call).** What I counted in the opening viewport: three masses on one axis.
  The 122px logo is the viewport's only full-chroma, three-hue mark. The
  48px headline is 672x104, the largest mass, and its orange second line
  repeats the logo's orange. The 308x56 navy CTA is the darkest. The headline
  is largest, but the logo above it competes in colour, and the stack is
  composed on an axis, not around one mass. This is not "one mass dominates
  because there is only one". Coin flip. Flip: +6.
- **`one-accent-discipline` (absent, could be present).** Navy
  `rgb(50,93,121)` (56 colour uses: headings, two CTAs, the footer fill,
  icons) and orange `rgb(242,114,33)` (13 uses: headline line 2, stat
  figures, the closing CTA, two icons) **each carry a CTA**. Teal
  `rgb(155,215,209)` takes one icon and the blob. A reader who takes navy as
  the ink colour sees one accent. Two CTA fills on one page reads as two.
  Flip: +6.
- **`density-variation` (absent, could be present).** Ink per band (pixels
  over 40 grey levels off the band's modal grey):
  - text bands: hero 3.2%, challenges 2.2%, showcase+stats 7.3%, features
    2.7%, CTA 4.3%, footer 1.2%;
  - blog: **20.0%**.

  The blog spike is six photographs. Every band below the hero is a centred
  30-36px `h2`, then a centred subhead, then a card grid, padded
  `py-16/24/32`. There is no table, list, spec or log. This is the reading
  toppic and permit-guide-ai took on the same shape. Flip: +6.
- **`shows-deliverable` (absent).** Entry that could have embarrassed the
  vendor: none in scored content.
  - The laptop's activity cards are illegible at about 4px. At full
    resolution they are three flattering listings with vote counters.
  - `80+ / 40+ / 50+ / 200+` is a vendor-aggregate count, absent by
    precedent.
  - The nearest candidate is a blog card dated `Aug 15, 2022` under the title
    "We Tried 100+ Apps: Here Are the Top 7 for Long-Distance Couples in
    2025!". It is a stale CMS date. It is not the product's output, and it
    narrows no claim. The blog teaser is vendor editorial, not the
    catalogue the product delivers.
- **`type-scale-high-contrast` (absent, firm).** `ladder.cjs`: 48px over
  16px body = **3.00:1**, below the 3.75 cut. Next sizes are 36, 36, 30.

Firm absents, briefly:
- **`badge-pill-spam`:** zero pill-shaped elements above y900. Blog
  categories are plain text.
- **`testimonial-card-row`:** no testimonial section, no `blockquote`.
- **`indigo-violet-accent`:** navy is hue 204°, a slate blue. The only purple
  is inside blog thumbnails, which are content.
- **`typewriter-headline`:** 24 samples over 12s returned one headline
  string.
- **`stock-photo-generic`:** the six blog thumbnails come from the vendor's
  own Supabase `activity-images` bucket. Each shows the product its post
  reviews (GeoGuessr's art, the "paired" app, a "Where We Met" map print, a
  3D party game), with no scrim.
- **`asymmetric-split`, `editorial-grid-break`:** no split layout and nothing
  breaks the grid. The laptop sits `max-w-4xl mx-auto`.
- **`custom-type-pairing`:** one face.
- **`live-claim-control`:** both CTAs route to the sign-in wall. "The world's
  first curated platform" cannot be tested from the page.

## Verdict: `slop`, net +7 (8 slop, 1 craft)

Page height 6172px over seven bands. This is not a thin page.

What separates it from the +3 mixed files, in terms a second rater can
check:

1. **The margin, and the recount on eligible signals.** Raw net is +7, against
   stripe-2014 at +3 and deepmark at +2 as now recorded (the brief lists +3).
   That is above both slop anchors too (heroku-2014 +5, openhack +4). Strike
   the three signals the vocabulary expects to fail eligibility
   (`centered-hero-stack`, `hero-mockup-float`, `single-optical-anchor`) and
   recount, the way vizleads' rater did:

   | page | slop | craft | net |
   |---|---|---|---|
   | coupleshub | 7 | 1 | **+6** |
   | stripe-2014 | 5 | 3 | **+2** |
   | deepmark | 4 | 4 | **0** |

   The gap widens on the eligible signals rather than closing.
2. **The structural craft both +3 files hold is absent here.** stripe-2014 and
   deepmark both carry `asymmetric-split` and `density-variation`. On top of
   that, stripe-2014 has the Checkout capture, and deepmark has Space
   Grotesk/Geist and one held accent. This page has none of those, by
   instrument:
   - every h1/h2 centred (7/7);
   - text bands inside 2.2-7.3% ink;
   - one face (93/93 nodes in Inter);
   - two CTA fills.

   Its one craft value is a genuine screenshot composited into a laptop
   render whose screen text is about 4px.
3. **It carries the robustness defect neither +3 file has.** 49 text nodes
   are recovered by scrolling and 0 by a matched dwell, and the walker's own
   strip lost a stat card to it.
4. **The margin survives the contested calls.** Three page-favourable flips
   are listed above (`single-optical-anchor`, `one-accent-discipline`,
   `density-variation`). Take all three and net is still **+4**. The last
   of those goes against corpus precedent. Reaching +3 needs a fourth flip
   on a value that is measured, not judged. The 8 slop values all rest on an
   instrument reading:
   - `backdrop-filter` count 12;
   - symmetry share 1.00;
   - 93/93 Inter;
   - 49 scroll-gated nodes;
   - a 2302x3345 `blur(64px)` disc;
   - four emoji code points in the icon slot;
   - eight 24px stroke-2 Lucide tiles;
   - the centred hero stack.

The profile is the stock Tailwind/shadcn landing kit seen on toppic and
permit-guide-ai: blur-3xl discs, a centred 48/16 hero, emoji and Lucide
tiles in frosted cards, every section a centred heading over a grid. The one
thing it does better than that kit is show its real app screen, and it shows
it at a size where nothing on it can be read.

Scratch and probe scripts: `~/scratch/antislop/s5work/coupleshub/`
(`probe*.json`, `final.json`, `gate.cjs`, `laptop-crop.png`).

**Rater B.**

Rater B, new page, rated blind. I opened no other rater's draft and none of rater A's strips.

**Process disclosure, so a reader can weigh it.** The brief splits the captures (`s5/coupleshub-B`) but not the probe directory, so both raters wrote to `s5work/coupleshub/`. Rater A's script overwrote my `probe2.json` at the same filename, and I read its raw DOM fields (no values, no prose) before I noticed. I then moved my work to `s5work/coupleshub/rater-B/` and re-measured every number below with my own probes (`rater-B/b-final.cjs`, the emoji and reveal probes, `ladder.cjs`, `symmetry.cjs`). No value depends on A's output. A shell-quoting failure while I was appending this prose executed fragments of it as commands. It wrote nothing: the only worktree file newer than this draft is another page's evidence file, written by the merge.

**What the page is.** It's the marketing page for "Couples Hub" ("Made with ♥ by MD Meets Techie"), a Next.js app, Inter via `next/font`, Tailwind, lucide, framer-motion-style entrance transforms. The only CTA in the hero, "Sign In to Access Resources", links to `https://app.coupleshub.io/`, and that page is a sign-in form ("Welcome back / Continue with Google / or continue with email"). There's no nav. In order, the sections are: a centred hero; "Common Challenges in Modern Relationships" (2x2 emoji cards); "Everything You Need in One Place" (a 3D laptop render, then a 4-up stat row); "Powerful Features for Modern Couples" (2x2 icon cards); "Latest from Our Blog" (six cards in a 3-column masonry); a closing CTA, "Start Your Journey"; and a navy footer.

## Capture

The viewport was 1440x900. `shoot-tiles.cjs coupleshub-B` gave `docH_before` 6172 = `docH_after` 6172, scroller `window`, 9 tiles, `clamped: false`, `coverage: 1`. Every landing matched what was asked except the last (5600 → 5272, the page bottom). The inner candidates were the hero's 2149px blob layer and a 1077px section, neither of them a real scroller. Stitched: 2 strips (1440x4400, 1440x1772), 6172px against a 6172px page, `OK`. **The last strip ends in the footer**: "Quick Links / Privacy Policy / Terms of Service / Blog / Contact Us", "© 2026 Couples Hub. All rights reserved.", "Made with ♥ by MD Meets Techie". Page height is 6172px and there are 7 sections, so this is not a thin page.

The walker's scroll gate is relevant here. 68 text nodes start at opacity 0, and the walk opens them (see `scroll-reveal-blank`). The strips show them because the walker scrolled. Everything is rated from the strips plus DOM reads taken after a full scroll walk.

## Slop signals present (9)

**`gradient-blob`.** The hero's `div.absolute.inset-0.overflow-hidden` holds a 2701x3522 element, `w-[200%] h-[200%] bg-gradient-to-br from-[#325D79]/20 via-[#F27221]/10 to-[#9BD7D1]/20 rounded-full blur-3xl` (`filter: blur(64px)`). It's animated: caught at `rotate(83.664deg)` and `border-radius: 33.944%` mid-cycle. On top of it sit three 256px `rounded-full blur-3xl` discs, `bg-[#325D79]/10`, `bg-[#F27221]/10` and `bg-[#9BD7D1]/10`, at element opacity 0.27-0.34, drifting by transform. The construction is exact: coloured blurred discs with no content. In the strip they read as the grey-beige wash over the hero's top left. That is stronger than vizleads' `present` at 8% alpha.

**`three-card-row`.** "Latest from Our Blog" is three equal 416px columns (`flex -ml-4`, react-masonry-css style, 2 cards per column). The three top cards share one top edge (y3856 on first load) and one template: thumbnail, date and category, a 20px/600 title, an excerpt, "Read more →". Their heights are 503, 518 and 439. Apart from "View all posts", the section is nothing else. This is toppic's blog-teaser precedent. A second instance of the module sits at four: the stat row is four 296x276 cards in `grid-template-columns: 296px 296px 296px 296px`, each a 56px gradient icon square, a 30px number, an 18px/600 heading and one 14px line. Near-miss below.

**`glass-card-overuse`, by the decided count, not by appearance.** After the scroll walk there are **12** visible `backdrop-filter` surfaces, all `blur(4px)`:
- the four challenge cards (432x236, `rgba(255,255,255,0.8)`);
- the four stat cards (296x276, same fill);
- the four feature-card overlays (616x148, `linear-gradient(to right bottom, rgba(255,255,255,0.8), rgba(255,255,255,0.4))`).

At rest before scrolling, only the 4 feature overlays count as visible, because the other eight sit inside opacity-0 reveal wrappers. Either count clears 3+. None of them reads as glass: they frost a near-white `#FFFFFF → #FAE8E0` field, the toppic shape ("by the decided rule, not by appearance").

**`emoji-as-icon`.** Each challenge card is headed by a single emoji in its own 24px `span.text-xl.md:text-2xl`, inside a white `rounded-full shadow-sm` disc: 💔 "Distance Creates Barriers", ⏰ "Time is Precious", 🤔 "Running Out of Ideas", 🔄 "Keeping Things Fresh". The computed font is `__Inter_d65c78, __Inter_Fallback_d65c78`, which has no emoji glyphs, so they render through the system colour-emoji fallback (confirmed in a cropped screenshot). There's no `aria-hidden`. This is not terminal output or data. It is the signal's exact shape.

**`generic-sans-default`.** Inter on every rendered text node (85 nodes, 14-48px). `ladder.cjs`: `bigFamilies: ["__Inter_d65c78"]`, `smallFamilies: ["__Inter_d65c78"]`. No display face and no second family.

**`symmetric-everything`, by procedure.** `symmetry.cjs`: basis h1-h2, n=7, centred 7, **share 1.0** against a 0.85 cut. Beyond the headings, every card grid is equal-column (2x2 at 432px, 4-up at 296px, 2x2 at 616px, 3x416px), and the hero and closing CTA are centred stacks.

**`generic-line-icon-set`.** There is one lucide set: every icon has class `lucide lucide-*` and `stroke-width: 2`, and the card icons are all 24x24.
- Stat row: `video`, `gamepad`, `gift`, `star`, for "Virtual Date Activities", "Games for Two", "Gift Recommendations", "Total Activities".
- Feature cards: `heart`, `users`, `calendar`, `book-marked`, for "Curated Activities", "Community-Driven", "Date Night Planner", "Personal Collections".

Each glyph restates its heading (gift for gifts, gamepad for games, calendar for planner, users for community). Colour varies across the feature set (orange, navy, teal, orange). Stroke and size don't.

**`scroll-reveal-blank`, by procedure, with the dwell control.** On load, 68 text nodes below the fold have effective opacity 0. They are every heading, paragraph and card label from "Common Challenges in Modern Relationships" down through the blog. A 700px-step walk taking 6506ms brought **68 of 68** to ≥0.5. A dwell control on a fresh load waited the same 6506ms without scrolling and recovered **0 of 68**. So the gate is scroll, not time. Two more readings:
- With `prefers-reduced-motion: reduce`, the gate still holds at rest and opens only on scroll.
- With JavaScript disabled, all six h2s, the hero headline included, compute opacity 0. The server HTML ships them as inline `style="opacity:0;transform:translateY(20px)"`.

A no-JS reader or an agent fetching the page gets no headings.

**`centered-hero-stack`, recorded fact.** All five pieces are centred on x=720:
- the 87px logo;
- the 24px brand h1 "Couples Hub";
- the 48px two-line h2 "Strengthen Your Bond, / One Activity at a Time" (box x384-1056, the second line in orange);
- an 18px subhead;
- the CTA pill (x566-875).

## Craft signals present (1)

**`real-product-surface`, present, flagged.** The laptop in "Everything You Need in One Place" (`img` "Couples Hub Platform", `/coupleshub.png`, 2400x1350 source, drawn at 896x504, y1964) shows the app in use: a tab bar (Discover / For You / Favorites / Schedule / Profile), "Explore curated activities and resources for couples", six category tiles, and three activity cards (Bunch, Truth or Dare, 2 Truths 1 Lie) with tags ("Free + Premium", "Casual", "Exciting", "Fun"), vote counts and heart buttons. I checked it against the shipped app bundle (`app.coupleshub.io/assets/main-CA93HQjI.js`, 1.35MB). "Explore curated activities", "Gift Recommendations", "Virtual Date Activities", "Games for Couples", "Free + Premium", "Casual", "Favorites" and "Schedule" are all present as literals. The activity titles and the other three category names are not, which fits database-driven content (the blog images are served from a Supabase bucket). The card art is real third-party art (Bunch's promo, CrowdParty's "Two Truths & A Lie" banner). I read it as a genuine capture composited into a device render. The PNG's XMP says how it was made: `dc:title` "Minimal and Professional Startup Pitch Deck Presentation (1600 x 900 px) - 5", `CreatorTool` Canva, author "MDMT". So it's a screenshot placed in a Canva pitch-deck laptop template. It passes on genuineness. It is not the doorway (that's the sign-in form, which isn't pictured). But at the drawn scale (0.373x) the card body text is about 6 CSS px and the vote counts about 4-5px, so the surface is recognisable but not readable. Near-miss below.

## Near-misses

- **`three-card-row` → absent** if a masonry of six with staggered second-row tops (4375 / 4390 / 4311) is read as a grid, not a row, and the 4-up stat row is held to "three". This is the most contestable slop value. Net +7.
- **`glass-card-overuse` → absent** if appearance overrides the count: 80%-white cards at `blur(4px)` over a near-white field frost nothing visible. The decided rule counts surfaces (toppic did the same). Net +7.
- **`hero-mockup-float`, absent on position.** The laptop is the construction exactly: a transparent-background 3D render, tilted, floating with no ground plane. But it sits at y1964-2468, two sections below a hero that is its own `min-h-[100svh]` section (0-900). If a rater reads the signal page-wide, it flips. Net +9.
- **`real-product-surface` → absent** for a rater who won't credit a capture nobody can read at page size (glowcase withheld a thumbnail-sized genuine capture on that ground). Net +9.
- **`one-accent-discipline`, absent.** Two chromatic hues both do accent work:
  - navy `#325D79` (chroma 71) fills the hero CTA and "View all posts", sets every h2, the blog categories and "Read more", and fills the footer;
  - orange `#F27221` (chroma 209) sets the headline's second line and the four stat numbers, fills the closing CTA, and strokes two feature icons and the footer heart.

  Teal `#9BD7D1` is a third, on one icon and in the blobs. If navy is read as the brand ink rather than an accent, orange is the single accent and the value flips. But navy filling the primary CTA is an accent's job. Net +7.
- **`density-variation`, absent.** Ink per band (pixels under luminance 200, every third pixel): hero 3.17%, challenges 1.97%, features 2.85%, stats 3.92%, CTA 4.24%. The two spikes are images: the laptop band 9.15%, the blog 15.31%. The footer is a solid fill at 99.6%. Every text band is the same module (centred H2, optional subhead, an equal grid of white rounded cards at `py-16`/`py-24`/`py-32`). This is toppic's shape: image bands alternating with sparse centred stacks, and no dense passage (table, list, spec, small print) set against them. Net +7.
- **`shows-deliverable`, absent. Candidates named and rejected:**
  - The laptop's vote counts ("3", "3", "2") might read as modest engagement, but they are about 4-5px in a perspective-warped render and fail the legibility clause.
  - The stat row (80+ / 40+ / 50+ / 200+) is a vendor-aggregate statistic, absent by the railway-com precedent. It is also internally consistent (80+40+50 under 200+), so nothing in it embarrasses.
  - The blog card dated "Aug 15, 2022" is titled "We Tried 100+ Apps: Here Are the Top 7 for Long-Distance Couples in 2025!". That's an unscrubbed inconsistency, but it is marketing copy, not the product doing its job, and it says nothing against the curation.

  Nothing in the scored content shows the product declining, costing or failing.
- **`single-optical-anchor`, absent (rule-ineligible; honest call).** In the hero, the 48px two-line headline (672x104, 5.4% of the viewport) is the only text mass, flanked by an 87px logo and a 309x56 pill over an empty wash. One mass dominates the hero because there is only one mass. Page-wide, the 896x504 laptop is the largest single object, but it competes with six saturated 416px blog thumbnails and the 361px navy footer. No anchor holds the page.
- **`type-scale-high-contrast`, absent by procedure.** `ladder.cjs`: ratio **3.0** (48px "Strengthen Your Bond," over 16px body), `ratioSub` 2.67, `rawMax` 48. Below 3.75.
- **`live-claim-control`, absent.** The central claim is "The world's first curated platform helping couples discover, plan, and share meaningful activities together." The page offers no control that tests it. Its only action is the sign-in gate, and every resource sits behind it ("Sign In to Access Resources").
- `badge-pill-spam` absent: zero decorative pills above the fold. The page's only pill shapes are three functional CTAs, and blog categories are plain text. `gradient-fill-cta` absent: all three CTAs are flat (`rgb(50,93,121)` ×2, `rgb(242,114,33)`), `background-image: none`. The navy→`#457B9D` gradients are the stat icon squares, not buttons. `indigo-violet-accent` absent: the hues are 204°, 23° and 174°, and the purple in two blog thumbnails (Paired's lavender art, a violet app screenshot) is third-party image content. `typewriter-headline` absent: the headline text is identical at load+2s and load+7s. `stock-photo-generic` absent: the thumbnails are the reviewed products' own art and screenshots (GeoGuessr, Paired, a map-print gift, game captures), and the laptop is a render. `testimonial-card-row` absent: there's no testimonial section. `asymmetric-split`, `editorial-grid-break` and `custom-type-pairing` absent: every grid is equal-column inside `max-w-7xl`/`max-w-4xl`, the masonry stagger is a component behaviour rather than a break, and there is one family.
- Materials: `single-theme`. Under `colorScheme: 'dark'` the body stays `rgb(255,255,255)` with the same wrapper gradient and the same `rgb(10,10,10)` headline. `context` includes `blog-index` for the six-post "Latest from Our Blog" listing; toppic left its blog teaser out of `context`, so the merge may drop it.

## Verdict

**9 slop present, 1 craft present, net +8. `slop`.**

Net +8 clears the +4 floor by four. The verdict rule asks what separates this page from the top of `mixed`. The brief names deepmark and stripe-2014 at +3. Their files now read 6 slop / 4 craft (+2) and 6 slop / 3 craft (+3), and the `mixed` ceiling in the corpus today is +4 (glowcase). Each of the following can be re-run from the front-matter of the files named:

1. **Slop density, not just net.** 9 slop signals. No `mixed` file in the corpus carries more than 8, and the only one at 8 (railway-com) offsets it with 7 craft. stripe-2014 and deepmark carry 6 each. Six of this page's nine are absent on stripe-2014 (`glass-card-overuse`, `emoji-as-icon`, `generic-sans-default`, `symmetric-everything`, `scroll-reveal-blank`, `centered-hero-stack`). Six are absent on deepmark (`gradient-blob`, `three-card-row`, `glass-card-overuse`, `emoji-as-icon`, `symmetric-everything`, `scroll-reveal-blank`). Five of the nine are procedure-measured rather than judged: symmetry share 1.0; 68/68 scroll-gated text against 0/68 under the dwell control; 12 backdrop-filter surfaces; Inter as the only family; four emoji in icon discs.
2. **Craft absence.** One craft signal, and it's the weakest kind: a genuine capture pasted into a Canva pitch-deck laptop at about 6px text. Both anchors' craft decisions are measured absent here: `asymmetric-split` (on both), `density-variation` (on both), `custom-type-pairing` and `one-accent-discipline` (deepmark).
3. **Which group it overlaps.** 7 of the 9 slop signals are shared with toppic (+7, `slop`: `three-card-row`, `glass-card-overuse`, `generic-sans-default`, `symmetric-everything`, `generic-line-icon-set`, `scroll-reveal-blank`, `centered-hero-stack`), and 6 with permit-guide-ai and zingy-cannoli (both `slop`). Only 3 are shared with stripe-2014 and 3 with deepmark.
4. **It does not hinge on one call.** Reaching +3 takes five contestable calls all flipping against slop at once: `three-card-row`, `glass-card-overuse`, `one-accent-discipline`, `density-variation`, `single-optical-anchor`. Any single flip leaves +7, and any two leave +6. The flips in the other direction (`hero-mockup-float` read page-wide, `real-product-surface` withheld) give +9 or +10.

Glowcase's rater declined `slop` at +4 because its slop count (5) sat below both anchors and one flip undid it. Neither condition holds here.

What is measurably there: a competent but fully templated page. The hero has animated blurred discs. Three equal-grid card modules use one lucide set, emoji in white discs, and translucent-blur fills over a white field. Every heading is centred. Every word below the hero waits for a scroll, and with JS off the whole page, headline included, ships at opacity 0. The one product picture is a pitch-deck laptop, and the only door into the product is a sign-in form. The `ai-builder` cohort label played no part in this verdict. The counts did.
