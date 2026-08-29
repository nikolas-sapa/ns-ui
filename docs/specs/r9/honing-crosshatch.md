# honing-crosshatch

- **slug:** `honing-crosshatch`
- **tier:** core (card-scale canvas)

## Product surface it replaces
Background / ambient card texture — a surface with a persistent process running behind foreground content, not a literal progress bar.

## The real mechanic
Cylinder bore honing: a rotating and reciprocating abrasive stone cuts two families of helical scratches across a bore surface at a controlled crosshatch angle (typically 30-60 degrees included) to produce a plateau-honed finish — a load-bearing plateau texture with oil-retaining valleys. The crosshatch angle is a deliberately controlled process parameter, not an incidental artifact. Source: engine-cylinder honing / plateau-honing process control.

## One-sentence mechanic description
Two families of fine scratches continuously deposit across a surface at a fixed controlled crosshatch angle, sweeping opposite diagonals, individual strokes fading out as new ones appear so the crosshatch density holds steady instead of ever filling solid.

## Rendering approach
2D canvas. Grid derived from the container's smaller dimension: base stroke spacing = min(width, height) / 40. Two stroke families at +CROSSHATCH_ANGLE/2 and -CROSSHATCH_ANGLE/2 from vertical.

## Real numbers
- Crosshatch included angle: 45 degrees (mid of the real 30-60 degree control range) — fixed, never varies.
- Deposit rate: 6 strokes/s per family (12/s combined), alternating A/B.
- Stroke length: 1.4x the grid spacing.
- Stroke lifetime: 4.5s birth-to-fully-eroded, linear luminance decay.
- Steady-state resident stroke count: ≈ 6 x 2 x 4.5 = 54 strokes at any moment (birth rate = death rate, so density holds constant — no accumulation).
- Overlap: strokes clamp luminance rather than stacking darker (matches real plateau honing, where a re-pass on already-plateaued area doesn't cut deeper — same clamp logic as `peen-coverage`'s dimples).

## The resting loop
- t0: texture pre-seeded to steady-state crosshatch density, never starts blank.
- 2.5s later: roughly half the visible strokes have turned over — different individual strokes, same aggregate angle and density.
- 5s later: fully turned over again, visible via stroke identity/position change rather than a density change.

## Reduced-motion freeze frame
Freeze on a seeded frame holding the mean steady-state density with both stroke families evenly represented. Named `FREEZE_PHASE = steady-crosshatch-lock`.

## Legibility
The one thing to follow: a single scratch stroke appearing and eroding along its diagonal — a viewer can pick one stroke and watch it fade over its 4.5s lifetime while the overall crosshatch angle and aggregate density stay visually constant.

## Interaction
Hover locally boosts deposit rate 2x within a radius (the stone dwelling), decaying over 500ms after the pointer leaves. Must NOT: recolor strokes with `--ns-accent`; change the crosshatch angle on hover — the angle is a fixed controlled process parameter, only density/rate may respond to interaction.

## Light vs dark theme
Dark: strokes render `--ns-muted` at birth, briefly brightening before decaying, over a `--background` base. Light: same relationship, contrast compressed and checked first so strokes don't read as `--border`-adjacent (invisible).

## Kill criteria
Reject if: the two families are not held at a fixed controlled angle (random angle scatter loses the entire point of citing a controlled crosshatch process); density is allowed to saturate solid or empty out (breaks the steady-state mechanic and Filter 2); strokes at minimum card width fall below the perceptual floor before the 2.5s checkpoint.
