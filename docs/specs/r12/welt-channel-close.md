# welt-channel-close

**tier:** core

**product surface it replaces:** divider (a full-width section-rule
divider, adjacent to `float-ribbon-draw`/`banner-tear-stub` — a literal
process-rule rather than a decorative line).

**the real mechanic, with source:** Goodyear-welted shoe construction. A
channel is skived into the insole rib to expose it; a curved awl and
needle lockstitch a welt to the upper and insole rib through that open
channel; immediately behind the working point, the lifted channel flap
(the sliver of leather that exposed the rib) is folded back down and
pressed flush, permanently concealing the just-completed stitching under
the insole surface. The visible outer edge only ever shows a plain seam;
the lockstitch itself is hidden the moment it's finished.

**one-sentence mechanic description:** A needle locks one welt stitch at a
time at a single working point while, a few stitches behind it, the
channel flap that exposed the last batch of stitches folds shut and hides
them for good.

**rendering approach:** DOM (absolutely-positioned divs/SVG) for the
seam strip; geometry (stitch spacing, flap width) derived from the
container's smaller dimension so it still reads at a thin card-width
divider.

**REAL NUMBERS:**
- `CELL_SPACING = 14px` per stitch (approximates a real ~6-7 stitches/inch
  welt gauge at typical card DPI).
- `STITCH_INTERVAL = 1.05s` per lockstitch (satisfies the round's
  legibility floor — one discrete event roughly every second).
- Feed speed (continuous scroll of the whole strip) `= CELL_SPACING /
  STITCH_INTERVAL ≈ 13.3px/s`, right-to-left.
- `FLAP_LAG = 3` stitches: the channel flap directly above a stitch stays
  open (lifted) until that stitch is 3 positions old, then folds closed.
- Flap fold transition: `260ms` ease-out CSS transform (`rotateX` from
  ~35deg open to 0deg flush, with a `transform-origin` at its hinge edge)
  — an explicit fold, never an opacity blink.
- Needle crossing (the working point): `420ms` traversal per stitch,
  in→lock→out, timed inside each `STITCH_INTERVAL` window.

**resting loop (t0/2.5s/5s):** t0: working point mid-strip, ~4 open flaps
visible ahead of it, closed flush seam behind. At 2.5s: ~2 new stitches
have locked, the flaps that were open at t0 have folded shut, new ones
opened ahead — the whole strip has visibly scrolled ~33px left. At 5s: a
further ~67px of scroll, entirely new stitch positions in view, oldest
material scrolled off the left edge. Continuous feed — no start/end state.

**reduced-motion freeze frame:** named `MID_LOCK` — the working point
frozen at the midpoint of a stitch's `420ms` crossing (needle fully
inserted), with the full FLAP_LAG=3 window of open flaps visible ahead and
the flush closed seam behind, so both states (open, closing, closed) are
legible in one static frame.

**interaction:** none; ambient divider. The working-point needle must NOT
use `--ns-accent` — render it in `--foreground` at full value; only
button/focus chrome elsewhere on the page may use accent.

**light vs dark:** the flush (closed) seam reads via a single hairline
`--foreground` stroke; the open flap's "lifted" state reads via a small
`box-shadow` value shift (darker/lighter cast depending on theme, derived
from `--foreground` at low alpha, never a literal shadow color) rather
than a hue change — checked that the lifted-vs-flush distinction survives
in light theme where shadow contrast is naturally weaker.

**kill criteria:** if the flap fold reads as a hard cut/pop instead of a
continuous hinge transform, or if a viewer can't tell open flaps from
closed ones at a card-width scale without zooming — reject.

**legibility:** the eye follows the single working point where the needle
currently locks a stitch, once every 1.05s; three stitches behind it, the
flap that was open folds flush over 260ms with a visible lift→flush arc,
never a blink, giving the viewer both a fast anchor point and a slower
confirmation event to track.
