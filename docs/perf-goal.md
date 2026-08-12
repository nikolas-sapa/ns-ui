# ns-ui Performance Goal

Baseline: Vercel Speed Insights, Production, **Desktop**, Last 7 Days, 256 data points.
Captured 2026-08-12. Lab cross-check: Playwright, 1440x900, fast connection.

This document is the brief. Paste the "Goal Prompt" section into a fresh session
to run the work.

---

## 1. Why this keeps repeating

Every prior pass fixed a symptom and shipped. Nothing measured the same numbers
before and after, and nothing blocked a regression from landing. So the next
feature reintroduced the cost and the cycle restarted.

The non-negotiable output of this round is therefore **a regression gate**, not
just a set of fixes. If the gate does not land, this round has failed regardless
of what the numbers do.

---

## 2. Baseline (do not re-measure by hand, these are the targets to beat)

| Metric | P75 now | Threshold | Status |
| --- | --- | --- | --- |
| FCP | 1.99 s | < 1.8 s | **FAILING** |
| TTFB | 0.78 s | < 0.8 s | passing by 20 ms |
| INP | 176 ms | < 200 ms | passing by 24 ms |
| LCP | 2.32 s | < 2.5 s | passing by 180 ms |
| CLS | 0.07 | < 0.1 | passing |
| FID | 18 ms | < 100 ms | passing |
| RES | 96 | > 90 | passing |

Per-metric sample counts: FCP 60, LCP 60, INP 71, CLS 65, FID 36, TTFB 66.

### Field vs lab gap

Lab TTFB was 39-195 ms across 7 routes. Field P75 is 780 ms, and Greece — 49 of
66 TTFB samples — is at **1.43 s**. The gap is the whole problem. Do not tune
against lab numbers; they hide it.

### Worst routes (TTFB, field)

| Route | TTFB | Samples | Note |
| --- | --- | --- | --- |
| `/changelog` | 15.61 s | 1 | lab says 39 ms → cold start / ISR miss, not steady state |
| `/preview/hero-ascii-schlieren/play` | 4.17 s | 3 | |
| `/components/[name]` | 3.53 s | 3 | |
| `/status` | 2.21 s | 7 | has `revalidate = 3600` yet still slow — verify it takes effect |
| `/account` | 1.86 s | 7 | auth'd, expected dynamic |

### Worst interaction (not visible in the P75 summary)

| Selector | INP | Samples |
| --- | --- | --- |
| `#site-nav>div.min-h-0.flex-1.overflow-y-auto.px-2.pb-6` | **2560 ms** | 2 |
| `#main>main.mx-auto.w-full.max-w-[1600px].px-6.pb-32.sm:px-10` | 840 ms | 1 |
| `a.rounded-sm.outline-none.hover:text-foreground.focus-visible:ring-2...` | 576 ms | 2 |

Scrolling the nav sidebar costs 2.5 s to next paint. Two samples hide it inside a
176 ms P75. This is a broken interaction, not a slow one.

### CLS

`footer.mt-16.border-t.border-border.px-6.py-8...` at 0.11 across 6 samples.
Routes `/account` 0.11, `/components/background-ascii-wake` 0.13, `/components/sand-lock` 0.12.

### Lab-only findings (real, but secondary)

Homepage `/`: 203 requests vs 68 on every other route, 464 ms blocking across 4
long tasks, one 491 KB JS chunk. Driven by the card grid mounting a
`/preview/<name>/embed` iframe plus an `.mp4` per visible card.

**These do not explain the FCP failure. TTFB does.** Fix in that order.

---

## 3. Data quality caveats — read before trusting any row above

- 256 data points total. Route rows are 1-7 samples each.
- Route and selector numbers are **leads to reproduce**, not measurements.
  Reproduce each before fixing it. A 1-sample 15.61 s row is one unlucky cold
  start, not a 15-second route.
- Desktop only. Mobile was not captured and may differ materially.
- Hobby plan: 7-day window, 10k events/month (currently 1.5k, not capped).

---

## 4. Non-goals

- Do **not** touch the iframe gate in `app/_components/site-analytics.tsx`.
  It correctly suppresses duplicate Analytics/Speed Insights boots inside card
  iframes. Removing it inflates sample counts and corrupts the numbers this work
  is judged by.
- Do not chase the homepage bundle before TTFB is fixed.
- Do not optimize `/preview/*/play` routes for FCP. They are demo players; slow
  first paint there is not a user-facing product problem.
