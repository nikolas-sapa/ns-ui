# soxhlet-siphon-cycle

- **slug:** soxhlet-siphon-cycle
- **tier:** core (card-scale canvas)

## Product surface it replaces
A loading/progress indicator — an alternative to a generic spinner for a
long-running background process.

## The real mechanic
Soxhlet extractor siphon cycle: condensed solvent drips into the
extraction chamber, filling it steadily until the level crosses the siphon
arm's overflow height, at which point the chamber self-primes and drains
almost instantly back into the boiling flask below — then the fill begins
again.

## One-sentence mechanic description
A chamber slowly fills with condensed solvent drop by drop until it
crosses a siphon threshold, then empties itself in one fast rush back to
the flask below.

## Rendering approach
2D canvas. Chamber and siphon-tube geometry derive from `min(width,
height)`; chamber height = 0.4 × min-dimension.

## Real numbers
- Fill phase: condensate drops at 0.9s/drop, each drop raising the chamber
  level by 2.5% of chamber height. Chamber fills 0% → 100% (siphon trigger)
  over ~22 drops = 19.8s.
- Siphon dump: once level crosses 100%, the chamber drains over 0.6s (fast,
  matching a real siphon's near-instant self-priming drain) — rendered as a
  bottom-to-top value-only "drain" wipe, not a blink.
- Post-dump settle pause: 0.4s at empty before the next fill drop begins.
- Flask level below ticks up by a fixed 4% per completed cycle
  (accumulating extract); capped and reset every 5 cycles (~100s) to keep
  the loop unbounded.

## The resting loop
- **t0:** chamber near-empty (just post-dump), first new drop falling.
- **2.5s:** chamber ~12% full (~3 drops in).
- **5s:** chamber ~25% full (~6 drops in) — visibly higher liquid line than
  at 2.5s.

## Reduced-motion freeze frame
Freeze at the **85%-full frame**, just before the siphon triggers — the
most structured, tension-loaded frame: liquid level near the siphon arm's
mouth, clearly about to cross the threshold.

## Interaction
None; ambient background-process indicator.

## Light vs dark theme
Chamber/tube outline uses `--border` strictly as a non-load-bearing glass
rim. Liquid fill is `--foreground` at moderate alpha, rising in density
rather than hue. The dump is rendered as a value-only drain wipe (opacity
falling from bottom to top) so it reads correctly in both themes without
any color-based "drain" cue.

## Kill criteria
If the fill-then-dump asymmetry (19.8s slow vs 0.6s fast) does not read as
two distinct paces, or the dump looks like a blink with no visible drain
motion, reject.

## Legibility
The ONE followable thing: the liquid level in the chamber, which the eye
tracks rising steadily for ~20s and then vanishing in under a second. The
slow/fast contrast is the entire mechanic — nothing else needs separate
animation to make it read.
