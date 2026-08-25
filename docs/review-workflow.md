# The review/verify workflow

How to eyeball a round of new/fixed components and how the automated gate
that has to agree with that eyeballing actually works. Written after this
round re-derived both from scratch and re-hit the same failure modes that
are documented below. Read this before starting a review round, not after
getting stuck.

## The three routes

**`/review`** (`app/review/page.tsx` + `app/review/data.ts`) — the human
judging surface. Local-only, not in site nav, not part of the catalog:
reads nothing the catalog reads. Content is a hand-written array in
`app/review/data.ts`, grouped into up to three buckets (`fixed` / `untested`
/ `expansion`) with a one-line "what changed" / "what to look for" per row.
"Working" / "Needs work" verdicts and a free-text note per row persist via
`PUT`/`POST` to `/api/review-state` (`app/api/review-state/route.ts`) into
`.review-state.json` at the repo root — gitignored, not localStorage, so
state survives reloads and is readable with `cat .review-state.json`. That
route 404s (not 403 — a 403 confirms the route exists) whenever
`NODE_ENV === "production"` and the request isn't over localhost, so it is
dead on every real deployment and live only against a local `next
start`/`next dev`. Card previews reuse the catalog's own
`LivePreviewFrame` + `useMountManager` machinery, not a second
implementation.

**`/preview/<name>`** (`app/preview/[name]/page.tsx`) — the chrome-less
fixture `scripts/verify.ts` and `scripts/record.ts` screenshot directly.
This is the gate target, and it has to stay exactly this shape. The
docblock at the top of that file records two measured reasons neither of
the other candidates works:

- `/components/<name>` (chrome-full) breaks the "first visible interactive
  element" locator the gate uses for hover/press/focus/`gate.openBy` —
  measured, it resolves to the sidebar's wordmark link instead of anything
  belonging to the component.
- `/preview/<name>/embed` breaks Tab-reachability: `/embed` is always
  `inert` and always autoplays unconditionally, so the gate's "Tab up to 12
  times and land on something" check never lands (focus measured staying on
  `document.body`), and any interaction screenshot is contaminated by the
  autoplay driver's own motion.

So `/preview/<name>` stays a plain, un-inert, non-autoplaying render — the
only shape that satisfies what the gate actually asserts.

**`/preview/<name>/embed`** (`app/preview/[name]/embed/page.tsx`) — the
cacheable card thumbnail every catalog card, featured card, and `/review`
row loads in its iframe. Same DOM as `/preview/<name>?embed=1&autoplay=1`
but with both flags baked into the path instead of the query string, so it
prerenders and serves from CDN instead of `no-store`-ing on every view
(measured: `x-vercel-cache: MISS` on every one of 4-12 per homepage load
before this route existed). Always `inert`, always autoplaying — which is
exactly why it can't be the gate target either.

The reason routes 2 and 3 have to be different pages, and why route 2 can't
move: **the review surface and the gate surface must be the same route.** A
green gate and a clean eyeball on `/review` mean the same thing only because
both are looking at `/preview/<name>`.

## How to review a round

1. Add rows to `app/review/data.ts` — one per slug, in whichever group fits
   (`fixed`/`untested`/`expansion`), with a one-line diagnostic "what to
   look at". Bump `COPY_ROUND_LABEL` in `app/review/page.tsx` if you're
   rewriting existing rows for a new fix round — it's the only signal the
   owner has that the row copy describes the current build, not a stale one.
2. If any component is new on disk (not yet in `registry.json`), run
   `npm run registry:build` so it's registered.
3. Build and serve production (see Launch recipe below).
4. Judge at `/review`. A row you mark "Needs work" and annotate with a note
   is what the next round's `fixed` group re-tests.

## Launch recipe

Port convention (`AGENTS.md`): pm2's `nsui-review` process serves
**production** (`next start`) on port **3400**. Parallel worktree instances
use `34xx`. Confirmed live right now: `nsui-review` is `npx next start -p
3400`, fork mode, cwd = repo root.

```bash
npm run build                      # registry:build && next build — mandatory before
                                    # a rebuild-requiring change, see below
pm2 restart nsui-review            # after every rebuild
BASE_URL=http://localhost:3400 npm run verify [name]
```

A rebuild is mandatory whenever you add a route, add a component, or change
anything `next build` bakes in — a running `next start` process does not
pick up new files. If pm2 isn't managing your instance (a throwaway
worktree server), start and verify **in one shell invocation** — see Known
failure modes below for why.

## How the gate works

```bash
BASE_URL=http://localhost:3400 npm run verify            # all components
BASE_URL=http://localhost:3400 npm run verify <name>      # one component
```

Per component × theme (`scripts/verify.ts`):

- `page.emulateMedia({ colorScheme: theme })` **before** `page.goto`. Order
  matters: the no-flash script in `<head>` picks the theme at load from
  `emulateMedia`/`prefers-color-scheme`, and Playwright defaults an
  unconfigured context to light. Emulating after navigating let the "dark"
  pass silently screenshot light for months — the gate covered light twice
  and never covered dark at all.
- Blank-render check: fewer than 2 elements with a non-zero box inside
  `<body>` fails.
