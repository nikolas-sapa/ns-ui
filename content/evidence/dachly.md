---
source: https://www.dachly.com/
kind: site
cohort: ai-builder
verdict: mixed
studied: 2026-10-18
context: [dashboard, hero]
signals:
  gradient-blob: absent
  three-card-row: absent
  glass-card-overuse: present
  emoji-as-icon: unresolved
  generic-sans-default: absent
  symmetric-everything: absent
  badge-pill-spam: absent
  generic-line-icon-set: absent
  testimonial-card-row: absent
  indigo-violet-accent: absent
  gradient-fill-cta: absent
  scroll-reveal-blank: absent
  typewriter-headline: absent
  stock-photo-generic: absent
  centered-hero-stack: present
  hero-mockup-float: absent
  asymmetric-split: absent
  single-optical-anchor: absent
  type-scale-high-contrast: absent
  editorial-grid-break: absent
  custom-type-pairing: present
  real-product-surface: present
  shows-deliverable: absent
  density-variation: absent
  one-accent-discipline: present
  live-claim-control: absent
materials: [single-theme, illustration]
---

**Sampling: random draw.** One of eight drawn with seed 20261018 from the thirty remaining gallery sites (pre-stated exclusions only: unreachable, blank, sign-in wall). Not chosen on any signal.

Rated by two independent blind raters on 2026-10-18, neither reading the other's draft. Both reached `mixed`. They agreed on 25 of 26 signals; the 1 split `emoji-as-icon` (A present, B absent) are recorded `unresolved`, which never counts toward a rule. Both write-ups follow in full.

**Rater A.**

Rater A, blind. New page, no prior study, so no drift section.

**Capture facts.** Viewport 1440x900. `www.dachly.com` 301s to `dachly.com`.
Walk: `docH_before` 900, `docH_after` 900, scroller `window`, 2 tiles, both
landing at y0 (asked 0 and 700, landed 0 and 0), `clamped: false`,
`coverage: 1`, stitched 900px against a 900px page, one strip. **There is no
footer and the footer check cannot pass, because the page has none.** I
confirmed there is nothing below the fold rather than trusting the walk:
`document.body.scrollHeight` is 0, zero elements have `overflow-y:auto|scroll`
with `scrollHeight > clientHeight`, the DOM is 8 `fixed` + 90 `absolute`
positioned elements over 334 static ones, and the lowest box ends at y920
(the background layer, `inset-[-20px]` for its parallax). The only content
outside the viewport is to the right: three slide-out panels translated to
x1416-1768 (Music Player, Nature Sounds, Pomodoro Timer). The page is one
900px screen. Thin page: most signals have nowhere to fire.

Two transient states are in the captured tile and not in the settled page,
so a second rater should expect them to come and go: the `Press ⌘ + K to open
AI assistant` hint pill (shown for roughly the first 6-9s after load:
present in the tiles and in probes at 6s and 9s, absent in one probe at 8s
and in every sample after 10s) and `Loading feed...` bottom right (the RSS widget; see
`shows-deliverable`). The background rotates per load: three loads gave the
"Leopard Portrait", "Mystic Forest" (`Forêt Mystique à l'Aube`) and a
`magnific-...` file, all from one `images.squarespace-cdn.com` account. The
server HTML carries a frozen build date: `curl` returns `Wednesday, July 2`
in the date slot, and one slow-hydrating probe rendered it at 8s. Not a
signal; a no-JS reader gets the wrong date.

