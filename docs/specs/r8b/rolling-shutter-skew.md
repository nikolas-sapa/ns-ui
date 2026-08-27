# rolling-shutter-skew

- **slug:** `rolling-shutter-skew`
- **tier:** loud (full-bleed showpiece)

## Product surface (Filter 1)

Background — a full-bleed ambient page background.

## The real mechanic

CMOS rolling shutter. A CMOS image sensor does not capture every row at once
(that's global shutter); it scans photosite rows top-to-bottom over a
readout period `T_ro`. If the scene or camera moves during that readout,
each row is exposed at a slightly later instant than the row above it, so a
straight vertical line in the world is rendered as a sheared/bent line in
the frame — the "jello effect" seen on phone cameras and consumer camcorders
panning past a fence or window blinds.

**Explicitly not `flyback-tear`** (cut on owner review, CRT family): flyback
is a *display-side* sync failure — a discontinuous tear/roll where the beam
loses lock and the image jumps or rolls. Rolling shutter is *capture-side*
and continuous — no jump, no discontinuity, just smooth per-row time-shear
that bends straight lines into parallelograms. The failure mode being
avoided (CRT-family oversaturation) is a different physical stage of the
imaging pipeline entirely.

## Mechanic, one sentence

A grid of vertical rules bends into a shifting parallelogram as a simulated
camera pan sweeps back and forth, each row capturing the scene at a
slightly later instant than the row above it.

## Rendering approach

2D canvas, `w-full h-full`. Geometry derives from the container's smaller
dimension: `GRID_SPACING = containerMinDim / 24`, vertical rules only
(horizontal motion is what a rolling shutter skews; keep the grid simple so
the skew reads clearly against straight references).

## Real numbers

- Virtual sensor rows: `N = 48` (independent of actual canvas pixel rows —
  each of the 48 bands gets its own captured-time offset, then rows within
  a band interpolate).
- Readout period: `T_ro = 16.7ms` (1/60s progressive CMOS readout, typical
  consumer sensor).
- Pan velocity: `v(t) = 140 * sin(2π t / 5.8) + 22 * sin(2π t / 0.9)` px/s —
  a slow base pan (period 5.8s, deliberately non-round) plus a faster
  high-frequency wobble term (period 0.9s) standing in for handshake.
- Per-row capture-time offset: `captureTime(row) = t - (row / N) * T_ro`.
- Per-row horizontal displacement: `skew(row) ≈ v(captureTime(row)) * (row / N) * T_ro`,
  applied as a per-band `translateX` on the grid draw so vertical rules bend
  into a piecewise parallelogram rather than staying straight.
- Line weight: 1px at dpr 1, `--foreground` at 0.35 opacity.
- DPR cap: 1.5 (full-bleed area cost dominates; matches `weld-pool`).

## The resting loop

- **t0:** `sin(2π·0/5.8)` is near its rising zero-crossing with the wobble
  term adding local high-frequency ripple — grid shows a mild, slightly
  ragged rightward shear.
- **2.5s:** base pan term has swept past its first quarter-period peak and
  is descending — shear direction has reversed from t0, lines lean left,
  wobble ripple sits at a different phase.
- **5s:** base term near its next zero-crossing (different phase than t0
  because 5.8s and 0.9s don't share a short common period) — grid reads
  close to straight with the wobble term as the dominant visible
  displacement, a distinctly different composition from both earlier
  frames.

Continuous, unbounded, phase-driven — never finishes or resets.

## Reduced-motion freeze

`STATIC_TIME = 1.45` — a quarter into the base pan period, near peak
velocity, so the freeze shows clear asymmetric shear (not the near-straight
read that a `sin = 0` freeze would give, which would look inert).

## Interaction

None required. If present: pointer position may add a small, local,
instantaneous velocity kick to `v(t)` near the cursor (simulating a bump to
the camera) — it must decay back into the base sinusoid within ~400ms and
must never pause or gate the ambient animation; the background must stay
alive whether or not a pointer is present.

Must NOT: tint the skew with `--ns-accent`; make the grid discontinuous
(jump/tear reads as flyback, not rolling shutter).

## Light vs dark

Grid lines are `--foreground` at reduced opacity in both themes — no fill,
no gradient. Verify 1px lines stay visible in light theme at dpr 1 (bump
opacity if they wash out; don't reach for `--border`, which is ~1.1:1 and
will vanish).

## Kill criteria

- Reads as a generic "wavy lines background," indistinguishable from other
  ambient backgrounds in the registry once in motion — kill.
- Any visible jump/discontinuity in the grid (reads as tear/roll, not
  shear) — kill, that's the CRT family this concept exists to avoid.
- Skew imperceptible at card/full-bleed scale on a standard laptop panel —
  kill.
