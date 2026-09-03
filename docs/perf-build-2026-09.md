# Build and dev-loop performance audit — 2026-09

Structural audit of `npm run build` and the dev-loop entry points, done by
reading code and the artifacts an existing build already left on disk
(`.next/prerender-manifest.json`, `.next/server/app/`, `.next/cache/`,
`.next/diagnostics/`). **No build was run for this audit and no wall-clock
timing is reported** — every number below is a byte count, a file count, or a
call count derived from source. The machine was under concurrent load
throughout, which would have made any timing worthless; byte counts are not.

Registry size in this worktree: **534 components** (410 `core`, 124 `loud`),
each with a `meta.json` sidecar. The July audit was written at 222. Where a
cost scales with that number it is called out explicitly.

---

## Findings, ranked by build-time cost

### 1. The nav tree is re-rendered and re-serialized into all 534 component pages — 492 MB of prerender output

**Measured.** `.next/server/app/components/` is **492 MB** for 534 routes:

| artifact | per page | × 534 |
|---|---|---|
| `<slug>.html` | ~504 KB (`accordion-latch.html` = 504,276 B) | ~270 MB |
| `<slug>.rsc` | ~118–154 KB | ~65 MB |

`accordion-latch.html` contains **744 `/components/<slug>` links, 534 of them
distinct** — the entire sidebar tree, in full, in every single page.

**Mechanism, verified in source.** `app/layout.tsx:126` renders
`<SiteShell groups={navGroups()}>`. `SiteShell` is a Client Component
(`app/_components/site-shell.tsx`), so `groups` crosses the RSC prop boundary
and is serialized into the Flight payload of *every route in the app*, not just
component pages. `lib/nav-data.ts:52` `navGroups()` has **no memoization** — I
read the function end to end (lines 52–133); it recomputes `categorize()`, the
bucket map, and ~13 sorts on every call. Contrast `lib/use-when.ts`, which in
this same codebase carries a module-level `cached` guard and a docblock
explaining precisely this 534-page problem.

The 744-vs-534 gap is the deliberate multi-category rule documented above
`navGroups()`: a component is listed under *every* category it matches, so the
tree is 1.39× the registry.

**Why this is the quadratic the July audit would not have seen.** Bytes on disk
are O(nav entries) × O(pages) = O(n²). At 222 components the tree was ~310
entries and the page count 222; today it is 744 entries over 534 pages — the
product is **~5.8× larger**, and the observed output directory reflects that.
Page *count* is linear and harmless; **page payload is the cliff.**

`navGroups()` is additionally called a second time inside the page itself
(`app/components/[name]/page.tsx:130`, `flatOrder(navGroups())`), so each
component page recomputes the whole tree twice: **1,068 full recomputes per
build**. That CPU cost is real but almost certainly minor next to the
serialization — `categorize()` is 534 × 13 category tests with `Set` lookups
(`lib/search-categories.ts:245`). Rank the bytes, not the CPU.

**Fix, in order of payoff:**

1. Stop sending the built tree across the RSC boundary. `SiteShell` should
   receive the compact projection (`lib/registry-lite.generated.json` is
   already exactly that, 137 KB, and `nav-data.ts` already imports it) and call
   `navGroups()` **client-side** inside a `useMemo`. The tree becomes one
   shared static chunk instead of 534 inline copies. This alone should remove
   the bulk of the 492 MB.
2. If the tree must stay server-rendered, render the sidebar collapsed —
   emit only the 13 category headers plus the active category's members, and
   fetch the rest on expand. 744 anchors per page is the payload.
3. Memoize `navGroups()` at module scope, exactly as `lib/use-when.ts:22`
   does. Cheap, obviously correct (the inputs are two generated JSON imports
   that cannot change within a process), and removes 1,067 of the 1,068
   recomputes. Do this regardless of 1 and 2.

---

### 2. Every dev-loop entry point runs the entire 11-script registry build, with no write guards

`package.json` chains `registry:build` into **`predev`, `pretypecheck` and
`preverify`** as well as `build`. That is eleven scripts, including a
`shadcn build` subprocess and a 12 MB file write, before `next dev` will start.

