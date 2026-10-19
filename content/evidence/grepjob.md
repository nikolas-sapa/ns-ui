---
source: https://grepjob.com/
kind: site
cohort: ai-builder
verdict: mixed
studied: 2026-10-19
context: [hero, nav, features, testimonials, cta, footer, faq, dashboard]
signals:
  gradient-blob: absent
  three-card-row: unresolved
  glass-card-overuse: absent
  emoji-as-icon: absent
  generic-sans-default: present
  symmetric-everything: present
  badge-pill-spam: absent
  generic-line-icon-set: present
  testimonial-card-row: present
  indigo-violet-accent: absent
  gradient-fill-cta: absent
  scroll-reveal-blank: absent
  typewriter-headline: absent
  stock-photo-generic: absent
  centered-hero-stack: present
  hero-mockup-float: absent
  asymmetric-split: absent
  single-optical-anchor: unresolved
  type-scale-high-contrast: absent
  editorial-grid-break: absent
  custom-type-pairing: absent
  real-product-surface: present
  shows-deliverable: present
  density-variation: unresolved
  one-accent-discipline: present
  live-claim-control: unresolved
materials: [single-theme, origin-captured, anchored]
---

**Sampling: random draw.** One of twelve drawn with seed 20261019 from the twenty-two gallery sites left after the first draw (same pre-stated exclusions). `gunsvzombies`, drawn first, returned 404 (project deleted) and was replaced from the same seed by `openmark`. Not chosen on any signal.

Rated by two independent blind raters on 2026-10-19, neither reading the other's draft. Both reached `mixed`. They agreed on 22 of 26 signals; the 4 splits `three-card-row` (A absent, B present), `single-optical-anchor` (A absent, B present), `density-variation` (A present, B absent), `live-claim-control` (A present, B absent) are recorded `unresolved`, which never counts toward a rule. Both write-ups follow in full.

**Rater A.**

**Rater A**, blind, new page. No prior study, so no drift section. Every value
above was set from the capture and the DOM. No other rater's draft was opened.
Probe scripts are in `~/scratch/antislop/s5work/grepjob/probe-A-*.cjs`.

## Capture facts

Viewport 1440x900. `https://grepjob.com/` serves directly. Walk `grepjob-A`
(`~/scratch/antislop/s5/grepjob-A/`): 9 tiles, `docH_before` 5900 =
`docH_after` 5900, scroller `window` (the only inner candidate is `html`
itself), every landing exact except the last (5600 asked, 5000 landed = 5900 −
900), `clamped: false`, `coverage: 1`. Stitched to 2 strips, 4400 + 1500 =
**5900px**, no drift. The last strip ends in the footer (Browse Jobs, Popular
Searches, `@kylem_dev`, `kyle@grepjob.com`). No `<video>`, `<canvas>` or
`<iframe>`. 12 `<img>` (10 company logos, 2 testimonial avatars). 77 SVGs.
The only `position: fixed` element is a 50x50 "Contact me" mail button at
bottom-right, which repeats in every tile; it is not duplicated content.
Mobile 390x844: `scrollHeight` 12612, `scrollWidth` 375, no horizontal scroll.

Stack, for the record only: Vite + React Router assets (`entry.client-*.js`,
`/__manifest`), Supabase storage for logos, PostHog on `t.grepjob.com`, Meta
Pixel, Senja testimonial widget. No builder marker is served. Not used in any
call.

## What the page is, and how scope was applied

The root is a logged-out job board with marketing chrome around it: centred
hero, a six-control filter bar, **a live feed of 10 job cards** (y=455 to
3191, the last two faded to `opacity 0.6` / `0.3` under a 784px bottom fade),
a sign-up wall ("Unlock 71,304 More Matching Jobs"), a "Wall of Love"
testimonial block, a four-item FAQ accordion and an SEO-link footer.

Nothing is embedded, so SCOPE excludes nothing. The v4 "page is the product"
limits applied: **data is not chrome.** Job titles, companies, descriptions,
tag chips, salary bands and timestamps are content. The card container
(`rgb(31,41,55)`, 8px radius, `rgb(55,65,81)` border, emerald hover border),
the filter bar and every band around the feed are chrome and were scored.
**Score at rest:** dropdown contents were opened only to test
`live-claim-control`, never to score another signal.

## Slop signals present (5)

