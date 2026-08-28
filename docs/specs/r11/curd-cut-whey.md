# curd-cut-whey

- **slug:** `curd-cut-whey`
- **tier:** core (card-scale canvas)

## product surface it replaces
A batch-processing status indicator (data pipeline "chunking" or a queue-drain visualization) — currently a bar or grid of static chips.

## the real mechanic
Cheesemaking curd cutting and syneresis: coagulated curd is cut into a grid of cubes with a curd knife (cube size sets surface area, which sets how fast whey expels); once cut, each cube independently shrinks over ~20-40 minutes as syneresis expels whey into the gaps, and the batch is periodically stirred to keep cubes from matting. Source: standard cheesemaking technique (cheddar/gouda-style curd work).

## one-sentence mechanic description
A solid curd mass is cut into a grid of cubes that each shrink at their own slightly different rate, releasing whey into the widening gaps between them, stirred every few seconds, then re-cut as a fresh batch.

## rendering approach
2D canvas grid. Grid count derives from the container's smaller dimension: `gridN = clamp(round(minDim / 90), 4, 8)` (e.g. 6×6 = 36 cubes at ~640px). Cubes drawn as filled squares in `--foreground`-derived luminance; gaps fill with a `--ns-muted` wash whose alpha represents pooled whey.

## real numbers
- Cut pass: two 500ms line-wipes (horizontal then vertical) forming the grid = 1000ms.
- Syneresis: each cube's edge length follows `size(t) = size0 * exp(-k*t)`, mean k = 0.12/s with ±15% per-cube jitter (seeded PRNG, fixed per batch), floored at 55% of original edge length.
- Whey gap alpha ramps 0 → 0.5 over 25s (ease-out-quad), representing accumulating whey.
- Stir event every 6s: all cubes jostle ±4px (300ms spring), a discrete beat distinct from the continuous shrink.
- After 25s shrink + 3s hold at floor size, a 1000ms recombine wipe merges cubes back into a solid mass, then a fresh cut begins. Full loop ≈ 30s.

## the resting loop
- t0: freshly cut grid, uniform 36 cubes, whey alpha ≈ 0.
- 2.5s: cubes visibly shrunk unevenly (jitter apparent), whey alpha ≈ 0.05-0.08.
- 5s: further shrinkage, wider gaps, whey alpha ≈ 0.15 — one stir jostle has likely already fired.

## reduced-motion freeze frame
Freeze at t=15s into the 30s cycle: cube sizes clearly varied (not uniform, not at floor), moderate whey pooling visible — the most structured mid-process frame, not the uncut or fully-drained extremes.

## interaction
None required. If hover is added, a hovered cube's local shrink rate may nudge slightly — must not recolor with `--ns-accent`; luminance/opacity change only.

## light vs dark theme
Curd cubes sit near `--background` with a faint `--border` separator between adjacent cubes at rest (never used as a gap fill); whey wash uses `--ns-muted` at low alpha, which needs checking in light theme where `--ns-muted` sits closer to `--background` and risks disappearing — bias the alpha curve higher in light theme if so.

## kill criteria
- If the shrinking grid reads identically to `vacuum-filtration-cake-build` once in motion (read that component first: continuous liquid-through-porous-cake buildup, one growing solid layer, no cutting) — kill unless the discrete cut + independently-shrinking cubes + periodic stir beat clearly differentiate at a glance.
- If per-cube jitter is imperceptible at card scale, kill (the mechanic depends on cubes visibly NOT shrinking in lockstep).

## legibility
The ONE thing to follow: the whey gap between two adjacent cubes visibly widening and brightening as syneresis proceeds. Cadence: continuous but punctuated by a stir jostle every 6s, giving the eye a discrete beat to re-anchor on between checks.
