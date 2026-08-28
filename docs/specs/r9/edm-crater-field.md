# edm-crater-field

- **slug:** `edm-crater-field`
- **tier:** loud (full-bleed showpiece)

## Product surface it replaces
Hero / full-bleed background — a metal-surface showpiece in the `weld-pool` family, but a distinct process (spark erosion, not a melt pool).

## The real mechanic
Electrical discharge machining (EDM): repeated electrical sparks between an electrode and the workpiece vaporize material, each discharge leaving a small crater with a raised recast rim. Under continuous machining, later discharges erode and flush away older recast material, so a real EDM surface reaches a statistical steady state — crater birth rate balanced by removal/flushing rate — rather than filling in solid. Source: EDM surface topography and recast-layer literature.

## One-sentence mechanic description
Sparks continuously pit a metal surface with small raised-rim craters that fade back to base as older craters are eroded by later discharges, holding the surface at a steady simmer of pockmarks rather than ever saturating.

## Rendering approach
WebGL, full-bleed, DPR cap 1.5 (per `weld-pool` precedent — full-bleed area cost dominates). Height-field texture at a resolution derived from the container's smaller dimension (e.g. 256x256 for a typical hero), each texel carrying a crater age; a normal-from-heightfield specular pass (value only, no hue, reusing the `weld-pool` lighting approach) makes craters read as raised rims through shading.

## Real numbers
- Discharge (birth) rate: 14 new craters/s, uniform-random position.
- Crater radius: 0.9%-2.2% of the smaller container dimension, varied per discharge (real crater size scales with discharge energy).
- Crater lifetime: 5.5s birth-to-fully-faded, linear luminance decay.
- Steady-state resident population: birth rate (14/s) x lifetime (5.5s) ≈ 77 craters visible at any moment — this constant is the density target, not a cap.
- Rim: raised luminance band at 1.15x the crater's own depth across the outer 15% of its radius (recast-rim read).

## The resting loop
- t0: pre-seeded to steady-state density immediately — never starts from an empty surface.
- 2.5s later: roughly half the visible craters have been replaced by new ones at different positions; aggregate density unchanged.
- 5s later: population has fully turned over again — same density, entirely different composition, which is what satisfies "visibly different" here.

## Reduced-motion freeze frame
Freeze on a seeded frame holding exactly the steady-state mean density (no growth transient visible). Named `FREEZE_PHASE = steady-state-lock`.

## Legibility
The one thing to follow: individual craters appearing, holding a raised-rim glint, and fading — a viewer can pick one crater and watch its 5.5s lifetime while the overall field density stays visually constant. Cadence: 14 births/s keeps any single crater's birth-to-fade arc well above the paint rate, so no strobe/alias risk (unlike a literal high-frequency mechanic driven 1:1).

## Interaction
Pointer position boosts local discharge rate 3x within a radius (electrode dwelling), decaying over 600ms after the pointer leaves. Must NOT: tint craters or rims with `--ns-accent` — this is the exact standing defect (`edge-yield`, `granule-churn`, `shear-billow`) the showpiece recipe calls out; the highlight is luminance-only, already carried by rim shading.

## Light vs dark theme
Dark: base near `--background`, craters recessed to a darker value, rims lifted toward `--foreground`. Light: same relationship inverted in bias/contrast (not a literal color swap), checked early per the recipe's "light theme is the harder case" rule.

## Kill criteria
Reject if: craters accumulate without the decay/removal mechanic (saturates-then-static is the exact Filter 2 failure this spec was written to avoid); rim shading needs a literal hue to read (fails monochrome-native); steady-state density falls under the perceptual floor at typical hero viewport height.