`registry:build` =
`build-index → build-registry → build-llms → build-autoplay →
build-contributors → build-posters → build-mcp-snapshot →
build-mcp-conventions → build-readme → build-status → build-cli-snapshot`.

**No content-hash or mtime caching exists anywhere in the chain.** Only two of
the eleven scripts avoid a pointless write:

- `scripts/build-index.ts:45` — `if (prev !== out) writeFileSync(target, out)`
- `scripts/build-readme.ts:74` — `if (prev !== readme) writeFileSync(...)`

Everything else writes unconditionally on every invocation, including the
largest artifacts:

| artifact | size | guarded? |
|---|---|---|
| `registry.json` | 2.77 MB | no |
| `lib/registry-lite.generated.json` | 137 KB | no |
| `public/llms-full.txt` | 2.87 MB | no |
| `public/llms.txt` | 460 KB | no |
| `mcp/data/registry-snapshot.json` | 12.3 MB | no |
| `cli/data/registry-index.json` | 797 KB | no |
| `public/r/*.json` (via `shadcn build`) | 535 files, 15 MB | no |
| `public/posters/*.png` | 82 files, 6.8 MB, dir `rmSync`d first | no |

`scripts/build-registry.ts:177` then unconditionally runs
`execFileSync(node_modules/.bin/shadcn, ["build"])`, which rewrites all 535
files in `public/r/` even when `registry.json` came out byte-identical. That is
the single largest avoidable unit of work in the chain, and the script's own
comment already prices the binary at ~8.8s.

Two artifacts are structurally *incapable* of being cached because they embed a
fresh timestamp:

- `scripts/build-mcp-snapshot.ts:166` — `generatedAt: new Date().toISOString()`
- `scripts/build-status.ts:195` — `builtAt: new Date().toISOString()`

`lib/status.generated.json` is imported by the app, so **at least one module in
the graph has different content on every single run, by construction.**

**Answer to "does any step reprocess the entire registry when one component
changed":** yes — every step does, every time, and there is no content-hash
caching to bypass it.

**Fix:**

1. Add the `build-index.ts` write-if-changed guard to `build-registry.ts`,
   `build-llms.ts`, `build-autoplay.ts`, `build-mcp-snapshot.ts` and
   `build-cli-snapshot.mjs`. Same three lines, already idiomatic here.
2. In `build-registry.ts`, skip the `shadcn build` subprocess entirely when
   `registry.json` was byte-identical to what was already on disk. 535 file
   writes and a subprocess spawn avoided on the common dev-loop run.
3. Reduce the two timestamps to day granularity (`build-llms.ts:29` already
   does exactly this: `.toISOString().slice(0, 10)`), or drop `builtAt` from
   `lib/status.generated.json` and render the time from the deployment ID.
   A per-run-unique file in the module graph defeats every downstream cache.
4. Split the pipeline: `predev` needs `build-index` + `build-registry` +
   `build-autoplay` only. `build-llms`, `build-mcp-snapshot`,
   `build-cli-snapshot`, `build-contributors`, `build-readme`, `build-posters`
   and `build-status` produce artifacts `next dev` never reads. Moving those to
   the `build` script alone removes ~15 MB of writes and a `shadcn` spawn from
   every `npm run dev`, `npm run typecheck` and `npm run verify`.

Alongside this, note the mechanism is *likely* worse than pure I/O: rewriting
`registry.json` changes its mtime, and 20 app modules import it
(`app/page.tsx`, `app/sitemap.ts`, `app/docs/page.tsx`,
`app/components/[name]/page.tsx`, `lib/search-corpus.ts`, `lib/category-pages.ts`,
`lib/markdown-pages.ts`, and 13 more). Bundler cache invalidation keyed on
mtime would then be forced on every run. I could not confirm Turbopack's
invalidation key from source, so treat that as a probable bonus, not the
justification — the wasted writes stand on their own.

---

### 3. `build-llms.ts` reads and bracket-parses every `component.tsx` twice

