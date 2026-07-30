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

## Cause 1 — five components burn 96% of the CPU

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
- **Every DOM assertion can pass while the page is visibly wrong.** The sidebar
  regression survived correct `src` attributes, 200 responses, cache HITs and a
  clean typecheck. It took one screenshot to see. When a change alters what
  renders, look at it.
