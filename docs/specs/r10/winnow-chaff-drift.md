# winnow-chaff-drift

- **slug:** winnow-chaff-drift
- **tier:** loud

## Product surface
Full-bleed hero/background for a "processing" or "filtering" landing
moment (e.g. a data-cleaning or triage product) — replaces a generic
particle-field hero background.

## The real mechanic
Winnowing: a mixed charge of grain and chaff is tossed or dropped through a
cross-current of air (traditional winnowing basket toss, or a fanning
mill's forced draft). Heavy grain has enough momentum to fall through the
airstream on a near-vertical path; light chaff is light enough that drag
dominates and it is carried laterally, drifting off to one side before it
lands. Source: traditional hand-winnowing and 19th-century fanning-mill
grain cleaning — the physical separation is purely a mass-to-drag ratio
under a constant crosswind, no sorting mechanism beyond gravity and air.

## Mechanic description
A falling stream of particles splits into two visibly different paths: dense
grain drops straight down, light chaff sails sideways on the same crosswind.

## Rendering approach
2D canvas, `w-full h-full`, DPR capped at 1.5 (full-bleed cost). Particle
count and crosswind field derived from the container's smaller dimension —
field width in "wind cells" = floor(min(w,h) / 24), each cell holding a
locally-varying lateral drift value (Perlin-noise-driven, updated slowly)
so the wind reads as a coherent gust field, not per-particle noise.

## Real numbers
- Spawn rate: 6 particles/s at a random x across the top edge.
- Grain particles: 65% of spawns, radius 2-3px, terminal fall speed
  180 px/s, horizontal drift ≤ 8 px over the full fall (mass dominates drag).
- Chaff particles: 35% of spawns, radius 4-7px (visually larger but far
  lighter — reads via shape/softness, not colour), terminal fall speed
  45 px/s, horizontal drift up to 220 px over the full fall, following the
  crosswind field directly (drift coefficient 0.85 of local wind value).
- Crosswind field: 1 gust cycle every ~9s (slow sine drive on a base lateral
  value, ±40 px/s), overlaid with Perlin noise updated at 2Hz for local
  gust texture — no cell updates faster than 2Hz, keeping it well under
  paint rate and avoiding the strobe failure mode from round 9.
- Particles despawn 40px past whichever container edge they exit (bottom
  for grain, either side or bottom for chaff).
- Standing particle count at steady state: ~90-140 depending on container
  height (taller container = longer average lifetime).

## Resting loop
- t0: an even scatter of grain (falling straight, tight column) and chaff
  (fanned laterally) mid-fall, wind gust at some phase.
- 2.5s: gust phase has visibly shifted the chaff fan's mean lateral offset;
  different individual particles present.
- 5s: gust has completed roughly half a cycle, chaff drift direction/extent
  visibly different from t0 (may have reversed if gust sine has crossed
  zero); grain column remains tight and centred throughout (the invariant
  that sells the separation).

## Reduced-motion freeze
Freeze at a gust-cycle extremum (peak lateral wind value, not zero-crossing)
with a full population of particles present: grain in a tight vertical
column, chaff fanned maximally to one side — the frame that most clearly
shows the mass/drag separation, the component's entire point.

## Interaction
None (ambient hero background). Must NOT tint chaff or grain with
`--ns-accent` to "explain" which is which — the separation must read from
trajectory and size/softness alone, per the monochrome mandate.

## Light vs dark
Both particle classes rendered as `--foreground`-derived tone at reduced
opacity (grain ~70%, chaff ~40% — chaff is visually softer/lighter, an
honest luminance analogue of "light enough to be blown," not a colour cue).
Background stays `--background` with no gradient. Check specifically that
chaff remains legible against a light background at 40% opacity — bump to
50% in light theme if a contrast check falls under 3:1 against
`--background`.

## Legibility
The one thing to follow: the lateral gust drifting the chaff fan back and
forth while the grain column stays put. Cadence: ~9s per full gust cycle —
slow enough that the eye tracks a clear directional trend rather than
jitter, on an unbounded loop so there's always a next phase to watch.

## Kill criteria
Reject if: grain and chaff become visually indistinguishable without a size
or opacity cue reading as "one is just paler" rather than "these are two
different physical things"; if the gust cycle is too fast to perceive as
directional drift (must hold well under paint rate per round 9's lesson);
if it reads as generic falling-particles regardless of the two-population
split (must A/B distinctly against `hero-particles-webgl` and the ASCII
falling-field family before shipping).
