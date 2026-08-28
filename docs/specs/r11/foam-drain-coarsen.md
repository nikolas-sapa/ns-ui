# foam-drain-coarsen

- **slug:** `foam-drain-coarsen`
- **tier:** loud (full-bleed showpiece, 2D canvas)

## product surface it replaces
A full-bleed hero/section background (same slot as `weld-pool`/`dye-whorl`/`background-lloyd-relax`).

## the real mechanic
Aqueous foam coarsening and drainage: cells obey von Neumann's law in 2D (`dA/dt = (pi*kappa/3)(n-6)` — a cell with more than 6 sides grows, fewer than 6 shrinks), triple junctions always meet at 120° (Plateau's first law), and liquid drains downward under gravity so the liquid fraction is highest near the base (wet, thick, rounded Plateau borders) and lowest near the top (dry, hairline borders, sharply polygonal cells) — the foam drainage equation. Source: foam physics (Weaire & Hutzler, *The Physics of Foams*; Plateau's laws; von Neumann's law).

## one-sentence mechanic description
A full-bleed cell mesh continuously grows large cells and shrinks small ones until they vanish, while its border thickness fades from hairline at the top to visibly thick at the bottom, slowly re-wetting from the base on a repeating cycle.

## rendering approach
2D canvas vertex-model foam mesh (not Lloyd relaxation — see kill criteria). Target cell count derives from container area: `targetCellSize = minDim / 9` (clamped [40px, 140px]), `N = round(area / targetCellSize^2)`. Junction vertices are nudged only toward local 120° equilibrium (Plateau's law), not toward cell centroids; cell area changes explicitly per von Neumann's law rather than by vertex relaxation.

## real numbers
- Growth constant: `kappa = 0.35` area-units/s per side-deficit — tuned so a full topology event (T1 edge-flip or T2 cell-death) completes roughly every 2-3s system-wide, not simultaneously across many cells.
- Cell death threshold: area < 6px² (triangular n=3 cells shrinking toward zero are the ones that vanish, per von Neumann's law).
- Border stroke width `w(y) = lerp(0.5px, 4px, clamp((y - topY)/(bottomY - topY), 0, 1))`, recomputed continuously as liquid fraction redistributes.
- Refill cycle: every 40s, a 6s upward wave raises the local liquid-fraction floor from the base (borders visibly re-thicken bottom-up), then drainage resumes — this is what keeps the loop unbounded instead of fully drying out and stopping, the same liberty `leaven-crest-fall`'s feed-pulse takes on its own mechanic.

## the resting loop
- t0: mixed cell sizes (4-8 sides), border gradient thin-top/thick-bottom already established.
- 2.5s: at least one T1 or T2 event has visibly completed somewhere in frame (a cell vanished or an edge flipped), overall dryness has progressed slightly since t0.
- 5s: 1-2 further topology events completed; either continued thinning or, if inside a refill window, the base has visibly re-thickened — either way, clearly different from 2.5s.

## reduced-motion freeze frame
Freeze at t=6s of the 40s cycle: clear thin-top/thick-bottom border gradient established, and at least one small triangular cell caught mid-vanish (smallest polygon on screen, about to disappear) — the most legible single structured frame.

## interaction
Pointer proximity may locally brighten borders near the cursor (luminance only, never `--ns-accent`). Must NOT trigger extra T1/T2 events on hover — the resting loop stays fully unforced regardless of pointer presence.

## light vs dark theme
Borders read as a `--foreground`-derived stroke over a `--background` fill, stroke width carrying the wetness gradient rather than hue; check light theme early since a hairline 0.5px stroke at low contrast risks disappearing entirely against a light `--background` — may need a minimum-contrast floor independent of the wetness-driven width.

## kill criteria
- **Primary risk — read `background-lloyd-relax` and `background-ascii-voronoi-walls` first.** If the resting frame is indistinguishable at a glance from either (a uniformly-toned relaxed cell mesh), this is a restyle and dies. The mandatory differentiators are (a) the height-graded border-width liquid-fraction gradient and (b) visible discrete T1/T2 events — a vertex model driven by von Neumann growth, never a centroidal relaxation. If a build can't make the top-to-bottom wetness gradient read clearly in both themes, kill.
- If topology events happen too fast/too many at once to track individually (see round-9 legibility lesson), kill or re-tune kappa down.

## legibility
The ONE thing to follow: a single small cell (the smallest polygon visible) shrinking to a point and vanishing, its neighbors closing the gap. Cadence: roughly one such vanish event every 2-3s somewhere in frame, so fixing on any one small cell lets a viewer watch it disappear within a few seconds.
