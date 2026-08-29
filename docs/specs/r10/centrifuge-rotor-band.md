# centrifuge-rotor-band

- **slug:** centrifuge-rotor-band
- **tier:** core (card-scale canvas)

## Product surface it replaces
A loading/progress indicator — an alternative to a generic spinner for an
ambient "working" state.

## The real mechanic
Benchtop microcentrifuge spin-up/hold/brake cycle combined with
density-gradient ultracentrifugation banding (Svedberg sedimentation): a
rotor accelerates to operating speed, holds, then brakes back to rest, while
a sample tube's pre-loaded density bands drift outward under the applied
centrifugal force during the hold phase.

## One-sentence mechanic description
A centrifuge rotor accelerates to speed, holds, and brakes back down while a
sample tube's density bands drift outward and re-settle each cycle.

## Rendering approach
2D canvas. Geometry derives from `min(width, height)` of the container.
Rotor radius = 0.32 × min-dimension. Sample tube rendered as a thin radial
slot at 0° with 4 band markers along its length.

## Real numbers
- Spin-up ramp: 0 → 14,000 rpm over 4.5s (~3,100 rpm/s accel).
- Hold: 14,000 rpm sustained for 8s.
- Brake: 14,000 → 0 rpm over 6s (slower than accel — matches a regenerative
  brake, not a hard stop).
- Full cycle: 18.5s, then repeats unbounded.
- Visual spin rate is capped at 3 rev/s independent of the "true" 14,000 rpm
  figure — rendered as a translucent blurred ring once visual speed exceeds
  ~1.5 rev/s, never as a literal per-spoke rotation, to avoid aliasing
  against the paint rate.
- Rotor imbalance wobble: ±0.4px, damped, present only above 40% of ramp
  speed.
- 4 density bands at starting radii 22% / 38% / 55% / 71% of tube length.
  During the 8s hold, each band migrates outward by 3px (exaggerated from
  the real sub-pixel Svedberg rate for legibility). Bands reset to start
  position at the top of each new cycle (a real prep is reloaded between
  runs, so this reset is mechanically honest, not a cheat).

## The resting loop
- **t0:** rotor at rest, 4 static bands at their start radii, tube fully
  visible.
- **2.5s:** rotor mid-accel (rendered as motion-blurred spokes past 1.5
  rev/s), bands compressed very slightly toward center (inertial lag).
- **5s:** rotor at hold speed (steady blurred ring), bands visibly migrated
  outward from their t0 positions — the primary tell that time has passed.

## Reduced-motion freeze frame
Freeze at the **hold-phase midpoint** (cycle t=8.7s): rotor rendered as a
static translucent ring at full speed (no motion blur trail, no strobing),
bands at mid-migration between start and end radii. This is the most
structured single frame — both the spin state and the band drift are
legible without motion.

## Interaction
None required (ambient loader). If a hover state is added, it may only
brighten band luminance directly — never mix `--ns-accent` into the
highlight.

## Light vs dark theme
Rotor housing and ring use a 2-stop `--foreground`/`--ns-muted` luminance
ramp. Bands render as `--foreground` dots on the `--background` tube slot.
Check band contrast against tube fill specifically in light theme, where the
tube's fill must stay visibly lighter than the bands at every migration
step.

## Kill criteria
- If the visual spin cannot be decoupled from the real 14,000 rpm rate
  without reading as a strobe or a static disc, reject.
- If band migration (3px over 8s) is imperceptible at card scale by t=5s,
  reject.

## Legibility
The ONE followable thing: the four density bands migrating outward from the
tube's center during each 8s hold phase. Cadence: a steady, continuous 3px
drift over 8s per band (no discrete steps), paired with the rotor's blurred
ring as background context rather than the focal motion.
