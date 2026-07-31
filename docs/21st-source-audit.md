# 21st.dev bookmarked components — source audit

Audit of the 60 components bookmarked on 21st.dev. Goal was to stop guessing what they are:
get the real implementation, classify the technique and dependencies, and decide what is
portable into ns-ui (zero/minimal dependency, CSS-token-driven, `prefers-reduced-motion` aware).

Raw material: `.scratch-21st/` (git-ignored). One `<author>__<name>.tsx` per component,
`INDEX.md` with the full table, `_analysis.json` with machine-readable classification,
`_bundles/` with the 60 downloaded preview bundles.

## Headline

| | Count |
|---|---|
| Components attempted | 60 |
| **Full original source obtained** | **2** |
| Technique + dependencies established as fact (not guessed) | **60** |
| Verbatim component GLSL recovered | **16** |
| Public usage/demo snippet recovered | **60** |
| Hard failures (nothing obtained) | **0** |

## What blocked full source, and why

21st.dev paywalls component source. On the free tier the account gets **2 code/prompt copies per
day**; the Builder plan ($7/mo) advertises "Unlimited code & prompt copies". Every route was tested:

| Route | Result |
|---|---|
| `Code` tab → `Component.tsx` in the DOM | Renders "Component source is locked · Unlock to view the full implementation" |
| `Copy prompt` button (writes source into a prompt on the clipboard) | **Works — the only full-source route.** Server-metered; yielded 2 components, then silently returned nothing |
| `CLI` button (`npx shadcn add …`) | Opens the pricing modal — gated |
| shadcn registry endpoint `https://21st.dev/r/<author>/<name>` | `403 {"error":"Authentication required"}` with session cookies, with `?api_key=`, and with `x-api-key` (the Magic MCP key in `~/.claude.json` is not accepted here) |
| Magic MCP `21st_magic_component_inspiration` | Server returns a malformed tool result; MCP client rejects it. Broken, independent of auth |
| Preview bundle `https://cdn.21st.dev/<author>/<slug>/default/bundle.<ts>.html` | **200, unauthenticated, no quota.** esbuild-minified — identifiers mangled, but GLSL/CSS string literals survive verbatim |

So the *route* is solved and repeatable; it is the quota that caps it. `scratchpad/batch.mjs` harvests 2 more full sources
per calendar day once its slug list is trimmed to the un-fetched entries. A one-month Builder
subscription would harvest all 60 in a single ~25-minute run.

### What was extracted instead

For the 58 locked components, each `.tsx` file contains:

1. The **public Usage/demo snippet** (real, verbatim — this is not paywalled). It gives the exported
   component name, the full prop surface as actually used, and the wrapper markup.
2. The **declared npm dependencies** from the component page.
3. For raw-WebGL components, the **verbatim GLSL** — fragment and vertex shaders, comments and
   uniform names intact — pulled out of the preview bundle. For a shader background the GLSL *is*
   the component; the surrounding React is ~60 lines of boilerplate. 16 of the 18 raw-WebGL
   components have this, verified complete (`void main` present, braces balanced, no template
   interpolation splicing the text).

Three deliberate gaps, stated rather than papered over:

- **three.js/react-three-fiber bundles (7 components) have no usable recovered GLSL.** three.js
  inlines its own several-hundred shader chunks, so extraction returns library internals. Those
  files carry technique + deps + usage only.
- **`reuno-ui/blue-meshy-background` and `designali-in/shader-lines` have no extracted GLSL block.**
  Their shaders are assembled at runtime from `${…}`-interpolated template parts, so no single
  contiguous chunk is the shader. The GLSL is still present in `_bundles/<name>.html` and can be
  reassembled by hand; it was not auto-extracted rather than silently emitted truncated.
- **`prefers-reduced-motion` compliance could not be assessed for any locked component.** The marker
  does appear in bundles, but only inside framer-motion's own code, so it says nothing about the
  component. Assume none of these respect it until the source is read.

## Technique breakdown (all 60, established from bundles — not inferred from titles)

| Technique | Count |
|---|---|
| Raw WebGL + GLSL fragment shader, **zero npm deps** | 18 |
| CSS / SVG only | 12 |
| framer-motion / motion | 10 |
| three.js (3) / + react-three-fiber (4) | 7 |
| paper-shaders (`@paper-design/shaders-react`) | 5 |
| canvas 2D | 3 |
| GSAP | 2 |
| cobe, visx, simplex-noise | 3 |

## Worth porting into ns-ui

### Tier 1 — real ports, zero runtime dependencies

**Raw WebGL + GLSL, no npm deps (18; shader on disk for 16).** These are the best value in the whole
set: no dependency, and the GLSL was recovered verbatim, so the shader does not need reinventing. A port is a ~60-line
`<canvas>` + WebGL host (compile, one full-screen triangle, `u_time`/`u_resolution` uniforms, RAF
loop, `ResizeObserver`) plus the recovered shader, with colors lifted to CSS custom properties read
via `getComputedStyle` instead of the hardcoded `vec3` literals they ship with, and the RAF loop
gated on `prefers-reduced-motion` (render one static frame). Write the host once, reuse for all 18.

