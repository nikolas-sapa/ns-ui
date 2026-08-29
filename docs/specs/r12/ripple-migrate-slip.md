# ripple-migrate-slip

- **slug:** ripple-migrate-slip
- **tier:** loud (full-bleed showpiece)

## Product surface it replaces (Filter 1)
Hero / full-bleed background — same slot as `weld-pool`, `dye-whorl`, `winnow-chaff-drift`,
differentiated by mechanism: this is a granular BEDFORM migrating under wind-driven grain
transport (reptation/saltation impact + slipface avalanche), not a convective plume field
(`granule-churn`), a falling-particle mass/drag separation (`winnow-chaff-drift`), or a
resonant standing-wave sand pattern (`sand-lock`, which collapses onto Chladni nodal lines
rather than migrating directionally).

## The real mechanic
Aeolian (wind-driven) sand ripples on a dune surface or beach. Wind-blown grains move by
saltation (long hops) and reptation (short hops kicked up by saltation impacts). Reptating
grains pile up preferentially on the STOSS (windward, gently-sloped) side of any small
existing bump, because a grain landing there is more likely to be trapped by the local slope
than one landing on flatter ground — this positive feedback is what grows and sustains a
ripple train rather than smoothing it flat. As the stoss-side pile grows past the local angle
of repose (~34deg for dry sand), the LEE (downwind) face periodically avalanches — a small
grain-flow slip that steepens back to a stable slope and pushes the ripple crest one step
further downwind. The net effect over many such slips is that the entire ripple TRAIN
migrates downwind at a rate much slower than any individual grain's hop, while each ripple's
asymmetric profile (gentle stoss, steep lee) is continuously rebuilt rather than static.

## One-sentence mechanic description
A field of asymmetric sand ripples creeps steadily downwind as their gentle windward faces
keep growing until each one's steep lee face gives way in a small avalanche, kicking the
whole ripple train one step further along.

## Rendering approach
2D canvas, full-bleed. A 1D heightfield (one column per horizontal pixel-bucket, bucket width
derived from the container's smaller dimension: `bucketPx = clamp(round(minDim / 240), 2, 4)`)
represents the sand surface profile, rendered as a filled silhouette with a subtle grain-
texture stipple on the stoss faces only (cheap: a fixed dither mask sampled by local slope
sign, not per-grain simulation — a full grain particle system is `winnow-chaff-drift`'s
territory, this component owns the BEDFORM not individual flight paths). Ripple wavelength at
card/full-bleed scale: 28-42px between crests, several ripples visible across the frame width
at once.

## Real numbers
- Stoss accretion: each ripple's windward flank height grows at **0.6px/s**, continuous, not
  event-based (this is the "many small reptation landings" approximation — individually
  invisible, only their accumulated effect is drawn).
- Slip trigger: when a flank's local slope exceeds **34deg** (angle of repose), that
  ripple's lee face avalanches — a discrete event, not continuous. Because different ripples
  across the frame reach threshold at slightly different times (seeded per-ripple phase
  offset), avalanches are staggered rather than simultaneous, giving a roughly **1 avalanche
  event per 1.1-1.6s** somewhere in the visible field — inside the round 9 legibility floor
  for a single followable event, even though many ripples exist at once.
- Slip kinematics: the avalanche itself takes **260ms** (fast relative to the slow accretion)
  — the lee face redraws from its pre-slip overhang to its post-slip stable angle, and the
  ripple's whole profile shifts **1.5-2.5px downwind** as part of that same redraw, which is
  the actual migration step.
- Net migration rate: at roughly one avalanche per ripple every ~9-12s (staggered across the
  field so it never looks synchronized) and ~2px per event, the train migrates at
  approximately **0.2px/s** net downwind — slow enough that migration is only obvious over
  the 2.5s/5s comparison, not per-frame, matching how real ripple migration is imperceptible
  moment-to-moment and obvious over a timelapse.
- Wind gust modulation: a slow global sine (11s period, ±25% amplitude) scales the stoss
  accretion rate, so avalanche frequency visibly breathes in and out rather than holding a
  perfectly even cadence.

## The resting loop
- **t0:** an arbitrary mid-cycle frame — several ripples at different points in their
  accretion cycle, no avalanche active, asymmetric stoss/lee profile clearly visible.
- **2.5s:** at least one avalanche has fired and completed since t0 (visible profile shift on
  that ripple), overall crest positions measurably shifted downwind versus t0.
- **5s:** cumulative downwind shift is clearly visible when compared to t0 (roughly 1px net,
  but 2-3 avalanche events will have fired somewhere in the field by then, each individually
  obvious at the moment it happens), gust modulation phase visibly different.

## The reduced-motion freeze frame
Freeze mid-way through an avalanche's 260ms redraw (lee face partially collapsed, an
overhang still visible above the new stable line) — the single frame that shows both the
pre- and post-slip geometry at once, more structured than a fully-settled resting profile.

## Interaction
None required (ambient full-bleed background). If pointer interaction is added, it may only
locally accelerate stoss accretion near the cursor (as if the wind picked up locally) — must
NOT tint any ripple with `--ns-accent`, must not trigger an avalanche synchronously with the
pointer (that would make the mechanic read as a toy rather than an ambient wind process).

## Light vs dark theme
Ripple silhouette fill in a `--background`-to-`--foreground` luminance ramp (stoss faces
slightly darker via the stipple texture, lee faces flat), no `--ns-muted` needed since this
is a single continuous surface, not a multi-material scene. In light theme, confirm the
stipple texture on stoss faces stays visible — a light-theme stipple risks reading as a flat
grey wash if the dither contrast isn't widened relative to the dark-theme version.

## Kill criteria
- If the avalanche events don't read as distinguishable discrete slips (i.e. the whole
  silhouette just looks like it's continuously wobbling), kill it — stoss-build-then-lee-slip
  is the entire mechanism, not ambient jitter.
- If the net downwind migration isn't visible in a real 5s screenshot comparison even though
  individual avalanches are, fix the migration-per-event number or kill — "alive at rest" for
  a bedform means the FORM moves, not just that something flickers.
- If it reads as a restyle of `winnow-chaff-drift`'s falling-particle field once built, kill
  it — this component must own the standing bedform silhouette, never individual flying
  grains.