**`generic-sans-default`.** Body and every heading compute to `ui-sans-serif,
system-ui, sans-serif, "Apple Color Emoji", …`. `ladder.cjs`: `bigFamilies:
["ui-sans-serif"]`, `smallFamilies: ["ui-sans-serif"]`. Inter is requested
through the Google WebFont loader (`wf-inter-n4-active` on `<html>`) but no
rule assigns it, so every node renders in the OS default face. One face, no
display voice.

**`symmetric-everything`.** `symmetry.cjs`, basis `h1-h2`: n=2, centred=2,
**share 1.0**, over the 0.85 cut. h1 "Find Your Next Software Engineering Role
Faster" spans 1024 of 1440px (71%, under the 90% skip), h2 "Frequently Asked
Questions" 704px. Those are only two, so I widened the census as a check, not
as the score. The section headings set as h3 ("Unlock 71,301 More Matching
Jobs", w=768; "Wall of Love", w=1216) are `text-align: center` too, so every
marketing section heading is centred, 4 of 4. Left-aligned headings exist only
as the 10 job titles (data) and the two footer column labels (footer is
excluded).

**`generic-line-icon-set`.** All 77 SVGs are Lucide, `currentColor`, stroke
1.5 at 24px and 64px, stroke 2 at 16-20px. In the feature position, the
sign-up wall's three benefits put a 24px emerald `zap` over "First to know", a
`shield-check` over "Zero Spam" and a `target` over "AI-powered filters". Each
glyph restates its heading. The 64px `unlock` glyph over "Unlock … More
Matching Jobs" does the same thing. The other ~70 label controls (carets,
`map-pin`, `banknote`, `users`, stars) and would not fire alone. Uniform set,
uniform stroke per size, nothing carried that the heading doesn't say.

**`testimonial-card-row`.** The social-proof section is one Senja masonry of
**6** quote cards in a closed shadow root (71,463 bytes of shadow HTML, no
iframe). All six are `w=392`, `border-radius 16px`, `background rgb(0,0,0)`,
with the same padding, avatar slot and 5 amber stars each. 3 columns at
x=107 / 517 / 927, ragged heights (row 1: 628 / 412 / 652). Equal weight, and
it is the whole section. Not a carousel: the container is `overflow:
visible`, 1216px wide, with no clipping track. The hero's "Loved by 1,000+ job
seekers" line is a separate aggregate claim, not a second social-proof
section.

**`centered-hero-stack`.** Inside `max-w-5xl mx-auto` (x=201, w=1024): the
40px h1 at `text-align: center`, then the 20px gray-300 subline "60,000+ jobs
scraped hourly from company career pages. No ghost jobs, reposts, or
sponsored listings. Filters that actually work.", then the avatar-and-stars
row, all on the centre axis. No image and no mockup in the hero.

## Craft signals present (5)

**`real-product-surface`.** The feed is the live product answering, not a
doorway. A logged-out visitor gets 10 fully populated cards. Each title links
to a vendor route `/jobs/<uuid>`, and each Apply resolves to the employer's
own ATS: Ashby (Sandbar, Perplexity), Greenhouse (Reddit, Backblaze,
Anthropic ×2), Fujitsu's careers site, SmartRecruiters (Air New Zealand),
Workday (BNZ), `careers.usbank.com`. For example `/jobs/84aaa71e-…` →
`job-boards.greenhouse.io/anthropic/jobs/5456406008`. The sign-up wall comes
after the surface, not instead of it.

**`shows-deliverable`.** The deliverable is the scraped, normalised listing.
The entry that could have embarrassed the vendor, at rest:

> Card 4, y=1328: "Red Team Security Engineer" · company **"Backblaze External
> Website"** (14px, `rgb(52,211,153)`, also the logo's `alt`), linking to
> `grepjob.com/companies/backblaze-external-website`

That string is Greenhouse's internal board name. Greenhouse titles the board
page "Jobs at Backblaze External Website", and its own h1 reads "Current
openings at Backblaze". GrepJob's scraper took the board title verbatim as the
company name and minted a company route from it. So the product's
normalisation failed on a visible field, under a hero selling "jobs scraped …
from company career pages" with "Filters that actually work". It is the
product's own unscrubbed output. Nothing on the page sells catching
extraction errors. It is legible at 14px. It is not an aggregate statistic.
This is the railway-com scanner-probe shape: incidental, real, and unflattering.

Provenance: `origin-captured` (a live fetch, and a detail with no authored
purpose: nobody writes "External Website" into a company field on purpose).
`anchored` (the string checks against Greenhouse's page title, which the
vendor does not control). Not `disclosed` (nothing labels the feed as an
example).

