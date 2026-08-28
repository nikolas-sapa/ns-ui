# millstone-furrow-flow

- **slug:** millstone-furrow-flow

- **tier:** core

## Product surface
An ambient background/divider panel for a "processing" section (data
grinding, batch transform) — replaces a static textured divider or a
generic radial-gradient panel.

## The real mechanic
Traditional stone-mill dressing: the runner stone's face is cut with
furrows radiating from the eye (centre) outward in a harp or sickle
pattern, each furrow with a leading "cutting" edge and a shallower
"feathered" trailing edge. Grain fed through the eye is carried outward by
centrifugal force and the furrows' scissoring action, being progressively
ground finer as it travels from centre (coarse, deep furrow) to rim
(fine, shallow furrow/land), exiting as meal at the stone's circumference.
Source: standard millwright furrow-dressing pattern (harp/sickle dress),
the geometry every operating stone mill still uses.

## Mechanic description
A radial furrow pattern rotates slowly beneath a field of grain particles
that spiral outward from the centre, shrinking into fine meal dust by the
time they reach the rim.

## Rendering approach
2D canvas, `w-full h-full`, DPR capped at 1.5. Stone face is a circle
inscribed at min(w,h) × 0.48 radius. Furrow count = 12 (sickle pattern,
matches typical millstone dress counts), each furrow rendered as a curved
line with depth encoded in luminance (deeper near centre = higher local
contrast, shallower near rim = lower contrast, matching the real dress).

## Real numbers
- Stone rotation: 0.08 rev/s (real runner stones turn ~120 RPM, deliberately
  decoupled and slowed for legibility per the round-9 rule — documented
  real rate, rendered rate is illustrative not literal).
- Counter-furrow moiré: the bedstone (stationary) is dressed with the same
  12-furrow sickle pattern, rendered as a second, static furrow layer
  underneath the rotating runner-stone layer. Where the two furrow sets
  cross, local line density doubles and produces a slow-drifting moiré band
  that sweeps around the stone once per runner rotation (~12.5s per full
  sweep at 0.08 rev/s) — this is the mechanic's OWN resting motion,
  independent of grain particles, so the furrow layer alone is alive at
  rest even with zero particles on screen.
- Grain feed: 1 particle every 0.9s spawns at the eye (centre, radius ≈ 4%
  of stone radius), size 5px.
- Outward travel: particle radius-from-centre increases at 14 px/s
  (accelerating slightly, ×1.15 easing, mimicking centrifugal build-up),
  reaching the rim (stone edge) in ~4.5s for a 240px-radius stone.
- Size decay: particle diameter shrinks linearly from 5px at the eye to
  1px at the rim (coarse-to-fine grind), and at the rim it disperses into
  a 3-6 particle "meal dust" puff (each 0.5px, 800ms fade) rather than
  simply vanishing.
- Particle angular drift: follows the stone's rotation partially (0.6× the
  stone's angular rate) plus its own outward radial path, so particles
  trace a shallow spiral, not a straight radius — visually ties them to
  the furrow pattern beneath.
- Steady-state particle count: ~5 mid-travel plus 0-2 dust puffs at any
  moment.

## Resting loop
- t0: stone at some rotation phase, moiré band at some angular position,
  3-5 particles at varying radii, sizes correspondingly varied.
- 2.5s: at least one particle has completed its outward run and dispersed
  into dust; stone furrow pattern visibly rotated (~7° at 0.08 rev/s) and
  the moiré band has swept to a visibly different angular position.
- 5s: full population turnover from t0's set; stone rotated ~14° total,
  moiré band roughly a third of the way through its ~12.5s sweep cycle,
  a second dispersal cycle underway.

## Reduced-motion freeze
Freeze with one particle at roughly 60% radius (mid-grind, mid-size) and
one dust puff mid-fade at the rim — the frame showing coarse feed at
centre, mid-size grind partway out, and finished meal dispersal at the
edge simultaneously, i.e. the whole process visible in one still.

## Interaction
None (ambient background/divider). Furrow depth luminance and grain
particles must never use `--ns-accent` — the centre-to-rim contrast comes
from a fixed luminance gradient on the furrow lines themselves (deeper cut
= more contrast against `--background`), not from any interactive tint.

## Light vs dark
Furrows rendered as `--ns-muted`-toned lines with a per-furrow contrast
gradient (higher near centre, ~1.6:1 against `--background`; lower near
rim, ~1.15:1, but never as low as `--border`'s dedicated 1.1:1 separator
value since these lines are meaningful surface texture, not a divider).
Grain particles are `--foreground` at full opacity; dust puffs fade through
the same tone at reduced opacity. Check specifically that the near-rim
furrow lines stay above the noise floor in light theme — bump the minimum
contrast to 1.25:1 if a check comes in flush against `--border`'s value.

## Legibility
The one thing to follow: a single grain particle's outward spiral from
centre to rim, shrinking as it goes and ending in a dust dispersal. Cadence:
one new particle every 0.9s, each particle's full transit taking ~4.5s —
gives a viewer several particles in flight at once (staggered starts), so
there's always one to pick up and follow through its full arc.

## Kill criteria
Reject if: the two-layer furrow moiré (runner over bedstone) doesn't read
as a moving band independent of the particles — verify with particles
disabled entirely that the furrow layer alone is visibly different at
t0/2.5s/5s; if it isn't, this is a restyle of an existing radial/spiral
background and should be killed; if particle count needed for legibility at
card scale exceeds what reads cleanly (clutter) — drop feed rate before
killing; if the size-shrink-to-dust-puff reads as particles simply
disappearing rather than grinding into meal (must show visible size decay,
not a discrete swap).
