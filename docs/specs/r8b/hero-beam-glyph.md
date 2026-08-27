# hero-beam-glyph

**tier:** loud

**product surface it replaces (Filter 1):** full-bleed hero wordmark —
same slot as `hero-ascii-wordmark`, `hero-letterpress-lockup`,
`hero-recursive-type`, `hero-oscilloscope` (a different mechanic on the
same surface).

## The real mechanic

XY vector CRT displays (1980s arcade vector hardware — Asteroids, Tempest,
Star Wars, Vectrex — plus oscilloscope/vector-scope character generators)
draw everything, including text, by physically deflecting an electron beam
along stroke paths rather than raster-scanning a grid. Text is rendered
from stroke-font data (the historical reference is the Hershey vector
fonts, single-stroke letterforms designed for pen plotters and vector
displays) where the beam traces each letter's strokes directly. Because
there is no shutter or pixel grid, a vector CRT's brightness at any point
on the trace is a direct function of **beam dwell time**: the beam moves
fast along long straight runs (dimmer, less time deposited per unit
length) and slows or briefly pauses at direction-change vertices and
stroke endpoints (brighter — this is why vector arcade text visibly
"glows" at its corners). Source: vector-monitor beam physics as documented
in arcade vector hardware (Atari's AVG, the "Analog Vector Generator") and
Hershey stroke-font construction.

## One-sentence mechanic description

A full-bleed hero wordmark drawn as a genuine stroke-based vector font —
not a filled or raster glyph — whose per-segment brightness comes from
simulated inverse beam speed, so corners and stroke endpoints glow
brighter than straight runs, continuously re-traced the way a real vector
CRT refreshes its display every frame.

## Rendering approach

2D canvas (line drawing with a glow/blur composite for the beam bloom; no
WebGL dependency needed for stroke rendering, though a WebGL line-strip
approach is acceptable if it hits the frame budget more reliably). Letter
geometry: self-authored single-stroke path data for the wordmark
characters (Hershey-style — one continuous poly-line per glyph, pen-up/
pen-down segments where letters have disconnected strokes), not the
registry's existing raster/block glyph fonts. Geometry scales from the
container's smaller dimension so the wordmark reads at card scale as well
as full-bleed.

## Real numbers

- `REFRESH_HZ = 36` — the beam completes one full wordmark trace 36
  times/sec, matching the commonly cited ~30-40Hz refresh range of real
  vector arcade hardware under moderate scene complexity (draw list length
  directly determined real hardware refresh rate; 36 sits mid-range).
- Per-pass draw budget ≈ `1000/36 ≈ 27.8ms`.
- Segment beam speed range: `400-2200 px/s` along the stroke path — long
  straight runs traced near the top of that range, corners/vertices
  dropping toward the bottom, producing the dimmer-line/brighter-corner
  contrast that is the component's entire identity. Brightness per point
  ∝ `1 / max(speed, epsilon)`, clamped so vertices cap at ~3x the baseline
  straight-run brightness (not unbounded — an unclamped 1/speed blows out
  to a hot white dot).
- `DECAY = 0.85` per retrace — each new pass's brightness buffer is the
  previous pass's buffer multiplied by 0.85 before the new trace adds in,
  giving a short multi-frame phosphor trail. This is deliberately a
  per-frame multiplicative decay (a handful of frames' worth of persistence
  at 36Hz), NOT `flyback-tear`'s whole-seconds broadcast-signal decay —
  keep the two mechanically distinct: this is short-persistence phosphor
  on a live vector beam, that is a failing broadcast timebase.
- Beam jitter (simulated deflection-coil hum): `±1.5px` positional noise
  applied per-vertex, refreshed independently of the trace rate (~60Hz),
  so the trail itself is never perfectly stable frame to frame even with a
  static wordmark.

## The resting loop — t0 / 2.5s / 5s

The decay trail plus continuous beam jitter mean no two frames are
pixel-identical even with static text: t0/2.5s/5s screenshots show
visibly different trail/jitter states (the trail's exact bleed pattern
around each stroke shifts continuously).

## Reduced-motion freeze frame

Freeze on a **single completed trace pass with the decay trail buffer
cleared to just that pass** (no accumulated trail) and jitter disabled —
the wordmark is clean and fully legible, with the corner-brighter-than-
straight-run contrast still visibly present (this is the state that must
prove the mechanic even without motion).

## Interaction

Pointer proximity may inject a local "beam disturbance" — a temporary
increase in jitter amplitude or a brief refresh-timing wobble near the
cursor — that decays back to the resting state within roughly one second
of the pointer leaving. Must not recolor anything toward `--ns-accent`;
the disturbance is expressed in brightness/jitter only.

## Light vs dark theme

Dark theme: bright strokes (graded `--foreground` toward white/near-white
at the ramp's top) on a near-black background — the natural reading of a
CRT. Light theme is the harder case: strokes must invert to dark-on-light
while preserving the SAME relative contrast relationship (corners still
read as more saturated/darker or brighter than straight runs relative to
background — whichever direction reads correctly for light) — verify this
is a genuine luminance-ramp inversion, not a flat color swap that
collapses the corner/straight-run distinction.

## Kill criteria

- If the corner-brighter-than-straight-run relationship is not visually
  distinguishable at hero scale in either theme, the mechanic has failed
  and this is a reject.
- If the resting trail/jitter reads as noisy/broken rather than a
  deliberate CRT-glow artifact, reject or reduce jitter amplitude.
- If, once built, this reads as a re-skin of `hero-oscilloscope`'s
  waveform-trace treatment rather than a genuinely different stroke-font
  + dwell-time mechanic, kill it.
