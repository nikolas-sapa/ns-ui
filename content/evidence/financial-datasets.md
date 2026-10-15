---
source: https://financialdatasets.ai/
kind: site
cohort: yc-current
verdict: exemplar
studied: 2026-10-14
context: [hero, nav, features, docs, cta, footer, stats]
signals:
  gradient-blob: absent
  three-card-row: absent
  glass-card-overuse: absent
  emoji-as-icon: absent
  generic-sans-default: present
  symmetric-everything: absent
  badge-pill-spam: absent
  generic-line-icon-set: absent
  testimonial-card-row: absent
  indigo-violet-accent: absent
  gradient-fill-cta: absent
  scroll-reveal-blank: present
  typewriter-headline: absent
  stock-photo-generic: absent
  centered-hero-stack: absent
  hero-mockup-float: absent
  asymmetric-split: present
  single-optical-anchor: present
  type-scale-high-contrast: present
  editorial-grid-break: absent
  custom-type-pairing: present
  real-product-screenshot: present
  shows-deliverable: absent
  density-variation: present
  one-accent-discipline: present
  live-claim-control: present
materials: [dual-theme, illustration]
---
Captured at 1440x900 in 700px steps with a 900ms settle; `documentElement.scrollHeight`
5758px, 9 tiles, stitched to strips of 4200 and 2300px. The strips overshoot the page by
742px because the sticky header is baked into the top of every tile and one 700px band
survived the overlap removal, so the "Same shape, every call" request/response pair and
the closing CTA each appear twice in strip1. One page, one of each. The footer is real
and was missed by the walk, not by the page: `footer` sits at y5646, 112px tall, seven
links, under a fixed cookie-preferences banner that occludes it in the final tile. It
was recovered by direct DOM read.

Two of the sixteen slop signals are present and eight of the ten craft signals are. Net
-6. That is exemplar-only territory on the observed distribution (exemplar -7..-2, mixed
-5..+4), and the margin is one signal wide: `live-claim-control` is the value a second
rater is most likely to split on, and at -5 the verdict becomes arguable. The case for
exemplar does not rest on the net alone. It rests on the slop count being 2, and on what
those two are.

**`generic-sans-default` is present, on the Linear and railway.com reading.** Body is
`__Inter` at 16px, `line-height: 26px`, `letter-spacing: normal`, and there is no
per-size tracking table compensating for it. Every piece of running copy on the page is
Inter at default tracking: the 18px hero subhead at `rgba(38, 37, 30, 0.6)`, the 16px
section bodies, the 14px nav, the 12px header buttons. The display face is a serif and
that is scored separately; the body face is the stock choice.

**`scroll-reveal-blank` is present, and the control settles it.** At rest, excluding nav,
menu, header, footer and dialog subtrees, 54 text nodes carrying 2030 characters render
under 8% effective opacity. Walked over the full 5758px, 26 of them cross to visible,
carrying 1082 characters, and **zero nodes mount**: `scrollHeight` is 5758 before and
after, so nothing lazy-mounts and this is pure opacity gating. The dwell control holds
step count, 900ms settle and total wall clock constant and scrolls to (0,0) each step
instead of (0,y). It crosses **0 nodes and 0 characters** and reproduces the rest state
exactly. The gate is the scroll, not elapsed time.

What is behind the gate is the page's argument. The six crossed nodes the walker sampled
are "Engineered for decisions with no margin for error", "Every number your agent acts on
is verified and cited to its source", "Analyze decades of history in one request", "See
each year as the market first saw it, so backtests stay honest", "Search years of
financial reports at machine speed", "Cover your whole universe, not just the names you
have time to read". That is every body section's heading and its subhead. A reader
without JS, without scroll, in print, in reduced-motion, or any agent reading the page,
gets the hero and then six invisible headings over six panels.

The no-JS control sharpens it and is worth recording separately because the vocabulary
does not name it. Same script, same wait, JS on against JS off: `innerText` is 12559
characters with JS and 4998 without, so 7561 characters (60%) of the page's text exists
only under JS. `scrollHeight` is 5758 in both, so the shell lays out and the content does
not arrive. railway.com measured 53% on the same instrument; this page is worse. And the
two defects compound rather than overlap: the 2030 opacity-gated characters are inside
the 4998 that do render without JS, and nothing is left to toggle them, so they are in
the DOM and permanently invisible.

The craft side, with the same rigour.