- No new dependencies. No new abstractions. No rewrites.
- Do not upgrade the Vercel plan as part of this work. That is the owner's call.

---

## 5. Goal Prompt

> Copy everything below into a fresh session.

```
Optimize ns-ui performance against measured field data. Read docs/perf-goal.md
first — it holds the baseline, the per-route leads, and the non-goals. Treat the
non-goals section as binding.

Success is defined numerically. All targets are Vercel Speed Insights P75,
Production, Desktop, 7-day window:

  T1  FCP    1.99s -> < 1.75s        (currently FAILING, primary goal)
  T2  TTFB   0.78s -> < 0.55s        (root cause of T1)
  T3  INP    176ms -> < 150ms        (headroom against the 200ms cliff)
  T4  LCP    2.32s -> < 2.1s
  T5  CLS    0.07  -> <= 0.07        (hold, do not regress)
  T6  worst-selector INP 2560ms -> < 500ms
  T7  a CI perf budget gate exists and fails a PR that regresses any of T1-T5

T7 is not optional. Without it this work gets undone by the next feature, which
is the entire reason this document exists.

Work in this order. Do not start a phase before the prior one is verified.

PHASE 0 — Reproduce, in a worktree
  Confirm each lead in docs/perf-goal.md section 2 is real before touching it.
  For each slow route: is it static, ISR, or dynamic? Is it a cold start, a cache
  miss, or genuinely slow server work? `curl -w` timing against prod plus the
  Vercel cache headers (x-vercel-cache) settles it. Rank by
  (field samples x severity), and write the ranked list down. Kill any lead that
  does not reproduce and say so explicitly.

PHASE 1 — TTFB (owns the failing metric)
  Targets T1, T2. The leads: /changelog, /components/[name], /status, /account.
  /status already declares `export const revalidate = 3600` yet reports 2.21s —
  find out why that is not taking effect before changing anything else.
  Greece is 49/66 samples at 1.43s; determine whether this is origin region
  placement, a cache-miss rate problem, or slow server work, and fix the actual
  one. Do not guess.

PHASE 2 — INP
  Targets T3, T6. Start with #site-nav's overflow-y-auto scroll container at
  2560ms. Find what runs on scroll/interaction in the nav. Then the main element
  at 840ms and the nav anchor at 576ms.

PHASE 3 — Homepage weight
  Target T4. 203 requests, 464ms blocking, 491KB chunk, all from the card grid.
  Below-fold cards should not mount iframes or fetch .mp4 until intersection.
  Poster images until then. Measure before and after.

PHASE 4 — CLS
  Target T5. The footer selector at 0.11 across 6 samples. Reserve its space.

PHASE 5 — The gate (T7, mandatory)
  Add a perf budget check to CI that runs the lab harness against the key routes
  and fails on regression past a threshold. Lab numbers are a proxy — they missed
  this entire TTFB problem — so the gate catches bundle/blocking regressions and
  must be documented as such in the file itself. Keep it small: one script, one
  CI step, no framework.

RULES
  - Work in a git worktree, isolated from the current branch.
  - Verify each phase against real numbers before moving on. Lab measurement for
    bundle and blocking; prod curl timings for TTFB. State plainly when a fix did
    not move its metric.
  - One reviewed commit per phase. Do not self-commit from subagents — report
    changes back and let the orchestrator commit.
  - Surgical edits. Match surrounding style. Do not touch adjacent code.
  - Field verification of T1-T6 requires ~7 days of new RUM data after deploy.
    Do not claim those targets met from lab numbers. Say what is verified and
    what is pending.

DELEGATION
  Phase 1 -> backend agent (caching, ISR, server work)
  Phase 2, 3, 4 -> frontend agent
  Phase 5 -> build agent
  Review before each commit -> reviewer agent
  Phases 2, 3, 4 are independent of each other and can run in parallel once
  Phase 1 lands. Phase 1 must go first — it owns the only failing metric.
```

---

## 6. Phase 0 results — measured 2026-08-12 from Greece

Method: `curl -w` against prod, warm and query-busted, reading `x-vercel-cache`
and `x-vercel-id`. 5 samples per route.

### Systemic finding (this is the real one)

