# steam-trap-batch-flush

- **tier:** core
- **product surface:** inline sync-status glyph beside an editable/live
  document, or a telemetry/event-buffer indicator (replaces a generic
  "saving…"/cloud-sync spinner icon).

## the real mechanic

A float-and-thermostatic steam trap (industrial steam heating/process
plant): condensate collects in a small chamber; a float rises with the
liquid level; at a set high point the float's linkage snaps a discharge
valve open, condensate blows down fast, the level drops, the float falls,
the valve reseats, and the chamber immediately starts refilling.

## mechanic description

Condensate collects in a small chamber until a float trips a valve open,
the chamber blows down fast, and it starts refilling immediately.

## rendering approach

DOM/SVG, small inline glyph scalable across 24-64px (same size range as
`status-glyph-cadence`). Chamber = rounded-rect outline (`--ns-muted`
stroke). Fill level = a clipped rect rising inside it (`--foreground` at
~70% opacity). Float = a small circle riding the top edge of the fill.

## real numbers

- Fill duration: 3.2s from empty to the trip line (represents locally-
  buffered pending events accumulating).
- Trip point: 88% of chamber height.
- Blow-down: 340ms, fill drops from 88% to 6% on an eased-out curve
  (fast, front-loaded — real blow-down is much faster than the fill it
  releases).
- Immediate refill restart; full cycle ≈ 3.6s, continuous forever.
- Float overshoots 2px below the falling fill line during blow-down, then
  settles back onto the new fill level — the mechanical snap-back read.

## the resting loop

- t0: chamber at some fill fraction (any phase of the 3.6s cycle).
- 2.5s: visibly higher, or has already blown down once and is mid-refill —
  objectively different fill height and float position (3.6s cycle isn't
  commensurate with the 2.5s sample).
- 5s: roughly 1.4 cycles have elapsed from t0, guaranteeing a third
  distinct phase from both earlier samples.

## reduced-motion freeze frame

TRIP_POINT: fill at 88% height, float at its highest point, the instant
before blow-down starts — the most information-dense frame, showing the
full chamber, the trip threshold, and the float all clearly. Not an
arbitrary mid-fill or empty frame.

## interaction

None required for the ambient/status read. If wired to a real "flush now"
affordance, pressing may force an early blow-down — it must NOT alter the
trip threshold or blow-down duration, and must not introduce `--ns-accent`
onto the fill or float; a focus ring is the only accent-eligible element.

## light vs dark theme

Chamber outline (`--ns-muted`) needs a minimum stroke-width floor (never
below 1 physical px) to stay legible at the smallest supported size (24px)
in light theme — verify at 24px before shipping. Fill uses `--foreground`
so contrast direction inverts correctly across themes with no separate
logic.

## legibility

The ONE thing to follow: the float rising with the fill, then snapping
down fast at blow-down. Cadence: one full fill-and-trip cycle every 3.6s,
comfortably past the "~1s between discrete events" floor — the 340ms
blow-down itself is fast BY DESIGN (that speed contrast against the 3.2s
fill IS the mechanic) but is bookended by long, easy-to-track dwell time
on both sides.

## kill criteria

- If the 340ms blow-down is too fast to register as a distinct phase from
  the fill at 24px scale, either lengthen it and document the trade-off,
  or reject.
- If it reads as a plain looping fill-then-reset bar with no snap
  character, reject — the mechanic's identity is the mechanical trip, not
  a sawtooth.
