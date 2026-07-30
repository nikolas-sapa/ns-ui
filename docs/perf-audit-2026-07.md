# Performance audit — July 2026

Triggered by a report that the site felt slow. Everything below is measured, not
inferred. Method: Playwright, Chromium, `Emulation.setCPUThrottlingRate` rate 4
(mid-tier laptop), viewport 1440x900, against production
(`design.helpmarq.com`) unless stated.

## The complaint was not about loading

Loading was already fine. On a warm CDN hit the homepage does:

| metric | value |
| --- | --- |
| TTFB (cache HIT) | 174ms |
| DOMContentLoaded | 303ms |
| FCP / LCP | 492ms / 572ms |
| HTML on the wire (brotli) | 97KB (843KB decompressed) |
| initial JS (brotli) | ~225KB across 12 chunks |

What was wrong is what happens *after* the page loads:

| window (no scroll, no input) | Total Blocking Time |
| --- | --- |
| 0-5s (boot) | 2384ms |
| 5-15s | 7367ms |
| **15-25s (steady state)** | **7209ms** |

The main thread stayed ~72% blocked **indefinitely**, with the page idle and
untouched. That is the "slow": the page paints quickly and then never becomes
responsive — scrolling stutters and every interaction lands late.

## Read this before trusting any number below

Total Blocking Time on this hardware is dominated by **machine state**, not by
the page. The same unmodified component measured 5606ms while other agents' dev
servers and builds were running (load average 13-18) and **32ms** on the same
production URL once the machine was quiet (load ~3). That is a 175x swing with
zero code change.

Consequences, and they are not small:

- Every absolute TBT figure below is only meaningful next to a control measured
  in the same minute. Where a control is not quoted, treat the number as a
  ranking signal at best.
- The per-component "before -> after" wins reported further down were measured
  back-to-back under load. They are real *under CPU contention* — which is
  exactly the condition a visitor on a mid-tier laptop is in, and the condition
  the original complaint came from — but they do **not** reproduce on an idle
  machine, where most of these components already measure near zero.
- The headline homepage number did **not** improve. See below.

## Cause 1 — five components burn 96% of the CPU *under contention*

All 222 components were profiled individually at
`/preview/<name>?embed=1&autoplay=1` (8s window, 3s after load).

- **205 of 222 measure exactly 0ms.**
- 7 exceed 200ms.
- The top 5 account for **96%** of the library's total blocking time.

The sweep ran 4 browsers in parallel, which inflates absolutes through CPU
contention, so the top 5 were re-measured **serially** against production. Both
columns below; the serial column is the one to trust.

| component | TBT / 8s (serial) | TBT / 8s (parallel sweep) |
| --- | --- | --- |
| frost-scrub | **6231ms** | 8219ms |
| solari-flap | **5043ms** | 4895ms |
| chroma-tide | **4432ms** | 4369ms |
| glyph-tide | **4146ms** | 3495ms |
| particle-hero | **1344ms** | 6511ms |
| scarp-horizon | *(not re-run)* | 551ms |

The sweep's ranking held for four of five. `particle-hero` was the exception —
inflated roughly 5x by contention, and at 1344ms it is the mildest of the group,
doing largely legitimate shader-side work rather than thrashing. It was left
alone. Treat any single-number claim from a parallel sweep as a ranking signal
only.

`frost-scrub` alone pegs the main thread at ~100%. `glyph-tide` is the **first
card on the homepage**, so the worst-feeling frame mounts first.

The shared pathology: each is a full-viewport canvas doing per-pixel or
per-cell work every frame — `getImageData`/`putImageData` loops, per-cell
`fillText`, per-frame `getComputedStyle` — sized to the 1440x900 iframe even
though the card displays it CSS-scaled to roughly 380px wide.

This is a handful of component bugs, not an architectural problem. The iframe
architecture (`preview-card.tsx`) is sound: 205 components run in it for free.

## Cause 2 — every preview route was uncacheable

