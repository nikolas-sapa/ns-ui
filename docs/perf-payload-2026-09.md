# Payload audit — what the browser downloads and parses (2026-09-01)

Scope: bytes only. No timing numbers — twelve agents were running on this
machine, so every duration measured today is noise. Sizes are not.

Method: `npm run build` (Next 16.2.11, Turbopack) in the `perf/r13-speed`
worktree, then every number below read out of the built artefacts
(`.next/static/chunks`, `.next/server/app/*.html`), not out of source.
A concurrent `next build` from a sibling agent wiped `.next` mid-audit, so
the build output was snapshotted to
`/private/tmp/.../scratchpad/next-snap-a` and all measurements were taken
from that immutable copy.

`raw` = bytes on disk. `gz` = gzip -9. Vercel serves brotli; where brotli was
measured it is called out.

---

## Verified holds today: commit c087b749

**Holds — in client JS. Does not hold in the HTML.**

c087b749 stopped `meta.instruction` reaching the browser *through a JS
chunk*, and it verified that by grepping `.next/static/chunks` for the
literal `instruction`. Re-running exactly that check today:

- 4 chunks contain the string `instruction`. All four are unrelated:
  a Convex error message (`38up5heczcikr.js`), a turn-by-turn navigation demo
  component's `step.instruction` field (`1y-gvmrl8nm8e.js`), a security-demo
  label string (`0gsgah12hjrhs.js`), and the `/submit` form's field
  validation copy (`0uimpsi4f1s1e.js`).
- Zero registry instruction prose in any client chunk. Control grep for a
  kept component title (`Autosave Ratchet`) hits 2 chunks, so the grep is
  live.
- `registry.json` is imported only by Server Components today. No file with
  `"use client"` imports it, directly or transitively —
  `command-palette.tsx` and `lib/nav-data.ts` both still import
  `lib/registry-lite.generated.json`.

**But the grep was aimed at the wrong artefact.** The prose now reaches the
browser through the RSC flight payload embedded in the HTML, which that check
never looked at. Proven from `.next/server/app/index.html`:

- 331 components' `meta.instruction` **first sentence** — 76.4 KB — is inside
  the inline `self.__next_f.push` payload of `/`.
- 532 components' `description` — 138.2 KB — likewise.

`app/page.tsx:57-76` builds a `ShowcaseEntry[]` for all 534 items carrying
`description`, `tags`, and `prose` (= `useWhen` + first sentence of
`meta.instruction`) and passes it to `<Showcase>`, a Client Component. Props
crossing that boundary are serialized into the HTML. The fix moved the bytes
from a `.js` file to a `<script>` tag; it did not remove them.

The verification to keep, and to add to CI, is a size assertion on
`.next/server/app/index.html`, not a grep of `.next/static/chunks`.

---

## 1. registry.json field breakdown (534 items, 2.64 MB on disk)

| field | raw | share |
|---|---:|---:|
| `meta.instruction` | 2076.1 KB | 78.7% |
| `description` | 139.6 KB | 5.3% |
| `cssVars` | 77.0 KB | 2.9% |
| `files` | 66.3 KB | 2.5% |
| `meta.tags` | 41.8 KB | 1.6% |
| `name` | 10.2 KB | 0.4% |
| `title` | 10.2 KB | 0.4% |
| `type` | 6.8 KB | 0.3% |
| `meta.collection` | 3.1 KB | 0.1% |
| `dependencies` | 1.1 KB | 0.04% |
| `meta.rank` | 0.1 KB | — |

gzip of the whole file: 916.9 KB.

**There is no `useWhen` field in `registry.json`.** `build-registry.ts`
deliberately omits it; `lib/use-when.ts` reads it off the 534 `meta.json`
sidecars at build time, and only 23 components carry one. It is a rounding
error in bytes.

**Which of these reach the browser, per route** — proven from built HTML:

| field | `/` | `/categories/<id>` | `/components/<slug>` | `/preview/<slug>/embed` |
|---|---|---|---|---|
| `name`, `title` | yes (534) | yes (534 nav + members) | yes (534 nav) | no (nav not rendered) |
| `description` | **yes, all 534, twice** (markup + flight) | members only | that component only | no |
| `meta.instruction` first sentence | **yes, 331 of 534** | no | no | no |
| `meta.instruction` full | no | no | **yes, that component only** (server-rendered copy-prompt, by design) | no |
| `meta.tags` | **yes, all 534** | yes | yes | no |
| `files`, `cssVars`, `dependencies` | no | no | no | no |

---

## 2. Built client bundles per route

`noModule` chunk excluded from the modern-browser column — Next emits its
core-js polyfill bundle (`0cz1d0mv5g_q7.js`, 110.0 KB raw / 38.5 KB gz) with
`noModule`, so no modern browser fetches it. It is listed because it is the
third-largest file on every route and looks like a finding until you read the
attribute. It is not one.

| route | HTML raw | HTML gz | JS raw (modern) | JS gz (modern) | scripts |
|---|---:|---:|---:|---:|---:|
| `/` | **3141.9 KB** | 393.4 KB | 765.7 KB | 222.1 KB | 16 |
| `/categories/heroes` | 548.7 KB | 69.4 KB | 684.8 KB | 195.5 KB | 14 |
| `/components/accordion-latch` | 492.3 KB | 58.3 KB | 687.6 KB | 196.9 KB | 15 |
| `/preview/<slug>/embed` | 103.2 KB | 21.7 KB | 770.8 KB | 217.2 KB | 16 |
| `/about` (a text page) | 420.0 KB | 44.7 KB | 684.8 KB | 195.5 KB | 14 |

`/` at brotli -q11: **235.8 KB**.

Total client JS emitted: 7552 KB across 568 files.
Current budget (`perf-budget.json`): `totalClientJsKb` 6345, `largestChunkKb`
986 — the largest chunk measures 985.6 KB today, so that ceiling is at 100%
of budget, and the total is over it. That budget counts every emitted chunk
including per-demo async chunks, so it grows with every component added; it
is not a per-route number and should not be read as one.

### Ten largest chunks

| chunk | raw | what it is | pulled in by |
|---|---:|---|---|
| `3616ro5q4o-bt.js` | 985.6 KB | `three` + `@react-three/fiber` | `registry/core/hero-particles-webgl/component.tsx` — the only file in the repo importing either. Async, correctly split. Not on any initial route. |
| `1qxz2klaztyt2.js` | 227.2 KB | `react-dom` + `motion` | root layout. Every route. |
| `433s_kwy47172.js` | 143.4 KB | `lenis` + **`registry-lite.generated.json` inlined verbatim (534 entries)** | `lib/nav-data.ts` → `site-shell.tsx` (client). Every route. |
| `3ua5m8vy5-dq1.js` | 112.7 KB | `app/status/answers.ts` prose blob | `/status` only. |
| `0cz1d0mv5g_q7.js` | 110.0 KB | Next core-js polyfill | `noModule` — modern browsers skip it. |
| `1vwck27fw9kru.js` | 108.1 KB | Next client runtime / router | every route |
| `38up5heczcikr.js` | 65.7 KB | `convex` browser client | account/save paths |
| `1cbnr4t4x7h2i.js` | 59.9 KB | `lib/card-frame.generated.json` (534 focus selectors) + neighbours | card-rendering routes |
| `17rakysqo_hy6.js` | 53.7 KB | the `demos` lazy map — 534 `import()` stubs, 534 distinct chunk paths | `registry/index.tsx` |
| `1ntn7efqc-iiw.js` | 53.5 KB | scroll/smooth-scroll runtime | root layout |

---

## 3. Are demo chunks code-split per component? Yes — verified.

`17rakysqo_hy6.js` references 534 distinct `static/chunks/*.js` paths as lazy
stubs, one per demo. Concatenating every `<script src>` on `/` (875.6 KB) and
probing for demo implementation code: `WebGLRenderer` → **not present**. The
slugs that do appear come from `registry-lite` and
`card-frame.generated.json`, not from demo modules.