`scripts/build-llms.ts:666-667`:

```js
const shortBody = components.map((m) => renderBlock(m, false)).join("\n\n");
const fullBody  = components.map((m) => renderBlock(m, true )).join("\n\n");
```

`renderBlock` (line 649) calls `formatPropLines` (line 383), which does
`readFileSync(path, "utf8")` at line 386 and then `extractComponentProps(src)`
— the hand-written bracket-balanced scanner (`findMatch`, `splitTop`,
`parseMember`, character-by-character over the whole file). There is no cache
between the two passes.

So the build performs **1,068 `readFileSync` calls and 1,068 full source parses
where 534 would do.** The `full` pass additionally calls `extractAuxTypes(src)`
(line 417), a third whole-source scan.

This is strictly O(n) — it is not the quadratic — but it is a 2× multiplier on
the most CPU-expensive script in `registry:build`, and it scaled directly with
the registry from 222 to 534.

**Fix:** memoize per component name. One `Map<string, {src, extracted,
auxTypes}>` populated on first touch, read by both passes. Roughly ten lines,
no behaviour change; `formatPropLines`'s only other input is the `compact`
flag, which affects formatting only, never parsing.

---

### 4. The build downloads ~20 MB over the network, from two remote hosts, and caches none of it

**Confirmed as the lead reported.** The two `Failed to set Next.js data cache`
warnings come from prerendering `/status` — it is in the prerender manifest,
and `app/status/page.tsx:69` sets `export const revalidate = 3600`, so the
route is statically generated at build time and its fetches run during
`next build`.

The reads are in `lib/status-checks.ts`:

| line | URL | size | over 2 MB cache ceiling? |
|---|---|---|---|
| 556 | `${REGISTRY_ORIGIN}/r/registry.json` | 3.69 MB reported by the build | yes |
| 642 | `unpkg.com/@nikolas.sapa/ns-ui-mcp@<v>/data/registry-snapshot.json` | 16.36 MB | yes |
| 642 | `unpkg.com/@nikolas.sapa/ns-ui@<v>/data/registry-index.json` | ~797 KB | no |
| 574 | `registry.npmjs.org/<pkg>` × 2 | ~2.4 KB each | no |

**Proof nothing is cached:** `.next/cache/fetch-cache` is **1.2 MB total**. If
the two large responses were being cached it would be 20 MB+. They are refetched
in full on every build.

**What they are for.** Exactly two integers on `/status`: the live origin's
`items.length` (row R1) and the published MCP package's `components.length`
(row R3). 20 MB of transfer to render two numerals.

**A local file cannot substitute**, and this is the important part: the whole
purpose of both rows is to compare *what is actually published* against *what
this build produced*. Reading `registry.json` or `mcp/data/registry-snapshot.json`
off disk would make the check compare the build to itself and always pass. The
network read is load-bearing; its *size* is not.

**If either host is unreachable or slow:** the build does **not** fail. Both
paths are bounded by `FETCH_TIMEOUT_MS = 8_000` (`lib/status-checks.ts:541`)
and every failure — non-OK, parse error, timeout — collapses to `null`, which
renders as an `UNKNOWN` row. The five reads are issued in parallel
(`app/status/page.tsx:235`, `Promise.all`), so the added build time is the
slowest single chain, not the sum. The worst case is the MCP chain, which is
**two sequential hops** (npm packument, then unpkg), i.e. up to **16 s** added
to the build before it gives up and prints UNKNOWN. The code comment at line
630 records that unpkg was once measured hanging past two minutes and taking
the build down; the timeout is the fix for that and it is correctly in place.

So this is a *cost and fragility* finding, not a correctness one. The failure
mode is honest.

**Fix — already written in the codebase's own comment** (`lib/status-checks.ts:637`,
"Upgrade path"), and it is the right one: emit the component count into each
package's own `package.json` at publish time and read it off the npm packument,
which is already being fetched at ~2.4 KB. That drops the unpkg host entirely
and removes 17 MB of the 20 MB. For the remaining 3.69 MB, the same file's
comment at line 552 proposes a `Range` request against `/llms.txt`'s header
line (verified there to return 206 with `accept-ranges: bytes`) and rejects it
because `registry.json` is the artifact the claim is about. Better than either:
publish a tiny `/r/count.json` alongside the registry from `shadcn build`'s
output, and read that — same artifact lineage, ~40 bytes.