`app/preview/[name]/page.tsx` awaited `searchParams`, which makes the route
fully dynamic. Neither it nor `play` appeared in `.next/prerender-manifest.json`
at all — only `/writing/[slug]` (the one route with `generateStaticParams`) was
cached. Both served:

    cache-control: private, no-cache, no-store, max-age=0, must-revalidate
    x-vercel-cache: MISS        (on every request, always)

Per single homepage load that meant:

- 4-12 uncached function invocations for the card iframes, and
- ~38 more for `/preview/<name>/play`, because each card title is a `next/link`
  and Next prefetches every link near the viewport (measured: 19 distinct play
  routes, requested twice each).

So one visitor triggered roughly 50 uncached SSR renders, none of which could be
shared with the next visitor. The function region is `iad1` while the edge is
`fra1`, so each one also crossed the Atlantic.

## Cause 3 — analytics ran once per card

The root layout wraps every route, and a card renders a preview route inside an
iframe, so each mounted card booted its own `@vercel/analytics` **and**
`@vercel/speed-insights`. Measured on the live homepage: both scripts fetched
**5x** on a single load. Besides the wasted requests, this inflates every
pageview and vitals sample by the number of visible cards.

## Fixes applied

1. **New `app/preview/[name]/embed` route.** Same markup as
   `?embed=1&autoplay=1` with the flags in the path instead of the query string,
   so it prerenders. `preview-card.tsx` and `featured-card.tsx` now point at it.
   `/preview/[name]` is untouched — `verify.ts`/`record.ts` screenshot it, and
   `?embed=1&interactive=1` (the playground frame) still needs the dynamic form.
2. **`generateStaticParams` + `revalidate` on `/preview/[name]/play`.**
   Declaring the function at all is what moves a route out of the always-dynamic
   bucket. Both new routes return an empty param list on purpose: prerendering
   218 client-component pages at build buys nothing over caching the first
   request for each, and avoids a build-time risk on demos the build has never
   exercised.
3. **`SiteAnalytics`** — mounts Analytics/SpeedInsights only when
   `window.self === window.top`, so frames skip them.
4. **`SiteShell` now treats `/preview/<name>/embed` as a bare preview.** The
   original `isBarePreview` pattern only matched a single path segment, so the
   deeper `/embed` path fell through and every card rendered the whole site
   sidebar inside its own iframe. Every DOM assertion still passed — correct
   iframe `src`, 200s, cache HITs — and it was only caught by looking at a
   screenshot. It also silently corrupted a round of measurements, because a
   demo squeezed next to a sidebar does far less work.

5. **Three of five components were optimized; one was reverted, one was a wash.**

Measured with the *same* harness on both sides (rate-4 CPU throttle, 8s window
3s after load) — production for "before", a local production build for "after".
Three untouched components were measured on both to prove the two environments
are comparable: `scarp-horizon` 1025 vs 1153, `ascii-dither-media` 29 vs 14,
`torus-render` 0 vs 0. Without that control the numbers would be worthless.

| component | before | after | |
| --- | --- | --- | --- |
| frost-scrub | 5606ms | **382ms** | -93% |
| chroma-tide | 2571ms | **1999ms** | -22% |
| glyph-tide | 4585ms | **3658ms** | -20% |
| solari-flap | 4908ms | 4977ms | reverted |
| particle-hero | 1584ms | 2088ms | unmeasurable |

- **frost-scrub** was the real prize and the diagnosis had been wrong: the
  per-pixel `getImageData` loops run once in setup, not per frame. The cost was
  the *fragment shader* (15 texture samples per pixel) running at the full
  1440x900 backing store — for a thumbnail displayed at ~380px. The iframe
  cannot see the parent's CSS transform, so `clientWidth` still reports 1440.
  Capping the backing-store dpr to 0.6 *only* when the card marker
  `[data-autoplay-root]` is present fixes it; the reference page that
  `verify.ts` screenshots is byte-identical to before.
- **solari-flap was reverted.** The hypothesis (skip the forced reflow when a
  cell is already settled) was sound but bought nothing: 4908ms -> 4977ms across
  three runs each, with tight variance. 23 lines of added state for no gain is
  a bad trade. It remains the worst component in the library at ~4.9s and is
  the obvious next piece of work.
