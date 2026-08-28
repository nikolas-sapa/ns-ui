# serving-mallet-wind

**tier:** core

**product surface it replaces:** loader / processing indicator (a thin
ambient bar, adjacent to `progress-wick`/`progress-hatch` — a literal
chafe-protection process rather than a generic fill bar).

**the real mechanic, with source:** Serving a line (marlinspike seamanship):
protecting a rope from chafe by tightly winding small stuff (twine) around
it, worked with a serving mallet that both delivers turns and helps twist
them down snug so each turn lies flush against its neighbor with no gaps —
"worming, parcelling, serving" is the traditional full sequence; this spec
is the serving pass only. The mallet travels steadily along the rope's
length as it works.

**one-sentence mechanic description:** A serving zone travels along a rope,
tightly winding twine turn after turn so covered rope trails behind it and
bare rope always waits ahead.

**rendering approach:** 2D canvas. Rope drawn as a horizontal cylinder
(shaded via a luminance gradient across its diameter, no hue); diameter and
serving-zone width derived from `min(w,h)`. The rope itself is a continuous
horizontal feed (bare rope enters from the right, covered rope exits left)
so the serving zone can stay at a fixed screen position while work never
runs out.

**REAL NUMBERS:**
- Rope diameter `= min(w,h) / 8`.
- Continuous feed speed `FEED = 22px/s` (rope drift, bare-to-covered).
- Fine wrap texture: helical twine turns at `WRAP_PITCH = 4px` (turns lie
  side-by-side, fully covering) — rendered as a continuous scrolling
  texture inside the served region, not as discrete per-turn events (per
  the round's decoupling rule: the real serving rate is far faster than a
  followable cadence, so only the coarse texture moves at 1:1, no single
  turn is claimed as individually trackable).
- A separate, DECOUPLED discrete anchor: a bright turn-lock highlight
  sweeps once around the rope's circumference and snaps to the newest
  fully-seated turn every `LOCK_INTERVAL = 0.9s` — this is the one
  followable event, deliberately slower than the real mallet cadence.
- Served-zone width `= 46px`, fixed on screen; boundary between bare and
  served rope is a hard luminance step (served = higher-contrast ridged
  texture, bare = smooth flat gradient).

**resting loop (t0/2.5s/5s):** t0: served/bare boundary mid-frame, a
turn-lock highlight mid-sweep. At 2.5s: ~2 more lock events have fired (at
0.9s cadence), rope has drifted `22*2.5 ≈ 55px`, so the same absolute
served/bare boundary position now covers entirely different rope material.
At 5s: further drift, texture phase has cycled multiple times — visibly
different framing of the wrap texture at all three marks.

**reduced-motion freeze frame:** named `LOCK_SETTLED` — frozen exactly at
a `LOCK_INTERVAL` boundary (highlight fully snapped, not mid-sweep), served
and bare halves both clearly visible with the ridged-vs-smooth luminance
distinction at its most legible.

**interaction:** none; ambient loader. The turn-lock highlight must move in
luminance only (a brightness pulse in `--foreground`), never `--ns-accent`
— this is exactly the standing pointer-highlight pitfall the recipe
documents, applied to a non-pointer highlight.

**light vs dark:** served texture (ridged) vs bare rope (smooth) both
derive from `--foreground`/`--ns-muted` value contrast on top of a
`--background`-tinted cylinder gradient; verified the ridged/smooth
distinction doesn't collapse in light theme where the base gradient has
less headroom (bump ridge amplitude contrast, not add a color, if needed).

**kill criteria:** if the served/bare boundary isn't visually obvious
within 1s of looking, or if the fast wrap texture and the slow lock
highlight visually alias against each other (one cadence reads as jitter
on top of the other) — reject.

**legibility:** the eye follows the single bright turn-lock highlight
snapping to the newest completed turn once every 0.9s; the served/bare
rope boundary sliding past underneath (at 22px/s) is the slower background
confirmation that work is continuously consuming bare rope, not looping in
place.
