# wind-regulator-bellows

- **tier:** core
- **product surface:** streaming media "buffer-ahead" indicator embedded
  in a playback scrub bar (the segment ahead of the playhead showing
  pre-loaded content — replaces the flat grey "buffered" overlay most
  players use).

## the real mechanic

A pipe organ's wind supply system: a feeder bellows (motor- or hand-
pumped, discrete strokes) fills a reservoir bellows whose weighted lid
smooths that pulsed input into steady wind pressure for the pipes. A
spring-loaded relief/spill valve bleeds excess pressure whenever demand
(pipes speaking) drops suddenly, preventing an over-pressure spike.

## mechanic description

A feeder bellows pumps air into a reservoir in discrete strokes, the
reservoir's own weighted lid rises and falls to smooth that into steady
pressure, and a spill valve bleeds off any excess when demand drops.

## rendering approach

DOM/SVG, horizontal strip sitting just ahead of the scrub bar's playhead.
Reservoir bellows = a pleated accordion (SVG path with folds) whose
height (lid position) encodes buffered-ahead amount. Feeder = a small
side panel with a stroke-arm glyph that pumps on its own interval. Relief
valve = a small flap near the reservoir top that visibly cracks open on
overflow.

## real numbers

- Feeder stroke interval: 1.4s; each stroke injects a fixed chunk
  (representing one network-fetched buffer segment) that raises the
  reservoir lid ~6% of max height.
- Continuous demand drain: lid lowers at a steady 4%/s of max height
  (simulated playback consumption), running independently of and
  concurrently with the feeder strokes.
- Relief valve: cracks open (flap rotates 0→28deg, 180ms) whenever the
  lid would exceed 92% of max height; bleeds the excess down to 92% over
  260ms, then reseats.
- Lid position is clamped to an 8% floor — never reads as fully empty at
  rest (represents a minimum pre-roll buffer).

## the resting loop

- t0: lid at some mid position, feeder mid-stroke or idle between strokes.
- 2.5s: roughly 1-2 feeder strokes have fired and continuous drain has
  moved the lid to a visibly different height (1.4s stroke interval and
  continuous 4%/s drain aren't commensurate with the 2.5s sample).
- 5s: lid height differs again from both earlier samples; if buffering
  briefly outran drain, a relief-valve crack event may be visible.
  Continuous and self-driven by an internal simulated fetch/drain
  generator — alive with zero external data, same convention as other
  status widgets in this registry.

## reduced-motion freeze frame

STROKE_PEAK: a feeder stroke has just completed and the lid sits at its
local peak, just before the relief valve would consider cracking — the
most structured frame, showing compressed pleats and a clearly legible
lid height. Not t0's arbitrary mid-drain moment.

## interaction

None required for the ambient buffer read. If placed adjacent to a real
scrub bar, hovering the reservoir may reveal exact buffered-seconds text.
Must never tint the reservoir, feeder arm, or relief flap with
`--ns-accent` — accent stays reserved for the actual scrub playhead/
controls elsewhere in the player chrome.

## light vs dark theme

Pleat fold lines need genuine contrast — use `--ns-muted` for fold
shading and `--foreground` for the lid/outline so the accordion structure
survives in light theme (`--border` alone is too faint for the fold
lines to read as structure). Verify the relief flap's crack gesture stays
visible against `--background` at low-opacity settings; check light
theme early.

## legibility

The ONE thing to follow: the lid's height rising in a discrete step on
each feeder stroke, then draining smoothly and continuously between
strokes. Cadence: one feeder stroke every 1.4s, comfortably past the
"~1s between discrete events" floor, with the continuous drain providing
a second, slower thing to track in between.

## kill criteria

- If the discrete-stroke-rise vs. continuous-drain contrast collapses
  into "a bar that goes up and down," the mechanic's identity (pulsed
  supply smoothed by a standing reservoir) has failed; reject.
- If it reads as a standard media buffer bar with cosmetic bellows
  skinning and no functional distinction, reject.