Secondary fix, independent of the above: move the `/status` runtime reads out
of the build by giving the route `dynamic = "force-dynamic"` with a cached data
layer, or by having it read the Convex-persisted snapshot that
`app/api/status-snapshot/route.ts` already writes daily. The build has no
business making them at all.

---

### 5. `verify.ts` re-screenshots all 534 components every run, sequentially, with no change detection

**Direct answer to "does screenshot generation run when nothing has changed": yes, always, all of it.**

`scripts/verify.ts:418-438`:

```js
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
for (const item of items) { ... await verifyComponent(page, item.name, dir, meta); }
```

- **One** browser, **one** page, a plain `for...of` — fully sequential, zero concurrency.
- No mtime check, no content hash, no git-diff filter. The only filter is a manual `--only <name>` argument.
- Per component: 2 themes × N states of `page.screenshot()` (line 175), plus a11y checks and read-backs.

`preverify` then runs the full `registry:build` in front of it, so the eleven
scripts from finding 2 are paid before the browser even launches.

**Fix:**

1. Add a `--changed` mode: hash `component.tsx` + `demo.tsx` + `meta.json` per
   component into a committed or cached manifest, and skip components whose
   hash is unchanged *and* whose `screenshots/{light,dark}-default.png` still
   exist. A one-component edit then verifies one component.
2. Shard across a worker pool. The loop is embarrassingly parallel — each
   iteration is independent and already isolates its own failures (the
   try/catch at line 428 exists for exactly that reason). N browser contexts
   at `os.cpus().length / 2` is the obvious shape.
3. Keep the full sweep as the CI gate; make `--changed` the local default.

---

### 6. `tsconfig.tsbuildinfo` — incremental works locally, is cold on every CI build

**Answer: not invalidated per run locally; never warm on Vercel.**

Both buildinfo files exist and are current:

```
./tsconfig.tsbuildinfo         566,771 B   (npm run typecheck)
./.next/cache/.tsbuildinfo     508,929 B   (next build's own type check)
```

`tsconfig.json` sets `"incremental": true` with `"noEmit": true`, which is
valid on TypeScript 5.9.3, and `"exclude": ["node_modules", "mcp"]` correctly
keeps the 12 MB MCP snapshot out of the program.

Two real problems, neither of them local:

1. **`.gitignore` line 6 is `*.tsbuildinfo`, and root `tsconfig.tsbuildinfo` is
   not under `.next/cache/`.** Vercel restores `.next/cache` between builds and
   nothing else. So `next build`'s own check (`.next/cache/.tsbuildinfo`) gets a
   warm cache on CI, but `npm run typecheck` — which `pretypecheck` also front-
   loads with the whole registry build — is **cold on every CI run**. Fix: set
   `"tsBuildInfoFile": ".next/cache/tsconfig.tsbuildinfo"` so it lands inside
   the restored cache directory.
2. **`lib/status.generated.json` changes content every run** (`builtAt`
   timestamp, finding 2), and `resolveJsonModule` is on, so that file's
   signature differs on every invocation and everything downstream of it is
   rechecked. Small graph, but it is a guaranteed cache miss by construction —
   fix it with the same change as finding 2.

`registry.json` at 2.77 MB is also a `resolveJsonModule` import in 20 modules;
TypeScript must materialise a type for the whole literal. That is a fixed cost,
not an invalidation, and it is unavoidable while the app imports the file
directly. Worth knowing it grows linearly with the registry.

---

### 7. Static page count: 534 of 577 prerendered routes are component pages

**Measured from `.next/prerender-manifest.json`** — 577 prerendered routes:

