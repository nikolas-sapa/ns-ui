# Component backlog — one organized list

Two sweeps merged, both run on 2026-07-31:

1. **21st.dev bookmarks** — the 60 components bookmarked there, classified one by one in
   [`21st-bookmarks.md`](21st-bookmarks.md).
2. **The wider ecosystem** — 1,196 component names across aceternity (272), termcn (329),
   magicui (247), chanhdai (62), bklit (56) via `design-reg`, plus the local clones of react-bits,
   fancy and motion-primitives. Names tokenised and diffed against all 225 ns-ui components
   (names + tags + descriptions) to find *concepts* with no answer here, not near-duplicates.

The registry's bar is "an interaction that does not already exist here". Most of the 1,196 fail it
— they are the same twenty ideas restyled. What follows is only what survives.

## The shape of the gap

ns-ui is deep on **mechanics** (loaders, reveals, inputs, ambient canvas, scroll instruments) and
absent on **page blocks and product furniture**. Every one of the concepts below appears 4+ times
across the ecosystem and zero times here:

| Concept | Ecosystem hits | Notes |
|---|---|---|
| features / feature grid | 19 | the single most repeated block out there |
| testimonials | 13 | quote cards, marquees of them, wall-of-love |
| navbar / nav | 12 | ns-ui has `jack-knife`, `periscope-sweep` — menus, not a site nav |
| bento grid | 12 | layout primitive, not an effect |
| logo cloud | 10 | with `logo_search` MCP available, cheap to do properly |
| device mockup (iphone/safari/apple) | 15 | frame + screen, the standard hero prop |
| theme toggler | 9 | ns-ui is token-driven throughout and still has no toggle |
| blog / post list | 8 | index + card |
| stat tile / KPI | 7 | `dataviz` skill covers the form; nothing here implements it |
| login / auth form | 7 | `dovetail-run` is a stepper, not an auth surface |
| masonry gallery | 5 | `caustic-coverflow` is a coverflow, different job |
| lens / magnifier | 5 | `prism-drag-split` is close but is a text instrument |
| tweet / GitHub card | 10 | embed cards |
| contact form | 4 | |
| pie / donut | 6 | data-viz form ns-ui skips |
| choropleth map | 4 | data-viz form ns-ui skips |

## Ranked queue

Ordered by (does it unlock a whole page) × (is it an interaction, not a picture).

### Now — page furniture ns-ui cannot ship a site without

1. ~~**Footer**~~ — built: `footing-course` (core).
2. ~~**Preloader / route curtain**~~ — built: `gel-wash` (loud, colour).
3. **Site nav** — the one block with real mechanics in it (scroll state, condense, mobile sheet,
   focus trap). Highest leverage remaining.
4. **Theme toggler** — small, and conspicuous by its absence in a registry whose entire contract is
   "colours come from tokens".
5. **Bento grid** — a layout primitive the rest of the queue composes into.

### Next — blocks, once the frame exists

6. **Feature grid** · 7. **Testimonial wall** · 8. **Logo cloud** · 9. **Stat tile row** ·
10. **Device mockup**

Each is a picture unless it earns a mechanic. Only build the version where something actually
happens — a testimonial wall that reflows on read, a logo cloud that settles, a stat tile whose
number arrives the way `carry-digit` does.

### Data-viz — the forms ns-ui skips

11. ~~**Heatmap**~~ — built: `tide-ledger` (loud, accent-derived sequential ramp).
12. **Funnel / stage drop** — from the bookmarks.
13. **Pie / donut** — only with a real reason; the `dataviz` skill's form heuristic says bar beats
    pie for almost every job.
14. **Choropleth** — heaviest of the three, needs geometry.

### Showpieces — from the bookmarks, colour welcome

15. **Liquid-metal full-bleed hero** — 3 bookmarks. `liquid-collar` proves the shader; the gap is
    hero scale with type sitting in it. WebGL, the biggest single build in this list.
16. **Rotating-word slot** — 1 bookmark, and the one text mechanic genuinely absent.
17. **Knot / volumetric geometry** — `torus-render` and `meridian-spin` are ASCII; a real 3D knot
    is not covered.

## Explicitly not building

- **Whole-page templates** (portfolio, landing clones). The registry ships parts.
- **Branded embeds** — Product Hunt badges, platform-specific badges.
- **Restyles of what exists** — anything the bookmark map marked *partial*: shader gradients,
  swirls, particle fields, glass buttons, shiny buttons, scramble text. `chroma-tide`, `glyph-tide`,
  `vortex-street`, `frost-scrub`, `glass-button` and `decrypt-text` already hold those positions.
- **404** — covered twice already (`dead-letter`, `knockout-404`).

## Method note

The ecosystem sweep is name-level, not source-level: it finds concepts with no counterpart here, and
it will miss a component whose name hides its mechanic. It is a filter for what to look at, not a
verdict on any single component. The 60 bookmarks were classified individually because that list is
small enough to deserve it.