`serverlessFunctionRegion = "iad1"` — Washington DC. Confirmed via the Vercel
projects API. `x-vercel-id` on any origin-bound route reads `fra1::iad1::…`:
Frankfurt edge, **US-East origin**. Greek traffic (49 of 66 TTFB samples) pays a
transatlantic hop on every cache miss.

There is no `regions` key in `vercel.json` and no `preferredRegion` export
anywhere in `app/`, so `iad1` is the project-level default doing this.

### Measured TTFB, 5 samples each (seconds)

| Route | samples | cache | verdict |
| --- | --- | --- | --- |
| `/` | .222 .167 .173 .226 .177 | HIT | fine |
| `/status` | .156 .221 .150 .197 .153 | PRERENDER | fine |
| `/changelog` | .150 **.762** .184 .242 .166 | HIT | fine, one revalidation spike |
| `/components/sand-lock` | .206 .145 .219 .147 .218 | HIT | fine |
| `/components/hero-ascii-schlieren` | .139 **.559** .385 .265 .198 | HIT | fine, spiky |
| `/account` | .404 .303 .505 .348 .409 | **MISS every time** | slowest, origin-bound |

Query-busting does not force a miss — Vercel ignores query strings for
static/ISR cache keys. Cold-origin cost could not be isolated this way.

### Lead verdicts

| Lead | Field | Verdict |
| --- | --- | --- |
| `/changelog` 15.61 s | 1 sample | **KILLED.** Warm 0.15-0.24 s. One cold start, not a route problem. |
| `/preview/hero-ascii-schlieren/play` 4.17 s | 3 samples | **KILLED.** 0.15 s, no cache header. Does not reproduce. |
| `/status` 2.21 s | 7 samples | **KILLED as a code problem.** The `revalidate` concern in §2 is already fixed — `app/status/page.tsx` wraps both Convex reads in `unstable_cache` and documents exactly this failure mode. Serves PRERENDER at 0.15-0.22 s. |
| `/components/[name]` 3.53 s | 3 samples | **PARTIAL.** 0.14-0.56 s. Magnitude does not reproduce; spikes are cold-function-on-revalidation. |
| `/account` 1.86 s | 7 samples | **CONFIRMED.** Only route that misses cache every time. Origin-bound, so it eats the iad1 hop in full. |

### Ranked by (samples x severity)

1. **Origin region `iad1` for a European audience.** Systemic — affects every
   MISS and every revalidation across all routes. One setting, cheap to revert.
2. **`/account`, 7 samples.** Always MISS. Auth'd, so it is legitimately
   dynamic; the fix is the hop, not the route.
3. `/components/[name]`, 3 samples. Cold-start spikes on revalidation only.

Everything else in §2 is noise from 1-3 sample rows, as §3 warned.

### Caveat on the gap

These numbers were taken from Greece on a fast connection and are 2-4x better
than the field P75 (0.78 s). The remainder is real-user network conditions —
mobile links, cold DNS/TLS — which no code change removes. Moving the origin
closer shrinks the fixed component that every one of those users pays.

### Open question blocking Phase 1

Convex lives at `useful-peccary-556.convex.cloud`, behind Cloudflare anycast, so
its backend region could not be read from DNS. Measured 0.17-0.47 s from Greece,
consistent with a US backend. If so, moving Next functions `iad1 -> fra1` makes
the function→Convex hop *longer* for any route that calls Convex on the request
path. The server-side Convex reads in `/status` are already wrapped in
`unstable_cache` and off that path, but the `force-dynamic` routes under
`app/api/` are not audited yet. Phase 1 must settle this before the region moves.

---

## 7. Phase 1 findings — the region lead is DEAD, and T2 is not reachable

### Measurement method that mattered

First attempt compared raw `time_starttransfer` across routes and produced
nonsense: it implied the Frankfurt→Washington round trip cost ~30 ms. Every
`curl` opens a fresh connection, so the handshake dominated and swamped the
signal. Correct method:

```
curl -w "%{time_appconnect} %{time_starttransfer}"
server_think = time_starttransfer - time_appconnect
```

Controls must be chosen by where they actually execute, read from `x-vercel-id`:
`fra1::` alone is edge-only, `fra1::iad1::` reached the origin. `/api/saves`
looked like a good control and is not — it returns `fra1::` only, never reaching
iad1. `/api/me` is the correct control: it reaches iad1 and returns
`{signedIn:false}` *before* its Convex call.

### Decomposition, 12 samples, medians

