# jacquard-card-chain

- **slug:** jacquard-card-chain
- **tier:** core (card-scale DOM/canvas)

## Product surface it replaces
A small ambient status/activity strip (the "something is running in the background" feedback
moment) — an alternative to a spinner or an indeterminate progress bar.

## The real mechanic
The Jacquard loom's control mechanism: a continuous chain of punched cards (one card per weft
pick), laced end to end into a closed loop, is fed over a rotating square-prism cylinder that
presses it against a bank of spring-loaded needles. Where a card has a hole, its needle passes
through unhindered and the corresponding hook stays engaged (thread lifts); where the card is
solid, the needle is pushed back and its hook is knocked out of engagement (thread stays down).
The chain is a literal physical program — it loops forever, repeating its pattern indefinitely as
long as the loom runs. Source: Jacquard loom card-chain read mechanism (textile/weaving,
19th-century mechanism still used on modern damask/brocade looms).

**Differentiation from shipped siblings:** `punch-patch` already uses "Jacquard card" as a static
hole/patch grid for a permissions matrix — this spec must NOT read as a data grid. The load-bearing
part here is the CHAIN in motion (cards continuously advancing, being read, and looping back),
not a single card's hole pattern as a data encoding. `bitting-cut`'s pin-bank read is a one-shot
deterministic cut at enrollment; this is a continuously repeating idle read, never triggered by
user data.

## One-sentence mechanic description
A short chain of punched cards continuously feeds through a reader; at each card, a bank of
needles probes for holes and snaps to the card's pattern before the next card advances in.

## Rendering approach
2D canvas, DOM chrome (label, live region) around it. Grid: a needle bank of 16 needles across the
card's width (derived from container's smaller dimension, min 12 / max 20 depending on width), each
needle a short vertical peg. Visible card queue: 3 cards on screen at once (previous / reading /
next), each card ~30% of canvas width, sliding left in a closed loop (a queue of 8 distinct
patterns cycling, so the loop doesn't visibly repeat for ~7.2s).

## Real numbers
- Card advance cadence: 900ms per card (decoupled from real jacquard rates of 100-1000
  picks/minute — at the fast end that's ~60-100ms/pick, well into strobe territory per the round 9
  legibility note, so this renders one full card-read cycle per 900ms instead of 1:1).
- Card slide transit: 220ms ease, cards visibly overlap mid-slide (departure of the read card,
  arrival of the next) — never a cut.
- Needle travel: 160ms per needle, staggered 4ms per needle across the 16-needle bank (so the
  read resolves as a fast ripple left-to-right across the bank, not a simultaneous snap) with a
  critically-damped spring settle (small ~2px overshoot).
- Needle hold: needles sit at their resolved position for 520ms before the next card's read
  begins (900ms total = 160ms ripple-in + 520ms hold + 220ms overlap into next).
- 8-card pattern loop, non-repeating cadence of ~7.2s per full loop.

## The resting loop
- t0: card mid-read, needle bank showing a partial ripple (some needles extended, some mid-travel).
- t=2.5s: ~2-3 cards further into the chain, a different binary needle pattern fully settled.
- t=5s: several more cards cycled through, chain has visibly advanced past its t0 position.

## Reduced-motion freeze frame
**CARD_READ_HOLD** — freeze mid-hold (not mid-slide, not mid-ripple) on a card with a
visually mixed pattern (roughly half the needles extended, half retracted — not all-up or
all-down, so the structure is legible in a single static frame).

## Legibility
The ONE thing to follow: the needle-bank ripple resolving left-to-right at each card read. Cadence
is one full read-and-settle cycle every 900ms, with the ripple itself taking 160ms staggered
across 16 needles — slow enough to see the pattern assemble rather than snap, and the 220ms card
slide gives a clear departure/arrival instead of a blink.

## Interaction
None required. Optional: hover/focus on the strip may pause the live-region announcement
cadence (not the visual loop) to let a screen reader user catch up — must not stop or alter the
autoplay animation itself (mechanical loop, not user-driven).

## Light vs dark theme
Card body: `--border` outline only (never a fill — it's a separator token). Needle bank: extended
needles at `--foreground`, retracted needles at `--ns-muted` (shorter, lower-contrast pegs). Card
holes are literal cut-throughs — drawn by NOT painting the card-body fill in that cell, letting
`--background` show through, so the punched pattern reads via negative space in both themes rather
than an inked color. No `--ns-accent` anywhere in the mechanism.

## Kill criteria
- If the needle bank reads as random flicker rather than a legible ripple resolving to a held
  pattern, kill it.
- If cadence has to drop below ~700ms/card to feel "alive," it has crossed into the overflow-chip-mux
  failure mode — kill or slow down further, never speed up.
- If it reads as a settings/config toggle array instead of a mechanical process readout, kill it.