**What the page is, and the scope call it forces.** The root URL is not a
marketing page. It is the product: a browser start-page dashboard (Next.js,
`<title>Dachly</title>`, meta description "Your personal dashboard with
beautiful backgrounds", which is never rendered). On load it fetches live
weather from `api.open-meteo.com`, a live BTC ticker from `api.binance.com`,
a Spotify oEmbed, eight nature-sound MP3s and an RSS feed. Visible at rest: a
128px clock, the date, a 5x3 launcher of favicon shortcuts (8 filled, 7
empty `+` slots), a Google search field, a seeded sticky note ("Welcome to
Dachly ! -Adrien", "over 1 year ago"), a "1 task" chip, weather and BTC
top-left, a six-icon toolbar top-right. There is no headline, no sentence of
marketing copy, no section, no CTA, no pricing, no footer.

The SCOPE block says marketing chrome is the unit of analysis and content
inside an embedded product surface is not scored. That rule's own rationale
is that a capture is "a thing the page is showing, not a decision the page is
making about itself". Here nothing frames the product; the app IS the page
the vendor serves at its root, so its design decisions are the page's
decisions about itself. I score the app UI as the page's chrome. A rater who
reads SCOPE strictly has an empty unit of analysis; I give that profile under
the verdict so the two readings can be reconciled. Both land on `mixed`.

## Slop signals present (3)

**`glass-card-overuse`, present.** 29 elements in the DOM carry
`backdrop-filter`, and frosting is the only surface material the app has: the
⌘K hint pill (`blur(12px)`, `rgba(0,0,0,0.2)`, 264x38), the search field
(`blur(12px)`, `rgba(255,255,255,0.08)`, 640x56), the "1 task" card
(`blur(24px)`, `rgba(0,0,0,0.2)`, 140x55), 15 launcher tiles (`blur(12px)`,
80x80, revealed on hover), 8 per-tile delete buttons (hover), the three
slide-out panels (`blur(24px)`, 320-352px wide) and the Settings dialog. In
the captured first view 3 render (pill, search, task card), which meets the
3+ threshold; hovering one tile makes 4; opening any panel makes 3 without the
transient pill. Counted as a CSS fact, the prilo-ai way. The 15 launcher tiles
do not paint at rest: luminance inside an empty tile is 120.7 against 121.3 in
the gap beside it.

**`emoji-as-icon`, present.** The Nature Sounds panel (one click on the
toolbar's waves button) leads each of its eight rows with an emoji as the
row's icon: 🌧️ Rain, 🌳 Forest, 🌊 Ocean, 🐦 Birds, 🔥 Fire, 💧 Stream, 💨 Wind,
🦗 Crickets, each in its own `<span>` at 20px. Font checked with CDP
`CSS.getPlatformFontsForNode`: the glyphs render in Apple Color Emoji, the
labels in Outfit. That is a pictograph standing in for an icon, not terminal
output. The panel is the app's own UI, reachable from the resting page in one
click; I count it the way stripe-2014's carousel slides were counted. The
About tab's "☕️" sits inline in a prose sentence and is not counted.

**`centered-hero-stack`, present, by form.** The opening (and only) viewport
stacks every primary element on the vertical axis: the hint pill (x588, w264,
centre 720), the clock (x551, w337, centre 720), the date (x630, w180, centre
720), the launcher grid (x488-952, centre 720), the page dots (x699-740) and
the search field (x400-1040, centre 720). Six elements within 1px of x720.
The clock sits in the headline slot and the search field in the CTA slot. The
corner furniture is off-axis and secondary. There is no headline copy, which
is the case for `absent`; see near-misses.

## Craft signals present (3)

**`real-product-surface`, present.** The page is the running product, not a
capture of it and not a rebuild: live weather (`13°C Paris`, open-meteo,
weather code mapped to a description table in the bundle), a live BTC price
that changed between every probe (`$81,201 -0.36%`, `$81,192 -0.40%`,
`$81,058 -0.60%`, `$81,102 -0.49%`), a ticking clock, working shortcuts, a
working Google search, playable sounds. Not a doorway: the resting state is
the product in use. One doorway exists inside it: ⌘K opens "Setup Required /
Please add your OpenAI API key", which is the AI assistant's gate, not the
dashboard.

**`custom-type-pairing`, present, on corpus precedent.** Two faces, each with
one job and no crossing: Manrope at weight 200, 128px, `letter-spacing:
6.4px` (+0.05em), carries the clock and nothing else; Outfit (300-500) carries
every other text node, 27 in the DOM (12 visible at rest, 12-20px; the
hidden pomodoro's "25:00" at 72px), at normal tracking. One `<kbd>` "K" in
the hint pill falls to the system monospace. Body computes to
`__Outfit_d28b19, __Outfit_Fallback_d28b19` at 16px. permit-guide-ai and
deepmark score the same structure (display face / UI face, no node in the
wrong face) `present`, and the vocabulary has no default-ness clause. Near-miss
noted below: Manrope's one node is four digits and a colon.

**`one-accent-discipline`, present, on the zero-accent ruling.** No element
carries a brand accent. Every button, toggle, slider and focus surface is
white at an alpha (`rgba(255,255,255,0.1)` search button, `0.7`/`0.9` text)
or shadcn neutral (`rgb(38,38,38)` switch track, `rgb(250,250,250)` slider
fill). Every chromatic value is data, state or object skin, and the bundle
shows which: the BTC delta is
`change24h>=0?"text-green-400":"text-red-400"` (it read `rgb(248,113,113)`
because BTC was down), the pomodoro label is `r?"text-rose-400":"text-emerald-400"`
by work/break state, task priorities are green/yellow/red by level, the sticky
note is `#fff7b1` (chroma 78) as a paper skin, and the favicons are third-party
marks. No indigo or violet anywhere in the chrome.

## Absent, with the measurement

- `type-scale-high-contrast`: `ladder.cjs` gives **1.25:1** (20px "Sunday,
  October 18" over 16px body). `rawMax` is 128 (the clock) and the next is 72
  (the hidden pomodoro "25:00"), but both are digits only and the procedure
  takes the largest node with at least one letter. Below 3.75:1, absent.
- `gradient-blob`, `gradient-fill-cta`: no `background-image` gradient on any
  visible element; the only `background-image` is the artwork `url()`.
- `indigo-violet-accent`: see the accent paragraph. `text-purple-600` exists
  once in the bundle, in the AI assistant's markdown formatter, unrendered.
- `scroll-reveal-blank`: the page cannot scroll (docH 900, body
  `scrollHeight` 0), so nothing can be gated behind scroll. The two transient
  states (hint pill, feed loader) are time-gated and they disappear rather
  than appear.
- `typewriter-headline`: no headline. Sampled every 2s for 16s: the search
  placeholder stays `Search Google...`; the hint pill appears once and leaves;
  the clock ticks minutes, not phrases.
- `three-card-row`, `testimonial-card-row`, `hero-mockup-float`,
  `asymmetric-split`, `editorial-grid-break`, `density-variation`: no such
  section exists on a one-screen page. `density-variation` is measured per
  band in this corpus and there is one band.
- `badge-pill-spam`: one pill above the fold, the ⌘K hint, and it is a
  functional shortcut hint, not decoration; the "1 task" chip is a button.
- `symmetric-everything`: the left half carries a 286x183 sticky note (x95,
  y227, rotated -2°) plus the weather/BTC stack and the task card; the right
  half carries a 6-icon toolbar and the (vanishing) feed loader. Nothing
  mirrors the note. The axis is symmetric; the page is not.
- `generic-line-icon-set`: all 50 SVGs are Lucide at `stroke-width 2`,
  16-20px, so one uniform set, but they are controls whose only label is the
  icon (music, waves, timer, plus, brain, settings), and the weather glyph is
  driven by the weather code. They carry what no adjacent heading carries.
- `generic-sans-default`: Outfit and Manrope, neither Inter, Geist nor a
  system stack. Absent on face identity, as sentient-os (Satoshi) and
  dipole-labs (Manrope).
- `stock-photo-generic`: the background is one of eight credited artworks in
  the Settings picker ("Autumn Aspen", "Robot Portrait", "Opal Sphere",
  "Autumn Forest", "White Tigers", "Night Sky", "Mystic Forest", "Leopard
  Portrait", each "by Pulss Art"), with NASA APOD and custom upload as
  options. They are the product's wallpaper offer, named and credited, not
  stock standing in for a company. Material recorded as `illustration`
  because several are visibly composited digital art (an astronaut seated
  beside a dog, an opal sphere on snow); see near-misses for the scrim.
- `single-optical-anchor` (rule-ineligible; my call): I counted three masses.
  The clock is the largest type but rendered at effective opacity 0.4: its
  strokes peak at luminance 176 against a ~115 field. The sticky note is the
  only opaque light block, a flat 244 against the ~120-130 field around it,
  off-axis at upper left. Behind both is the full-bleed artwork under a 40%
  black scrim. No one mass dominates, and it is not "one mass because only one
  mass". Absent.
- `shows-deliverable`: **no entry could embarrass the vendor.** The product's
  output is a dashboard of third-party data. Candidates, each excluded: the
  red BTC delta is the market's number, not the product's work; "over 1 year
  ago" on the seeded welcome note is a timestamp on demo content, not output
  on a job; the AI assistant's "Setup Required" is a doorway. The one genuine
  product failure is scrubbed: the RSS widget asks `api.allorigins.win`
  (`ERR_FAILED`), `corsproxy.io` (403) and `cors-anywhere.herokuapp.com` (403)
  for The Verge's feed, all three fail, and the widget unmounts. Samples every
  5s for 70s show `Loading feed...` until about 25-30s, then nothing in that
  corner. The visitor is never shown the failure, so it cannot count.
- `live-claim-control`: the page states no claim. Its only claim lives in an
  unrendered meta description. Every control on the page is live, but there
  is nothing on the page for a control to falsify.

## Near-misses

- `centered-hero-stack` (present, could be absent): the stack is exact on the
  axis, but a clock is not a headline and a search field is not a CTA. A rater
  who requires marketing hero copy scores absent. Net moves to -1.
- `custom-type-pairing` (present, could be absent): Manrope carries one node,
  digits only, and both faces are geometric sans whose voices separate by
  size, weight (200 vs 300) and tracking rather than by letterform. modal-com's
  "one speaking voice" reading gives absent. Net moves to +1. The root element
  also carries 12 `next/font` CSS variables; only these two families render.
- `emoji-as-icon` (present, could be absent): behind one click. A
  resting-view-only reading gives absent. Net moves to -1.
- `glass-card-overuse` (present, could be absent): the settled resting view
  holds 2 frosted surfaces; 3 only while the hint pill shows, or with any
  panel open or tile hovered. A settled-rest-only count gives absent. Net
  moves to -1.
- `stock-photo-generic` (absent, could be present): a 40% black overlay
  (`absolute inset-0 bg-black`, opacity 0.4) sits over every background so
  the white type survives, which is the signal's literal "scrim bolted over
  it". Held absent because the imagery is the product's curated, credited
  content and the overlay is a user setting (Settings > Appearance > "Overlay
  Opacity"), not a fix applied to a marketing photo. Net moves to +1.
- `generic-line-icon-set` (absent, could be present): one uniform Lucide set,
  the shadcn default, across 50 icons. Held absent on informational content,
  not glyph identity. Net moves to +1.
- `one-accent-discipline` (present, could be absent): a rater who reads the
  yellow note (chroma 78) as an accent rather than a paper skin gets absent.
  Net moves to +1.

## Verdict: `mixed`, net 0

3 slop present (`glass-card-overuse`, `emoji-as-icon`,
`centered-hero-stack`) against 3 craft present (`custom-type-pairing`,
`real-product-surface`, `one-accent-discipline`). Net **0**.

Net 0 is four below the `slop` floor, so no separation prose is owed, and I
checked it is not near one. The most slop-ward reading available, taking
every near-miss against the page (adding `stock-photo-generic`,
`generic-line-icon-set` and `generic-sans-default` on a template-default
reading of Outfit, and dropping `custom-type-pairing` and
`one-accent-discipline`), reaches 6 slop and 1 craft, net +5. Even there I cannot write what separates it from deepmark (+3)
and stripe-2014 (+3) in checkable terms: both of those fire on a marketing
composition (deepmark's centred YC hero, floating phone mockup, badge pill and
stock photo; stripe-2014's blob, card row and gradient CTA), while every slop
value on dachly fires on the inside of a working app, which is exactly the
territory SCOPE keeps out of every other file. So the verdict would stay
`mixed` at the extreme.

Not `exemplar` either. Net 0 is above the -8..-2 band. The page is 900px,
one screen, with no copy, sections or footer; five of the sixteen slop
signals (`three-card-row`, `testimonial-card-row`, `hero-mockup-float`,
`typewriter-headline`, `scroll-reveal-blank`) have no section or behaviour to
fire on, which flatters any count. Under the strict SCOPE
reading (the whole page is a product surface, so nothing is scored as chrome)
the profile is 0 slop and at most the 3 craft values, net -1 to -3, and a
-2 or -3 there would be a thin page scoring well by having nothing, not an
exemplar.

What the page measurably is: a one-screen start-page app served at its own
root, assembled from shadcn/Lucide/Tailwind defaults (frosted `bg-black/20
backdrop-blur-xl` surfaces, `rounded-lg border-white/10` everywhere) over
rotating credited artwork, with real live data and no marketing layer at all.
The defaults are there; the density of marketing slop is not, because there
is no marketing.

**Vocabulary faults found on this page.**
1. SCOPE has no clause for a root URL that serves the product with zero
   marketing chrome. Read strictly, the unit of analysis is empty; read by its
   rationale, the app is the chrome. The two readings move four values here.
2. No rule says whether UI one click from rest counts. It decides
   `emoji-as-icon` and `glass-card-overuse` on this page (2 surfaces settled,
   3 in the capture, 29 in the DOM).
3. `type-scale-high-contrast`'s "at least one letter" rule measures 1.25:1 on a
   page whose display element is a 128px clock (8:1 raw). The rule was written
   for stat figures; a page whose only display type is numeric gets no ladder
   at all.
4. `live-claim-control` needs a stated claim. A page that is wholly operable
   but states nothing cannot score it.

**Rater B.**

Rater B, new page, rated blind (no other rater's draft or capture opened).

**What the page is.** The root URL is not a marketing page. It is the product itself: a
Next.js browser start page / personal dashboard ("Dachly", title `Dachly`, meta
description "Your personal dashboard with beautiful backgrounds"), Tailwind + shadcn +
lucide, by Adrien Donot ("Pulss Art"; the About tab links `x.com/pulssart` and
`buymeacoffee.com/pulssarte`; localStorage keys are `dashify-*`). At rest there is no
headline, no value proposition, no features band, no pricing, no social proof and no
footer. The only first-party sentences are a seeded sticky note, "Welcome to Dachly !
-Adrien", and a hint shown for about 5s, "Press ⌘ + K to open AI assistant". Everything
else is live widgets: clock, date, weather (open-meteo, default city Paris), a BTC
ticker (Binance), eight shortcut favicons (icons.duckduckgo.com) plus seven empty `+`
slots, a Google search box, "1 task", and an RSS feed (default The Verge).

**Scope ruling, stated because it moves values.** SCOPE excludes content *inside an
embedded product surface*. Nothing here is embedded: the app shell is the top-level
document, so its surfaces are the page's own decisions about itself, and I score them.
I score the **rest state** (what renders on load, settle and the scroll walk, which is
what every corpus strip records). Click-revealed panels (the six toolbar buttons,
settings, ⌘K) are product depth; I record what is in them as near-misses with their
flips. A rater who scores click-revealed panels flips `emoji-as-icon` and
`gradient-blob` to present (+2); the verdict holds either way (see Verdict).

**Capture.** 1440x900. `shoot-tiles.cjs` into `s5/dachly-B`: `docH_before` 900 =
`docH_after` 900, scroller `window`, `innerCands` empty (no inner scroller),
`clamped: false`, `coverage: 1`. Landings: asked 0 landed 0, asked 700 landed 0. The page
cannot scroll, so the second tile is the same frame by construction, not a clamp.
Stitched to one strip, 1440x900 against a 900px page, `OK`. **There is no footer, and
that is the page, not the capture:** `document.body.scrollHeight` is 0 (every element is
fixed or absolute), no element's box reaches below y950, and the DOM's text holds no
footer copy. Page height 900px, one viewport. This is a thin page in the restudy
brief's sense: most signals have nowhere to fire.

Four load-gated hazards, all checked:
1. The first walk (default 8s settle) painted a black field: the background image had
   not painted. Re-shot with `NS_LOAD_MS=15000`; the rated tiles are that walk, with the
   background present.
2. The background is drawn at random per load from an eight-image collection. Across my
   seven loads I saw three of them ("In autumn the leaves..." in the rated tiles,
   "Paysage forêt automnale", the robot-and-dog image). No value below depends on which.
3. The served HTML is a build-time prerender that hardcodes "Wednesday, July 2" and no
   clock; hydration replaces it about 3-4s in, and the search bar jumps from y616 to
   y808. In one of seven loads the prerender was still showing at 12s. A no-JS reader or
   agent gets a stale date. Not a signal; recorded.
4. The ⌘K hint renders only about 5s after hydration (2-6s in one load, 4-8s in
   another). The 8s walk caught it, the 15s walk did not; timed by DOM sampling.

## Slop signals present (2)

**`glass-card-overuse`, present at exactly the threshold.** Sampled once a second for
9s after load, visible `backdrop-filter` surfaces at rest: 2, 2, 2, 3, 3, 3, 3, 3, 2.
The three that co-render: the search bar (640x56 at 400,808, `blur(12px)`,
`rgba(255,255,255,0.08)`), the "1 task" box (140x55 at 24,821, `blur(24px)`,
`rgba(0,0,0,0.2)`) and the ⌘K hint (264x38 at 588,96, `blur(12px)`, `rgba(0,0,0,0.2)`).
All three sit over the full-bleed photograph and frost real detail (not modal-com's
blur over a flat field). The document carries 28 `backdrop-filter` declarations, all one
recipe (`bg-black/20` or `/10`, `backdrop-blur-md`/`-xl`, `border-white/10`): 15
hover-only shortcut-tile backs and 5 hover-only delete buttons (excluded, databuddy
precedent), three slide-in panels (352x692, 340x587, 320x654, `blur(24px)`, offscreen
at rest) and the settings dialog, any one of which brings the visible count back to 3
with a single click. Counted at rest, without interaction, as databuddy and acyclic
were. The settled count is 2; see near-misses.

**`centered-hero-stack`, present (recorded fact).** The only viewport's primary content
is a vertical stack on x=720: the 128px clock (x553-888, centre 720.5, top 192), the
20px date (x630-810, centre 720, top 368), the 5x3 shortcut grid (x488-952, y444-716),
the page dots (x699-740, y748) and the search bar (x400-1040, y808). There is no
headline and no CTA, so this is the new-tab convention (clock over date over controls)
rather than a marketing hero. The signal is expected to fail eligibility.

## Craft signals present (3)

**`custom-type-pairing`, present on precedent, thin.** Two faces with one job each at
rest: Manrope (weight 200, 128px, `letter-spacing: 6.4px`, wrapper `opacity: 0.4`)
carries the clock and nothing else; Outfit carries every other visible node at 12-20px
(weather 18/12, ticker 18/12, date 20, task 14, Search 14, note 14/12). No Outfit node
above 20px at rest, no Manrope node anywhere else. Scored to deepmark and
permit-guide-ai (two faces, strict role split, no default-ness clause). Why it is thin:
it rests on one letterless node, and the face is the default of a user preference
(`clock.fontFamily: "var(--font-manrope)"` in chunk 542; the clock-font menu offers 12
faces: Inter, Montserrat, Plus Jakarta Sans, Work Sans, DM Sans, Manrope, Outfit, Space
Mono, JetBrains Mono, Roboto Mono, IBM Plex Mono, Source Code Pro). The hidden Pomodoro
panel sets its 72px "25:00" in Outfit, so the split holds only at rest.

**`real-product-surface`, present.** The page is the live product in use: not a
capture, not a rebuild, and not a doorway, since nothing stands between the visitor and
the product answering. A fresh load fetches open-meteo (13°C, Paris), Binance's
BTCUSDT 24h ticker (the value moved across loads: $81,185, $81,199, $81,057, $81,132)
and DuckDuckGo favicons for eight shortcuts, then renders the clock, date, seeded note
and task, and a working search box. Present trivially, which is worth saying: any page
that is its own product passes this.

**`one-accent-discipline`, present.** The app shell carries no hue. Buttons and
surfaces are white or black at 8-30% alpha (Search button `rgba(255,255,255,0.1)`, the
active page dot `rgb(255,255,255)`, toolbar icons white at 90%). Visible nodes with RGB
chroma at or above 40: three values. The note fill `rgb(255,247,177)` (chroma 78) and
its footer band `rgb(243,239,158)`, one yellow, the skeuomorphic sticky note; and
`rgb(248,113,113)` on the 12px "-0.52%" ticker delta, semantic data colour (down is
red), the railway-com data-colour precedent. The eight favicons (OpenAI, Perplexity,
YouTube, X, LinkedIn, Notion, Amazon, Spotify) are third-party marks the shortcuts point
at, not page accents, and the photograph is image content. One accent at most.

## Near-misses

- **`glass-card-overuse` → absent** if the transient hint is excluded or the settled
  state is counted: 2 surfaces. The most contestable value on the page. Net -2.
- **`emoji-as-icon`, absent at rest; present if click-revealed panels count.** The
  Nature Sounds panel (≋ toolbar button; panel at `opacity: 0` and offscreen at rest)
  labels its eight sound buttons with emoji used as icons: 🌧️ Rain, 🌳 Forest, 🌊 Ocean,
  🐦 Birds, 🔥 Fire, 💧 Stream, 💨 Wind, 🦗 Crickets, each a 20px `span.text-xl` in the
  Outfit stack, rendering through the system colour-emoji fallback, beside a 14px label.
  That is the signal's exact shape, excluded only by the rest-state ruling. Flip: +1.
- **`gradient-blob`, absent at rest.** The Meditation dialog (brain button) carries
  `bg-blue-500/20` and `bg-indigo-500/20` discs under `blur-3xl animate-pulse`, and its
  breathing view a `from-blue-500/30 via-purple-500/30 to-pink-500/30` disc under
  `blur-3xl`. Read from the page chunk, not rendered at rest. Same ruling. Flip: +1 (and
  it would put indigo in a blob fill, a case for `indigo-violet-accent` too).
- **The page's only feature-tour copy is a "Welcome Guide" dialog** behind an
  Information button, titled "Welcome to Dashly" (sic; the product is Dachly), with a
  feature card filled `bg-gradient-to-br from-blue-500/20 to-violet-500/20`. Read from
  the bundle; not rendered at rest; not scored.
- **`stock-photo-generic`, absent.** A 40% black scrim (`absolute inset-0 bg-black`,
  opacity 0.4) is bolted over the background, which matches the scrim clause's
  mechanism. But the images are not stock: Settings > Background > Collection 1 lists
  eight, each "by Pulss Art" (Autumn Aspen, Robot Portrait, Opal Sphere, Autumn Forest,
  White Tigers, Night Sky, Mystic Forest, Leopard Portrait), hosted on the maker's own
  Squarespace (`images.squarespace-cdn.com/content/v1/51c0923ee4b0c1252c655107/...`),
  filenames carrying `magnific-` upscaler prefixes and
  `pulssart_In_autumn_the_leaves_on_a...`. The maker's own generated imagery, and for a
  wallpaper product the image is the product's content. Unsplash, Pexels and NASA APOD
  are user options, off by default. In materials as `illustration` (photoreal generated
  renders; the list has no token for generated imagery, and a second rater could pick
  `commissioned-photo`).
- **`generic-sans-default`, absent on face identity.** Outfit is a free Google face,
  not Inter and not a system stack; aviern (Archivo) and sentient-os (Satoshi) read
  absent on the same basis. Inter is in the clock-font menu but is not rendered.
- **`symmetric-everything`, absent.** The centre column is mirror-symmetric; the frame
  is not. The second-largest mass, the opaque 284x182 yellow note at x96-380, rotated
  -2° (`matrix(0.9994, -0.0349, ...)`), has no right-hand counterpart; the top corners
  differ (weather/ticker cluster 127px wide at left, a 320px six-button toolbar at
  right); the bottom-left task box has nothing opposite once the feed spinner clears.
  Flip: +1.
- **`generic-line-icon-set`, absent.** 22 visible lucide SVGs, all `stroke-width: 2`,
  at 16/20/24px (sun, bitcoin, music2, waves, timer, plus, brain, settings, list-todo,
  chevron-right, search, chevron-down, minus, trash2, eight more plus). One uniform set.
  But there are no headings: the six toolbar icons are their buttons' only label (only
  the gear has sr-only text, "Open settings"), so they carry everything, not nothing. The
  informational-emptiness clause fails. Flip: +1.
- **`type-scale-high-contrast`, absent by procedure.** `ladder.cjs`: ratio 1.25 (20px
  "Sunday, October 18" over 16px body), `rawMax` 128. The 128px clock ("18:55") has no
  letter and is excluded, as "$ 2.89" and "78.6" are; it would read 8:1. It is this
  page's display term the way "Haiku 5.5" is anthropic.com's, but unlike "Haiku 5.5" it
  carries no letter. Flip: -1.
- **`shows-deliverable`, absent, and the absence is the finding.** The dashboard's
  output on a fresh load is the time, the date, Paris weather, a BTC ticker, favicons,
  and a seeded note and task. The red "-0.52%" counts against Bitcoin, not Dachly. The
  product does fail on a fresh load, and the page hides it: the default feed (The Verge)
  is fetched through three public CORS proxies and all three refuse
  (`api.allorigins.win` net::ERR_FAILED, `corsproxy.io` 403,
  `cors-anywhere.herokuapp.com` 403; console "Error loading feed The Verge: APIError:
  Failed to fetch RSS feed data"). The surface shows "Loading feed..." (14px, bottom
  right) for about 30-45s and then removes it, with no error row: the vocabulary's
  "dashboard with no error row" case. The one legible unflattering entry is "over 1 year
  ago" (12px, `rgba(0,0,0,0.6)` on yellow) under the welcome note, whose fixture
  `createdAt` is `2025-02-10T14:56:22.939Z` (chunk 542), so every first-time visitor is
  told their welcome is over a year old. Not counted: it is a fixture's timestamp, says
  nothing about the product doing its job, and is not offered as output. A rater who
  reads it as unscrubbed output on railway-com's scanner-probe shape flips: -1.
- **`live-claim-control`, absent.** The page makes no claim to falsify: no headline, no
  value proposition. The only claim-shaped sentence is the 5s hint "Press ⌘ + K to open
  AI assistant", and the control it names does answer: ⌘K opens "Setup Required" /
  "Please add your OpenAI API key in the settings to start using the AI assistant." The
  claim narrows to bring-your-own-key in front of the visitor, the vizleads shape. Not
  credited because a 5s feature tip is not the page's central claim. Flip: -1.
- **`single-optical-anchor`, absent (rule-ineligible; honest call).** Masses counted:
  the clock (335x128, the largest type, but weight 200 at 40% opacity, reading grey over
  the photograph) and the sticky note (284x182, opaque yellow, the highest-contrast
  solid in the frame, off-axis left). Two masses compete, over a third field-level mass,
  the photograph. Not one mass dominating because there is only one.
- **`scroll-reveal-blank`, absent.** The page cannot scroll (asked y700, landed 0).
  Late text (weather and ticker skeletons, then values) is fetch-gated: time, not
  scroll.
- **`density-variation`, absent.** One 900px screen, uniformly sparse; nothing to vary.
- `gradient-fill-cta` absent: the one button with a fill, Search, is flat
  `rgba(255,255,255,0.1)`. `badge-pill-spam` absent: the ⌘K hint is an 8px-radius
  toast, the page dots are 10px and 20px pagination controls. `typewriter-headline`
  absent: nothing cycles; the clock ticks minutes, not phrases. `indigo-violet-accent`
  absent at rest (the leaves photograph has blue-violet leaves; image pixels, not a
  fill, and the image is random per load).

## Verdict

**2 slop present, 3 craft present, net -1. `mixed`.**

Not slop: net -1 is five short of the necessary +4, and nothing here resembles the
density that separates heroku-2014 (+5) or openhack (+4) from deepmark and stripe-2014
(+3). Not exemplar either, and the number flatters the page for structural reasons. It
is a 900px single-viewport app with no marketing sections, so `three-card-row`,
`testimonial-card-row`, `badge-pill-spam`, `gradient-fill-cta`, `scroll-reveal-blank`,
`typewriter-headline`, `hero-mockup-float`, `asymmetric-split`, `editorial-grid-break`
and `density-variation` have nowhere to fire. Of the three craft presents,
`real-product-surface` is trivially true of any page that is its own product and
`custom-type-pairing` rests on one letterless node.

The range under the near-misses above: glass excluded gives -2; emoji and gradient-blob
scored from click-revealed panels gives +1; shows-deliverable and live-claim-control
credited gives -3; every slop near-miss flipped together (glass kept, plus emoji,
gradient-blob, symmetric-everything, generic-line-icon-set) gives +3, at the mixed
ceiling and below the +4 gate. Every arm stays inside mixed (-6..+3). The verdict does
not hinge on any single call.

For the cohort: the `ai-builder` sampling assumption (a marketing page made with a
builder) does not hold here. The URL serves the product, and the template tells it
carries (one glass recipe on every container, emoji as sound icons, pulsing blurred
blue/indigo discs in the Meditation dialog) sit one click below the rest state the
corpus rates.