| Probe | Executes | server_think |
| --- | --- | --- |
| `/categories` | `fra1::` edge HIT | 69 ms |
| `/api/me` | `fra1::iad1::`, no Convex call | 186 ms |
| `/api/health` | `fra1::iad1::`, one Convex query | 190 ms |

- **iad1 origin hop = 186 − 69 = 117 ms.** Real, and consistent with
  transatlantic RTT.
- **Convex RTT from iad1 = 190 − 186 = 4 ms.** Convex is co-located with iad1.

### Conclusion: do NOT move the region

Moving `serverlessFunctionRegion` to `fra1` removes 117 ms from the user hop and
adds ~117 ms to every server-side Convex call. 17 files call Convex on the server
and only `/status` caches those reads. Hobby allows one function region, so the
choice is "near users" or "near Convex" — and since almost every dynamic route
touches Convex, **iad1 is already the correct setting**. No change.

Correction to §6: `/account`'s three `fetchQuery` calls in
`_account-data.tsx:31-33` run inside one `Promise.all`. That is one Convex RTT,
not three. `/account` missing cache on every request is correct behavior for an
authenticated route, not a defect.

### T2 is not reachable server-side — restate it

Of 66 field TTFB samples, ~21 are origin-bound (`/account` 7, `/status` 7,
`/components/[name]` 3, `/preview` 3, `/changelog` 1). The other ~45 are edge
HITs that never touch iad1, so no origin change can move them.

Edge HIT server_think is 69 ms, yet field TTFB P75 is 780 ms and Greece is at
1.43 s across 49 samples. The difference is client network — DNS, TCP, TLS, and
slow last-mile links — which no server change touches. The origin-attributable
share of the P75 budget is at most the 117 ms hop on ~32% of navigations.

**T2 (`TTFB P75 < 0.55s`) cannot be met by server-side work and should not be
ground against.** Replace it with a per-route target that is actually ours:

```
T2'  server_think on origin-bound routes: 186ms -> < 140ms
     (measured with the appconnect split above, not raw TTFB)
```

T1 (FCP) remains the real goal, but its lever is render and blocking work —
Phases 2 and 3 — not TTFB.

---

## 8. Phase 2 findings — INP is presentation-bound, and 2560 ms does not reproduce

### What the field number actually means

The selector `#site-nav>div…overflow-y-auto…` is the *interaction target*, and
**scroll is not an INP interaction** — INP counts click, tap and keypress only.
So the 2560 ms row is a click on a nav link, not slow scrolling.

### Reproduction, Playwright + `PerformanceObserver({type:'event'})`, 4x CPU throttle

The consistent, reproducible finding is the **breakdown**, not the magnitude:

```
duration 1056 ms   input delay 24 ms   processing 0-7 ms
```

Processing is effectively zero across every run. The click handlers are not
slow. Essentially the entire duration is **presentation delay** — the paint after
the handler returns. Any fix aimed at handler JS is aimed at the wrong thing.

### Magnitude does not reproduce

| Page | DOM nodes | worst interaction | p75 |
| --- | --- | --- | --- |
| `/install` | 1,762 | 72-304 ms | 72 ms |
| `/` (grid unmounted) | 9,676 | 160 ms | 120 ms |
| `/` (grid mounted) | 1,766 | 408 ms | 72 ms |
| `/` (first run, hover) | — | 1,056 ms | — |

Local worst is ~1 s against a field figure of 2560 ms from **2 samples**, so the
field number is a slow real device, not something reproducible here.

### Hypothesis tested and REJECTED

*"The homepage card grid inflates the DOM, so every interaction pays a page-wide
paint."* Rejected: 9,676 nodes produced a 160 ms worst interaction while 1,766
nodes produced 408 ms. Inverted, so DOM node count does not drive paint cost
here. The grid virtualizes — node count falls after scrolling as cards recycle —
which is already the behavior Phase 3 was going to introduce.

Not carried forward. Recorded so it does not get re-proposed.

### Honest status

Root cause is **not** established. What is established:

1. Interaction cost is presentation/paint-bound, never handler-bound.
2. The nav carries 452 `<a>` elements in the DOM on every page.
3. Interaction cost on `/install` (light) is materially lower than on `/`, but
   the relationship is noisy and does not track DOM size.
4. T6 (`2560 ms -> <500 ms`) rests on 2 field samples. It is not a safe target
   and local measurement cannot verify it.