**`asymmetric-split`.** The hero headline block is 575px wide at x=80 with
`text-align: left`, and `DIV.scene-poster` is 637x566 at x=719, filled by
`image-set(url(.../images/enterprise/financial-district-light-800.webp))`. Nothing is
centered: `headings` records 9 headings and every one is `left` or `start`, at x=80 or
x=974. The body sections then alternate. Text left with the panel right at y964 and
y2200; panel left with the heading right at y1830, where "Analyze decades of history in
one request" sits at the right of its own section over a panel that begins at x=48. Where
the panel is full-width, the heading block still pins to x=80 and leaves roughly 600px of
the frame empty beside it, which is railway.com's asymmetry-by-vacancy.

**`centered-hero-stack`, `symmetric-everything` and `hero-mockup-float` all fall out of
the same measurements.** Nothing in the hero is centered. The hero visual carries
`box-shadow: none`, and zero elements wider than 200px and taller than 150px above y900
carry any box-shadow at all, so there is no float, no bezel and no tilt; the diorama's
shadow is painted into the WebP. And the hero pictures no interface. There is no product
mockup in the hero to float.

**`single-optical-anchor`.** The page is 79.9% `rgb(248, 248, 248)` by pixel count, with
total saturation at 5.9%. The illustration is the only saturated object above the fold
and the only three-dimensional one anywhere. Precedent is exact: `papaya` and `truemile`
both score this present on the same construction, copy left against a commissioned
isometric illustration on an off-white field.

**`stock-photo-generic` is absent and the illustration is why.** It is a commissioned
isometric render of a stock-exchange block, built for this page's one metaphor ("Connect
your agent to the stock market"), carrying no scrim. The building's pediment lettering is
live DOM: 40px Literata, `letter-spacing: 6.4px`, `rgb(107, 82, 45)`, at x=974 y=535,
inside the illustration's 719-1356 footprint and transform-scaled so its computed 40px is
not its painted size. Type sited into the image, in the engraved bronze of a stone sign.
That is the strongest thing on the page the vocabulary has no slot for;
`type-sited-in-image` is listed in v3 as a candidate, not adopted, and this is a second
supporting file for it.

**`custom-type-pairing`.** Two faces, cleanly divided by role. `__Literata`, a serif,
carries every size at or above 24px: the 63.4px/600 display at `letter-spacing:
-1.26721px` on `line-height: 67.1622px`, the 40px pediment lettering, the 24px section
heads. `__Inter` carries 18px down to 12px. Both are in one frame at y964, where a 24px
Literata head sits directly on 16px Inter body. Same shape as railway.com's IBM Plex
Serif against Inter, which scored present, and as there the licence is irrelevant: both
faces are open, and the decision to set a financial-data API's display type in a serif is
not.

**`type-scale-high-contrast`.** 63.4px display against 16px body is 3.96:1 over a
seven-step ladder (63.4 / 40 / 24 / 18 / 16 / 14 / 12). `vercel-com` scores this present
at 3.9:1 and `anthropic-com` at 3.8:1, both below this page.

**`density-variation`.** 80.1% of sampled pixels sit in the brightest of 16 luminance
bins, and the page spends that whiteness unevenly on purpose. The hero band is one
headline and one image across 900px. Section 3's panel is a five-column monospace table
in a `h-[450px]` card whose inner scroller measures `scrollHeight` 3328 against
`clientHeight` 415, eight times its own frame, with a `PRE.shiki` 871px wide running to
x=1627, 187px past the viewport edge. 63.4px display type and 13px mono tables, on the
same page, with near-empty bands between them.

**`one-accent-discipline`, after excluding code colour.** A computed-style census over
every box larger than 4x4 returns four high-count chromatic text colours that are all
Shiki `vitesse-light` syntax tokens: `rgb(153, 132, 24)` on 188 elements,
`rgb(47, 121, 138)` on 114, `rgb(181, 105, 89)` on 61, `rgb(36, 41, 46)` on 13. That is a
syntax theme, and it is excluded on railway.com's precedent for the six-series chart
palette inside its Observability capture: code colour and data colour are not brand
accent choices. Strip those 376 elements and the page's chrome has exactly one accent, a
green at `rgb(30, 117, 79)` and `rgb(31, 138, 101)` across 33 text and 5 background
instances, carrying one meaning throughout: verified, positive, up. It is the YoY delta
column, the `200 OK` chip, the "TODAY" benchmark bars and the agent status ticks. Both
primary CTAs are flat monochrome, `rgb(38, 37, 30)` on cream and `rgb(20, 18, 11)` in
dark. Hue buckets 240-330 degrees read 0.00%, so `indigo-violet-accent` is absent at the
pixel level, and `btnGrad` is empty, so `gradient-fill-cta` is absent in source.