### Correction: the homepage did not improve

The `-12%` homepage figure first recorded here (7503ms -> 6634ms) did not
survive. Re-measured on a quiet machine, three interleaved runs each:

    production  steady = 5915 / 6249 / 6290 ms
    with fixes  steady = 6121 / 6101 / 6043 ms

That is run-to-run variance, not an improvement. **The shipped component work
does not measurably speed up the homepage.** It was worth finding out why.

## Cause 1b — what actually blocks the homepage: live scaled iframes

A sequence of ablations on the same build, same machine, back to back:

| homepage variant | steady-state TBT / 10s |
| --- | --- |
| as shipped (4 featured frames mount, 2 visible) | ~4400-6100ms |
| catalog card iframes disabled | unchanged (~6300ms) |
| **all featured iframes disabled** | **0ms** (3/3 runs) |
| featured frames capped to 2 instead of 4 | unchanged (~4600ms) |
| featured frames with autoplay off | unchanged (~5000ms) |
| featured frames unscaled (`scale(1)`, card clips) | ~2900ms |

And, measured individually against the same local build, each of the four
featured components scores **0ms in isolation** at a full 1440x900 viewport.

So the cost is not the components, not the catalog, not the host page, not
autoplay, and not the number of frames past the first couple. It is inherent to
the design the homepage copy advertises — *"every card below is the real
component running live"* — specifically **a continuously-repainting 1440x900
iframe being CSS-scaled to ~26% in the parent document**. Roughly 40% of it is
the scale transform; the rest is simply having live animating documents
composited into the page.

Nothing in this PR changes that, and no per-component optimization can. The
levers that would are all product decisions:

- render a poster frame (static image or short video) and only go live on hover
  or click;
- size the iframe to its displayed size instead of 1440x900 (cheap, but breaks
  the viewport-fidelity invariant `preview-card.tsx` exists to protect);
- keep fewer featured cards above the fold.

Recommended next step: measure a poster-frame prototype for the featured rail
before writing any more component-level optimizations.

### On the components anyway

- **particle-hero is not a perf bug** and should never have been on this list —
  its 6511ms came from the contended parallel sweep. Its motion is already
  shader-side and `getComputedStyle` runs only on mount. Its measurements swing
  from 193ms to 3252ms run to run (particle seeds are `Math.random()` per
  mount), so no change is measurable at this precision. The one edit kept —
  reusing a scratch `THREE.Vector2` instead of allocating one per frame — is
  behaviour-identical and removes an allocation, so it is kept on correctness
  grounds, not on a claimed speedup.

Verified against a local production build and server:

| route | before | after |
| --- | --- | --- |
| `/preview/<name>/embed` | *(did not exist)* | `● SSG`, `x-nextjs-cache: HIT`, `s-maxage=3600` |
| `/preview/<name>/play` | `ƒ` dynamic, `no-store`, MISS | `● SSG`, `x-nextjs-cache: HIT`, `s-maxage=3600` |

Unknown slugs still 404, and `/preview/<name>?embed=1&autoplay=1` still returns
200.

## Deliberately not done

- **The inline RSC payload.** The homepage serializes the whole 222-item catalog
  into the HTML for the client-side `Showcase`. Decoded field sizes: `prose`
  80,997B, `description` 52,561B, `tags` 18,288B — ~152KB of the ~178KB payload.

  `prose` is the tempting target: 81KB, and `grep -rn '\.prose\b' app/ lib/`
  finds exactly one consumer, the search haystack builder in
  `showcase.tsx:180-191`. It is never rendered. But it cannot simply be replaced
  by a precomputed haystack, because a haystack *contains* the prose text plus
  the title/description/tags already shipped for rendering — that trades 81KB
  for something larger. Actually shrinking this means either dropping prose from
  the search corpus (a search-quality decision, not a perf fix) or building a
  compact token index. Left alone deliberately; the number is recorded here so
  the trade is a choice rather than an oversight.

  Note this is a parse cost, not a bandwidth one: 843KB of HTML compresses to
  97KB brotli on the wire.
