# crack-polygon-order

- **slug:** crack-polygon-order
- **tier:** core (card-scale DOM/canvas)

## Product surface it replaces (Filter 1)
Section divider / decorative panel fill — same slot as `craze-rule` and `compare-crack-seam`,
differentiated by mechanism: this is a hierarchical, self-completing polygon TESSELLATION
that keeps re-running forever, not a single instant-draw fracture (`craze-rule`, which draws
once via IntersectionObserver then idles) or a drag-driven seam on a comparison divider
(`compare-crack-seam`).

## The real mechanic
Desiccation (mud-crack) cracking in a drying clay or mud layer. Shrinkage stress builds as
the layer dries; the FIRST generation of cracks forms an irregular, widely-spaced network at
roughly random orientation. As drying continues, stress in the still-intact polygons between
those cracks builds until secondary cracks nucleate INSIDE each polygon and propagate until
they hit an existing crack — and because a crack is a free surface (zero stress), a new crack
almost always approaches an existing one and stops at very close to 90 degrees (a T-junction,
never crossing through). This repeats — tertiary cracks subdividing the daughter polygons —
until polygon size converges to a stable range set by the layer's thickness, at which point
the pattern is "mature." A real playa or drying paddy field then gets rewetted (rain, tide,
irrigation), the clay expands and heals the surface tension in the fine cracks, and the next
dry cycle re-cracks along a new, unrelated set of paths (old crack SHAPES may show as faint
scars but the crack raster itself does not repeat).

## One-sentence mechanic description
A crack-front grows and splits the panel into ever-smaller polygons — each new crack always
entering an existing one at a right angle and stopping there, never crossing it — until the
panel is fully tiled, then the whole panel rewets, heals over, and the tiling begins again
along new lines.

## Rendering approach
2D canvas or SVG (SVG preferred — path stroke-dasharray draw-in is cheap and crisp at any
DPR). Grid: no fixed lattice — crack seeds and growth directions are randomized per cycle
(seeded RNG so the same cycle can freeze deterministically under reduced motion), with
polygon count converging to 14-22 cells at card scale, derived from the container's smaller
dimension (`targetCells = clamp(round(minDim / 34), 10, 28)`). Each crack is grown as a
short-segment random walk (segment length 3-5px, turning noise ±12deg) that terminates the
instant it comes within 2px of another crack pixel/path (the T-junction test) or reaches the
panel edge.

## Real numbers
- Generation cadence: primary cracks (4-7 of them) all begin growing at t=0 of a cycle,
  advancing at **90px/s** per crack tip. Once every primary crack has either hit an edge or
  died, secondary cracks nucleate inside the largest 60% of remaining polygons after a fixed
  **900ms pause** (a real "next generation waits for local stress to rebuild" beat), also
  growing at 90px/s. This repeats for a third generation with the same 900ms pause rule.
  Total time from empty panel to fully tiled: roughly 6-8s depending on RNG.
- Hold: once no polygon is large enough to spawn a new generation (below a min-polygon-area
  threshold of ~900px² at 1x card scale), the mature tiling holds for **4s**.
- Rewet/heal: over the next **2.5s**, every crack's stroke opacity eases from 1.0 to 0.0
  (rewetting/swelling shut) using an ease-in-out, panel returns to blank.
- Cool-down: **600ms** blank pause (freshly rewetted, no visible stress yet) before the next
  cycle's primary cracks begin. Full cycle period: ~14-17s, non-uniform by design (seeded per
  cycle) so it never reads as a metronome.
- Crack stroke width: 1.5px hairline in `--foreground`, never `--border` (would fall below
  the 1.1:1 light-theme floor and vanish).

## The resting loop
- **t0:** an arbitrary mid-cycle frame — a partially tiled panel with some polygons already
  subdivided twice and others still large and uncracked (deliberately not started fresh).
- **2.5s:** several new crack tips actively mid-growth (visibly extending from t0's frame),
  at least one new T-junction having just formed.
- **5s:** either the panel has reached full maturity and is mid-rewet (opacity visibly
  dropping), or a fresh cycle's primary cracks are growing across a blank panel — either way,
  visibly different structure from both t0 and 2.5s.

## The reduced-motion freeze frame
Freeze at the mature, fully-tiled, pre-rewet hold frame (all three generations complete,
full opacity, 4s hold window) — the most structured single frame, showing the complete
hierarchy of primary/secondary/tertiary T-junctions at once.

## Interaction
None required. If added: hovering a polygon cell could show its generation number (1st/2nd/
3rd) in a tooltip — must not pause crack growth or trigger an early rewet, and must not tint
any crack with `--ns-accent`.

## Light vs dark theme
Cracks stroke in `--foreground` at full contrast in both themes (a hairline crack is thin
enough that `--ns-muted` would risk falling below the perceptual floor in light theme, so use
`--foreground` unconditionally rather than the usual muted-for-secondary-detail convention).
Panel fill is `--background`; no fill-based shading of individual polygons in either theme —
the tessellation must read from the crack lines alone, not from shaded cell faces (shading
would risk reading as elevation/hue rather than a flat dried surface).

## Kill criteria
- If new cracks visibly cross through existing ones instead of stopping at a T-junction, kill
  it — the T-junction rule is the entire identifying signature of desiccation cracking versus
  a generic Voronoi/crack-seam pattern (`compare-crack-seam` already owns free-crossing
  branch fissures).
- If the three-generation hierarchy isn't visually distinguishable (i.e. it just reads as
  "a crack pattern slowly filling in" with no sense of primary cells being subdivided), kill
  it — the ordering IS the mechanic, not the end-state tiling.
- If the rewet/heal phase reads as a simple fade rather than a legible "surface returning to
  blank before the next cycle," fix the easing or kill — a process that finishes and stops
  with no visible renewal fails Filter 2.
