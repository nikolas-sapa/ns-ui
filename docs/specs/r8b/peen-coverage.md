# peen-coverage

- **slug:** `peen-coverage`
- **tier:** core (card-scale DOM/canvas)

## Product surface it replaces
Background / ambient card texture — a surface with a persistent process running behind foreground content, not a literal progress bar.

## The real mechanic
Shot peening. A stream of small round media (shot) is blasted at a metal surface at high velocity; each impact leaves a shallow dimple, and quality is graded by "coverage" — the percentage of surface area that has been dimpled — not by time or shot count directly. Coverage follows an Avrami-type saturation curve (new impacts increasingly land on already-dimpled area as coverage rises), and shops explicitly re-run passes until 100–200% coverage (200% meaning, statistically, twice the exposure needed to nominally cover the surface once). Source: standard shot-peening process control (aerospace/automotive spring and gear surface treatment, per SAE/AMS peening specs).

## One-sentence mechanic description
A stream of shot continuously pelts a surface, each impact stamping a small dimple, coverage climbing toward saturation and then resetting to a fresh unpeened pass rather than ever stopping.

## Rendering approach
2D canvas, DPR-capped 2. Sim grid derived from container's smaller dimension: cell size = min(width,height)/48, so a dimple is roughly one grid cell. Impacts tracked as a coverage bitmap (Uint8Array at grid resolution) rather than per-particle history, redrawn each frame from the bitmap so cost stays flat regardless of total impacts.

## Real numbers
- Impact rate: 90 impacts/s distributed across the surface (mapped down from real peening's far higher physical rate — thousands/s — to a rate that reads as discrete stamps rather than a continuous field, matching the "individual dimple" read the mechanic needs).
- Impact position: uniform-random across the container, matching real peening's nominally uniform nozzle sweep coverage assumption.
- Coverage saturation: `C(t) = 1 - exp(-k*t)`, k tuned so nominal 100% coverage (by the statistical definition, not literal 100% of pixels) is reached at t=8s; the pass continues to a visual 200%-equivalent at t=16s before resetting.
- Dimple visual: each impact stamps a soft circular indent (radius = 1.3 cells) that darkens the surface luminance by a fixed step; overlapping dimples clamp rather than stack (stamping twice does not double-darken — matches real peening, where a second hit on covered area doesn't create a deeper dimple, just re-confirms coverage).
- Reset: at t=16s the bitmap fades back to unpeened over 700ms (a visible "fresh part loaded" beat) and the cycle restarts from t=0 — this is the one place the mechanic is allowed to have a clear start, because a resting real-world peening line is a sequence of parts, not one part run forever.

## The resting loop
- t0 (of any cycle): near-blank surface, a handful of scattered fresh dimples.
- 2.5s into a cycle: coverage visibly patchy (~25–30% by the saturation curve), individual dimples still mostly distinguishable.
- 5s into a cycle: coverage denser (~45–50%), texture reading as a continuous stippled surface rather than discrete dots — since cycles are 16s and phase-desynced from page load (start offset = a value derived from mount time, not always 0), any two page loads show different coverage states, and within one mount the three checkpoints are visibly distinct textures.

## Reduced-motion freeze frame
Freeze at the coverage level corresponding to t=6s of a cycle (~55% coverage) — dense enough to read as "an active process," not blank, not saturated flat. Named: `FREEZE_PHASE = 55pct-coverage`.

## Interaction
Hover/focus over a region locally boosts impact rate 2× within a radius (nozzle "dwelling" there, a real peening-operator behavior), decaying over 500ms after pointer leaves. Must NOT: tint hovered dimples with `--ns-accent`; must NOT let hover push a region past the pass's global reset timer (local rate change only, global cycle clock is untouched).

## Light vs dark theme
Dark: unpeened surface at `--background`, dimples darkening toward `--ns-muted` (peened = duller/rougher reads as slightly lower luminance, matching a shot-blasted matte finish against a level backdrop). Light: same directional logic but the delta is compressed and the base surface must lean toward `--ns-muted` rather than pure `--background` so dimples have room to read a step darker without crossing into `--border`-adjacent values or vanishing — checked in light theme first.

## Kill criteria
Reject if: the coverage curve is dropped for even/tiled dimple placement (loses the visible "new hits increasingly overlap old ones" saturation read that is the entire point of citing coverage, not shot count); if the reset beat isn't legible as a deliberate new-pass restart (looks like a bug/glitch instead); if dimple density at minimum card width falls below the perceptual floor before the 5s checkpoint.
