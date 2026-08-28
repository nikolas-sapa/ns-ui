# blast-hole-delay-sequence

- **slug:** blast-hole-delay-sequence
- **tier:** core (card-scale DOM/canvas)

## Product surface it replaces (Filter 1)
Status feed / loader array — the "many small units progressing toward one event, in a fixed
order" slot (nearest sibling: `loader-braille`, `status-glyph-cadence`), not a settings/config
surface — no delay values are user-editable, the pattern is fixed and decorative.

## The real mechanic
Surface-mine and tunnel blast rounds use electronic detonators wired into a fixed hole
pattern (rows and rings around a free face), each assigned a programmed delay so the round
fires as a SEQUENCE, not simultaneously — this controls fragmentation and throw direction
and is the actual reason a blast pattern is drawn as a grid with delay numbers on it in every
blasting engineer's shot plan. A typical bench-blast pattern fires center-row-first (or free-
face-first) and the delay wave propagates outward/across the pattern row by row, each row
detonating tens of milliseconds after the last so the rock has somewhere to move into.

## One-sentence mechanic description
A grid of charged holes fires in a fixed sequence, each detonation flashing and settling to
a spent, darkened crater before the delay wave reaches the next row.

## Rendering approach
DOM: CSS grid of hole cells (grid size derived from container's smaller dimension — 6×6 at
card scale, up to 9×9 at larger card sizes, cell target 24–40px). Each cell is a div with a
radial-gradient background driven by a per-cell CSS custom property (`--charge`, 0–1) set via
JS on a rAF loop — no canvas needed at this cell count.

## Real numbers
- Pattern: 6 rows × 6 columns = 36 holes for the default card size.
- Real inter-row delay in industry electronic detonators: 25–50ms between rows (down to 9ms
  for some short-delay designs) — far too fast to read as sequence, so DECOUPLE per the
  round 9 rule: render at **900ms between rows** (documented real rate: 25ms/row, rendered
  at 36x real-time slowdown).
- Within a row, all holes fire together (this matches real practice — delay is typically
  row-to-row or ring-to-ring, not hole-to-hole) — this also satisfies the "transition shows
  departure and arrival" rule: a whole row visibly lighting up together reads as one event,
  not a blink.
- Firing flash: cell brightens to peak luminance over 80ms, holds 120ms, then decays to a
  "spent" dark state over 600ms (asymmetric: fast rise, slow settle — matches how a flash
  reads against a rock face).
- Full pattern cycle: 6 rows × 900ms = 5.4s to fully fire, then a 2s "cleared" pause (all
  holes spent, dark), then a 1.5s recharge sweep (holes reset to unfired state one row at a
  time, 250ms/row, no flash — this is the reload, not part of the mechanic proper, kept
  visually quiet) before the firing sequence restarts. Total loop: ~8.9s.

## The resting loop
- **t0:** all 36 holes unfired (dim, neutral), row 1 mid-flash (this is the chosen loop start
  so t0 already shows motion, not a static grid).
- **2.5s:** roughly rows 1–3 fired and settling to spent-dark, row 4 flashing — a visible
  gradient from spent (top) to charged (bottom) across the grid.
- **5s:** full pattern fired and spent (uniformly dark), heading into or already in the
  recharge sweep — visibly different overall tone (uniform dark) from t0/2.5s (mixed).

## The reduced-motion freeze frame
Freeze mid-pattern with rows 1–3 spent-dark, row 4 at peak flash brightness, rows 5–6 still
unfired-dim — the single frame that shows all three states (spent / firing / charged) at
once, which no other frame in the loop does as clearly.

## Interaction
None required. If added: hover/focus on a single hole cell may show its row-delay number as
a tooltip (`row 4 · +2700ms`) — informational only, must not retrigger the fire animation or
use `--ns-accent` for the flash itself (accent is fine on the tooltip chrome only).

## Light vs dark theme
Unfired holes sit near `--ns-muted` on `--background`; the flash peak reads at `--foreground`
brightness (or beyond via a controlled overshoot mixed from foreground, never a literal
white). In light theme the spent-dark state must still read as visibly darker than
`--ns-muted` — check this early, since "dark" in light theme has much less headroom below
`--background` than in dark theme.

## Kill criteria
- If the 900ms row cadence still reads as "too fast to follow" in an actual runtime check
  (per round 9's overflow-chip-mux lesson), slow it further before shipping, and if slowing
  it makes the loop feel inert instead, kill it.
- If the grid reads generically as "a loading indicator with dots" with no legible sense of
  sequence/direction, kill it — the row-by-row propagation must be the obviously readable
  feature.
- If distinguishing "unfired / firing / spent" requires more than 3 luminance steps to read
  clearly in light theme, kill it rather than shipping a 2-state pattern that lost its middle
  state.
