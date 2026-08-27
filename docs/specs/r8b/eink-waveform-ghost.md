# eink-waveform-ghost

- **slug:** `eink-waveform-ghost`
- **tier:** core (card-scale DOM/canvas)

## Product surface (Filter 1)

Empty state — a bounded panel rendered as an idle e-ink display.

## The real mechanic

Electrophoretic (e-ink) display driving. An e-ink panel updates by running
each cell through a discrete voltage "waveform" — a short sequence of
drive steps that physically push charged black/white particle capsules
into position — rather than switching instantly like an emissive pixel.
Partial updates run an abbreviated, fast waveform that leaves faint
residual charge from the prior image ("ghosting"); most consumer e-readers
also exhibit a "shoot-through" artifact where a cell mid-transition briefly
flashes to full black (or full white) before landing on its true grey
target, because the waveform's intermediate steps push particles past
their final position on the way there. Periodically the driver runs a full
"screen refresh" waveform — several alternating black/white flashes across
the whole panel, ~250-800ms — to fully reposition every particle and clear
accumulated ghosting; this is the visible flash Kindle-style readers do
every several page turns.

## Mechanic, one sentence

A coarse grid of e-ink cells continuously steps a scattered subset of
itself through multi-stage waveforms — each transitioning cell flashing
briefly darker or lighter than its target before settling — while the
whole panel periodically flashes through a synchronized full-refresh cycle
to clear ghosting.

## Rendering approach

2D canvas, `w-full h-full`. Grid derives from container's smaller
dimension: `CELL_PX = containerMinDim / 20`, roughly 20×14 cells depending
on aspect ratio, rendering a simple coarse pixel-art scene (e.g. a
weather-icon-scale glyph) as the settled image.

## Real numbers

- Per-cell transition schedule: each of the ~280 cells independently gets a
  new target grey level on a randomized interval, mean `1.9s` per cell
  (Poisson-like — draw next interval as `-1.9 * ln(random())`), so at any
  instant a scattered handful of cells are always mid-waveform. This is
  the layer that keeps the panel alive at rest independent of the
  full-refresh event.
- Waveform per transitioning cell: 4 discrete steps at `60ms` each (`240ms`
  total). Steps 2-3 overshoot to full black or full white (whichever is
  further from the start value — the shoot-through artifact) before step 4
  lands on the true target grey.
- Full-refresh climax: every `T_refresh = 14s ± 3s` (jittered per mount so
  parallel instances desync, not metronomic), the entire grid runs a
  synchronized sequence of 3 alternating full-panel black/white flashes at
  `90ms` each (`270ms` total), then every cell settles to its current
  target image simultaneously. This is layered ON TOP of the continuous
  per-cell layer above, not a substitute for it.
- Cell values interpolate between `--background` and `--foreground` tokens
  (read via `getComputedStyle`, re-read on the `documentElement` class
  `MutationObserver`).

## The resting loop

Because ~280 cells each transition independently on a ~1.9s mean interval,
a different subset is always mid-waveform at any sampled instant —
provably different at t0/2.5s/5s regardless of where the 14s-ish
full-refresh cycle happens to land. The full-refresh flash is a periodic
bonus event on top, not the thing carrying Filter 2.

## Reduced-motion freeze

`STATIC_TIME = 3.0` — chosen at a moment where zero cells are mid-waveform
(all settled to their true grey levels, forming the clearest possible
"resting e-ink page" read) — the deliberately-picked, most-structured,
non-t0 frame.

## Interaction

None required. If present: a click/tap on a cell may re-trigger that
cell's local waveform (like marking the panel with a stylus), staying
within the same `--background`/`--foreground` grey-value palette — must
NOT introduce `--ns-accent` or any hue.

## Light vs dark

E-ink's real-world identity (white paper, black ink) is the literal
opposite of a dark-theme UI. Because cell values interpolate between
`--background` and `--foreground`, the paper/ink relationship inverts
automatically with the rest of the site theme — call this out explicitly
in the build so nobody "fixes" it by hardcoding a white paper base. The
waveform-stepping and shoot-through mechanic itself is theme-agnostic; only
the two endpoints swap.

## Kill criteria

- If the per-cell shoot-through flicker reads as generic noise/static
  rather than a legible waveform-settle pattern (distinct dark/light
  flash → grey landing, not random flicker) — kill.
- If the full-refresh flash is the ONLY motion visible to a casual glance
  (i.e., the continuous per-cell layer is imperceptible at card scale) —
  kill; the continuous layer must be the dominant visible signal at any
  given moment, the refresh is the periodic climax, not the whole act.
- If it reads as a restyle of an existing dither/halftone core component
  (e.g. `card-dot-gain-screen`) rather than a temporal waveform-settle
  mechanic — kill.