- On the dark pass only (theme-independent, so it runs once): the ARIA
  audit (`auditA11y`, `scripts/verify.ts:91`) — every exposed, non-disabled
  interactive control needs an accessible name, `role=switch/checkbox/radio`
  needs `aria-checked`, a visible dialog needs an accessible name — plus
  page-level Tab-reachability (if the component renders any control at all,
  Tab from a blurred body must land on something within 12 presses).
- hover/press/focus byte-compare: screenshots the first visible interactive
  element's default/hover/press/unfocused/focus states and asserts
  hover≠default (button-likes only) and focus≠unfocused (blur first, then
  drive focus by keyboard so `:focus-visible` applies the way a real user
  sees it — not the pre-click `default`, since that click may have toggled
  state and the diff would then pass on state change rather than a focus
  ring).
- Cross-theme byte compare: `dark-default.png` and `light-default.png` must
  NOT be byte-identical. This is what catches "theme never switched" — the
  same class of bug the `emulateMedia`-ordering fix above closed, checked
  again independently so it can't regress silently.
- Screenshots land in `registry/{core,loud}/<name>/screenshots/` —
  generated, not hand-authored (see Don't-do-this below).

## The `gate` descriptor

```jsonc
"gate": {
  "openBy": "button[aria-haspopup=menu]",  // CSS selector: click this
  "expect": "[role=menuitem]"              // CSS selector: this must then be
                                            // visible AND hittable
}
```

Both keys are required if the key is present. `expect` is checked with a
real hittability test (`hittable()`, `scripts/verify.ts:153`): non-zero
box, not `visibility:hidden`/transparent, **and**
`document.elementFromPoint()` at its centre resolving to it or something
inside it. A non-zero box alone proves nothing — that's exactly what an
ancestor's `overflow:hidden` leaves behind.

**Failure hit this round:** two curtain components
(`curtain-austrian-gather`, `curtain-tab-diagonal` — plus
`curtain-traveler-draw` on the same pattern) originally pointed `expect` at
the curtain's rod/track, which renders identically whether the curtain is
open or shut. The gate clicked `openBy`, found the rod exactly where it
always is, and passed — while the fabric was still covering everything.
Fix pattern (see `registry/loud/curtain-austrian-gather/component.tsx`
around the `data-curtain-open` marker): add a dedicated element the fabric
genuinely occludes at rest and genuinely clears once open — its own SVG
`<rect>` at a known point, not the worst-case centre of some larger backing
shape. Point `expect` at that marker, not at a wrapper or a track.

**Rule: verify with `elementFromPoint` before AND after the trigger, never
reason from paint order.** "It's drawn after the curtain in the DOM/z-order
so it must be on top when open" is exactly the reasoning that shipped this
bug — confirm empirically, don't infer from source order.

## Known failure modes

- **Production `next start` does not see new routes or components without a
  rebuild.** This is why a throwaway dev server on 3401 got used mid-round
  this time instead of touching the pm2-managed production instance.
- **A server started with `&` in one shell call dies when that call
  returns.** Start the server and run verify inside a single invocation, or
  use pm2 — otherwise the gate fails with `ERR_CONNECTION_REFUSED` and tells
  you nothing about the components (`RESUME.md`).
- **Never run the gate against `npm run dev`.** Turbopack serves corrupted
  chunks under parallel load: measured 15-50% false failures vs. 0/12
  against a production build (`AGENTS.md`, `RESUME.md`).
- **`npx tsx scripts/verify.ts` fails with `__name is not defined`.** Must
  run via `npm run verify`; tsx's esbuild transform injects a helper into
  code Playwright serialises into the page. Use `npm run verify [name]`.
- **A 401 on one port but not another is a stale/other process, not the
  script.** Check `lsof -nP -iTCP:<port> -sTCP:LISTEN`, confirm cwd, before
  blaming verify.ts.
- **`scripts/build-previews.ts`: a full run (no argv) WIPES `public/previews`
  first**, so a slug dropped from `FEATURED` doesn't ship a stale preview
  forever. A targeted run (`node scripts/build-previews.ts <name>`) does
  **not** wipe — batching several targeted runs used to each erase the
  previous batch's output; don't reintroduce that by adding a wipe to the
  targeted path.

## Don't do this

- **Don't hand-build a per-round page with a pile of `dynamic()` imports and
  a hand-maintained demo map.** `app/r8a/page.tsx` did this — 34 manual
  `dynamic()` imports plus a `DEMOS`/`SECTIONS` map — and its own docblock
  says why: it was only necessary because none of the round's components
  were registered yet (`registry/index.tsx` is generated by
  `registry:build`, and that task couldn't run it). Once components are
  registered, `/preview/<name>` and `/review` already give you this for
  free. Treat `app/r8a` as a one-off, not a pattern.
- **Don't re-solve mounting or theming.** `useMountManager` and
  `ThemeSync` (`app/_components/theme-sync.tsx`) already do it —
  `ThemeSync` is what propagates a theme change live into already-mounted
  same-origin iframes via the `storage` event (a write is invisible to the
  document that made it) and keeps a no-stored-preference visitor tracking
  `prefers-color-scheme` live.
- **Never hand-author `screenshots/`.** They're `npm run verify` output.
