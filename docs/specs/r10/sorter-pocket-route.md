# sorter-pocket-route

**tier:** core

**product surface it replaces:** an ambient processing/organizing loader — the same slot a
team would reach for `loader-die-tumble` or `queue-triage-ratchet` for, a visual that says
"items are being continuously sorted into categories," not a literal card-chain reader
(round 9's `jacquard-card-chain` already owns punched-card-chain-into-needle-bank reading;
this spec is deliberately about the sorter's routing/pocket mechanism, not the brush
reading a card).

**the real mechanic, with source:** the Hollerith tabulating-machine card sorter. Cards
travel single-file past a brush contact that senses a punched hole in one column; a
solenoid-actuated chute gate downstream reads that sensed value and deflects the card into
one of several numbered pockets below the track. The read event is incidental to this
component — the visible subject is the chute mechanism routing each card to a different
pocket and the pockets filling unevenly over time.

**one-sentence mechanic description:** a stream of cards drops one at a time onto a
branching chute that flips a different way for each card, so the cards pile up unevenly
into a row of pockets below.

**rendering approach:** DOM + CSS transforms, no canvas. A single-column card track at
top; below it, N=5 pocket bins laid out horizontally, each a bordered slot whose fill
height grows as cards land in it. A card element animates: drop straight down the track,
then a horizontal translate into its assigned pocket's x-position while falling the
remaining distance, landing on top of that pocket's current stack. Geometry: pocket width =
container width / 5.5 (leaves gutter), card height = pocket width x 0.4, derived from the
container's smaller dimension so the whole assembly compresses correctly at narrow card
widths too.

**REAL NUMBERS:**
- card feed rate: **1 card / 1.1s** — new card enters the track top.
- vertical drop-to-gate time: **300ms** (card falls from track top to the chute gate).
- gate deflection + horizontal travel into pocket: **380ms**, ease-in-out, so the direction
  change at the gate is a visible curve, not a snap.
- pocket assignment: cycles through a fixed pseudo-random sequence (period 17, so it never
  exactly repeats within a short viewing window) weighted so pocket 3 (center) receives
  roughly 2x the cards of the outer pockets — uneven fill is part of the "alive" read.
- pocket capacity before recycle: **14 cards visible per pocket** (stacked with 2px
  overlap); on the 15th card assigned to a pocket, the bottom card of that pocket fades
  out over 260ms as the new one lands on top — a rolling window, never a hard reset, so the
  loop has no visible restart.
- stack overlap offset per card: **3px** vertical rise per card added, capped so the tallest
  pocket never exceeds 70% of the available bin height (older cards compress/fade rather
  than overflow the bin).

**the resting loop — t0 / 2.5s / 5s:** t0: pockets show whatever uneven fill state the
continuous feed has produced by mount, one card mid-flight in the chute. t=2.5s: roughly 2
more cards have fed and landed (2.5s / 1.1s ≈ 2.3), pocket heights visibly changed. t=5s:
~4-5 more cards landed since t0, at least one pocket has visibly grown taller than it was
at t0 and the oldest visible card in the busiest pocket has likely faded/recycled once.

**reduced-motion freeze frame:** `STATIC_PHASE`: freezes with one card frozen mid-chute at
the 60%-through-deflection point (visibly angled, neither vertical nor horizontal) and all
five pockets showing a distinctly uneven fill (never all-empty, never all-equal) — the
single frame that reads "mechanism mid-motion, system in an uneven working state."

**interaction:** none. Ambient loader; no click-to-sort, no pocket labeling/filtering
control — either would push this toward a literal filter/table-sort UI, which is a
different, already-covered surface (`filter-facet-mesh`).

**light vs dark theme:** card fill `--background`, card outline `--foreground` at 60%
opacity; pocket bin outlines use `--border` (never filled with it); stacked card fill in
the pockets steps from 25% to 55% `--foreground` opacity oldest-to-newest so pocket depth
reads as a value gradient, not a literal color stack. No accent anywhere — chute deflection
direction is conveyed by motion/angle only, never a color cue.

**legibility line:** the ONE followable thing is a single card's journey — drop, curve at
the gate, land in a specific pocket — cadence: one full card journey takes ~680ms
(300ms drop + 380ms gate travel) inside a 1.1s feed interval, so each card fully resolves
before the next one starts falling, and a viewer can track one card start-to-finish without
a second card overlapping its motion.

**kill criteria:** if five slowly-filling bins read as static/boring rather than a live
mechanism, or if the routing direction per card looks random noise instead of a
mechanism reading something (even though no value is actually rendered, the deflection
angle+timing must still read as "decided," not jittery), kill it.
