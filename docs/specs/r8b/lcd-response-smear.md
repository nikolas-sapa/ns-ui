# lcd-response-smear

- **slug:** `lcd-response-smear`
- **tier:** core (card-scale DOM/canvas)

## Product surface (Filter 1)

Card — an ambient status/data card with a sweeping accent edge.

## The real mechanic

LCD pixel response time and overdrive overshoot (RTC — response time
compensation). A liquid-crystal cell doesn't switch luminance instantly
between grey levels; it follows a panel-dependent gray-to-gray (GtG) settle
curve, and rise/fall are asymmetric — most panels switch faster toward
brighter values than toward darker ones (rise ~4-8ms, fall ~8-14ms on
typical spec-sheet TN/IPS panels). To hit advertised response numbers,
panel drivers intentionally overdrive the transition — push past the
target voltage, then relax back — which produces a brief luminance
overshoot (a bright halo on a rising transition, an undershoot dip on a
falling one) before the pixel settles at its true target. This is the
"inverse ghost" visible trailing fast-moving light-on-dark UI in reviews of
LCD panels with aggressive overdrive.

**Not motion blur** — `kelvin-wake`, `background-ascii-wake`, and
`reorder-drag-wake` already own smooth trailing-blur territory. The
identifying feature here is a discrete overshoot-then-settle spike with
asymmetric rise/fall, not a continuous gradient tail. **Not
`cursor-subpixel-fringe`** either — that's a spatial subpixel-geometry
artifact; this is a purely temporal per-pixel luminance response curve.

## Mechanic, one sentence

A moving edge sweeps across a row of simulated LCD cells, each cell
overshooting past its new luminance target before settling back, with a
visibly different overshoot on the rising edge than the undershoot on the
falling edge.

## Rendering approach

2D canvas, `w-full h-full`, geometry from container's smaller dimension:
`CELL_PX = max(6, containerMinDim / 56)`, a single row of cells spanning
the card width.

## Real numbers

- Sweep velocity: `v(t) = 220 * (1 + 0.15 * sin(2π t / 9.1))` px/s,
  direction reverses (ping-pong) at the card edges — the slow ±15%
  modulation (period 9.1s, non-round) keeps the bounce from reading as a
  metronomic loop.
- Per-cell transition, triggered when the sweeping edge crosses a cell:
  - **Rising** (going toward the brighter of the two target values):
    `tau_rise = 6ms`, overshoots to `1.18×` the target luminance delta at
    `t+4ms`, settles to `1.0×` by `t+9ms`.
  - **Falling** (toward the darker value): `tau_fall = 11ms`, undershoots
    to `0.90×` the target at `t+6ms`, settles to `1.0×` by `t+15ms`.
  - Both curves computed from local start/end luminance (not absolute
    white/black), so overshoot direction is always "further from the
    previous value," never a fixed absolute target — this keeps it correct
    automatically across themes.
- Cell luminance is interpolated between `--background` and `--foreground`
  (read via `getComputedStyle`, re-read on the documentElement class
  `MutationObserver`) — no fill or hue, value only.

## The resting loop

- **t0:** edge mid-sweep in one direction, trailing bright overshoot halo
  visible immediately behind it.
- **2.5s:** direction has reversed at least once (ping-pong), edge at a
  different position, now showing the smaller undershoot dip leading the
  opposite way.
- **5s:** the slow velocity modulation has shifted the sweep speed,
  producing a different edge position and overshoot/undershoot balance
  than either earlier checkpoint.

## Reduced-motion freeze

`STATIC_TIME = 0.85` — frozen exactly at an overshoot peak (not at a
settled rest state), so the reduced-motion frame still shows the
climactic asymmetric halo rather than a plain static edge.

## Interaction

Pointer entering the card may seed the initial sweep position/direction,
but the sweep must run unconditionally without a pointer present. The
overshoot halo brightens by moving luminance toward `--foreground` (or
darkens toward `--background`) — never by mixing `--ns-accent`, per the
project's standing pointer-highlight rule (this isn't even a pointer
highlight, but the same rule applies: no accent on the climactic moment).

## Light vs dark

Overshoot direction is computed from local transition direction (further
from the previous luminance value), so it self-corrects across themes
without special-casing: verify by sampling R/G/B across the canvas in both
themes and confirming equality within rounding (this is the project's
standing accent-leak check, worth running here explicitly since the
concept is luminance-only by construction).

## Kill criteria

- If the overshoot renders as a smooth gradient tail rather than a
  discrete peak-then-settle spike, it has become `kelvin-wake` — kill or
  redesign the curve, don't ship as a restyle.
- If rise and fall read identically (no visible asymmetry), the mechanic's
  identifying feature is gone — kill.
- If the halo direction inverts incorrectly across themes (reads as a hue
  shift rather than luminance) — kill.