```
components  534   categories 15   writing 4   changelog 3
status 2  connect 2  guidelines 2
about, docs, community, feedback, install, privacy, review, suggest,
theming, /, _not-found, _global-error, icon.svg, opengraph-image,
sitemap.xml  — 1 each
```

**The relationship is `pages = N_components + ~43`, strictly linear**, and it
confirms the lead's 591-for-546 (546 + 45). `app/components/[name]/page.tsx:29`
enumerates every registry item; `/categories/[id]` adds one page per category
(a constant 13–15).

Three things keep the count from being worse, and all three are deliberate and
correct:

- `app/preview/[name]/embed/page.tsx:52` returns `[]` from
  `generateStaticParams` on purpose — it would otherwise mount 534 unexercised
  client demos at build time.
- `app/preview/[name]/page.tsx` has no `generateStaticParams` at all.
- `app/components/[name]/opengraph-image.tsx` is **not** prerendered (no
  `/components/*/opengraph-image` keys in the manifest). Satori-rendering 534
  OG cards at build time would be a genuine cliff; do not add it.

**The count is not the cliff — the payload is (finding 1).** 534 pages is fine;
534 × 504 KB is not.

**The actual cliff to name:** if anything ever adds `generateStaticParams` to
`/preview/[name]` or `/preview/[name]/embed`, or forces OG prerendering, the
build goes from 577 renders to 1,600+, and the preview routes each mount a real
client demo (WebGL, `@react-three/fiber`, canvas animation). That is the change
that turns a slow build into a failing one.

---

### 8. Negligible, reported for completeness: the `registry.items.find()` scan

`app/components/[name]/page.tsx` does `registry.items.find((i) => i.name === name)`
in both `generateMetadata` (line 60) and the page body (line 100). Across 534
prerenders that is 534 × 2 × ~267 = ~285k string comparisons — **genuinely
O(n²), and genuinely irrelevant**, on the order of milliseconds total. The same
pattern appears in several other routes. Converting it to a module-level
`Map<string, Item>` is a one-line tidy-up worth doing when someone is already in
the file. **It is not a bottleneck and should not be prioritised as one.**

---

## Screenshot deploy exclusion — assessment, not implemented

Assessing the restructure at the lead's request. I re-verified the parts the
action depends on rather than inheriting them.

**Verified true.** Two build-time consumers read
`registry/<collection>/<name>/screenshots/<theme>-default.png`:

- `scripts/build-posters.ts:34` (`findScreenshot`) — copies them to
  `public/posters/`. Confirmed non-fatal on absence: line 52 pushes to
  `missing[]` and continues, and the script logs rather than exits.
- `scripts/build-status.ts:143-147` — `existsSync` on both themes per
  component, feeding `screenshotsOk` / `screenshotsTotal` in
  `lib/status.generated.json` (currently `534 / 534`).

**Correction to the inherited claim.** The teammate's message and `.gitignore`'s
own comment (lines ~70-77) both state that
`app/components/[name]/opengraph-image.tsx` serves these screenshots as the OG
card. **It does not.** That route's header comment (lines 7-19) records that
screenshot embedding was tried and dropped after a theme regression, and the
route now renders a type-only card. `grep` confirms the file contains no
screenshot read — only the comment describing the abandoned approach. So there
are **two** live consumers, not three, and **`.gitignore`'s explanatory comment
is stale and should be corrected** whether or not this restructure happens.

**Measured cost.**

| item | measured |
|---|---|
| `*-default.png` pairs | 534 light + 534 dark = **1,068 files, 83 MB** |
| `public/posters/` today | **82 files, 6.8 MB** (41 featured × 2 themes), gitignored |
| net deploy reduction | **~76 MB** |

**Price of the restructure:**

1. **Commit `public/posters/`** — drop it from `.gitignore`, delete
   `build-posters.ts` from the `registry:build` chain (make it a manual
   `posters:build` that a human runs when `lib/featured.ts` changes). Cost:
   **+6.8 MB of PNGs enter version control**, and they become a hand-maintained
   artifact — editing `FEATURED` without rerunning the script now silently
   ships a stale or missing poster. Mitigate with a check in `verify.ts` that
   every `FEATURED` entry has both posters committed.
