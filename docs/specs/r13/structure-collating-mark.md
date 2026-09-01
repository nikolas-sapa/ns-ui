# collating-mark

- **slug:** collating-mark
- **tier:** core (card-scale DOM + SVG)
- **surface:** feature grid

## 1. Surface it replaces + the real process
Feature grid. Borrowed from **bookbinding gathering and collation checking**. A book is assembled
from signatures gathered in order from a row of pockets onto a moving saddle or chain. To verify the
order without reading a single folio, printers print a **collating mark** (also "back mark" or
"collating bar") on the folded spine of each signature: a short thick black bar placed one step
lower on each successive signature, so a correct gather shows a clean descending **staircase** down
the spine, and a misgather shows a gap, a repeat or a jog that is visible from a metre away. A
gathering line also carries a **caliper** / missing-signature detector at the delivery end that
measures the assembled block's thickness and rejects a short book.

## 2. Nearest existing slug + why this is not a restyle
Nearest: `feature-grid-ascii-rule` (hovering or focusing a cell draws box-drawing connectors to
related features, routed through the gutters and retracted glyph by glyph) and `grazing-light` (a
single feature-grid card with blind-embossed icon and heading under a raking light).
feature-grid-ascii-rule's mechanic is a **relationship graph** drawn on demand between cells, and it
is inert until hovered. Here the grid has no relationships and nothing is drawn on hover: the grid
carries an independent **ordering** channel along a spine rail, a staircase that is either correct or
visibly broken and is legible without reading any cell, and the payoff is a **detected misgather and
an ejection** — a verification artifact with no analogue in either existing component. Against
`sorter-pocket-route` (Hollerith card sorter, cards dropping down a chute into pockets): that
component's subject is *routing* — a gate flap selecting a destination — while this one's subject is
*order verification* after the fact, and the marks stay on screen as an accumulated readout rather
than leaving the frame.

## 3. One-sentence mechanic
Signatures are pulled from pockets in round-robin order onto a spine rail where each one's collating
mark lands one step lower than the last, so the grid always carries a live staircase that a
misgather visibly breaks.

## 4. Rendering approach
DOM cells (real buttons/links, real text) plus one SVG layer for the rail, the marks, the caliper and
the in-flight signature. In-flight motion is `transform` only. `M = min(width, height)` governs
every length.

## 5. Real numbers
**The card-scale arithmetic drives the counts — do it first.** At `M = 340px` a rail of `0.055*M`
is 18.7px; with a mark thickness of 0.62 of that, the per-signature step over 8 signatures is ~1.0px,
**below the perceptual floor**. So:
- **Rail width `0.10*M`** (34px at M=340), **mark thickness 0.45 * railWidth** (15.3px).
- **N = 5 signatures / cells**, in a 5-up arrangement chosen from the container aspect (a 1x5 strip
  in a wide card, a 2+3 block in a square one). Step = `(railWidth - markThickness) / (N - 1)` =
  `(34 - 15.3)/4` = **4.7px per step** at M=340 — legible.
- Mark length `0.075 * railLength / N`; along-rail position of mark i = `(i + 0.5)/N` of the rail;
  across-rail offset = `i/(N-1) * (railWidth - markThickness)`.
- **Gather cadence:** one signature pulled every **640ms**, round-robin 0..4, so a full pass is
  **3.2s**, then it repeats. A pulled signature's cell lifts `0.02*M` toward the reader, travels
  along the rail at `1.9 * railLength/s`, and seats with a critically damped spring
  (`omega = 26 rad/s`, `zeta = 0.9`) — 210ms travel plus settle.
- **Caliper:** a two-jaw gauge at the delivery end closes on the assembled spine once per pass,
  260ms to close and 180ms to open, with a one-line mono readout ("5/5").
- **Misgather:** every 3rd pass (**every 9.6s**) one seeded signature is pulled out of order
  (index i+2 instead of i). Its mark then sits one step wrong and the staircase shows a visible jog.
  The caliper arm swings down over 180ms, the offending cell tilts 4 degrees and slides `0.09*M` out
  of the rail over 300ms, and the correct signature is re-gathered 640ms later, closing the
  staircase. Anomaly duration ~1.3s.
- **Delivered stack:** a thin stack at the delivery end grows one sheet-line per completed pass and
  is jogged away at 12 books, so the accumulation is real but bounded and never terminates.

## 6. Unconditional resting loop
- **t = 0s:** signatures 0-1 seated, 2 in flight along the rail, 3-4 empty — two marks on the rail,
  no readable slope yet.
- **t = 2.5s:** signatures 0-3 seated (3.9 pulls at 640ms), 4 in flight — four marks, and the
  staircase now reads as a slope, which it did not at t0.
- **t = 5s:** the first pass has completed and the caliper has closed and reopened; pass two is under
  way with 0 and 1 re-seated and 2 in flight, and the delivered stack behind the rail is one book
  thicker than it was at t0 — so this frame differs from both earlier ones in two independent
  channels.

## 7. Reduced-motion freeze frame
`STATIC_TIME = 3.05s`. Every signature seated, the full 5-step staircase complete, and the caliper
jaws closed on the spine with the readout showing. This is the only frame where the mechanic's
*purpose* is legible — a staircase means nothing until it is complete — and it includes the measuring
instrument. **Not t0**, where two marks read as a decorative dash pattern.

## 8. Scroll behaviour
None. The component never reads scroll and is card-native by construction; the arrangement steps from
1x5 to 2+3 on aspect, and geometry derives from `M = min(width, height)`.

## 9. Hue -> luminance, both themes
- Cell faces: `mix(bg, fg, 0.07)` light / `mix(bg, fg, 0.14)` dark.
- Rail: `mix(bg, fg, 0.05)` light / `mix(bg, fg, 0.10)` dark.
- **Collating marks are the highest-contrast element in the component in both themes**: full
  `--foreground` against the rail, giving `deltaL >= 0.55` either way — a dark bar on pale rail in
  light theme, a bright bar on dark rail in dark theme. That is what makes the staircase readable at
  a glance, and it is the one place where maximum contrast is correct.
- The in-flight signature is distinguished by a cast shadow (offset `0.012*M`, **-0.14 L** toward
  `--foreground` in light and toward `--background` in dark) plus a **+0.06 L** lift on its own face.
  Never by hue, never by accent.
- A misgathered signature is flagged **only** by the geometric jog in the staircase and its 4-degree
  tilt. No colour flag, no red, no accent — an error state is the classic place this rule gets broken.
- `--ns-accent`: focus rings on the real cell buttons only.
- `--border`: cell hairlines and the rail edge — legitimate separator use.
Tokens via `getComputedStyle` + `MutationObserver`, no literal fallbacks.

## 10. Interaction
Cells are real links or buttons with accessible names. Arrow keys move within the grid, Enter
activates, and Tab from a blurred body lands on a cell within 12 presses. Focusing a cell parks that
one signature but does **not** pause the gather of the others. Hover draws no connectors — that is
`feature-grid-ascii-rule`'s job and duplicating it would collapse the distinction.

## 11. Kill criteria
- If the staircase does not read as an **ordered sequence** at card scale, N is too high or the rail
  too narrow. Re-run the step arithmetic; if 4.7px per step still does not read, kill.
- If the misgather is not obvious without the tilt cue — i.e. if the jog alone does not break the
  staircase visibly — the mark geometry is wrong and the concept has lost its reason to exist.
- If the gather ever reads as items being *routed* to destinations rather than *verified* in order,
  it has become `sorter-pocket-route` and should be killed.