**`live-claim-control`, present with a named limit.** 30 controls, and they are not
decorative: tapping "Balance Sheets" swaps the response pane from Delta Air Lines
operational KPIs ("Premium Revenue $5.36B +13.9%") to a balance sheet ("FY 2025 FY 2024
FY 2023 / Current Assets $133.24B $152.99B $143.57B"); tapping "Insider Trades" swaps it
again to "Tim Cook / CEO / Sale / 511,000 shares / $178.25 / $91.09M"; tapping
"TypeScript" rewrites the request pane from a Python `requests.get` call to
`new URLSearchParams` and `await fetch`. The ticker control opens on AAPL / NVDA / MSFT /
TSLA. The textarea holding the request is `readOnly: false`, 235 characters, 580px wide.
The benchmark section puts four dimensions behind tabs (Accuracy / Latency / Coverage /
Freshness) and prints the method for each: "Sample: 1,000 companies across 75 sectors,
20,000 data points verified per audit cycle" and "Metric: A value is accurate if it
exactly matches the figure reported in the source document".

The limit: **no control issues a network request.** Across every tap above, the only call
the page makes to its own API is `GET api.financialdatasets.ai/config` on load, and
clicking `Run` produced zero requests in a 5s window. Every response is a client-side
fixture. The affordance is real and switches real cited data, which is what v3's wording
asks for ("resolvable from a still because the affordance is a visible label"), and the
falsifiable part is independently checkable without the button: the response carries
`"accession_number": "0000320193-25-000079"` and a `filing_url` to sec.gov against
`"revenue": 416161000000` for Apple FY2025. A rater who requires a live round-trip scores
this absent, and the net goes to -5.

Near-misses, and what settled each.

`real-product-screenshot` present / `artifact-not-dashboard` absent is the brief's
convention applied, not a reading of this page, and the tension is sharper here than the
convention anticipates. **There is no screenshot.** The only raster or vector assets on
the entire page are `logos/light.svg`, `logos/dark.svg`, `yc-logo-square.svg`,
`google-g-logo.svg` and the hero WebP. Every product surface is a live rebuild in DOM:
real buttons, real tabs, a real editable textarea, real Shiki highlighting. And what
those surfaces render is a claims ledger in the vocabulary's own words, a cited row per
number: `Metric / Type / Period / Value / Citation`, where the Citation column holds the
quoted source string ("Data Center $89,023") beside an out-link, and the 10-K pane holds
five real Item 7 excerpts with years ("...we spent $52.5 billion and $91.4 billion on
capital expenditures...", 2025). So the honest reading of the two definitions is the
reverse of the scored one: absent / present. The values stay as scored because the brief
forbids flipping them, and the verdict is unaffected either way, since both are craft
signals and the swap leaves the craft count at 8 and the net at -6. The defect is in the
vocabulary, not the page: `real-product-screenshot` is defined on a capture medium while
`artifact-not-dashboard` is defined on content, so a live-DOM rebuild of a UI that
renders a deliverable satisfies the spirit of both and the letter of neither.

`editorial-grid-break` absent. Every section obeys an x=80 to x=1360 content column, and
the only boxes outside it are horizontal overflow clipped inside scrollers (the
`PRE.shiki` running to x=1627, the 3328px table in a 415px frame). Overflow under a clip
is a scroller, not an element living in the margin, which is what railway.com's 12212px
gutter rail is and what this page has nothing of. The left/right zigzag is
`asymmetric-split` and is scored there.

`typewriter-headline` absent, and this was the closest call on the slop side because the
strips look like evidence for it. Two panels in strip0 show mid-type states, "Agent:
searching|" with a caret and "Agent: searching Fina |" with the word "Financial"
half-typed. Three measurements settle it: `h1` innerText is byte-identical across four
samples spanning 12s; `setInterval` occurs 0 times in the serialised document; and the
completed panel line "Agent: searching Financial Datasets" is identical across five
samples spanning 14s after the type-on finishes. It types once on intersection and holds.
Nothing cycles. The signal names phrases cycling on a timer, and the entrance animation
here is already counted once, under `scroll-reveal-blank`.

That same animation is a capture hazard worth recording. The 900ms settle is not long
enough for two panels to finish typing, so the strips under-report them: the "Analyze
decades of history" panel reads as a search bar over roughly 300px of empty card, when
the card actually holds a five-era table ("Item / 2025 / 2020 / 2015 / 2010 / 2005 /
Revenue $402.8B $182.5B $75.0B $29.3B $6.1B / COGS $162.5B $84.7B..."). Resolved by
direct DOM read, no signal value changed. A rater working from the strips alone would
have marked that section's content unresolved.

`glass-card-overuse` absent at exactly 1 `backdrop-filter` surface against a threshold of
3: `DIV.flex items-center overflow-hid`, 151x31, `blur(8px)`. `badge-pill-spam` absent at
exactly 1 decorative pill above the fold, "BACKED BY Y COMBINATOR" at 220x31, y278; the
four other above-fold pill shapes are buttons with destinations (Contact sales,
Dashboard, Get API key, Copy onboarding prompt).

`gradient-blob` absent, and the one large gradient declaration on the page is the reason
to say so explicitly rather than by omission: `895x439@y4051` carrying
`radial-gradient(circle, rgb(212, 212, 212) 1px, rgba(0, 0, 0, 0) 1px)`. A 1px dot at
zero falloff, tiled, is a plot-area grid texture behind the benchmark chart, not a soft
wash. `gradText` is empty and `btnGrad` is empty.

`three-card-row` absent. The row detector found four equal-width candidates and all four
have empty card flags, meaning no background, no border and no radius: 895/895 at y4051
and 150/150/150/150 at y4027, both the benchmark chart's paired bars; 628/628 at y4782 and
580/580 at y4893, the playground's request and response panes. There is no 3-up anywhere
on the page. The one stat row is a 4-up at y1086, four figures separated by hairline rules
with no card treatment (30+ years / 27,529 stocks covered / 99.9%+ verified accuracy /
under 200ms API latency). Note for anyone reading the probe: the 97.50 / 99.99 / 99.20 /
99.97 strings at y4027 are not an uptime row, they are the before/after bars of the
accuracy benchmark, four categories (Earnings / Financial Statements / Operational KPIs /
Segmented Financials) each pairing a dark "JUL 2026" bar against a green "TODAY" bar:
97.50 to 99.99, 99.20 to 99.97, 97.84 to 99.99, 96.10 to 99.96. The page publishes its own
worse past numbers on a 95-100% axis.

`testimonial-card-row` absent because the section does not exist, not because it could not
be read. There is no social-proof block, no logo wall, no quote and no avatar on 5758px.
The only social proof is a subordinate clause in the hero subhead ("Trusted by thousands
of investors and AI teams") and the YC badge.

`generic-line-icon-set` absent. 18 SVGs, none in a feature-icon position. The nine-item
dataset selector at y3044-3676, which is where a template would put a uniform glyph above
each item, carries a name and a one-line description and no icon at all (Operational KPIs
/ Forward Guidance / Non-GAAP Metrics / Income Statements / Balance Sheets / Cash Flow
Statements / Financial Metrics / Insider Trades / Segment Breakdowns). The only uniform
set is five 20x20 glyphs at y2407 labelling five distinct 10-K years inside a product
panel, which carry information the adjacent label does not repeat.

`emoji-as-icon` absent. The emoji scan returns zero, and the tick marks beside the agent
status lines coincide with 16x16 `fill` SVGs at y1291 and y1344, so they are drawn icons
rather than glyphs. Unlike railway.com's U+2713 in JetBrains Mono, there is no raw count
here that needed disambiguating.

Materials: `dual-theme`, and it is a real theme rather than a neglected one, which is why
the fact belongs here and not in a signal. `html.light` flips to `html.dark` under
`prefers-color-scheme: dark`, `body` background goes from `rgb(247, 247, 244)` to
`rgb(20, 18, 11)`, mean sampled luminance from 228.9 to 31.3, and **100.0% of sampled
pixels differ** between the two renders. The theme is maintained down to the assets: the
DOM carries both `logos/light.svg` and `logos/dark.svg` with the unused one at 0x0, and
the hero illustration is requested as `financial-district-light-800.webp`, a filename that
names its variant. The probe's `pcsRules: 0` is misleading and would read as "no second
theme" if taken at face value. There are no `prefers-color-scheme` CSS at-rules because
the dark variant is class-based, 12 `dark:` hooks with the class flipped from the media
query in JS.
