# lap-stroke-trace

**tier:** core (card-scale canvas texture)

**product surface it replaces:** background / ambient card texture (same slot as
`background-ascii-*` and `honing-crosshatch` — a panel filler that stays alive
behind other content, not a settings/admin surface).

**the real mechanic:** pitch-lap polishing of an optical mirror blank. A pitch
lap smaller than the workpiece is worked across the surface under pressure in
a continuously-varying stroke (classically a "W-stroke" or randomised
Prescott stroke) so that no single point of the lap ever repeats the exact
same path over the glass — repetition would print a ring or zone into the
figure. Source: classical optical-shop and amateur-telescope-making mirror
grinding/polishing practice (Texereau, *How to Make a Telescope*; Ceravolo
stroke patterns).

**one-sentence mechanic description:** A polishing lap traces an
unrepeating, ever-extending stroke across a rotating mirror blank, glowing
brightest at its most recent pass and fading as pressure moves elsewhere.

**rendering approach:** 2D canvas, direct rAF. The stroke is a single
continuously-extended polyline (not a particle field) computed from two
superimposed rotations: workpiece rotation and lap-arm oscillation, at an
irrational frequency ratio so the path never closes. Stroke width derives
from the container's smaller dimension: `strokeWidth = min(w,h) / 180`. Disc
radius = `0.42 * min(w,h)`.

**REAL NUMBERS:**
- Workpiece rotation: 0.05 rev/s (slowed from real shop rates of ~0.3-1
  rev/s for card-scale legibility).
- Lap-arm angular rate: workpiece rate × φ⁻¹ (golden ratio, ≈0.618) — the
  irrational ratio is what keeps the traced path from ever closing or
  visibly repeating.
- Trail history retained: 8s of path, oldest 3s of that fades linearly to
  0% opacity (a 5s fully-bright window, 3s fade tail).
- Peak trail luminance decays to 40% of head brightness by the fade point.
- New path length added per second: matches the combined angular rate, ~46
  px/s of arc length at 0.42×360px disc radius on a 360px card.

**the resting loop:** t0 — trail freshly seeded, a short bright arc near one
edge of the disc, most of the disc still bare. 2.5s — trail has extended
roughly a third of the way around the disc, head clearly advanced from t0,
tail beginning to fade. 5s — trail has wrapped further still, earliest
segments from t0 now fully faded and gone, head in a position that does not
match any earlier frame (irrational ratio guarantees no near-repeat within
this window).

**the reduced-motion freeze frame:** `STATIC_T = 6.0s`, named
`"half-lap"` — trail arcs cover roughly half the disc's circumference with
a clearly bright head and a visible fade gradient behind it, the most
structured single frame available (a t0 seed frame would be too sparse to
read).

**interaction:** pointer proximity to a stroke segment locally boosts that
segment's brightness within a ±15° window, decaying back over ~500ms after
the pointer leaves — the same local-pressure idea as a lap dwelling
slightly longer where the operator is checking pressure. Must NOT: use
`--ns-accent`, change the underlying stroke frequency ratio (would read as
a glitch/skip), or pause the base motion.

**how it reads in light theme vs dark:** dark theme — trail head near
`--foreground`, fading through `--ns-muted` toward `--background`. Light
theme — same ramp, bias/contrast retuned per the weld-pool convention (not
inverted direction): the disc stays a coherent value field in both themes,
never a hue shift.

**legibility:** the one thing to follow is the bright trail head advancing
continuously along its arc. It reads as followable because on-screen head
speed stays under ~50px/s (well below anything that could read as a
strobe or jump) and the irrational stroke ratio means the head never
revisits the same position within the 5s observation window, so continuous
motion reads as genuinely live rather than a repeating loop.

**kill criteria:** if the golden-ratio stroke is perceptually
indistinguishable from a simple closed loop within 5s of observation, or if
it reads as generic decorative Spirograph rather than a lap dressing a
mirror blank (no disc/blank framing, no pressure-dwell interaction), kill.
