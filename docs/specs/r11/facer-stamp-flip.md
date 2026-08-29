# facer-stamp-flip

**tier:** core

**product surface it replaces:** loader — a batch-processing indicator for
a document/upload pipeline (e.g. "normalizing files"), not a progress bar
with a percentage (there is no total count, only continuous throughput).

**the real mechanic, with source:** a letter-facing and cancelling
machine. Mixed-orientation letters feed in a single-file stream; an
optical sensor bank detects the stamp corner's position on each envelope
(one of four rotations) and a mechanical rotator turns only the letters
that aren't already stamp-corner-up-right into the common orientation
before they continue to the canceller, which stamps a postmark/cancel mark
across the stamp as each envelope passes a fixed point. The facing
(orientation-resolution) step is this spec's subject — the cancel mark is
a brief, secondary consequence, not the climax (`frank-register` already
owns the franking-meter indicium moment; `not-found-postmark` already owns
the stacked hand-stamp moment).

**one-sentence mechanic description:** Envelopes enter in mixed
orientations, a sensor gate reads each one's stamp corner and only the
ones that need it get rotated into the common orientation before
continuing on, picking up a brief tap of ink as they pass.

**rendering approach:** DOM + CSS, a horizontal single-file lane of
envelope `<div>`s (simple rect + corner-triangle "stamp" glyph so
orientation is legible at a glance) sharing one rAF-driven lane position;
each envelope's rotation state is its own small piece of state (0/90/
180/270deg initial, resolves to 0deg). Geometry derives from the
container's smaller dimension for envelope size (envelope height = 0.22 *
min(w,h)).

**REAL NUMBERS:**
- Real throughput: ~30,000 letters/hour ≈ 8.3/s — far above the paint-rate
  floor. DECOUPLED: rendered feed is one envelope every 1.1s, the real
  rate is documented here, not animated.
- Each envelope spawns with one of four rotations from a fixed period-4
  sequence (0, 180, 90, 270deg — never `Math.random()`), so exactly 1-in-4
  envelopes is already correctly oriented and passes the facing gate
  untouched (a visible "no-op" case matters — not every envelope gets the
  flip, which is what makes the flip read as a decision, not a tic).
- Facing-gate flip: for the 3-in-4 that need it, a 340ms rotate-to-0deg
  transition (ease-in-out) triggers exactly as the envelope's leading edge
  crosses the gate line (a fixed x-position at 55% of lane width) — the
  gate line itself briefly brightens (luminance flash, 120ms) marking the
  read event.
- Cancel tap: 90ms after reaching 0deg orientation, a small ink-mark glyph
  appears over the stamp corner for 400ms then fades — deliberately
  understated (no shake, no ink-splatter filter) since it is a consequence
  here, not the subject.

**the resting loop:** t0 — several envelopes visible along the lane at
staggered rotations/phases, at least one pre-gate at a non-zero rotation.
t2.5s — at least 2 envelopes have crossed the gate (some flipped, at least
one likely passed through already-oriented per the 1-in-4 no-op case) and
exited the lane. t5s — the full period-4 rotation sequence has cycled at
least once, so both a flip and a no-op pass have definitely both occurred
and are visible in different envelopes' positions.

**reduced-motion freeze frame:** named `GATE_FLIP`, the instant one
envelope is mid-rotation exactly at the gate line (gate flashed, envelope
between its start rotation and 0deg), with one already-cancelled envelope
ahead of it and one not-yet-arrived envelope at a visibly different
rotation behind it — one frame shows pre-gate, mid-flip, and post-cancel
states together.

**interaction:** none. Ambient batch-processing loader; no pointer state.

**what it must NOT do:** must not tint the gate-line flash or the cancel
ink-mark with `--ns-accent` — both are `--foreground`-derived luminance
events. Must not draw the cancel mark as a heavy, decorative hand-stamp
(that territory belongs to `not-found-postmark`) — keep it a small,
functional tick.

**light vs dark:** envelope bodies need a real luminance step against
`--background` in both themes (they are the primary subject, not
structure); the gate line itself can sit at `--border` contrast at rest
but must be checked that its 120ms brightness flash is still visible
against a light-theme background, where the flash has less headroom to
brighten toward than in dark theme.

**kill criteria:** if the 1-in-4 no-op case is imperceptible in practice
(reviewers only ever notice flips, never notice a pass-through), the no-op
envelopes need a small distinguishing beat of their own (e.g. a fainter
gate-line flash) rather than removing the no-op case — losing it would
make every envelope look identical at the gate, which flattens the
mechanic into a generic "things move and then get a mark," the exact
restyle risk this spec exists to avoid.
