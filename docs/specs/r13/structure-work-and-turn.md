# work-and-turn

- **slug:** work-and-turn
- **tier:** loud (full-bleed gallery)
- **surface:** gallery / image grid

## 1. Surface it replaces + the real process
Gallery. Borrowed from **sheetfed imposition, specifically the work-and-turn scheme**. Both sides of
a sheet are printed from ONE plate carrying both formes: run the sheet, then turn it over
**left-to-right about its vertical axis, keeping the same gripper edge and the same side guide**,
and run it again. Cut the sheet in half and you have two identical complete copies. The
distinguishing detail against work-and-**tumble** (which flips end over end and therefore changes the
gripper edge) is exactly that retained gripper edge, and it is why work-and-turn registers better.
The layout on the press sheet looks scrambled — half the pages sit upside down and the sequence jumps
around the sheet — and only the **fold** resolves it into reading order.

## 2. Nearest existing slug + why this is not a restyle
Nearest: `fiche-step-repeat` (a thumbnail grid populated one cell per raster step with a brief flash,
then an index strip types in), `masonry-ascii-settle` (tiles drop into packed column slots and
re-pack on resize) and `magazine-drop` (a rotary drum indexes against a detent and drops one plate at
a time into a gate). All three **deliver tiles into a grid one at a time**, and in all three the
grid's order is the trivial reading order. Here nothing is delivered: the whole sheet exists at once,
its resting arrangement is deliberately **not** reading order (it is a real 8-up imposition with half
the tiles rotated 180 degrees), and the mechanic is the turn-about-the-gripper-edge plus the fold
sequence that resolves the scramble. The gallery's subject is an ordering scheme, not an arrival.

## 3. One-sentence mechanic
Eight thumbnails sit on a press sheet in a work-and-turn imposition — half of them upside down — and
the sheet turns about its vertical axis on a retained gripper edge and folds three times to resolve
into reading order.

## 4. Rendering approach
CSS 3D for the sheet turn and the folds (real DOM tiles, `perspective: 2.4*M`, a real back face
carrying the second forme — not a mirrored front). One canvas layer behind for the sheet texture, the
impression cylinder's wet-ink wave, the gripper fingers and the delivery pile. Tile images render as
**ordered-dither ink density** (8x8 Bayer) rather than greyscale tone, matching this registry's
existing ink-density family (`background-ascii-dither`, `heatmap-year-stipple`). `M = min(W, H)`.

## 5. Real numbers
- **8 tiles, 4 across x 2 down**, on one press sheet. **Exactly four of the eight are rotated 180
  degrees** and the reading sequence jumps around the sheet. Use a real 8-page work-and-turn folio
  imposition from a bindery imposition chart; the two properties the builder must preserve are
  (a) exactly half the tiles rotated 180 degrees and (b) the fold sequence in this spec provably
  resolving them to 1..8. Do not invent a scheme that only looks scrambled.
- **Gripper edge:** the sheet's bottom edge, a `0.045*M` band with 6 gripper-finger silhouettes. It
  **never changes side**, in any state. This is the work-and-turn tell and the check against
  work-and-tumble.
- **Turn:** 180 degrees about the sheet's vertical centre axis over **900ms**, ease-in-out with a 6%
  overshoot damped out in 180ms — a sheet turned by hand, not a CSS flip.
- **Register:** after each turn the sheet lands `0.008*M` off register and the side guide pushes it
  back over **220ms**. Visible, and it is the reason work-and-turn beats work-and-tumble.
- **Press cadence at rest:** one impression per **1.45s** (~2480 iph). The impression cylinder, drawn
  as an arc along the sheet's top edge, rolls across the sheet in **620ms**; the sheet is drawn
  denser behind the rolling nip (**+0.06 L** toward `--foreground`, fresh ink) and dries back over
  **1.1s**. So an ink wave crosses the gallery every 1.45s.
- **Turn cadence at rest:** every 3rd impression, i.e. every **4.35s**.
- **Delivery pile:** a stack at the right edge growing `0.004*M` per impression, capped at `0.16*M`
  and then jogged away and restarted — an accumulating count that never terminates.
