# tonearm-skate

**tier:** core

**product surface it replaces:** a read-only quality/tracking gauge (the
"how well-aligned is this" family — sibling to `meter-threshold-trip`,
distinct from `dial-moire` and `clock-card`, both of which are rotary but
neither of which encodes a geometric error function across a swept arc).

**the real mechanic, with source:** a pivoted tonearm sweeping an arc
across a spinning record has a tracking (offset) angle between the stylus
and the ideal tangent-to-groove direction that varies geometrically across
the radius — near zero at two calculated null points (per Löfgren/Baerwald
alignment geometry), growing toward both the outer lead-in and inner
runout grooves. The same pivot geometry also generates an inward "skating"
force pulling the stylus toward the spindle, which is why every real
tonearm carries an anti-skate spring or hanging weight to counteract it;
an uncompensated arm produces audible inner-groove distortion and uneven
stylus/groove wear. Source: standard tonearm alignment geometry
(Baerwald/Löfgren two-null alignment, documented in any turntable setup
guide and anti-skate calibration procedure).

**one-sentence mechanic description:** an arm sweeps slowly across a
spinning disc, and a small error needle swings toward zero at two exact
points on the way in and drifts off it everywhere else.

**rendering approach:** SVG/DOM, top-down view: a rotating disc, a pivoted
arm with headshell sweeping across it, and a small tracking-error
indicator (needle or bar) reading a continuously-computed geometric value.
All geometry (disc radius, arm pivot offset) derived from the container's
smaller dimension.

**REAL NUMBERS:**
- Real turntable speed: 33⅓ RPM (documented only, deliberately decoupled —
  see the round-9 aliasing note). Rendered disc rotation: 1 revolution per
  4s.
- Real full-side play time: ~22 minutes (documented reference). Rendered
  arm traversal: outer lead-in to inner runout over 48s, continuous, then
  the arm lifts and resets to the outer edge to start the next "side" —
  unbounded loop, no dead stop.
- Tracking-error angle is a real geometric function of arm pivot-to-
  spindle distance (215mm, standard 9" arm) and current radius — not an
  invented wobble. Two null radii at 66mm and 120mm (standard Baerwald
  values for a 215mm arm); error swings to roughly +2° at the outer edge,
  crosses ~0° at each null, and reaches roughly −2° near the innermost
  groove.
- Skating force is shown as a constant ~3° inward lean of the headshell
  relative to the arm tube, with a faint anti-skate spring/thread line
  under visible tension — this offset is present throughout, not a
  discrete event.

**the resting loop:** t0 — arm at some radius mid-sweep, error needle at
whatever angle that radius implies. 2.5s — disc has completed 0.6+
revolutions (visibly different disc orientation), arm has advanced
~1/19th of the full traversal. 5s — arm at a clearly different radius,
error needle at a measurably different angle, likely having crossed one
null point if the window lands right.

**the reduced-motion freeze frame:** the arm frozen exactly at the first
null point (66mm radius) — needle centered at zero, chosen because it's
the single frame that shows both "here the geometry is correct" (needle
centered) and, by contrast with the arm's visibly non-radial position,
that error exists everywhere else on the sweep.

**interaction (if any) and what it must NOT do:** optional — dragging the
arm to manually scrub radius, with the tracking-error readout updating
live from the same geometric function. The error needle itself must never
use `--ns-accent` — represent higher error with weight/luminance change
only; accent is reserved solely for a focus-visible ring on a draggable
handle, never the needle or the arm.

**light theme vs dark:** disc as a stroked `--foreground` circle with thin
`--border` groove-ring ticks (true separator use, not load-bearing
geometry); arm and headshell solid `--foreground`; error needle
`--foreground` with weight (not hue) increasing at higher error magnitude.

**kill criteria:** if the tracking-error concept is unreadable without an
explanatory label (i.e. "null point" means nothing to a glance-level
viewer and the needle just looks like noisy jitter) — kill it. If the
disc-plus-sweeping-arm silhouette reads as a plain clock hand and gets
confused with `clock-card` or `dial-moire`, kill it and say so.

**legibility:** the ONE thing to follow is the small error needle swinging
toward center and away again. Cadence: a null crossing (needle centering)
happens roughly every ~20s during the 48s traversal, each crossing taking
1–2s to read clearly as "it centered, now it's drifting off again."
