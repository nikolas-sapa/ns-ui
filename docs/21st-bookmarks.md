# 21st.dev bookmarks → ns-ui gap map

Source: the 60 components bookmarked on 21st.dev (`21st.dev/community/bookmarks/components`,
pulled 2026-07-31). Extracted over CDP against the logged-in browser — one `Runtime.evaluate`
returning slugs, no snapshots, no screenshots.

Verdict column:

- **have** — ns-ui already answers the same need; nothing to build.
- **partial** — the mechanic exists here in a different register; a port would be a variation,
  not a new idea.
- **gap** — no ns-ui component solves this.
- **skip** — a page or template, not a component. Out of registry scope.

The registry's bar is "an interaction that does not already exist here", so **partial** is normally
a decline, not a backlog item.

## Shader / WebGL ambient surfaces (25 bookmarks)

The largest cluster by far, and the one ns-ui already answers hardest.

| Bookmark | Verdict | ns-ui |
|---|---|---|
| google-gemini-effect, spotlight-new | partial | `leading-light`, `pressure-front` |
| wave-background, waves-shaders-homlu-ui, line-shader-homlu-ui | partial | `chroma-tide`, `glyph-tide` |
| blue-meshy-background, gradient-bars-background, liquid-gradient | partial | `chroma-tide` |
| swirl, blue-light-swirl, verdant-swirl, shader-anima, magic-dust-shader | partial | `chroma-tide`, `vortex-street` |
| glsl-hills, valley-of-the-mind, trail-grid | partial | `scarp-horizon`, `warp-lattice`, `worn-path` |
| crystal-shader, liquid-crystal, icey-night-shards, wrap-shader | partial | `frost-scrub`, `seed-crystal` |
| sphere, geometric-orb, torus-ish shaders | partial | `gyre-mote`, `torus-render` |
| particles, seed, nebula | partial | `particle-hero`, `vortex-street`, `lodestone-hero` |
| knot-animation, symbols-effect, spooky-smoke-animation | gap | volumetric/knot geometry — nothing here does it |
| liquid-metal-hero, hero-liquid-metal, portfolio-hero-with-paper-shaders | **gap** | `liquid-collar` is metal on a *ring*, not a full-bleed hero |
| cobe-globe-satellites | partial | `meridian-spin` (ASCII globe, no satellite arcs) |

## Glass, metal, buttons (7)

| Bookmark | Verdict | ns-ui |
|---|---|---|
| liquid-glass, apple-tahoe-liquid-glass-button, liquid-button | have | `glass-button`, `glass-panel` |
| shiny-button ×2, hero-button-expendable | partial | `glass-button`, `spark-gap`, `torsion-wind` |
| award-badge (Product Hunt badge) | skip | branded third-party badge |

## Text (7)

| Bookmark | Verdict | ns-ui |
|---|---|---|
| vertical-cut-reveal | partial | `bolt-unfurl`, `quoin-lock` |
| morph-texts, text-dia | partial | `dynamic-weight-text`, `card-flick`, `singularity-text` |
| animated-highlight-text | partial | `wet-ink`, `under-ink` |
| ai-text-loading | have | `chronicle-bar`, `wet-ink` |
| text-word-carousel | **gap** | no rotating-word slot in the registry |
| pixel-perfect-hero, animated-hero-section | partial | `glyph-cast`, `nested-slug`, `core-sample-scroll` |

## Loading (5)

| Bookmark | Verdict | ns-ui |
|---|---|---|
| metamorphic-loader, progressive-flux-loader | have | `blade-iris`, `lath-rack`, `hinge-topple`, `phase-swing`, `loom-shuttle` |
| preloader, 8bit-loading-screen | **gap** | ns-ui has inline loaders only — no full-page curtain / route-transition preloader |
| 8bit-not-found1 | gap | no 404 component |

## Page furniture (5)

| Bookmark | Verdict | ns-ui |
|---|---|---|
| motion-footer, animated-footer | **gap → built** | `footing-course` (this session) |
| book-a-demo-2 | partial | `counterpoise-tiers`, `dovetail-run` |
| preloader/404 | see above | |

## Data (3)

| Bookmark | Verdict | ns-ui |
|---|---|---|
| heatmaps | **gap** | `grain-tally` is a histogram; no calendar/matrix heatmap |
| funnel-chart | **gap** | no funnel/stage-drop chart |
| cobe-globe-satellites | partial | `meridian-spin` |

## Templates, not components (6)

portfolio, istanblue, valley-of-the-mind, ricaelmenezes3/portfolio, nuova/shader-anima page,
easemize/pixel-perfect-hero page — **skip**. Whole-page compositions; the registry ships parts.

## Ranked build queue (the real gaps)

1. ~~**Footer that the page slides off**~~ — built as `footing-course`.
2. **Full-page preloader / route curtain** — 2 bookmarks, zero coverage, and it is a mechanic
   (hold until ready, then leave) rather than a picture.
3. **Liquid-metal full-bleed hero** — 3 bookmarks. `liquid-collar` proves the shader; the gap is
   the hero-scale surface with type sitting in it.
4. **Rotating-word slot** — 1 bookmark, but the one text mechanic genuinely absent.
5. **Heatmap** (calendar/matrix) — data-viz gap, useful beyond decoration.
6. **Funnel chart** — same bucket, narrower need.
7. **404 state** — cheap, low value; do it when something else touches page furniture.

Everything else in the 60 is already answered here or is a template.
