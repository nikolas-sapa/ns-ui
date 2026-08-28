# grinding-chatter-lobes

- **slug:** `grinding-chatter-lobes`
- **tier:** core (card-scale canvas)

## Product surface it replaces
Loader / activity indicator — a card-scale spinner substitute with a real self-excited-process mechanic instead of an arbitrary rotation.

## The real mechanic
Regenerative chatter in cylindrical (OD) grinding. The wheel's previous pass leaves a faint wavy profile on the workpiece; the wheel re-cuts that wave on the next revolution with a phase lag between wheel and workpiece, and under the right speed ratio the wave self-amplifies into a stable lobed pattern (typically 5-15 lobes) before saturating against the contact stiffness of the wheel-workpiece system. Dressing the wheel clears the regenerative memory and the process restarts at a new lobe count. Source: regenerative chatter theory (Tobias/Merritt) as applied to cylindrical grinding, standard grinding-process-control literature.

## One-sentence mechanic description
A rotating disc's rim grows a wavy lobed profile as a grinding wheel re-cuts its own previous pass, the lobe count and amplitude breathing as the self-excited vibration ramps up and then self-limits, until a dress event clears it and a new lobe count begins.

## Rendering approach
2D canvas, polar plot. Disc radius = 0.38 * min(container width, height). Rim profile sampled at 360 angular bins (1° resolution), redrawn each frame from a coefficient (not per-pixel history) so cost stays flat.

## Real numbers
- Workpiece rotation: 0.15 rev/s (slowed from real 1-5 rev/s wheelhead speeds to stay legible at card scale).
- Lobe count N: picked per growth cycle from {5,6,7,8,9,10,11}, held fixed for that cycle (real chatter locks to one harmonic per stable cycle, doesn't jitter frame to frame).
- Amplitude growth: logistic self-limiting curve `A(t) = Amax / (1 + exp(-r*(t - t0)))`, Amax = 0.06 * radius, r tuned so growth visibly ramps from ~5% to ~95% of Amax over 6s, then plateaus (matches the real self-limiting saturation against contact stiffness — chatter doesn't grow unbounded).
- Dress event: every 40s, lobes fade to a smooth circle over 1.2s, a new lobe count is picked, and growth restarts from t=0 — phase-desynced start (offset derived from mount time, not always 0) so any two page loads show different states.

## The resting loop
- t0 (any point in a growth cycle, not necessarily cycle-start): rim already mid-growth with a partial lobed profile.
- 2.5s later: amplitude visibly further along its logistic curve, lobe crests taller.
- 5s later: either near-plateau (dense scalloping) or, if a dress landed in between, a smooth rim regrowing at a different lobe count — either way, visibly different from the 2.5s frame.

## Reduced-motion freeze frame
Freeze at the equivalent of 6.4s into a growth cycle (~70% of Amax) — lobes clearly formed but not yet fully plateaued, the most structured single frame. Named `FREEZE_PHASE = lobe-70pct`.

## Legibility
The one thing to follow: the rim's amplitude growing from near-circular to visibly scalloped. Cadence: a full growth-to-near-plateau arc takes 6s, well within the "roughly a second or slower, with visible departure and arrival" rule — this is continuous growth, not a discrete swap, so there is no blink to misread.

## Interaction
Pointer near the rim locally boosts amplitude growth rate ~1.5x within a 30° angular window (simulating locally applied contact pressure), decaying over 500ms after the pointer leaves. Must NOT: recolor the rim or lobes with `--ns-accent`; let hover trigger or delay the dress-event clock (global cycle stays independent of pointer, same rule as `peen-coverage`).

## Light vs dark theme
Rim stroke `--foreground`. Lobe fill/shading is a radial luminance gradient between `--background` and `--ns-muted` so scalloping reads as depth, not color. Checked in light theme first: the gradient's contrast is compressed in light mode so lobes stay visible without approaching `--border`-adjacent values.

## Kill criteria
Reject if: lobes are driven by per-frame random jitter instead of the logistic growth + periodic dress cycle (loses the self-excited-vibration read that is the entire point); if lobe count changes mid-growth-cycle instead of holding fixed until a dress event; if amplitude at minimum card width (rim scalloping) falls below the perceptual floor before the 2.5s checkpoint.
