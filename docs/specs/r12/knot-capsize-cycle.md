# knot-capsize-cycle

**tier:** core

**product surface it replaces:** capacity/status gauge (a feedback-moment
card, adjacent to `meter-threshold-trip`/`gauge-capacity-waterline` — load
status expressed as knot topology rather than a fill bar or needle).

**the real mechanic, with source:** Knot capsizing under cyclic load — a
well-documented rigging behavior where an asymmetric binding knot (the
classic demonstration pair is the granny knot vs. the reef/square knot:
tied with the same crossings but the wrong second half-hitch) slips and
rolls into a different, weaker topology as load is applied, while its
symmetric counterpart locks and holds. This spec renders the granny-knot
capsize path specifically, as a real, named, reproducible failure mode
riggers test for, not an invented "knot under stress" abstraction.

**one-sentence mechanic description:** A binding knot is breathed through a
load cycle — slack, tension, peak, release — and at peak load its
asymmetric crossings visibly slide and roll into a capsized topology before
the next release lets it re-dress.

**rendering approach:** 2D canvas or SVG line art. The knot is drawn as a
small fixed set of parametric bezier loops (2 standing ends, 2 crossing
loops) whose control points are driven by a single scalar `load ∈ [0,1]`;
capsize is a scripted control-point interpolation between the "dressed"
and "capsized" control-point sets, not a physics solve. Geometry scaled
off `min(w,h)`.

**REAL NUMBERS:**
- Full breathing cycle `CYCLE = 8s`: ramp-up `4.5s` (load 0→1, eased),
  hold-at-peak `1.5s`, release `2s` (load 1→0, eased).
- Capsize transition: triggered once per cycle, starting at
  `load ≈ 0.92` (just before peak) and completing over `900ms` — control
  points interpolate from `DRESSED` to `CAPSIZED` sets, showing the near
  loop visibly sliding out and re-seating (departure of the old crossing,
  arrival at the new one), never an instant swap.
- Re-dress: during release (`load` crossing back below `0.3`), the same
  control-point interpolation runs in reverse over `700ms`, restoring
  `DRESSED` before the next cycle's ramp begins.
- Standing-end length modulates ±6% with `load` (visible tightening) so
  the cycle reads as tension even between capsize events.

**resting loop (t0/2.5s/5s):** t0: mid-ramp (`load ≈ 0.3`), loops loose,
standing ends slightly slack. At 2.5s: near peak (`load ≈ 0.85`), loops
visibly tightened, capsize about to trigger. At 5s: past peak, capsize
transition complete and now in the release phase (`load` falling,
`CAPSIZED` topology visible, distinct silhouette from both earlier marks).

**reduced-motion freeze frame:** named `CAPSIZE_MIDWAY` — the capsize
transition frozen at 50% interpolation between `DRESSED` and `CAPSIZED`,
loops mid-slide — the single most structurally information-dense frame,
showing the knot is neither fully dressed nor fully capsized.

**interaction:** none; ambient status gauge. Must NOT color-code load
level via `--ns-accent` (e.g. "red at peak") — peak tension reads through
line tautness (standing-end length/curvature) and the capsize event
itself, never a hue or accent cue.

**light vs dark:** knot line art drawn in `--foreground` at full value
throughout (a knot has no "dim" state that reads as sensible); the
breathing-cycle tautness is the only value cue and must remain legible in
light theme purely through curvature/geometry, not a value ramp that could
wash out.

**kill criteria:** if the capsize reads as an instant topology swap (blink)
rather than a visible slide-and-reseat, or if the granny/reef distinction
that motivates the whole mechanic isn't recognizable as knot-specific
geometry (i.e. it could pass for generic abstract line art) — reject.

**legibility:** the eye follows the knot's two crossing loops through one
full 8s breathing cycle — tightening as load ramps, then visibly sliding
into the capsized arrangement over 900ms right at peak load — a single
slow, repeating event a viewer can anticipate and watch arrive.
