# magnetron-racetrack-sweep

**tier:** loud (full-bleed background).

**product surface it replaces:** background.

**the real mechanic:** sputter target erosion racetrack. A magnetron's
magnetic field behind a planar sputter target confines plasma into an
annular "racetrack" band that erodes the target face; in production PVD
coaters the racetrack position is swept back and forth (rotating or
oscillating magnet assembly) specifically so erosion doesn't dig one fixed
groove and waste the rest of the target. Source: rotating/oscillating
magnetron cathode design in production physical vapour deposition.

**one-sentence mechanic description:** A magnetron's racetrack of plasma
sweeps back and forth across a sputter target, the target's face slowly
deepening into a groove wherever the racetrack has lingered.

**rendering approach:** WebGL, full-bleed. A persistent, never-cleared
height-field accumulation buffer holds erosion depth (same non-clearing
accumulation technique as `rime-creep`, different physical mechanic — carve
not grow). A separate luminance-only glow ring is drawn on top each frame
from the current racetrack radius, explicitly never colour-tinted (real
sputtering plasma glows violet/pink — that hue is deliberately discarded).

**REAL NUMBERS:**
- Racetrack radius oscillates between 0.3 and 0.7 of target radius.
- Oscillation period: 22s (real production sweep periods run tens of
  seconds to minutes; this is a light slowdown, documented explicitly
  rather than left implicit).
- Racetrack ring width: `0.08 * targetRadius`.
- Erosion accumulation rate: 0.002 depth-units/s wherever the ring
  currently sits — monotonic, never decays (matches real physical
  erosion), so the groove is a slow structural bias layered under the
  faster ring motion, not the primary alive-at-rest signal.

**the resting loop:** t0 — glow ring at one radius along its sweep,
existing erosion groove faint. 2.5s — ring has visibly moved to a
different radius, groove very slightly deeper where it lingered. 5s — ring
further along its 22s oscillation (direction may not yet have reversed),
groove now showing visible asymmetry between inner and outer bands.

**the reduced-motion freeze frame:** `STATIC_T` at sweep phase = 0.5 (ring
at mid-radius, with the dual-band erosion asymmetry already visible so
structure reads at a glance), named `"racetrack-mid"`.

**interaction:** pointer hover locally brightens the glow ring near the
cursor, luminance-only, no accent, and must not perturb the underlying
sweep oscillation itself (the sweep is a fixed physical cycle, not
pointer-driven).

**how it reads in light theme vs dark:** erosion depth reads via a value
ramp where material removed shows as lower relative luminance than the
surrounding fresh target face — that relative relationship holds in both
themes; only global bias/contrast shifts per the weld-pool convention,
never a direction flip that would make "eroded" read as "brighter" in one
theme.

**legibility:** the one thing to follow is the glow ring's radius sweeping
continuously between its inner and outer bounds — at a 22s period that's
roughly 0.018 radius-units/s, slow enough to track by eye as motion rather
than a jump, and explicitly decoupled from the real magnetron field-switch
rate (kHz-MHz) which would alias into noise if rendered 1:1.

**kill criteria:** if the glow ring reads as a generic rotating
spinner/loader rather than a physical erosion process (no accumulating
groove context legible under it), kill. If slowing the sweep to 22s reads
as inert rather than alive, and tightening the period to compensate then
reads as spinner-fast, kill the concept rather than force a period that
satisfies neither.
