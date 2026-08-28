# auger-flighting-spoil

- **slug:** auger-flighting-spoil
- **tier:** core (card-scale DOM/canvas)

## Product surface it replaces (Filter 1)
Loader — a continuous-work indicator (nearest siblings: `loader-thread-spool`,
`loader-spirograph-trace`), differentiated by an accumulating BYPRODUCT (the spoil pile) that
those loaders don't have, which is also what buys the unbounded resting loop.

## The real mechanic
A continuous-flight auger (earth auger, auger boring machine, or the flighting inside a screw
conveyor on a drill rig's cuttings-handling line) is a helical steel ribbon welded to a
rotating shaft. As it turns inside its casing, the helix's pitch mechanically advances loose
material along its length the way a screw advances into wood — cuttings/spoil enter at the
bottom (or the working end) and are conveyed to a discharge point, where they fall and pile up
under gravity into a cone-shaped spoil heap whose angle of repose is a real, named soil-
mechanics property (typically 30-45° for dry granular spoil).

## One-sentence mechanic description
A helical auger spins continuously, feeding material up its flighting to a discharge point
where it falls and the spoil pile at the bottom keeps growing and settling.

## Rendering approach
2D canvas: auger rendered as a vertical (or diagonal) tube with a scrolling helical stripe
texture (a repeating diagonal-band gradient offset each frame — cheap, no per-flight-turn
geometry needed) to read as continuous screw rotation. Spoil pile: a simple particle-settle
system, 40-60 live particles max, each a small filled circle that free-falls from the
discharge point and stacks against previously-settled particles (simple angle-of-repose
approximation: a particle stops when its would-be resting slope from the nearest settled
neighbor exceeds ~37°, otherwise it rolls one step downslope and rechecks). Geometry (tube
width, discharge height, particle size) derives from the container's smaller dimension.

## Real numbers
- Auger helix scroll rate: real earth augers run 40-100 RPM; render the helical stripe
  texture scrolling at a rate equivalent to **50 RPM** (0.83 rev/s) — this is a texture
  scroll, not a discrete-event cadence, so it does not trip the round 9 aliasing rule the way
  a strobe-like discrete flash would, but it must stay visibly SMOOTH (no visible stepping)
  at 60fps, i.e. sub-pixel stripe offset per frame.
- Discharge rate: one particle emitted every **420ms** — slow enough to watch each one fall
  and land individually, satisfying the discrete-event legibility floor.
- Fall: particle free-falls under a simple gravity constant (800px/s² scaled to container
  height) from discharge point to current pile surface height.
- Pile cap: once the pile reaches 85% of the available spoil-zone height, oldest settled
  particles are retired (fade out over 600ms) at the same rate new ones land, keeping the
  system in steady-state rather than ever overflowing or emptying — this is what makes the
  loop genuinely unbounded rather than "finishes and stops."
- Angle of repose check: 37° (dry sand/aggregate is commonly cited at 30-45°; 37° is a
  reasonable mid-value to document and use as the rolling threshold).

## The resting loop
- **t0:** auger mid-scroll (helix texture at an arbitrary phase, not aligned to any obvious
  start), pile at roughly 40% height with a few particles mid-fall.
- **2.5s:** pile visibly higher (more particles settled, roughly 6 new landings since t0),
  different particles mid-fall, helix phase advanced — silhouette of the pile has changed
  shape, not just height.
- **5s:** pile at or near steady-state cap with the retire-fade cycle visibly running (a
  particle fading at the bottom edge while a new one lands at top) — visibly different
  activity pattern from t0 (build-up) to 5s (steady-state turnover).

## The reduced-motion freeze frame
Freeze at the steady-state pile shape (85% height, symmetric cone, no mid-air particles) —
the most structured, most legible single frame of the mechanic, rather than a build-up frame
with the pile still asymmetric.

## Interaction
None required. If added: hovering the pile could report a rough "particle count" or "fill %"
in a tooltip — must not pause the auger scroll or particle emission, and must not tint
settled particles with `--ns-accent`.

## Light vs dark theme
Auger tube and helix stripe in `--ns-muted`/`--foreground` value steps against `--background`;
settled particles use a slightly lower-contrast fill than the auger itself so the pile reads
as a distinct material, not the same object. In light theme, confirm the helix stripe's two
alternating bands stay distinguishable — a shallow luminance step here is the most likely
light-theme failure (the fix is widening the ramp, not adding hue).

## Kill criteria
- If the particle-settle system reads as generic "falling dots" rather than a legible growing
  PILE with a stable angled silhouette, kill it — the angle-of-repose shape is the whole
  point, not just accumulation.
- If the steady-state retire-fade turnover isn't visually distinguishable from the build-up
  phase in an actual 5s+ screenshot check, the "alive at rest" claim is unverified — fix
  timing or kill.
- If it reads as a restyle of `loader-thread-spool`'s spinner-with-trail mechanic once built,
  kill it — the spoil pile accumulation must be the primary read, not the spinning tube.