**`density-variation`.** Measured band heights down 5900px: hero 182px of
centred air, filter bar 80px compact, ten job cards at 242-274px on a 276px
pitch (dense, text-heavy), a sparse sign-up wall (one 64px glyph, one h3, one
line, three benefits, one 60px button), a 1148px masonry, a 508px FAQ on a
`bg-gray-800/50` panel, then a dense 23-link footer matrix. Packed and open
bands alternate. It is not one column module repeated.

**`one-accent-discipline`.** One accent hue, measured by `chromaPct`. Emerald
`rgb(16,185,129)` (chroma 169, h160) carries 12 solid fills (Sign Up, 10 Apply,
the wall's Sign Up) and 6 10%-alpha salary washes. Emerald `rgb(52,211,153)`
(chroma 159, h158) carries 19 text nodes (company names, "Faster", "71,304").
`rgba(16,185,129,0.2)` carries 6 borders. The three initial chips are in the
same family (h163/175/194, chroma 96-116). Everything else is gray-900/800/700
(chroma 22-26) or white. Amber `rgb(251,191,36)` appears only on star glyphs,
a rating semantic, as the corpus has treated stars before.

**`live-claim-control`.** The page's central claim, in visible hero copy, is
"Filters that actually work", and the filter bar sits directly under it at
y=368 with visible labels (Location, Salary, Level, Specialty, Tech Stack, H1B
Sponsorship). The controls work logged-out. Level → "Entry Level" rewrote the
URL to `?seniority=entry+level` and replaced all 10 cards, 10 of 10 now
labelled `Entry Level` (one `Entry Level / Mid Level`), against 0 of 10
before. A visitor can falsify the claim, and the test is a live one: the first
"Entry Level" result on a board titled "Find Your Next Software Engineering
Role" was "Founder's Associate (Ops)". That result is one click away, so it is
**not** used for `shows-deliverable`. The affordance is visible at rest, which
is what this signal scores. The v4 note says this signal fires on
product-at-root pages by construction, and I have not read it toward the
verdict.

## Near-misses, and what settled each

- **`three-card-row` (absent; the call most likely to differ).** The sign-up
  wall's benefits are the textbook module: three equal 195px items at x=369 /
  635 / 902, each a glyph, an 18px/600 h4 and one line. But they have **no
  card chrome at three ancestor levels**: background transparent, border 0,
  radius 0, shadow none. That matches referable-dev, which held a chrome-less
  `272px x3` band absent. vizleads' present had a shared container with 1px
  dividers, and this has nothing. Counting it gives 6 slop, net +1, still
  `mixed`.
- **`badge-pill-spam` (absent).** Three 32x32 `border-radius: 9999px` chips
  above the fold at y=268, "OS", "DZ" and "AT", meet the count. They are
  initial-avatar stand-ins in the testimonial-proof row, beside a "Loved by"
  caption, not labels repeating a heading. The six filter buttons are 6px-radius
  functional controls. Counting the chips gives net +1, still `mixed`.
- **`shows-deliverable` (present, at the margin).** It rests on one entry.
  The other candidate does **not** count. Cards 5 and 6 (y=1541, 1817) are both
  Anthropic "Principal Engineer Capacity/Compute" at "$320k - $485k/yr", one
  in Seattle and one in New York, under a "no … reposts" line. But the ATS ids
  differ (…5456406008 and …5456405008) and the descriptions diverge after the
  first sentence. These are two genuine requisitions, and listing both is
  correct. A rater who reads "Backblaze External Website" as too trivial to
  embarrass gets `absent`, net +1, still `mixed`.
- **`gradient-fill-cta` (absent).** Every button is a flat `rgb(16,185,129)`,
  `background-image: none`. The page's one decorative gradient is the h1 word
  "Faster", `linear-gradient(to right, rgb(52,211,153), rgb(16,185,129))`
  with `background-clip: text`. That is headline type, not a CTA.
- **`gradient-blob` (absent).** The only other gradient is a
  `from-transparent via-gray-900/90 to-gray-900` overlay (1216x784, y=2919)
  fading the last two cards into the paywall. It is a content fade, not an
  ambient blob. The page field is flat `rgb(17,24,39)`.
- **`emoji-as-icon` (absent).** Zero emoji code points in the rested DOM. The
  Location dropdown, one click away, prefixes every city with a flag emoji
  (🇺🇸 Everywhere, USA … 🇸🇬 Singapore, SGP). Scored at rest per the v4
  clause, as dachly's was.
- **`glass-card-overuse` (absent).** Zero `backdrop-filter` /
  `-webkit-backdrop-filter` surfaces.
- **`scroll-reveal-blank` (absent).** 125 text nodes of 8+ characters at load,
  **0** under 8% opacity, no inline `opacity` styles, `docH` constant at 5900
  through the walk. The only `opacity` classes are the two faded teaser cards
  (0.6 and 0.3, visible, a paywall device and not a reveal). Nothing to
  recover, so no dwell control was needed.
- **`type-scale-high-contrast` (absent).** `ladder.cjs`: 40px max over 16px
  body = **2.5:1** (subhead 20px, 2.0:1). Well under 3.75.
- **`asymmetric-split` (absent).** Every band is a single centred column
  (1216px feed, 768px wall, 704px FAQ). No split anywhere.
- **`single-optical-anchor` (rule-ineligible, honest call: absent).** If
  anything anchors, it is the feed, about 2700 of 5900px and the only band
  with internal rhythm. Above the fold, the h1 at 40px and the green Apply
  buttons compete at near-equal weight. The feed dominates the page partly
  because "one mass dominates because there is only one mass": the hero is
  182px and every other band is one block. Not credited.
- **`stock-photo-generic` (absent).** No photography except employer logos and
  avatars.

## Materials

`single-theme`: under an emulated `prefers-color-scheme: light`, `matchMedia`
dark = false and the shell still paints `rgb(17,24,39)`. `<meta
name="color-scheme">` says "dark light", but there is no theme control (0
toggles). `origin-captured` and `anchored` per `shows-deliverable` above. No
illustration, WebGL or video.

## Verdict

**Net = 5 slop − 5 craft = 0. `mixed`.**

The page has a template perimeter and a working middle. The perimeter is a
centred hero, system-default type, a Lucide-iconed benefit trio, a masonry
quote wall and a centred FAQ. The middle is a live, filterable feed whose
cards link to real postings and whose own output carries a visible
normalisation error.

There is no `slop` case to make: net 0 is four points under the floor. For a
second rater, the swing values are `three-card-row`, `badge-pill-spam` and
`shows-deliverable`. Each is argued above and each moves net by one. All
three going against this rating gives net +3, which equals stripe-2014 and is
still `mixed` under the floor. The comparison the rules demand for `slop`
does not arise.

Thin-page caveat: not this page. At 5900px with a populated feed, a six-card
wall and a FAQ, the slop signals had real surfaces to fire on and five did.
Not an exemplar either. Two of the five craft values (`real-product-surface`,
`live-claim-control`) come free from serving the product at the root.

No `unresolved` values.

**Rater B.**

# grepjob — new-page rating (rater B)

## 1. Capture facts

- Viewport 1440x900. Page height 5900px, 9 tiles, 2 strips.
- `clamped: false`, `coverage: 1`, `reachedPx: 5900`, walkHeight 5900. Landing at the last ask of 5600 resolves to 5000 because 5900 − 900 = 5000 is maximal scroll; not a clamp.
- Stitched height equals settled page height exactly (stitch: `9 tiles -> 2 strips, 5900px vs page 5900px OK`, `0 slug(s) where stitched height != page height`).
- The last strip ends in a footer: `<footer>` at y 5531–5900, carrying "Browse Jobs", "Popular Searches", the @kylem_dev and kyle@grepjob.com contacts.
- The 10 job cards are genuine scraped data, not a capture placeholder: each card's Apply link resolves to an outside ATS (`jobs.ashbyhq.com/sandbar/...`, `job-boards.greenhouse.io/reddit/...`, `.../anthropic/...`). The page is a live Vite/React app with a `/__manifest` route prefetch.
- The counter "Unlock 71,304" in the walk read "71,301" in two later probes minutes apart. It is a live query value, not a static number.

## 2. Slop signals, present

**`three-card-row`** — present. The signup band holds a 1x3 grid (`grid grid-cols-1 md:grid-cols-3 gap-8`) at y 3467, three children each exactly 234.66px wide: icon 24px + h4 18px + one-line description 16px. "First to know", "Zero Spam", "AI-powered filters". Identical internal composition across all three.

**`generic-sans-default`** — present. Every one of 142 sampled visible text elements computes to `ui-sans-serif, system-ui, sans-serif`, including the H1. Google's Inter is requested seven times (`fonts.googleapis.com/css?family=Inter:400,700` in seven stylesheets) and applied to zero elements: no element's computed family contains "Inter". The page's own body class `wf-inter-n4-active` announces a webfont that never reaches the DOM.

**`symmetric-everything`** — present. `symmetry.cjs`: basis h1-h2, n=2, centred 2, share 1.0. The two h1/h2 headings outside nav and footer ("Find Your Next Software Engineering Role Faster", "Frequently Asked Questions") are both `text-align: center` and both centred on the page axis. The footer's two h2s (14px, left) are excluded by the procedure. Above the cut of 0.85.

**`generic-line-icon-set`** — present. 77 visible SVGs, 74 of them lucide. 64 at `stroke-width=2`; only the four decorative band icons (zap, shield-check, target, unlock) use 1.5 and those are the ones carrying a heading's meaning. Size buckets: 53 at 16x16, 18 at 20x20. Glyphs are map-pin, users, clock, banknote, chevron-down, external-link, bot, trending-up, code, cpu, globe: each duplicates the word beside it ("New York, NY, USA" gets a pin, "1 hour ago" a clock, "Senior" a users glyph). Uniform stroke and size, nothing the adjacent text does not say.

**`testimonial-card-row`** — present. Six quote cards in a 3-column masonry, each exactly 391px wide with 16px radius on `rgb(0,0,0)` inside the senja.io embed (shadow DOM, `data-id=107c5b75...`). Heights vary 388–652px; width and styling are identical. They are the whole social-proof section under "Wall of Love". Captured 5-star rows are amber `lucide-star`.

**`centered-hero-stack`** — present. H1 at y 121 is centred, the subhead ("60,000+ jobs scraped hourly… Filters that actually work.") centred, a three-avatar row (OS/DZ/AT, 32px circles) and five amber stars centred at y 265–268, then the filter bar full-width at y 368. One vertical axis, no lateral offset.

## 3. Craft signals, present

**`real-product-surface`** — present. The root URL serves the product: ten job cards (250px each, y 455–3190) with company logos fetched from Supabase storage, title, salary band, location, tech stack, relative post time, and Apply links that point at real ATS records. This is the product's own interface at rest, not a marketing mockup.

**`shows-deliverable`** — present, and the embarrassing entry is nameable. Rows 5 and 6 are the same requisition twice over: "Principal Engineer Capacity/Compute" at Anthropic in adjacent cards, both Staff+, both $320k–$485k/yr, both "2 hours ago", differing only in location (Seattle vs New York). The page's own band claims "Zero Spam — No ghost jobs, reposts, or sponsored listings". A duplicate posting sits ten pixels below that claim in the live feed. Second entry: the Red Team card's company is rendered "Backblaze External Website", a scrape artefact visible as a job field. Neither can flatter; both could be fixed and were not.

**`single-optical-anchor`** — present by placement reading (rule-ineligible signal; this is the honest call). The feed is 2,735px of a 5,900px page and is the only mass of any weight. The nearest competitor is the 1,208px testimonial wall, which reads as a further page of the same centred column rather than a second mass. Recorded caveat: the feed dominates partly because there is only one mass, and the page is a single centred column throughout.

**`density-variation`** — present, weakly. The feed is dense and list-like (10 cards at ~250px); between it and the footer sit three much airier centred bands (the 496px signup band, the 1,208px wall, the 508px FAQ panel). The rhythm changes measure, not merely colour.

**`one-accent-discipline`** — present. Emerald `rgb(16,185,129)` is the only accent: Sign Up, Apply, the salary chips (`rgba(16,185,129,0.1)`), the H1's "Faster" span, and the four band icons. 83 elements carry it. The only other chromatic fill is amber `rgb(251,191,36)` on the five rating stars, which is semantic (a rating, not a second brand hue). Zero-accent would also count present; this is one accent.

## 4. Near-misses

- **`gradient-fill-cta`** — could go present on the H1 alone. The H1's "Faster" is `bg-clip-text` over `linear-gradient(to right, rgb(52,211,153), rgb(16,185,129))`. But the signal is a multi-stop gradient on a *primary button*; every primary button (Sign Up, Apply, the band CTA) is a flat `rgb(16,185,129)` with `background-image: none`. A gradient-filled headline word is not a gradient-fill CTA. Absent.
- **`gradient-blob`** — one gradient exists: `linear-gradient(rgba(0,0,0,0), rgba(17,24,39,0.9), rgb(17,24,39))` on an absolutely positioned 1216x784 block at y 2919, with a mask-image fade. It is a bottom-of-feed fade so the dense list does not cut hard into the signup band. A scrim is not a blob. Absent.
- **`badge-pill-spam`** — the page is pill-adjacent: "Senior / Staff+", "$190k - $260k/yr", location, tech tags, `+3 more`. All are 6px-radius chips *inside the job cards*, i.e. inside the product surface, and the scope rule excludes them. In marketing chrome above the fold there are six filter triggers (151/134/127/156/169/197px wide, 46px tall, 6px radius) and no pill shapes at all. Absent.
- **`indigo-violet-accent`** — no purple or violet anywhere; the only hues are emerald and amber. The Tailwind grey ramp (gray-900/800/700) carries everything else. Absent.
- **`type-scale-high-contrast`** — 40px largest prose node against 16px body = 2.5:1, well under 3.75. Even the secondary 30px section heads give 1.875. Absent, cleanly.
- **`scroll-reveal-blank`** — at scroll 0, zero of the visible h1–h4/p nodes have opacity < 1 or a non-`none` transform, and at settle nothing is pending. The senja embed sets `data-lazyload="false"`. Absent, no dwell control needed.
- **`custom-type-pairing`** — absent for the reason `generic-sans-default` is present: one family, 142 of 142 elements. The Inter `<link>` is dead weight, not pairing.
- **`live-claim-control`** — the closest case. Six labelled filters ("Location", "Salary", "Level", "Specialty", "Tech Stack", "H1B Sponsorship") let a visitor narrow the feed, and the H1 subhead says "Filters that actually work." But the claim the page needs falsifying is its supply claim ("60,000+ jobs scraped hourly", "no ghost jobs"), and no visible affordance lets a visitor check either. The filters are the product's normal input, not a control offered to test a claim. Absent.
- **`hero-mockup-float`** — the feed at the root is not a floating glass mockup; it is the page at rest. Absent.
- **`stock-photo-generic`** — no photography except 32px Senja avatars and 48px company logos; logs, not stock. Absent.
- **`emoji-as-icon`** — zero emoji in text. Amber stars are `lucide-star` SVGs with `fill`, not glyphs. Absent.
- **`glass-card-overuse`** — zero elements with a `backdrop-filter` other than `none`. Absent.
- **`density-variation` vs `editorial-grid-break`** — I gave the first and withheld the second. The page alternates dense/sparse vertically but every section stays inside the same `max-w-7xl` (1216px) column; nothing breaks the grid. `editorial-grid-break` absent.
- **`asymmetric-split`** — every section is full-width or centred; no lateral offset at 1440px. Absent.
- **Cohort caveat** — the page is a Vite/React app rather than a Lovable/Bolt template, but the ai-builder cohort is decided by its sampling source, not by the stack, and the instruction says treat it as valid.

## 5. Verdict

Slop present: 6 — `three-card-row`, `generic-sans-default`, `symmetric-everything`, `generic-line-icon-set`, `testimonial-card-row`, `centered-hero-stack`.
Craft present: 5 — `single-optical-anchor`, `real-product-surface`, `shows-deliverable`, `density-variation`, `one-accent-discipline`.

Net = 6 − 5 = **+1**. Verdict: **mixed**.

The corpus at +3 (deepmark, stripe-2014) is the near-neighbour band, and this page is below it, so no rounding pressure exists. What separates it from the +3 pages downward is that its four structural negatives (`editorial-grid-break`, `custom-type-pairing`, `type-scale-high-contrast`, `asymmetric-split`) are all plain default-template decisions, and its slop set is the whole stock marketing skeleton: centred hero, three-up feature row, six quote cards, one icon set, one system font. What holds it out of slop is not slickness but the feed: ten real requisitions with working external ATS links, real company logos, and, in the duplicate Anthropic card, a thing on the page that counts against the page's own "Zero Spam" claim. A page that shows its product erring is not a page that has nothing.

Against the +4/+5 slop files, the difference is legibility of the product: heroku-2014 and openhack carry their slop signals over a page with no product at all, where grepjob's slop signals sit around a genuine working list. If a second rater reads the feed as decorative rather than as product, `real-product-surface` and `shows-deliverable` both collapse and this page becomes slop. That is the single contested reading to check, and I record it here rather than rounding.

## 6. Drift

Not applicable: new page, no prior evidence file.
