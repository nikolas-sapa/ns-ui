---
source: https://www.databuddy.cc
kind: site
cohort: yc-current
verdict: mixed
studied: 2026-10-18
context: [hero, nav, dashboard, features, integrations, pricing, faq, testimonials, cta, footer]
signals:
  gradient-blob: present
  three-card-row: present
  glass-card-overuse: present
  emoji-as-icon: absent
  generic-sans-default: absent
  symmetric-everything: absent
  badge-pill-spam: absent
  generic-line-icon-set: present
  testimonial-card-row: present
  indigo-violet-accent: absent
  gradient-fill-cta: absent
  scroll-reveal-blank: absent
  typewriter-headline: absent
  stock-photo-generic: absent
  centered-hero-stack: absent
  hero-mockup-float: present
  asymmetric-split: present
  single-optical-anchor: absent
  type-scale-high-contrast: absent
  editorial-grid-break: absent
  custom-type-pairing: absent
  real-product-surface: present
  shows-deliverable: present
  density-variation: present
  one-accent-discipline: absent
  live-claim-control: present
materials: [single-theme]
---

**Re-study of a redesigned page, rated blind.** Every value above was set from
today's capture and DOM before the 2026-10 evidence file was opened. The drift
section at the end is the only part written after reading it.

**Capture.** 1440x900 viewport, document height 8486 before and after the walk,
window scroller (no inner scroller: the only candidate is `html`, 8486/900), 13
tiles, `clamped: false`, `coverage: 1.0`, stitched to two strips of 4400 + 4086 =
8486px, matching the page. The last strip ends in the footer: brand block, Product /
Company / Compare / Newsletter columns, `© 2026 Databuddy Analytics, Inc.`, Privacy
policy / Data policy / DPA / Terms of service.

The first walk was NOT clean, and it passed every check the brief lists. `html` has
`scroll-behavior: smooth`, and the page's own bundle
(`_next/static/immutable/chunks/1ewh2umye5slm.js:9:104790`) calls
`window.scrollTo(0, scrollY)` when the Claude Code section approaches, which halts an
in-flight smooth scroll. Asked for 4200, the window stopped at 3906-3907 on three
separate runs. The walker read the short landing but only aborts after two in a row,
and the stitcher places tiles by computed position, not recorded landing, so tile 6
was pasted 294px too low: the strip showed the Claude Code terminal twice and hid the
pricing H2 (`10,000 events free, then from $9.99.`, y5009) behind it, at the correct
total height. Re-walked with a copy of the walker that adds one style rule,
`html,body{scroll-behavior:auto !important}`
(`~/scratch/antislop/s5work/databuddy/shoot-tiles-instant.cjs`, landings written into
walk.json). Every landing now equals its target except the two final clamps at the
legitimate maximum (7586 = 8486 - 900). The re-stitched band was checked by eye: one
terminal, then the pricing H2. All ratings below come from the clean walk plus DOM
reads.

Two load-gated panels were read from the DOM, not pixels, because the walker
disables animations. The Databunny chat panel (y≈3473-3983) sits as skeleton bars
until it has been in view for a few seconds, then fills; at 14s:
`Which referrers brought paying customers last month?`, a `get_data` call, a six-line
SQL query, four rows (`news.ycombinator.com 38 $4,180`, `google.com 21 $2,310`,
`chatgpt.com 9 $1,340`, `x.com 12 $1,020`) and `Hacker News brought 38 paying
customers and $4,180 last month, more than Google and ChatGPT combined.` The Claude
Code terminal (y4212, 727x540) alternates two scripted sessions on a timer, about 22s
per cycle (transcripts quoted under `shows-deliverable`).

The hero product is not a picture. It is five iframes onto the vendor's own app,
`https://app.databuddy.cc/demo/OXmNQsViBT-FOS_wZCTHc?embed=true` and siblings
("Databuddy Overview Demo", Events, Errors, Vitals, Funnels), switched by a tab bar.
The Overview frame queries
`api.databuddy.cc/v1/query?...website_id=OXmNQsViBT-FOS_wZCTHc&start_date=2026-09-18&end_date=2026-10-18`,
and `rpc/websites/getPublicSummary` returns that website as `"domain":"databuddy.cc"`,
`"name":"Landing Page"`. The hero is Databuddy's live analytics of this very page.