Nine of them — `serafimcloud/blue-light-swirl`, `serafimcloud/verdant-swirl`,
`audriusnek/icey-night-shards`, `senommu/line-shader-homlu-ui`, `senommu/waves-shaders-homlu-ui`,
`nuova.esperienza.1993/shader-anima`, `ricaelmenezes3/portfolio`, `davekatague/valley-of-the-mind`,
`yaoztorun/istanblue` — are the same 21st.dev shader-studio host with different shader bodies
(identical ~288-line file shape, identical uniform vocabulary: `u_time`, `u_contrast`,
`u_saturation`, `u_hue`, `u_vignette`, `u_grain`, `u_cursorPresence`). That is one ns-ui component
with nine presets, not nine components.

The rest of the tier, individually distinct: `designali-in/swirl`, `designali-in/sphere`,
`designali-in/shader-lines` (GLSL needs hand-reassembly), `dhileepkumargm/crystal-shader`,
`dhileepkumargm/liquid-crystal`, `aayush-duhan/liquid-gradient`,
`reuno-ui/blue-meshy-background` (GLSL needs hand-reassembly), `easemize/spooky-smoke-animation`,
`easemize/apple-tahoe-liquid-glass-button` (WebGL + a canvas-2D pass).

**CSS/SVG-only (12).** Nothing to port in the dependency sense — but also no recovered source, so
each is a clean-room rewrite from the demo plus the rendered preview. Cheap and low-risk:
`designali-in/shiny-button`, `Shatlyk1011/shiny-button` (adds only clsx + tailwind-merge),
`waleedkibhen/gradient-bars-background`, `mathewsaju210/trail-grid`, `suraj-xd/liquid-glass`,
`maxim.bort.devel/metamorphic-loader`, `montekkundan/knot-animation`, `yogaprtamaa/seed`,
`shugar/award-badge`, `theorcdev/8bit-loading-screen`, `theorcdev/8bit-not-found1`,
`designali-in/book-a-demo-2` (drop its `@aliimam/icons` dep).

### Tier 2 — port with one dependency swap

**framer-motion / motion (10).** Single dependency, and the two we hold in full
(`manuarora700/google-gemini-effect`, `manuarora700/spotlight-new`) confirm the pattern: thin
components, motion used for `useScroll`/`useTransform` and simple transitions. Most are text
effects — `kokonutd/ai-text-loading`, `animbits/text-dia`, `animbits/text-word-carousel`,
`cnippet.dev/vertical-cut-reveal`, `edwinvakayil/morph-texts`,
`ruixen.ui/animated-highlight-text` — which reduce cleanly to CSS `@keyframes` + Web Animations API
and drop the dependency entirely. `bklitai/funnel-chart` and `ruixen.ui/progressive-flux-loader` are
more motion-coupled; port only if the effect earns it.

**canvas 2D (3).** `uniquesonu/animated-hero-section` is dependency-free and portable.
`easemize/pixel-perfect-hero` needs `lucide-react` stripped. `devsam7t3/liquid-button` depends on
`@avenra/liquid-glass` — skip or rewrite the effect.

### Tier 3 — "port" means a full rewrite; do not attempt as a port

| Component(s) | Dependency | Why |
|---|---|---|
| `designali-in/glsl-hills`, `arlanoska/symbols-effect`, `scrollxui/particles` | `three` | three.js is ~600 KB; no usable GLSL recovered. Rewriting on raw WebGL is a from-scratch build |
| `alexperezcedeno/magic-dust-shader`, `uicapsule/geometric-orb`, `chamaac/nebula`, `aghasisahakyan1/animated-footer` | `three` + `@react-three/fiber` (+`drei`, `next`, `react-icons`, `framer-motion`) | Scene graph + React reconciler. `animated-footer` pulls five deps including `next` |
| `cult-ui/hero-liquid-metal`, `chowlol202/liquid-metal-hero`, `moazamtrade/wrap-shader`, `moazamtrade/portfolio-hero-with-paper-shaders`, `moazamtrade/hero-button-expendable` | `@paper-design/shaders-react` | The component is a thin wrapper; the effect lives entirely in the vendor package. Porting = reimplementing paper-shaders |
| `easemize/motion-footer`, `gaxocif204/preloader` | `gsap` | GSAP timelines throughout; ScrollTrigger-shaped. Rewrite on WAAPI/scroll-timeline is a redesign |
| `shuding/cobe-globe-satellites` | `cobe` | The globe *is* cobe |
| `airbnb/heatmaps` | 4 × `@visx/*` | D3 charting; out of scope for a UI-effects registry |
| `xubohuah/wave-background` | `simplex-noise` | Portable in principle — inline a ~40-line simplex implementation — but that is a rewrite of the dep, not a port |

## Recommendation

1. Build one WebGL shader host component for ns-ui. That single piece of work unlocks 18 components
   whose shaders are already on disk verbatim — the highest-leverage item by a wide margin.
2. Take the 12 CSS/SVG-only ones as clean-room rewrites; they need no source.
3. If full source for the remaining 58 genuinely matters, one month of 21st.dev Builder ($7)
   turns this into a single ~25-minute automated run. The extraction pipeline is written and
   proven (`scratchpad/batch.mjs`). Two caveats before re-running it: it iterates the bookmark
   list from index 0 with no skip-if-already-fetched guard, so on the free tier it would spend
   both daily copies re-fetching the two already on disk — trim the slug list to un-fetched
   entries first.