2. **Replace `build-status.ts:143`'s `existsSync` probe with a committed
   manifest** — a small JSON of `{name: [hasLight, hasDark]}` written by
   `verify.ts` (which is what actually produces the screenshots and is the only
   thing that knows they are current). Cost: the status row moves from "measured
   on the deploy filesystem" to "measured when verify last ran", which is a real
   loss of directness and needs saying in the row's caption. It is also arguably
   *more* honest — the row is meant to mean "the gate produced these", not "some
   bytes exist at this path".
3. **Only then** add `registry/*/*/screenshots/` to `.vercelignore`.

**Do not do 3 before 1 and 2.** `.vercelignore` strips files before the build
container starts, so the exclusion removes the *inputs*, and both consumers
degrade silently: zero posters, every featured card on `/` falling back to the
dot-grid placeholder with both `<link rel=preload as=image>` hints gone, and
`/status` reporting `screenshots 0/534` — i.e. the site claiming all 534
components are ungated. No partial exclusion helps, since the `-default` pairs
*are* nearly the whole 83 MB.

**Recommendation:** worth doing, in that order, as its own change. It is a
source-control policy change (6.8 MB of binaries in, a measured check becomes a
recorded check) and per the lead's instruction it is not implemented here.

---

## The silent-tolerance pattern, catalogued

The lead asked me to look for the shape of "the build tolerates a failure and
carries on". It is a deliberate and mostly-correct house style here, but three
instances convert a misconfiguration into a silent wrong result rather than a
loud one:

| location | tolerated failure | consequence if it fires |
|---|---|---|
| `scripts/build-posters.ts:52` | missing screenshot | featured cards silently lose their poster; **no signal anywhere** |
| `scripts/build-registry.ts:86` | `meta.name` ≠ folder name | `console.warn` only; ships an installable `/r/<name>.json` with no preview. The comment already flags this as a ceiling with "flip to `throw` once the batch lands" |
| `scripts/build-registry.ts:150` | components missing from `component-order.json` | `console.warn` only; they sort **last** under "Newest". Comment records it went unnoticed twice, at 16 and then 22 components |

Two instances that tolerate failure **correctly**, for contrast — these should
not be changed: `lib/status-checks.ts`'s network reads (a timeout must render
UNKNOWN, never a fabricated pass or fail) and `scripts/verify.ts:428`'s
per-component catch (one bad gate must not abort the sweep).

The distinguishing test is whether the tolerated failure leaves a visible mark.
`build-posters` leaves none — it should at minimum exit non-zero when a
`FEATURED` component has no poster, since `FEATURED` is a hand-edited list and
a miss there is always a bug.

---

## Recommended order of work

| # | change | effort | payoff |
|---|---|---|---|
| 1 | Memoize `navGroups()` at module scope (`lib/nav-data.ts`) | ~5 lines | removes 1,067 recomputes |
| 2 | Move nav-tree construction client-side; pass the lite projection to `SiteShell` | medium | the 492 MB |
| 3 | Write-if-changed guards + skip `shadcn build` when `registry.json` is unchanged | ~20 lines | 535 files + a subprocess per dev-loop run |
| 4 | Trim `predev`/`pretypecheck` to the three scripts they need | config | ~15 MB of writes off every `npm run dev` |
| 5 | Memoize the source read/parse in `build-llms.ts` | ~10 lines | halves the heaviest script |
| 6 | Drop the sub-day timestamps from `status.generated.json` / MCP snapshot | ~2 lines | makes every downstream cache reachable |
| 7 | `tsBuildInfoFile` → `.next/cache/` | 1 line | warm typecheck on CI |
| 8 | Publish component counts in package manifests; drop the unpkg hop | medium | −17 MB network, −1 remote host, −8 s worst case |
| 9 | `verify.ts --changed` + worker pool | medium | the gate loop |
| 10 | Screenshot deploy restructure (above) | medium, policy | −76 MB deploy |

1, 3, 5, 6 and 7 are mechanical, low-risk, and total under a hundred lines.