Next probe if this is resumed: Chrome DevTools performance trace of a single nav
click on `/`, reading the actual paint/style-recalc breakdown, rather than
inferring from event timings. That is what separates "large style recalc" from
"compositor-blocked by canvas/video work".

---

## 9. Phase 4 findings — CLS mechanism confirmed, fix deliberately NOT shipped

### Mechanism (confirmed by reading, not guessed)

`app/_components/site-auth.tsx` renders two different shapes:

- Server render and pre-fetch: `<Link>Sign in</Link>`, inline, sharing the
  footer's first line with Changelog/Writing/Connect.
- After `/api/me` resolves **for a signed-in user**: a `<Link>` carrying
  `w-full basis-full`, which forces it onto **its own new line** in the
  `flex-wrap` footer row in `site-shell.tsx`.

The footer therefore grows by one line height after hydration. That is the
`footer.mt-16.border-t…` 0.11 CLS row across 6 samples, and it explains why
`/account` shows 0.11 — the shift only happens for signed-in visitors, which is
exactly the population those samples represent.

Bonus: the 576 ms INP selector
`a.rounded-sm.outline-none.hover:text-foreground.focus-visible:ring-2…` is that
same "Sign in" `<Link>`'s class string.

### Why no fix landed here

The `basis-full` behavior is deliberate and documented in place: it lets a long
display name or email wrap against the sidebar's full width instead of fighting
three fixed labels for the remainder of the first line.

Reserving the line unconditionally would add permanent empty space in the footer
for **anonymous visitors, who are the overwhelming majority of traffic**, to fix
a 0.11 shift affecting 6 signed-in samples — while site-wide CLS P75 is already
0.07, i.e. "Great", and T5 only asks that it be held.

Verifying any fix requires an authenticated session, which this measurement
setup does not have. Shipping an unverifiable layout change to the auth footer,
paid for by every anonymous visitor, is a worse trade than leaving it.

### If it is picked up later

Reserve space **conditionally**, not always: render the footer's second line as
a zero-content placeholder only once `/api/me` has resolved signed-in, or move
the auth link out of the wrapping row so its line count never changes. Verify
with a real signed-in session and a CLS observer before and after — do not
accept a lab CLS of 0 as proof, since anonymous lab runs never trigger the shift
in the first place.

---

## 10. Phase 3 findings — the premise was wrong, the real cost is elsewhere

### §2's homepage numbers were a measurement artifact

§2 claims "203 requests vs 68 on every other route… each visible card mounts a
`/preview/<name>/embed` iframe plus an `.mp4`". That was measured by a script
that scrolled 1500 px first, so it counted lazy-loads as if they were initial
load. Corrected, on a clean load with no scrolling:

| | requests | iframes | videos |
| --- | --- | --- | --- |
| `/` initial load | **77** | **0** | 4 (340 KB) |

Zero `/embed` iframes on load. The grid already lazy-mounts and already loads
posters ahead of video. **The Phase 3 work item — "below-fold cards should not
mount iframes or fetch .mp4 until intersection" — is already implemented.** Do
not do it again.

Of the 77, 43 are Next `?_rsc=` link prefetches totalling 9 KB. Many requests,
negligible weight.

### What is actually expensive: main-thread work on card mount

| | long tasks | total blocking | worst | resources |
| --- | --- | --- | --- | --- |
| `/` no scroll | 3 | 330 ms | 191 ms | 76 |
| `/` after scrolling | 14 | **1006 ms** | 164 ms | 92 |

Scrolling adds 11 long tasks and 676 ms of blocking to load just 16 more
resources. The cost per mounted card is main-thread execution, not bytes and not
requests.

This connects Phase 2: an interaction made while browsing the catalog lands on a
main thread already saturated by card-mount work, which is a plausible mechanism
for the 2560 ms field INP sample on a slower device — and it fits Phase 2's
finding that the time is presentation, not handler processing.

### Revised Phase 3

Not "fewer requests". The target is **main-thread cost per mounted card**:

```
T4'  scroll-induced blocking on /: 676ms -> < 300ms
     measured as (total longtask ms after 4 scroll steps) - (same before scroll)
```

Profile one card mount before changing anything. Candidate causes, unverified:
the ASCII/WebGL components initialising on mount, video decode kicked off on
intersection, or per-card layout thrash. Establish which before touching code —
this document has already produced three confident hypotheses that measurement
rejected.

---

