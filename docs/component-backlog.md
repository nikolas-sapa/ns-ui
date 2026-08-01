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

Slugs in this file were re-checked against the 223-slug registry on 2026-08-01. The only two names
here that do not resolve are `footing-course` and `gel-wash`, and that is correct: both were built
and removed.

## Licence status — nothing here is a port

Settled 2026-08-01 by [`shader-port-licensing.md`](shader-port-licensing.md), which has the evidence
and the per-author table. The conclusion, and the only part the backlog needs:

**Nothing from 21st.dev may be ported.** Not from the platform (their Terms make components the
authors' property, forbid republishing and forbid scraping), and not from the authors' own repos
either, because for all 30 priority slugs those repos either do not exist, do not contain the
component, or carry no licence. Anything recovered from their CDN — the GLSL under the gitignored
`.scratch-21st/` — is off-limits for anything shipped.

So every 21st-derived entry below is an **independent reimplementation**, and "clean-room" here has a
specific meaning rather than a vibe:

1. Build from the **rendered behaviour** — what it does, its timing and feel — not from their source.
   Do not open their bundle, and do not paste GLSL out of it.
2. The **technique** is not owned: simplex/value noise, fbm, domain warping, the fullscreen-triangle
   plus `u_time`/`u_resolution` uniform pattern, standard gradient and vignette functions are
   textbook material from The Book of Shaders and Shadertoy. Writing those from knowledge is clean.
3. Because there is no port, there is also **no attribution obligation and no `meta.json` paper
   trail** for these. The attribution mechanics in that document apply only to a future MIT-to-MIT
   port, and none of the 30 qualifies today.
4. This does not soften the standing method note at the end of this file. "Do not read their source"
   and "do not invent a house-style answer to a category" are both true, and the way to hold both is
   to build against the **rendered preview**, closely, which is where `footing-course` and `gel-wash`
   went wrong.

## The shape of the gap

ns-ui is deep on **mechanics** (loaders, reveals, inputs, ambient canvas, scroll instruments) and
absent on **page blocks and product furniture**. Every one of the concepts below appears 4+ times
across the ecosystem and zero times here:

| Concept | Ecosystem hits | Notes |
|---|---|---|
| features / feature grid | 19 | the single most repeated block out there |
| testimonials | 13 | quote cards, marquees of them, wall-of-love |
| navbar / nav | 12 | ns-ui has `context-menu-unfold`, `command-palette-rotary` — menus, not a site nav |
| bento grid | 12 | layout primitive, not an effect |
| logo cloud | 10 | with `logo_search` MCP available, cheap to do properly |
| device mockup (iphone/safari/apple) | 15 | frame + screen, the standard hero prop |
| theme toggler | 9 | ns-ui is token-driven throughout and still has no toggle |
| blog / post list | 8 | index + card |
| stat tile / KPI | 7 | `dataviz` skill covers the form; nothing here implements it |
| login / auth form | 7 | `wizard-dovetail` is a stepper, not an auth surface |
| masonry gallery | 5 | `gallery-coverflow-caustic` is a coverflow, different job |
| lens / magnifier | 5 | `text-prism-split` is close but is a text instrument |
| tweet / GitHub card | 10 | embed cards |
| contact form | 4 | |
| pie / donut | 6 | data-viz form ns-ui skips |
| choropleth map | 4 | data-viz form ns-ui skips |

## Ranked queue

Ordered by (does it unlock a whole page) × (is it an interaction, not a picture).

### Now — page furniture ns-ui cannot ship a site without

1. **Footer** — open. First attempt (`footing-course`) was removed: category answered, bookmark not.
2. **Preloader / route curtain** — open. Same (`gel-wash`, removed).
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
number arrives the way `counter-carry-ripple` does.

### Data-viz — the forms ns-ui skips

11. ~~**Heatmap**~~ — built: `heatmap-calendar-tide` (loud, accent-derived sequential ramp).
12. **Dithered chart family** — open, and the most interesting item in this group because it is a
    *family* rather than a component. Full reasoning in the Dither Kit section below; the short
    version is that `background-ascii-dither`, `ascii-engraving-contour` and `heatmap-year-stipple`
    already work in ink density rather than colour, so the aesthetic is latent here and could become
    one coherent chart set. Canvas plus a Bayer matrix constant, no D3, no Motion — a rewrite, not a
    port. **Blocked on one decision, not on effort:** does the accent-token colour rule survive
    contact with dithering, or are these pure ink on paper? `heatmap-year-stipple` chose
    density-not-colour deliberately. Answer it once for the whole family rather than per component,
    because the answer is what makes it a family. Owner's call.
13. **Funnel / stage drop** — from the bookmarks.
14. **Pie / donut** — only with a real reason; the `dataviz` skill's form heuristic says bar beats
    pie for almost every job. If 12 happens, this is one member of it rather than its own build.
15. **Choropleth** — heaviest of the three, needs geometry.

### Showpieces — from the bookmarks, colour welcome

16. **Liquid-metal full-bleed hero** — 3 bookmarks. `border-chrome-ring` proves the shader; the gap is
    hero scale with type sitting in it. WebGL, the biggest single build in this list. Clean-room:
    written from the rendered surface, not from their GLSL.
17. **Rotating-word slot** — 1 bookmark, and the one text mechanic genuinely absent.
18. **Knot / volumetric geometry** — `ascii-torus-donut` and `ascii-globe-spin` are ASCII; a real 3D knot
    is not covered. `montekkundan`'s `knot-animation` is the one row of the licence table marked
    *unclear* rather than a definitive no — a manual pass over their 105 repos is ten minutes and
    could turn this into a permitted port, but until it does, clean-room.

### Clean-room rebuilds — the 21st backlog, reimplemented

Both entries exist because a port was ruled out, not because a new idea arrived. Status on both:
**open, unstarted, and unblocked** — the licence question is settled, so nothing is waiting on
research.

19. **One WebGL host + presets** — the shader family. 18 of the 30 priority slugs were raw-WebGL, and
    they are 18 variations on one program: a fullscreen triangle, `u_time`/`u_resolution`, and a
    fragment shader built from noise, fbm and domain warping. Build the host once — canvas sizing,
    DPR, `prefers-reduced-motion`, pause-off-screen, the uniform plumbing — and each preset is then a
    shader body rather than a component. This is what makes 18 entries affordable and it is why it
    sits above them in priority. It also risks the trap named in *Explicitly not building*: the
    presets must be genuinely different surfaces, not restyles of `background-gradient-shader` and
    `hero-vortex-street`, which already hold those positions.
20. **The 12 CSS/SVG-only rebuilds** — the non-WebGL half of the priority 30. Unaffected by the
    licence finding in the sense that mattered: there was never any source to obtain, so a rebuild
    from the rendered preview was always the plan and is now simply the only plan. Cheaper per item
    than the shader family and individually smaller; the discipline is the method note below, since
    these are exactly the class of component that gets "answered by category" instead of built.

## Explicitly not building

- **Whole-page templates** (portfolio, landing clones). The registry ships parts.
- **Branded embeds** — Product Hunt badges, platform-specific badges.
- **Restyles of what exists** — anything the bookmark map marked *partial*: shader gradients,
  swirls, particle fields, glass buttons, shiny buttons, scramble text. `background-gradient-shader`, `background-ascii-plasma`,
  `hero-vortex-street`, `scroll-defrost`, `button-glass` and `text-decrypt` already hold those positions.
  This is the bar queue item 19 has to clear: a shared shader host is worth building, but a preset
  that is `background-gradient-shader` with different noise constants is a restyle and fails here
  like anything else.
- **404** — covered twice already (`not-found-postmark`, `not-found-knockout`).

## Method note

The ecosystem sweep is name-level, not source-level: it finds concepts with no counterpart here, and
it will miss a component whose name hides its mechanic. It is a filter for what to look at, not a
verdict on any single component. The 60 bookmarks were classified individually because that list is
small enough to deserve it.

---

## Dither Kit (tripwire.sh/dither-kit) — the background for queue item 12

Flagged by the owner 2026-08-01: "the designs are soo cool." Not a list of gaps like the rest of
this file — it is one coherent aesthetic applied across a component set, which is the same thing
ns-ui is trying to be. Worth studying as a body of work before cherry-picking from it. It now has a
place in the ranked queue as **#12, the dithered chart family**; this section is the reasoning behind
that entry rather than a loose idea beside it.

**What it ships**

| Group | Items |
|---|---|
| Charts | area, bar, line, pie, radar, sparkline |
| Extras | generative avatars, dithered buttons, gradient washes |
| Behaviours across all of them | ordered-dither fills, entrance animations, interactive tooltips, selection states, sparkle effects, colour bloom |

**How it is built** — canvas engine (not WebGL/shader), D3 for chart logic, Motion for animation.
Distributed as a shadcn registry with its own CLI (`@dither-kit/cli`) and a lockfile for version
tracking. Requires Tailwind and a shadcn `components.json`.

**Why it cannot be ported directly.** It carries D3 and Motion as runtime dependencies. This
registry's entire pitch is plain source you own with zero or minimal dependencies, and ordered
dithering is a small pure function over pixel data — the Bayer matrix is a 4x4 or 8x8 constant.
Anything taken from here is a rewrite against `<canvas>` and the token palette, not a port.

**What it answers in this backlog.** Pie/donut (#14) and the chart family generally, in a house
style that would already be consistent with `background-ascii-dither`, `ascii-engraving-contour` and `heatmap-year-stipple` —
the three components here already working in ink-density rather than colour. That is the real
opportunity: not "copy dither-kit" but "the dithering aesthetic is already latent in this registry
and could become a coherent chart family."

**Open question for the owner, and it is what #12 is blocked on.** Does the accent-token colour rule
survive contact with dithering, or do these want to be pure ink-on-paper? `heatmap-year-stipple`
chose density-not-colour deliberately; a dithered chart family should make the same choice once,
everywhere, rather than per component. Note this is a different licence situation from the 21st
material: Dither Kit is a real published registry, so the constraint here is dependency weight (D3
and Motion at runtime versus this registry's plain-source pitch), not permission.