- **Fold sequence (on activation):** three folds, **620ms** each, **180ms** apart — fold 1 about the
  vertical centre, fold 2 about the horizontal centre, fold 3 about the vertical centre again — after
  which the tiles read 1..8 and the activated tile is on top. Escape unfolds by the same sequence in
  reverse.

## 6. Unconditional resting loop
The press runs whether or not anyone activates a tile.
- **t = 0s:** sheet flat; impression cylinder 0.15 through its sweep; pile at 7 sheets.
- **t = 2.5s:** the cylinder has completed one impression and is 0.4 into the next; the ink laid at
  ~0.6s is 62% dried and visibly lighter than when it was laid, while a fresh wet band sits further
  right; pile at 8-9.
- **t = 5s:** three impressions in, and the sheet has been **turned once** (turns run every 4.35s), so
  the tiles that were upright at t0 are the rotated ones now and the side guide has just finished its
  220ms register correction; pile at 10-11. Three independent channels differ from t0.

## 7. Reduced-motion freeze frame
`STATIC_TIME = 4.62s`. Mid-turn, sheet at 118 degrees about its vertical axis: the **gripper edge is
visibly still at the bottom**, one forme is edge-on and the other is emerging, the impression cylinder
is parked and the pile sits at mid height. This is the only frame that shows the turn axis together
with the retained gripper edge — i.e. the thing that makes it work-and-turn rather than a flip.
**Not t0**, which is a flat grid of thumbnails: the reject-on-sight case.

## 8. Scroll behaviour
None required; the fold sequence is activation-driven. If a host wires scroll, progress is read once
per rAF from layout as in `registry/loud/ebb-flat/component.tsx:613`, `p` drives the fold sequence and
is clamped at both ends, and each fold is **hysteretic** — once a fold starts it completes on the
clock, so a rubber-band scroll cannot leave a fold half-made. In a card viewport
(`rect.height - innerHeight <= 0`) `p` pins at 0, no fold ever runs, and section 6 is the entire read.
All geometry from `M = min(W, H)`; below `M = 300px` the imposition drops from 4x2 to 2x2 (a 4-page
work-and-turn) so the rotated tiles stay legible.

## 9. Hue -> luminance, both themes
- Sheet: `mix(bg, fg, 0.09)` light / `mix(bg, fg, 0.15)` dark.
- Tile images are **ink density**, not tone: ordered-dither `--foreground` dots on the sheet, so the
  images read identically in both themes with only the ink and paper values swapping. This is the
  same choice `heatmap-year-stipple` made deliberately and it is what keeps a photographic gallery
  monochrome-native rather than monochrome-by-desaturation.
- Wet ink: **+0.07 L** toward `--foreground` (denser), drying back over 1.1s.
- Gripper band: **-0.10 L**.
- The turn is carried by a single-lamp Lambert shade spanning **0.30 L** (azimuth 118 degrees), so an
  edge-on sheet is legible by value in either theme.
- **Rotated tiles are marked only by their actual 180-degree rotation** — never a tint, never a badge.
- `--ns-accent`: tile focus rings and the fold control only. It never touches the sheet, the ink, the
  turn or the fold.
- `--border`: the trim marks and the fold-line hairlines, which are literally register/fold rules — a
  legitimate separator use.
Tokens via `getComputedStyle` + `MutationObserver`, no literal fallbacks, no paint before the first
read.

## 10. Interaction
Tiles are real links or buttons with accessible names; Tab reaches one within 12 presses; arrow keys
move across the sheet in **sheet order, not reading order** (which is honest to the imposition), and
Enter runs the fold. Escape unfolds. The `gate` descriptor, if one is used, must point `expect` at a
tile that is genuinely occluded in the folded state and genuinely exposed unfolded — not at the sheet
wrapper or the trim marks, which render identically either way.

## 11. Kill criteria
- If a viewer cannot tell the **turn** from a flip, the gripper edge is not drawn strongly enough;
  fix it, and if it still reads as a flip, kill — the retained gripper edge is the whole concept.
- If the imposition reads as "randomly rotated thumbnails" rather than as an order the fold resolves,
  kill. The fold must demonstrably produce 1..8, and the builder should verify that by inspection
  before shipping.
- If the ordered-dither images turn to mud at card scale, drop the tile count before dropping the
  dither — greyscale photos would make this a generic gallery.