## 11. Phase 3 profile — forced layout is the candidate, no fix shipped

CPU profile (CDP `Profiler`, 100µs sampling) of `/` across 4 scroll steps,
27,847 samples over 5,338 ms:

| share | symbol |
| --- | --- |
| 60% | `(program)` — browser-internal style/layout/paint |
| 11% | `(idle)` |
| 3% | **`getBoundingClientRect`** (786 samples) |
| ~14% | assorted minified app frames in one chunk |

60% in `(program)` corroborates Phase 2: the cost is browser layout/paint work,
not application JS. The one application-attributable signal is 786 samples of
`getBoundingClientRect` — forced synchronous layout.

### Two call sites, one of them bounded

- `app/_components/use-mount-manager.ts:47` — `recompute()` measures each tracked
  card. It is rAF-throttled (`frame.current = null`) and runs once per frame, so
  it is bounded by the number of near cards.
- `app/_components/autoplay-driver.tsx:337-345` — `hitTest()` walks up to 32
  levels, and at each level loops every child calling `getBoundingClientRect()`
  **and** `getComputedStyle()` in the same pass. Read-after-read is fine, but
  interleaving with the driver's own DOM writes is the classic thrash shape, and
  this runs continuously for autoplaying demos rather than only on scroll.

`hitTest` exists for a real reason, documented in place: demos are `inert`, so
`document.elementFromPoint` always answers `<body>`.

### Not fixed here, deliberately

This is the machinery driving 298 component demos. A wrong "optimisation" —
caching rects across a pass, or changing traversal — silently breaks demo
interaction across the catalog, and the lab has no assertion that would catch it.
Combined with field verification being ~7 days out, blind-optimising it is the
worst available trade.

Next step, in order: (1) confirm `hitTest` is actually hot by profiling with the
autoplay driver disabled — if `getBoundingClientRect` self-time collapses, it is
confirmed; if not, the cost is `recompute` or the browser's own work and this
lead dies like the others; (2) only then batch the reads, with a demo-interaction
test in place first.

---

## 12. RETRACTED — the "root cause" was a headless artifact

> **This section previously claimed a confirmed root cause. It was wrong.**
> A better-controlled experiment falsified it. The original reasoning is kept
> below the retraction because the mistake is instructive, but do not act on it.

### The falsifying experiment

The original A/B ran in **headless** Chromium, which never autoplays video. Re-run
**headed** with `--autoplay-policy=no-user-gesture-required`, so the videos
actually play, 3 runs per condition:

| condition | scroll blocking | median | videos playing |
| --- | --- | --- | --- |
| normal | 276 / 126 / 71 ms | **126 ms** | 4, 4, 4, 4 |
| reduced-motion | 178 / 116 / 172 ms | **172 ms** | 0 (elements absent) |

**No meaningful difference, and reduced motion is marginally *slower* at the
median.** The ~10x effect does not exist under real conditions.

### What went wrong

Headless reported 2213-4315 ms of scroll blocking where headed reports 71-276 ms
— an order of magnitude of pure instrument error. The "replication" that gave
confidence (two experiments, both ~10x) replicated the *artifact*, because both
ran under the same broken conditions. Replication does not rescue a biased
instrument.

`featured-card.tsx:243` does gate `<video>` out of the tree under
`calm === false`, so reduced motion genuinely removes the videos. That part was
read correctly. It simply does not cost what headless implied.

### What this means for the remaining targets