## Slop signals present (6)

**`gradient-blob`.** The hero background is an inline SVG, 1440x1165 from y0: five
stroked paths, `#E3A514` (stroke-width 257), `#CD5F20` (194), `#B24A7E` (225),
`#714075` (200), `#483C7B` (166), each under `feGaussianBlur stdDeviation=60.65`. A
soft amber-to-violet ribbon with no hard edge, sweeping from top right down and around
the left of the dashboard. The close-out repeats it as a full-bleed horizon glow (two
SVGs, 1440x416 and 1440x224, y7638-8054).

**`three-card-row`.** The feature bento is three 413px columns at x84 / x513 / x943.
Its second row is three equal 413x302 cards (Error tracking, Feature flags, Events),
each icon + title + subhead + arrow button. The clerk-com precedent (a bento in three
~395px columns) puts this present. The pricing strip (Free / Hobby / Pro, three
≈426px cells) and the testimonial grid (three 425px columns) repeat the module.

**`glass-card-overuse`.** Six `backdrop-filter` surfaces render at rest: the fixed
header (`blur(1.01px)` on `rgba(24,24,28,0.043)` at the top, `blur(24px)` on an opaque
`rgb(24,24,28)` once scrolled), the hero YC badge (258x34, `blur(8px)`, 5% white), the
hero demo frame (1280x618, `blur(8px)`, opaque `rgb(30,30,35)`), the footer
(1440x1035, `blur(8px)`, 60% fill), the close-out Databunny tooltip (320x100,
`blur(8px)`, 70% fill) and the footer YC badge. Two more are hover-only (the "Explore
the live demo" chip, 190x38, and the fullscreen button, 32x32, opacity 0). Six against
a threshold of 3; five are translucent. Present by the decided count. It is a CSS fact
more than a visual one: only the tooltip sits over anything but a flat `#18181C`
field, so only one surface visibly frosts. See the vocabulary note.

**`generic-line-icon-set`.** Seven bento card headers each carry a 16x16 glyph from one
set (`viewBox 0 0 18 18`, `fill: currentColor`, class `size-4 text-muted-foreground`):
a funnel beside "Conversion funnels", a bug beside "Error tracking", a flag beside
"Feature flags", a pointer beside "Events", people beside "Sessions", a chart beside
"Real-time", a gauge beside "Web Vitals". One set, one size, one muted colour, none
saying anything the title doesn't. Caveat: these are filled glyphs, not stroked line
icons. The decided definition is uniformity and emptiness, not glyph style, so present.

**`testimonial-card-row`.** "Why founders are switching" is the whole testimonial
device: eight tweet quotes in a 3x3 grid of 425px columns. Seven are equal weight
(425 wide, 181-205 tall, 15px quote type, avatar + name + handle + role, an X glyph).
The centre card is featured: 425x387 spanning two rows, quote at 24px over a faint
grid texture. The bottom row is three equal quote cards. Present, closely; the
featured cell is the one piece of hierarchy (see near-misses).

**`hero-mockup-float`.** The live demo sits in a bezelled frame (1px border, 9px inner
padding, a tab bar on top, the pixel Databunny mascot perched on its top edge)
placed over the blurred ribbon, which wraps behind its left edge. No shadow (all
`box-shadow` layers transparent) and no tilt (`transform` identity), so it is the
flattest version of the move, but it is product UI set on decorative colour, the sona8
shape (a real capture over a halftone field, present). Real product, floated
convention. Expected to fail eligibility either way.

## Craft signals present (5)

**`asymmetric-split`.** The MCP section splits 505px of copy (x80) against a 727px
terminal (x633). The FAQ splits a 395px sticky heading column (`lg:col-span-4`) against
an 837px chat column. The hero headline and copy hold the left, with the mascot and
ribbon on the right.

**`real-product-surface`.** The strongest form the signal has. The hero is the shipped
app running in iframes on live data for databuddy.cc, not a capture or a rebuild. The
tabs work: Events loads `app.databuddy.cc/demo/.../events` and an event stream; Funnels
calls `rpc/funnels/list` and `rpc/funnels/getAnalytics`; Vitals shows a percentile
switch (p50 / p75 / p90 / p95 / p99). The Overview shows dates Sep 19 - Oct 18, 2026
ending today, and a public annotation `"YC Launch"` dated 2026-10-08 matching the spike.

**`shows-deliverable`.** The entry that could have embarrassed the vendor is in the
hero's default state: `54.5%` `Bounce rate` `+37%`, the delta in `rgb(239, 68, 68)`
at 12px, and `30s` `Session duration` `11%` with a down arrow in the same red. These
are the product's unscrubbed output on the vendor's own landing page: its visitors
are bouncing more and staying shorter than the prior 30 days, published in its hero.
No panel on the page sells "watch your bounce rate rise". The Overview sells tracking
traffic in one place, so this is the measured site doing worse, not the capability
displaying itself. Legible at page size (12px).

The tabs carry more of the same and a reader can open them: Vitals reads `Real
experience score 72 Needs work` with FCP `1,988` and TTFB `813` both marked `Needs
work`; Funnels lists `Sign-Up Flow` at `0.1%` conversion on 4.1K users and a `Leap`
funnel at `0.0%`. The contrast with the curated surfaces is the clearest evidence of
stance. The page-authored bento shows Web Vitals `LCP 2.1s / INP 144ms / CLS 0.00`,
all `Good`, choosing the three metrics that pass while the live frame grades the site
`Needs work`.

Rejected, by name:
- The bento error card, `TypeError: Cannot read 'plan' of undefined`, `CRITICAL`,
  `/pricing at app/(home)/pricing/_pricing/table.tsx:88:11`, `Last 24 hours`,
  `12 affected` (y≈2718). It is the vendor's own pricing page breaking, which makes it
  tempting. But the card is headed `Error tracking / Catch and fix bugs fast` and the
  nav sells `Error tracking / See which bugs hit the most people`. Error display is
  the capability that card is selling, so it falls under the stripe-com / papaya /
  linear exclusion: catching the bug is the pitch. Whose code broke does not change
  that. Separately, the live Errors tab for the same domain reads `0` total errors and
  "No errors in the selected period", so this error is not in the live data window.
  That is a sourcing question (hole 8), not this signal's.
- The terminal's second session, `list_investigations` returning `"Checkout
  conversion down 22% vs the prior 7 days"` and `error_segments` returning Safari `412`
  errors over `187` sessions on databuddy.cc. The section sells exactly this ("read
  investigations"), so it is excluded on the same rule. It is also scripted, and its
  first session claims `Launch week brought 18,240 visitors across 52,910 pageviews`
  for databuddy.cc over `last_7d`, against the live frame two screens above showing
  5.9K visitors and 9.1K pageviews over 30 days for the same domain. Another hole-8
  item.
- The Databunny answer (Hacker News 38 customers, $4,180) and the bento's other cards
  (13% conversion `+2.4%`, 134 live users, event counts): every value flatters.

Fragility, stated so a second rater is not surprised: the entry is live. The red
deltas belong to the 30-day window ending 2026-10-18, which the launch spike inflates.
On another day the Overview may show all green, and the call would then rest on the
tabbed Vitals and Funnels entries, which need a click.

**`density-variation`.** The page alternates real textures: the data-dense bento
(seven cards; funnel, sparkline, gauges, session list, error bars, toggles, counts at
10-13px), a single-question chat panel, a sparse split with one terminal, a three-cell
price strip with 36px figures, a list of FAQ chips, a 3x3 quote grid, and a close-out
spending 550px on one 60px line and one tooltip. Ink by band on the clean strips
(pixels more than 60 levels off the `#18181C` ground): MCP 1.6%, Databunny 2.4%
(skeleton state), logos 2.4%, pricing 3.6%, testimonials 5.0%, bento 6.7%, FAQ 8.0%,
with the hero (27%) and close-out (13.6%) inflated by the ribbon and horizon.

**`live-claim-control`.** The central claim is "Track visitors, signups, funnels, and
revenue in one place". The hero hands the visitor five tabs over the live product on
the vendor's own data, and each tab issues real API requests. The control is strong
enough to falsify the page's own curated claims: the Errors tab contradicts the bento's
`12 affected` card with `0` errors, and the Vitals tab contradicts the bento's all-`Good`
vitals with `Needs work`. Unlike financial-datasets, whose controls issued no network
request, these do.

## Near-misses

- **`typewriter-headline`, absent, the most disputable slop call.** The H1 is static.
  The Claude Code terminal types and alternates two prompts on a timer, unprompted:
  `How did the launch land? Set up tracking for the new pricing page.` and `Anything I
  should know before we ship today?`, each followed by tool calls (`get_data`,
  `create_funnel`, `create_goal` / `list_investigations`, `get_data`,
  `reply_to_investigation`), roughly 22s per cycle. That matches the signal's
  second clause literally, as neuron-industries' cycling spec panel did. It is absent
  here because SCOPE names "a terminal transcript or a simulated app window" as a thing
  the page shows, and decent-com's own ruling counted its film because it was not a
  product surface. A rater reading the "product panel" clause over SCOPE gets present
  and net +2. Still `mixed`.
- **`scroll-reveal-blank`, absent.** Walk vs dwell, 900ms settle, same wall clock: 358
  text nodes, 90 under 8% opacity at rest. The walk crossed 4 (three header-dropdown
  items in the fixed nav and a script node); the dwell crossed 0. No marketing heading
  or body copy is gated. What is gated is the Databunny answer (about 20 text nodes:
  SQL, four referrer rows, the answer sentence), which needs several seconds in view, so
  even the 900ms walk did not cross it. It is inside a simulated product panel, which
  SCOPE excludes. A slower walk plus a reading of SCOPE that stops at chrome would not
  change the value; a reading that counts panel text would.
- **`testimonial-card-row`, present.** The featured centre card (2.0x the area, 1.6x
  the type) is real hierarchy. A rater who reads "equal-weight ... the whole section"
  strictly gets absent and net 0. Seven of eight cards equal and a bottom row of three
  equal quote cards decided it.
- **`hero-mockup-float`, present.** No shadow and no tilt; a rater who requires a
  visible float gets absent and net 0.
- **`glass-card-overuse`, present.** Present by the decided count (6 rendered, 5
  translucent). By visible frosting it would be 1 and absent.
- **`generic-line-icon-set`, present.** Filled, not stroked. A literal reading of
  "line" gives absent.
- **`indigo-violet-accent`, absent.** `#483C7B` (hue 251°, chroma 63) is one of five
  ribbon stops and one of the rotating section markers (the bento heading's three-bar
  glyph, 28x32, fill `rgb(72,60,123)`). In the hero's chromatic pixels outside the
  iframe (10.0% of the viewport), hue 0-60° is 56.4%, 300-360° is 32.4%, and 240-270°
  is 11.1%. Every CTA is neutral (`rgb(231,232,235)` and `rgb(42,42,49)`). The indigo
  chart lines are inside the product iframe and out of scope. Violet is a minority
  stop, not the accent.
- **`one-accent-discipline`, absent.** No single accent. Section markers rotate through
  the ribbon: violet `rgb(72,60,123)` (y1842), magenta `rgb(178,74,126)` (y3187), amber
  `rgb(227,165,20)` (y5015), orange `rgb(205,95,32)` (FAQ, y5570), plum on the
  testimonial head. Four or five hues doing the same marking job is four or five
  accents (the decent-com reasoning). A rater who reads the ribbon as one brand gradient
  gets present and net 0.
- **`type-scale-high-contrast`, absent.** `ladder.cjs`: `ratio 3.75`, `maxFs 60`,
  `bodyFs 16`, `ratioSub 3.33` (18px hero subhead). At, not below, the cut, so the ratio
  does not rule it out; the ladder does. The top is flat: H1 60px, close-out H2 60px,
  three section H2s at 48px, FAQ 36px, MCP H3 30px. The H1 is 1.25x the next tier and
  shares its size with the close-out. Same shape as neuron-industries and decent-com at
  3.75, both absent.
- **`single-optical-anchor`, absent (rule-ineligible, undefined).** In the first
  viewport I counted three masses: the two-line 60px headline block (≈800x130 at x80,
  y202), the blurred ribbon (the largest chromatic mass, filling the right half), and
  the demo frame's top 353px (1280 wide, five sparkline KPI cards), plus the 160px
  pixel mascot. No one mass dominates, so absent on the corpus's "three competing
  masses" standard. This is not a "one mass because only one" case.
- **`custom-type-pairing`, absent.** One family carries the page: `ltSuperior` on 287
  visible text nodes, 9-60px, weights 400/500/600. The only other face is
  `ui-monospace` on 6 nodes inside the terminal, a system stack in a product panel. An
  `ltsuperiormono` CSS variable is declared on `html` and no visible node uses it.
- **`generic-sans-default`, absent.** `ltSuperior` is a self-hosted foundry grotesk
  (`document.fonts` loaded at 400/500/600), not Inter, Geist or a system stack.
- **`editorial-grid-break`, absent.** Every content block sits on the 1280px container
  at x80 (headings with a marker indent to x116). The only full-bleed objects are the
  decorative ribbon and horizon SVGs; the mascot perches inside the container.
- **`badge-pill-spam`, absent.** One decorative pill above the fold, the YC badge
  (`BACKED BY Y COMBINATOR | F26`, 258x34). The Overview / Events / Errors / Vitals /
  Funnels bar is the demo's tab control.
- **`emoji-as-icon`, absent.** The emoji scan finds 🔥 inside a quoted tweet
  ("everything you need for analytics is at @trydatabuddy 🔥"), which is quoted user
  text, and ⏺ in `ui-monospace` inside the terminal transcript, which is terminal
  output. No emoji works as an icon.
- **`centered-hero-stack`, `symmetric-everything`, `gradient-fill-cta`,
  `stock-photo-generic`, absent.** The H1 is `text-align: left` at x80 with left CTAs;
  section heads are `start` at x80/x116 over 5/7 and 4/8 splits; both CTAs are flat
  fills with `background-image: none`; there are no photographs beyond 32px avatars
  and customer logos.
- **`materials`.** `single-theme`: dark is forced (`html` carries class `dark`). With
  `prefers-color-scheme: light` emulated, body is still `rgb(24,24,28)`, and there is
  no theme control. The ribbon is SVG with Gaussian blur, not WebGL. The pixel bunny is
  a brand asset (`/brand/bunny/off-black.svg`), not counted as illustration.

## Verdict: mixed, net +1

Six slop present (gradient-blob, three-card-row, glass-card-overuse,
generic-line-icon-set, testimonial-card-row, hero-mockup-float) against five craft
present (asymmetric-split, real-product-surface, shows-deliverable, density-variation,
live-claim-control). Net +1, inside the mixed band (-6..+3). The slop column is
template furniture: an aurora ribbon, a three-column bento with a stock glyph per card,
a tweet wall. The craft column is unusually strong in substance: the hero is the real
app on the vendor's own live data, the visitor can drive it, and its default state
publishes two unflattering numbers. Several slop values sit at their thresholds
(glass on CSS count, testimonials on one featured card, the float with no shadow); if
each went the other way the page would read net -2, still `mixed`. The one plausible
upward move (`typewriter-headline` under a non-SCOPE reading) gives +2, still `mixed`.
No reading reaches +4. Page height 8486px with ten sections, so this is not a thin page
scoring well for lack of places to fire.

**Drift from the 2026-10-10 study**

Written after the blind rating above, from `content/evidence/databuddy.md`. The old
file rated a page 8761px tall; this one is 8486px, and the vendor's commits between
(`a196376d`, `9a6d2a0d`, `00505329` on 2026-10-10, then `71f86ec4` on 2026-10-16,
"rebuild the bento with real Databuddy data", which also removed the hero insight
popup) account for most of the difference. Verdict unchanged: `mixed` at net +1 then
(5 slop, 4 craft) and net +1 now (6 slop, 5 craft), with a different composition.

| signal | 2026-10-10 | now | cause |
|---|---|---|---|
| `glass-card-overuse` | absent | present | undetermined, leaning old rating wrong. The old prose records no `backdrop-filter` census, and the header, YC badge, demo frame and footer CTA chip it describes are the surfaces counted here. The 10-10 DOM was never saved, so this cannot be proved. |
| `testimonial-card-row` | absent | present | page changed. The old wall was "roughly a dozen quotes in a masonry wall"; today's is eight quotes in a regular 3x3 grid of 425px columns, seven equal and one featured. |
| `indigo-violet-accent` | present | absent | old rating wrong, on a near-identical ribbon. The old call rested on the bloom's right edge sampling `#5e3e79` to `#4e3d77`. Today's SVG has the same violet stops (`#714075`, `#483C7B`), but they are 11.1% of the hero's chromatic pixels against 56.4% amber-orange, and every CTA is neutral. A terminal stop of a multi-hue wash is not the accent. A second rater could call this rater difference. |
| `type-scale-high-contrast` | present | absent | old rating wrong. It predates the threshold. The vocabulary block names databuddy as one of the five files at exactly 3.75:1, and the ladder is flat (60 / 60 / 48x3 / 36 / 30), the neuron-industries and decent-com shape, both absent. |
| `shows-deliverable` | absent | present | page changed. On the studied capture the hero iframe was a loading skeleton, and in the 10-11 walk its bounce delta sat under the insight popover, which `71f86ec4` removed. Today the default Overview shows `Bounce rate +37%` and `Session duration 11%` down, both red, legible, on databuddy.cc's own live data. The old file's 10-16 drift note proposed `present` on the bento error card instead. I reject that card: it is headed "Error tracking / Catch and fix bugs fast", so error display is the capability it sells. railway-com's log counted because nothing on that page sold error display. |
| `live-claim-control` | absent | present | old rating wrong. The tab strip over the live `app.databuddy.cc/demo` iframe is in the old prose ("Overview / Events / Errors / Vitals / Funnels") and the old re-pass names the iframe as live product chrome. The old rater worked from stills ("nothing in a static frame shows whether any motion answers to the pointer") and never clicked a tab. Each tab issues real API requests today. |
| `context` | [hero, nav, pricing, features, testimonials, cta, footer] | + dashboard, integrations, faq | mixed. `faq` did not exist in the vocabulary on 10-10. `dashboard` (the live hero demo) was an old miss. `integrations` (the MCP / Claude Code section) is a page change in form: the editor panel was rebuilt as a Claude Code session on 10-10, though an editor panel existed before. |
| `materials` | [single-theme, illustration] | [single-theme] | rater difference, page unchanged on this point. The old file counted the pixel-art rabbit and the horizon silhouette as illustration. I read the rabbit as a brand asset (`/brand/bunny/off-black.svg`) and the horizon as the same blurred-gradient SVG as the hero. Low stakes, since a material backs no rule; the orchestrator may prefer to keep `illustration` for continuity. |

Unchanged values whose grounds moved with the page:
- `three-card-row` present: was the pricing tiers and a 3-up icon feature grid; now the
  three-column bento, with pricing and testimonials repeating the module.
- `generic-line-icon-set` present: was a grey stroked set (panel, shield-check, bolt)
  in the 3-up grid, which is gone; now seven 16px filled glyphs in the bento headers.
  A rater who reads "line" literally would flip it on the new page.
- `hero-mockup-float` present: was "a dashboard screenshot ... with a separate insight
  popover layered over its right edge"; the popover is gone, and the "screenshot" was
  always a live iframe.
- `density-variation` present: was the install snippet and live event log, both
  removed; now the bento against the sparse chat, MCP and close-out bands.
- `real-product-surface` present: the old prose called the hero a screenshot; it is the
  live app, which only strengthens the value.

Capture note for the orchestrator: the 10-16 walk in `s5/databuddy` that the old file's
re-pass reused ("worst landing error 0px") came from the same walker that broke here.
Today a stock walk hit the page's `window.scrollTo(0, scrollY)` freeze at tile 6, and
the stitcher hid it at a correct total height. Whether the 10-16 walk was affected
cannot be known from its walk.json, which records no landings. The tiles now in
`s5/databuddy` are the instant-scroll re-walk of 2026-10-18.

**Superseded study (2026-10-10, verdict `mixed`).** Everything below describes the page as it was before the redesign that forced the re-study above, and is kept as the record of that page. Its signal values, which the front-matter no longer carries:

```
gradient-blob: present
three-card-row: present
glass-card-overuse: absent
emoji-as-icon: absent
generic-sans-default: absent
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
hero-mockup-float: present
asymmetric-split: present
single-optical-anchor: absent
type-scale-high-contrast: present
editorial-grid-break: absent
custom-type-pairing: absent
real-product-surface: present
shows-deliverable: absent
density-variation: present
one-accent-discipline: absent
live-claim-control: absent
```

Product analytics tool, YC F26. Dark site, hero text left at roughly half measure,
headline split across two weights so the second line ("without a data team.") drops
to a mid grey.

The gradient is the loudest thing on the page and it is not behind the headline: a
large soft bloom runs orange to magenta to violet across the top right corner,
bleeding under a pixel-art rabbit silhouette. The same gradient returns in the
footer CTA as a mountain-range silhouette. Two instances, one of them 8000px down
the page, so the site is paying the cost of the blob twice.

Below the hero a dashboard screenshot sits on the gradient with a separate insight
popover layered over its right edge, partly occluding the KPI row behind it. The
tab strip ("Overview / Events / Errors / Vitals / Funnels") straddles the boundary
between the hero band and the screenshot.

Where the page earns something: the bento band shows a real install snippet with
the actual CDN path and client-id attribute, and a live event log with typed
coloured pills (FLAG, ERROR, VITAL, EVENT, PAGEVIEW), timestamps to the second,
and real right-hand context ("Safari 18", "Chrome · Germany", "25% of users").
That is genuine density against an otherwise sparse page.

Pricing is three equal cards (Free / $9.99 / $49.99). The 3-up feature grid above
it carries one undifferentiated grey line-icon set at uniform size and weight
(panel, shield-check, bolt), each repeating what its heading already says.
Testimonials are not a triplet: roughly a dozen quotes in a masonry wall with real
handles and avatars.

Single theme. The default (prefers-color-scheme: light) capture renders dark, so
there is no second theme to have neglected. Two captures 3.5s apart differ, so
something on the page animates, but nothing in a static frame shows whether any
motion answers to the pointer.
**v3 re-pass.** `indigo-violet-accent` is present: the top-right bloom samples at
#5e3e79 to #4e3d77 along its right edge, so the orange-to-magenta run terminates in
indigo-violet rather than stopping at magenta. `gradient-fill-cta` is absent — the
bloom is a background wash and both hero buttons are flat dark pills with hairlines.
The full page renders complete, so `scroll-reveal-blank` is absent despite the page
being 8761px tall.

**v4 hole-7 deliverable re-pass**

Capture: reused `s5/databuddy` walk, 13 tiles, `clamped: false`, `coverage: 1`,
`docH_before` 8486 = `docH_after` 8486, worst landing error 0px. Stitched to 2 strips,
8486px vs page 8486px. The last strip ends in the footer (`© 2026 Databuddy Analytics, Inc.`).
That capture is the live page of 2026-10-16, and it is a redesign (see the studied-page
check below). The studied page was therefore rated from the 2026-10-10 full-page capture
(`shots/databuddy-full.png`, 1440x8761, taken 15:01 +0300 = 12:01 UTC) plus the vendor's
public repo at the matching commit (`8bad96b3`, 2026-10-09) for the animated panels the
capture shows mid-state. Wayback has only `20261011203657` for Oct 1-16, which is after the
study, and the Archive went offline on follow-up queries.

Candidates on the studied page (y from the 10-10 capture, approximate):
- Hero live-demo iframe (`app.databuddy.cc/demo/...`, product chrome), y~555-1170. It is a
  loading skeleton in the studied capture, so unreadable. The 10-11 walk shows `+60%`
  `+80%` `+85%`, with the bounce delta hidden under the popover.
- Hero insight popover over the iframe (page canvas), y~575-848: "Signups from organic
  search rose 34% week over week", `Example investigation` `+34%`. The per-tab examples in
  source are all the product finding something about a customer's site.
- Bento (page canvas), y~1843-2540: `TypeError: undefined is not a function`
  `at /app/layout.tsx:42:15` `CRITICAL` `12 AFFECTED` (y~2459). Also flags `New Dashboard`
  / `AI Assistant` / `Dark Mode V2` and events `add_to_cart` `8.9k`. This is a generic demo
  customer, and an error caught by an error tracker is the feature being sold.
- Databunny investigation (page canvas, animated), y~3165-3676: `Signup completion −22%`,
  `3 signals found`, `a41f0c2 verification copy, Tue`. Every source scenario finds its cause
  and closes on a recovery (`Back to 62%`, `Back to 4.0%`, `Back to 41%`).
- Editor panel (page canvas, typed), y~3821-4045. It is empty in the capture. Source answers
  are "Launch week traffic is up 64%. ..." and "Yes. This week's investigation found checkout
  conversion down 22% ... I asked Databunny whether the two line up." Generic customer, the
  product wins.
- Swap-a-stack snippet + `One dashboard` live log (page canvas), y~4494-4790:
  `TypeError at /checkout` `Safari 18`, `acme.link/launch`. Generic acme demo.
- Pricing, y~5603-5759: three tiers with no refusal in the grid. "Set a billing limit and
  ingestion stops instead of surprising you." is footnote copy and a limit the page sells.
- FAQ "Can I trust the AI answers?": FAQ prose, excluded.
- Footer CTA chip, y~7997-8096: "Traffic looks normal next to last week. If a change is
  real, I'll post it in Slack." This is a null result sold as restraint.

Entry that could have embarrassed the vendor: none. Every artefact is either unreadable at
capture (the iframe) or a demo customer's trouble that the product catches and fixes. Nothing
shows the product erring or missing, or narrows a claim. Verdict: `absent`, confirmed for
the studied page.

Studied-page check: redesigned. The prose's install snippet, event log and icon card grid
are gone. A Databunny chat panel, a chat-thread FAQ, a macOS Claude Code window and a
dogfooded bento have appeared. Height went from 8761 to 8486. Vendor commits after the study:
2026-10-10 16:19 UTC `a196376d` (editor as a real Claude Code session), `9a6d2a0d` (FAQ as
chat thread) and `00505329` (Databuddy domains in the activity feed). Then 2026-10-16
00:10 UTC `71f86ec4`, "rebuild the bento with real Databuddy data", which "Removes the hero
insight popup and the tools section".

Drift, not applied: the redesigned page carries a candidate entry. In the bento error card
(page canvas), at y=2715 to 2807, it shows `TypeError: Cannot read 'plan' of undefined` `CRITICAL`
`/pricing at app/(home)/pricing/_pricing/table.tsx:88:11` `Last 24 hours` `12 affected`.
`apps/docs/app/(home)/pricing/_pricing/table.tsx` exists in the vendor's own repo, so the
artefact shows a critical crash in Databuddy's own pricing table, the same kind of entry as
railway-com's own error log. Weaker supports on the same page:
- The editor transcript at y~4389 (animation-dependent) runs on `websiteDomain: "databuddy.cc"`
  with `"Checkout conversion down 22% vs the prior 7 days"`.
- The live hero iframe currently reads `53.5%` Bounce rate `+36%` and `30s` Session
  duration `10%` in red.

On the redesigned page I would score `present` on the error card. It needs a full re-study.