- **`regions: ["fra1"]`.** The edge is Frankfurt and the function is US East.
  Setting this needs a `vercel.json` and changes deploy behaviour for every
  route, so it is an owner decision. With the routes now CDN-cached it also
  matters much less.
- **`MOUNT_CAP = 12`** (`showcase.tsx:48`) still keeps up to 8 off-screen frames
  live. Lowering it cuts background work but makes cards pop in on scroll — a
  UX trade, not a free win, and far less relevant now the expensive components
  are fixed.
- **The playground's own iframe** (`?embed=1&interactive=1`) is still one dynamic
  invocation per playground visit. One request per page, left alone.
- **solari-flap** (~4.9s TBT) is still unfixed — the one attempt did not work
  and was reverted rather than shipped. It is now the single worst component in
  the library.

## If you repeat this

Two process notes that cost real time here:

- **A parallel profiling sweep gives you a ranking, not numbers.** Running 4
  throttled browsers at once inflated `particle-hero` roughly 5x and sent an
  agent off to fix a component that was not broken. Re-measure any candidate
  serially before acting on its number.
- **Check the machine before believing a profile.** `uptime` first. Under load
  average 13-18 this codebase profiled 175x worse than at load 3, and that noise
  is what drove most of the component work here. An A/B is only valid measured
  back-to-back in the same conditions, and an absolute number without a control
  measured beside it is not evidence.
- **Ablate before optimizing.** Deleting the suspected cost (here: rendering the
  featured iframes not at all) took ten minutes and would have redirected the
  entire effort on day one. Five agents optimizing five components never had a
  chance to answer "is it the components at all?" — only turning them off did.
- **Every DOM assertion can pass while the page is visibly wrong.** The sidebar
  regression survived correct `src` attributes, 200 responses, cache HITs and a
  clean typecheck. It took one screenshot to see. When a change alters what
  renders, look at it.

---

## Resolution (shipped)

The architectural finding above — that the homepage cost is live scaled iframes,
not components — was acted on. The featured rail now renders in three layers:

1. **the still**, the screenshot the quality gate already generates. Paints
   immediately, is the LCP element, theme-correct with no JS.
2. **the loop**, a silent 6s recording per component per theme
   (`scripts/build-previews.ts`), fetched only near the viewport and faded in on
   the video's own `playing` event. Video decode is GPU work, so the card moves
   at rest for free. Skipped entirely under `prefers-reduced-motion` — gating the
   element, not just its visibility, because hiding it in CSS still downloads it.
3. **the real component**, mounted on pointer-enter or focus, for anyone who
   wants to confirm the card is not a marketing video.

Recordings are committed rather than built: capturing needs a running server,
which a Vercel build does not have. 72 files, 2.7MB in the repo; a visitor
fetches the two on screen.

Link prefetching is also off on the card titles and the sidebar. The sidebar
lists all 222 components, and Next prefetches every link near the viewport —
~126 RSC requests per page load for a list a visitor picks one item from.

Measured like-for-like, both on Vercel, 4x CPU throttle, three interleaved runs:

| | before | after |
| --- | --- | --- |
| TTFB | 206ms | 182ms |
| FCP | 596ms | 440ms |
| LCP | 596ms | 516ms |
| CLS | 0 | 0 |
| TBT (load phase) | 1700ms | 202ms |
| **TBT (steady state)** | **3521ms** | **0ms** (0/0/0) |
| requests | 61 | 53 |
| transfer | 688KB | 864KB |

Transfer is the one regression and it is the honest price of motion: ~176KB of
video for the cards actually on screen. Everything else improved, and the
indefinitely-blocked main thread that prompted the audit is gone.

### What this cost that a profiler would not have told you

The first fix shipped stills only. It measured beautifully and was wrong: a rail
of frozen thumbnails reads as broken, and requiring a hover before anything
moves is a worse experience than the slowness it cured. The number improved and
the product got worse. Video was the answer to both, and it only surfaced
because someone looked at the page instead of the metric.