Headed homepage scroll blocking is ~126 ms median. That is not a performance
problem, and it undercuts the premises of Phase 3 (§10's 676 ms) and the
forced-layout lead (§11) equally — all were measured with the same headless
instrument.

**There is currently no lab-reproducible main-thread problem on `/`.** Field INP
is 176 ms P75, which Vercel rates Great, and the 2560 ms selector row is 2
samples on an unknown device. The honest position is that T3/T6 may have no
defect behind them at all.

Anyone resuming: measure headed, 5+ runs, compare medians. Every blocking figure
in §2, §10, §11 and the original §12 was produced by an instrument now known to
inflate by ~10x.

---

## 12b. Original (retracted) reasoning — card-tied motion

The first hypothesis in this document that survived its own disconfirming test.

### The A/B

`prefers-reduced-motion` short-circuits `autoplay-driver.tsx:30`,
`smooth-scroll.tsx:25`, `smooth-cursor.tsx:39` and `featured-card.tsx:126`, so
emulating it is a kill switch requiring no deploy.

| page | motion | scroll blocking | load blocking |
| --- | --- | --- | --- |
| `/install` (no cards) | normal | **0 ms** | 0 ms |
| `/install` (no cards) | reduced | 0 ms | 0 ms |
| `/` (cards) | normal | **2213 ms** | 2295 ms |
| `/` (cards) | reduced | **214 ms** | 230 ms |

Smooth-scroll and smooth-cursor are exonerated: on a card-free page they cost
nothing measurable, normal or reduced. The whole delta is **card-tied motion**,
and it is roughly **10x** on the homepage.

Supporting profile, same A/B: `(program)` — browser style/layout/paint — falls
from **73% to 12%** of samples, and `getBoundingClientRect` self-time from 87
samples to 9.

### Why this is also the Phase 2 answer

Phase 2 established interaction cost was presentation-bound with ~0 ms of handler
processing, but could not say what saturated the main thread. This is it: an
interaction taken while browsing the catalog lands on a thread already busy with
per-card demo simulation and its forced layout. That is a credible mechanism for
the 2560 ms field INP sample on a slower device, and it is consistent with every
Phase 2 measurement rather than contradicting any.

### Attribution, stated precisely

Confirmed: **card-tied motion systems**. The two candidates are
`autoplay-driver.tsx` (which drives demo interaction and runs the `hitTest`
forced-layout walk from §11) and `featured-card.tsx`. The autoplay driver is the
primary suspect because it is the one performing the forced layout, but reduced
motion disables both at once, so this A/B does not separate them. Separating them
needs a build with one disabled — a deploy, not a lab run.

### Still not fixed, and why

Autoplaying demos are the site's core value proposition, not an incidental
animation. Throttling, capping concurrency, or pausing off-screen demos is a
**product decision about how the catalog feels**, not a mechanical optimisation,
and it is exactly the class of change the non-goals section keeps off an agent's
hands. Field verification remains ~7 days out regardless.

The measurement is what this phase owed. The decision is the owner\'s.

### Options, cheapest first

1. **Pause demos that are mounted but off-screen.** `use-mount-manager.ts`
   already computes `onScreen` separately from `mounted` for exactly this kind of
   use, and `LivePreviewFrame` already has a visibility postMessage path.
2. **Cap concurrent driven demos** to the 2-3 nearest the viewport centre;
   `recompute()` already sorts off-screen cards by distance.
3. **Batch the `hitTest` reads** (§11) so the walk stops interleaving
   `getBoundingClientRect` with `getComputedStyle`. Smallest behavioural risk,
   smallest expected win.
4. **Respect reduced motion more aggressively** — already correct, no change.

Whichever is chosen, a demo-interaction test must exist first. Nothing in the
lab currently fails if a demo silently stops responding.

### Variance warning — do not trust a single blocking run

Three homepage runs under identical conditions, same session, minutes apart:

```
531 ms   2267 ms   2981 ms      (scroll blocking, same page, same method)
```

Nearly 6x spread with nothing changed. Any single-run blocking figure in this
document — including the 464 ms in §2 and the 676 ms in §10 — is one draw from
that distribution, not a measurement. Only differences that replicate across
separate experiments should be believed.

The reduced-motion finding in §12 survives this bar: two independent experiments,
4315 -> 707 ms and 2213 -> 214 ms, both ~10x, plus a corroborating profile shift
(`(program)` 73% -> 12%). The effect is real even though the absolute numbers are
not stable.

### Video is neither confirmed nor excluded

An attempt to isolate autoplaying `<video>` by pausing every video and
re-measuring returned `playing=0` in **all** runs, including the controls:
headless Chromium never started the videos. The experiment tested nothing. Video
decode/compositing remains an untested candidate for the §12 delta, alongside the
autoplay driver and the featured card.

Anyone resuming this: run blocking measurements at least 5x and compare medians,
and use a headed browser for anything involving video.

---

## 13. Re-measuring

Lab harness (per-route TTFB/FCP/LCP/CLS/long tasks/request count) is what
produced the lab column above. It runs against prod with Playwright, already a
repo dependency. Phase 5 turns it into the CI gate.

Field re-measure: Speed Insights, Production, Desktop, Last 7 Days. Needs ~7 days
of traffic after a deploy before the numbers mean anything. Check Mobile too —
this baseline is desktop only.