The `demo-lazy.tsx` fix (moving the `demos[name]` lookup into a Client
Component so Next's client-reference-manifest stops marking all 534 reachable)
**holds**. No gallery route pulls code for components it is not showing.

The cost has moved to iframes instead: each card is an iframe onto
`/preview/<slug>/embed`, and that document costs 770.8 KB raw / 217.2 KB gz
of JS to render 7.1 KB of markup — 91% of what the entire homepage loads, for
a bare fixture with no nav. `MOUNT_CAP = 12` means up to 12 of those at once.
Warm cache shares the chunks, but each iframe still parses and executes them
in its own realm.

---

## 4. Dependencies in the client graph

Nothing shipped that shouldn't be, and no wholesale-vs-submodule import
problem:

- `three` (0.185.1) + `@react-three/fiber` — 985.6 KB combined, imported by
  exactly one file, `registry/core/hero-particles-webgl/component.tsx`, as
  `import * as THREE from "three"`. Namespace import, but `three` has no
  tree-shakeable submodule story worth the churn, and the chunk is async, so
  it costs nothing until that one demo mounts. **Caveat:** that component has
  a poster (`hero-particles-webgl-{light,dark}.png`), i.e. it is a featured
  card, so scrolling it into view on `/` does pull 985.6 KB.
- `motion` — one importer, bundled with `react-dom`.
- `lenis` — `smooth-scroll.tsx`, root layout, every route.
- `convex` / `@convex-dev/auth` — 65.7 KB, account and save paths.
- `@vercel/analytics`, `@vercel/speed-insights` — small.
- `geist` — fonts only, see §6.

---

## 5. Static assets

| set | count | on disk | browser-facing? |
|---|---:|---:|---|
| `public/posters/*.png` | 82 | 8.0 MB | yes, via `next/image` |
| `public/previews/*.mp4` | 82 | 4.4 MB | yes, gated |
| `public/testimonials/*.png` | 3 | 1.0 MB | yes |
| `public/r/*.json` | 535 | 15 MB | CLI/agent installs only |
| `registry/**/screenshots/*.png` | 1110 | 88 MB | **no** — not under `public/` |

**Posters are handled correctly.** `featured-card.tsx` renders them through
`next/image` with `fill`, a real `sizes`
(`(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw`), AVIF/WebP
re-encode at display width, `priority` on row 1 only and on the light variant
only (the dark twin is `loading="lazy"` and `display:none` at parse time, so
it is never fetched until a theme flip). Largest source is 285.9 KB
(`thallus-siege-dark.png`); the wire cost is a fraction of that after the
optimizer. Two `<link rel=preload as=image>` entries on `/`, both row-1 light
posters — correct.

**Videos are handled correctly.** `preload="metadata"`, `inView`-gated,
removed entirely under reduced motion, keyed on theme.

**One real image finding:** `public/testimonials/alex-lekkas.png` is
**1,064,023 bytes** and is rendered at `width={36} height={36}`
(`community-testimonials.tsx:37-41`). `next/image` shields the wire, but a
1.06 MB PNG is the optimizer's input on every cache miss and 1.06 MB of repo
and deploy weight for a 36 px avatar.

**Deploy-weight finding (not browser payload):** `registry/**/screenshots`
— 1110 PNGs, 88 MB — is **not** in `.vercelignore`, while `public/r/`,
`registry.json` and `registry/index.tsx` are. Those 88 MB are uploaded on
every deploy and land in the function bundle. Nothing serves them.

Only 82 of 534 components have a poster; the other 452 render as a live
iframe with a dot-grid placeholder, which is the design, not a gap.

---

## 6. Fonts

Two faces, both variable, both self-hosted by the `geist` package via
`next/font/local`, both `<link rel=preload as=font crossorigin>` in `<head>`:

| face | raw |
|---|---:|
| `GeistMono_Variable.woff2` | 69.7 KB |
| `Geist_Variable-s.woff2` | 68.0 KB |

No unused *faces* — the `geist` package ships 40 static `.ttf`/`.woff2` files
per family, and the build correctly emits only the two variable ones.
Preloaded fonts do not block render (`next/font` sets `font-display: swap`),
so neither is on the critical path.

**But `Geist_Variable-s.woff2` (68.0 KB) is downloaded and never rendered on
Apple platforms.** `app/globals.css:65` sets
`--font-sans: ui-rounded, "GeistSans", …` — `ui-rounded` leads and resolves
to SF Rounded on macOS and iOS, so GeistSans never wins the cascade there,
while the `rel=preload` fetches it unconditionally on every cold load. The
comment above that line explains the `ui-rounded` choice deliberately (it
resolves to nothing off Apple, so non-Apple keeps the webfont); the preload
is the part nobody costed.

**CSS:** one 170.4 KB stylesheet, render-blocking on every route.

---

## Ranked findings

Sorted by bytes removed from the wire. Everything here touches component or
shared runtime source, so per the brief **none of it was implemented** — no
finding qualified as an isolated config or build-script change with a
measurable before/after, so nothing in this worktree was modified.

| # | finding | measured | where | change |
|---|---|---:|---|---|
| 1 | `/` server-renders all 534 cards into one document | **3141.9 KB raw / 393.4 KB gz / 235.8 KB br**; 2252.7 KB markup + 817.1 KB inline flight; 1277 `<li>` | `showcase.tsx:686` maps `gridItems` with no window | Render the first ~24 cards and append the rest on scroll (the `MOUNT_CAP`/`onScreen` machinery already exists — extend it from *mounting iframes* to *rendering cards*). Roughly −2.5 MB raw / −300 KB gz. Biggest single win on the site. |
| 2 | Full search corpus passed as props for all 534 | `description` 139.6 KB + `prose` 119.3 KB + `tags` 41.8 KB = **300.7 KB**, of which 138.2 KB + 76.4 KB proven inside `/`'s inline flight | `app/page.tsx:57-76` → `<Showcase items>` | Ship `name`/`title`/`order` in props; emit the search fields as a static `/search-index.json` fetched on the first keystroke or filter click. −300 KB raw / ~−45 KB gz off `/`, and it is what actually reverses c087b749's regression. |
| 3 | Sidebar renders all 534 components on every route | 323.3 KB markup on `/about`, a page with no components on it; ≥728 `/components/` hrefs | `site-shell.tsx:711-864` via `lib/nav-data.ts` | Render group headers and counts server-side; fetch the item lists when a group is expanded. −300 KB raw / −35 KB gz on **every** route. |
| 4 | `registry-lite.generated.json` inlined into a client chunk | **136.7 KB raw / 23.3 KB gz**, inside the 143.4 KB `433s_kwy47172.js`, on every route | `lib/nav-data.ts:6`, `command-palette.tsx:9` | Same fix as #3 — fetch it, don't bundle it. The palette needs it only once opened. −23.3 KB gz per route. |
| 5 | `/preview/<slug>/embed` loads a near-full bundle per iframe | **770.8 KB raw / 217.2 KB gz** of JS for 7.1 KB of markup, up to 12 concurrent | root layout applies (no `app/preview/layout.tsx`) | Give `/preview` a minimal route-group layout that omits `SiteShell`, `SmoothScroll`, `SmoothCursor` and the Convex provider. Cuts the per-iframe realm cost; exact saving needs the layout split to measure. |
| 6 | JSON-LD `ItemList` for all 534 on `/` | **69.3 KB raw** | `app/page.tsx:97-105` | Cap at the featured set, or move the full list to `sitemap.xml` where crawlers already look. −69.3 KB. |
| 7 | GeistSans preloaded but unrendered on Apple | **68.0 KB** per cold load, Apple visitors | `app/globals.css:65` + `next/font` preload | Either drop `ui-rounded` from the stack (Geist Sans is the documented brand face anyway) or stop preloading the sans face. −68.0 KB for most visitors. |
| 8 | 1.06 MB PNG for a 36 px avatar | **1,064,023 bytes** source | `public/testimonials/alex-lekkas.png`, used at `community-testimonials.tsx:37` | Re-export at 144×144 (~10 KB). −1.05 MB of repo/deploy/optimizer input; the wire is already fine. |
| 9 | 88 MB of screenshots uploaded on every deploy | 1110 PNG, **88 MB** | `registry/**/screenshots` absent from `.vercelignore` | Add `registry/**/screenshots/` to `.vercelignore`. Deploy weight only, zero browser effect. Left unimplemented because it is one line in a file the build pipeline agent owns — hand it there. |
| 10 | `three` + `r3f` pulled by a featured card | **985.6 KB raw** async chunk | `hero-particles-webgl` has a poster, so it is on `/` | Demote it out of the featured rail, or accept it. Correctly split either way. |

### Non-findings, recorded so nobody re-audits them

- **Per-demo code splitting works.** 534 lazy stubs, no demo implementation in
  any initial route chunk (`WebGLRenderer` absent from `/`'s 875.6 KB).
- **The 110.0 KB core-js chunk is `noModule`.** Free on modern browsers.
- **`registry.json` itself never ships to a browser** as a file. It is served
  at `/registry.json` and `/r/registry.json` for CLI and agent consumers
  (3.68 MB live, per the build log's data-cache warning), and imported only by
  Server Components.
- **Posters and preview videos are already optimally loaded** — correct
  `sizes`, one `priority` per row, lazy dark twin, `inView` + reduced-motion
  gating on video.
- **No unused font faces, and fonts do not block render.**

---

# Addendum — how much of the 917 KB gzipped registry reaches the browser, and how often

Added after the lead reframed the round: the July audit was written at 222
components, the registry is now 534, and the question is not "what regressed"
but "what was never re-measured". No new build was run for this section — all
numbers come from the same snapshot of the build that already existed on disk.

## Method

Marginal-cost measurement, not estimation. For each prerendered document,
every registry-derived string (`description`, `meta.instruction` first
sentence, `meta.tags`, `title`, `name`) was deleted from the built HTML, the
remainder recompressed, and the delta recorded. Layers are stripped
cumulatively, so an individual layer's number is order-dependent (later
layers compress against a smaller corpus and look bigger); the **total** row
is the honest figure and is what the ranking uses. gz = `gzip -9`,
br = `brotli -q 11` (what Vercel actually serves).

One measurement gap, stated rather than hidden: the `tags` layer reports 0.0
because tag arrays are quote-escaped inside the flight payload
(`[\"accordion\",…]`) and my literal strip did not match them. Tags are
therefore counted inside the `slugs`/remainder figures, not broken out. The
raw field total for tags is 41.8 KB; the compressed share is unmeasured.

## Answer

**Of the 917 KB gzipped registry, the browser never downloads it as a file on
any page route. What it downloads is a re-serialized projection of it, inside
the HTML, on every single navigation.**

| route | HTML gz | registry-derived gz | share | br | registry-derived br | share |
|---|---:|---:|---:|---:|---:|---:|
| `/` | 393.4 KB | **196.9 KB** | **50%** | 230.3 KB | **89.9 KB** | 39% |
| `/categories/heroes` (gallery) | 69.4 KB | **44.9 KB** | **65%** | 38.7 KB | 22.1 KB | 57% |
| `/components/accordion-latch` | 58.3 KB | 25.4 KB | 44% | 34.0 KB | 14.4 KB | 42% |
| `/preview/<slug>/embed` (card iframe) | 21.7 KB | 11.8 KB | 54% | 16.1 KB | 8.6 KB | 53% |
| `/about` — **a text page with no components on it** | 44.7 KB | **24.7 KB** | **55%** | 27.1 KB | 14.0 KB | 52% |

Layer detail for `/` (cumulative strip order):

| layer | raw | gz | br |
|---|---:|---:|---:|
| `description` (all 534, present twice — markup + flight) | −224.1 KB | −91.5 KB | −31.0 KB |
| `meta.instruction` first sentence (331 items) | −56.0 KB | −22.2 KB | −16.9 KB |
| `title` (534, nav + cards) | −61.4 KB | −30.2 KB | −9.8 KB |
| `name`/slug (534, nav hrefs + card links + tags) | −121.7 KB | −53.1 KB | −32.1 KB |
| **total registry-derived** | **463.3 KB** | **196.9 KB** | **89.9 KB** |
| remainder (chrome, CSS refs, React runtime payload) | 2675.8 KB | 196.5 KB | 140.5 KB |

Plus, on the JS side: `lib/registry-lite.generated.json` — all 534 items with
`name`, `title`, `tags`, `collection` — is inlined verbatim into
`433s_kwy47172.js` (136.7 KB raw / 23.3 KB gz). **562 of the 567 prerendered
documents load that chunk**, including every card iframe.

## Fetched once, per page, or per component? All three, in different places.

- **Once per browser** — the `registry-lite` JS chunk (23.3 KB gz). Immutable
  hashed URL, HTTP-cached. Cheap on the wire after the first hit.
  **But it is parsed once per document**, and the gallery spawns up to
  `MOUNT_CAP = 12` iframes, each its own realm. A gallery view therefore
  parses a 534-entry JSON array **13 times**, not once.
- **Per page load** — everything in the HTML table above. It is part of the
  document, so it cannot be cached separately and is re-sent on every
  navigation. `/about` pays 24.7 KB gz of component data to render a page
  with no components on it; that is the floor on every route on the site.
- **Per component shown** — each card iframe is a separate document carrying
  its own 11.8 KB gz of registry-derived HTML, on top of 217.2 KB gz of JS
  parsed in its own realm. Twelve at a time.

## What replaced instruction prose as the dominant cost

Not another single fat field. **The per-item floor, multiplied by 2.4x
growth.** The dominant cost is now the 534-item nav plus the 534-item card
projection being re-serialized into every document on the site. c087b749
removed one 2 MB field from the JS bundle; the thing that grew past it is the
part nobody thought of as payload at all — `name` and `title`, 20.4 KB of raw
registry data, costing **83.3 KB gzipped on `/`** once rendered into 534 nav
links and 534 card links and their flight-payload twins.

Straight-line scaling back to the July baseline of 222 components (arithmetic,
not a measurement — the July build no longer exists to check):

| | at 222 items | at 534 items | measured today |
|---|---:|---:|---:|
| `/` registry-derived, br | ~37 KB | ~90 KB | 89.9 KB |
| every-route nav floor, br | ~6 KB | ~14 KB | 14.0 KB |

Nothing regressed. The design has always cost ~0.17 KB brotli per component
per page, and 312 components were added to it.

## What this changes about the ranking

It confirms findings 1-4 and sharpens the order. Fix #3 (stop rendering all
534 nav items on every route) moves from third to co-first with #1, because it
is the only one that pays back on **every route including the card iframes**,
not just on `/`:

1. **Window the `/` grid** — biggest single-route win, ~2.5 MB raw off the
   document.
1=. **Collapse the sidebar to group headers + counts, fetch items on
   expand** — takes ~14 KB br off *every* document on the site, 562 of them,
   including all 12 concurrent card iframes. This is the change that scales
   with the registry instead of against it.
3. **Move the search corpus (`description` + `prose` + `tags`) out of props
   into a fetched `/search-index.json`** — −113.7 KB gz off `/` alone
   (91.5 + 22.2), and it is the change that actually finishes what c087b749
   started.
4. Findings 5-10 unchanged.

The pattern behind all three: every one of them is the same bug, which is
that the registry is treated as a build-time constant to inline rather than
as data to fetch. That was correct at 222 components and is not at 534.
