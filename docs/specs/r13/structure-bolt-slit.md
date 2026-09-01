# bolt-slit

- **slug:** bolt-slit
- **tier:** loud (full-bleed route curtain)
- **surface:** route curtain / preloader

## 1. Surface it replaces + the real process
Route curtain. Borrowed from **unopened books and the folder's bolt slitter**. A printed sheet
folded into a signature has closed folded edges at the head and the fore-edge; those folds are
called **bolts**. Books were sold unopened into the 20th century and the reader slit the bolts with
a paper knife; a modern folder does it with **slitting wheels** — rotating discs running against an
anvil, which must cut the head bolt before the chopper fold or the signature wrinkles. A slit bolt
does not leave a clean edge: the cut follows the fibre grain and produces a ragged, deckle-like
edge, and the two leaves **spring apart** because the fold stored elastic energy.

## 2. Nearest existing slug + why this is not a restyle
Nearest: `blade-stop` (a route curtain built as a nine-leaf iris diaphragm), plus
`curtain-traveler-draw`, `curtain-austrian-gather`, `curtain-tab-diagonal` and
`curtain-leader-countdown`. All five **move an intact covering** — leaves rotate, fabric hoists,
panels part, numbers count — and the covering survives the transition unchanged. Here the covering
is never moved: it is a folded sheet **destroyed along one line**, and the reveal is the fold's own
stored spring energy popping the halves apart, so the mechanic is a cut plus an elastic release
rather than a translation. Nothing in the registry cuts along a fibre grain to a ragged edge.

## 3. One-sentence mechanic
A full-bleed folded sheet whose single bolt is slit open by a travelling wheel, releasing the two
leaves on the fold's own spring and dropping them away.

## 4. Rendering approach
2D canvas (or SVG paths driven from the same model — canvas is preferred for the fibre edge).
The sheet is one surface with a raised fold ridge; after the wheel passes a column, that column
belongs to two independent leaves with their own opening angle. Leaf shading is a single-lamp
Lambert term. Cut edge geometry is a seeded 1-D fibre noise resampled per column.
Orientation: the fold runs along the container's **longer** dimension so the two leaves are as wide
as possible; in a card this means the fold runs horizontally at `0.5*H` in portrait and vertically at
`0.5*W` in landscape. `M = min(W, H)` governs amplitudes.

## 5. Real numbers
- **Fold ridge:** a 3-stop value band of total width `0.075*M` centred on the fold line, brightest on
  the lamp side (lamp azimuth 118 degrees).
- **Slitting wheel:** diameter `0.10*M`, riding the fold line, travelling at `0.62 * span/s` so a full
  slit takes **1.6s**. It rotates at `travelSpeed / (pi * d)` so surface speed matches — no slip. An
  anvil roller sits opposite.
- **Cut edge:** after the wheel passes column x, the fold at x is replaced by two edges whose profile
  is a seeded fibre noise, **RMS amplitude `0.004*M`, correlation length `0.02*M`** — visibly ragged
  at card scale, not a line.
- **Spring release:** per column, opening angle `theta(x, t)` is a second-order response with
  `omega = 11.5 rad/s`, `zeta = 0.72` (slight overshoot), target **34 degrees** for the near leaf and
  **30 degrees** for the far one — paper does not open symmetrically. The response for column x starts
  the frame the wheel passes x, so the opening is a travelling wave 1.6s long, not a hinge.
- **Fall:** once `theta > 30 degrees`, gravity carries the leaf to `theta = 92 degrees` over **380ms**
  with a single bounce at restitution 0.86.
- **Total reveal:** 1.6s slit + 0.55s spring + 0.38s fall, overlapping = **2.35s**.

## 6. Unconditional resting loop (curtain closed — this is what the gate screenshots)
`/preview/<name>` never fires the trigger, so the closed state must pass Filter 2 on its own.
Always-running rAF:
- **(a) ridge breath:** `h = h0 * (1 + 0.24*sin(2*pi*t/5.3) + 0.11*sin(2*pi*t/2.17))` with
  `h0 = 0.075*M`. At `M = 340px` that is a **+/-6px swing in ridge height** — explicitly not a
  sub-pixel breath; the highlight band on the crease visibly widens and narrows.
- **(b) crest wander:** `y_fold(x, t) = 0.5*H + 0.012*M * noise(2.1*x, 0.19*t)` — the fold is not
  straight and the shape it takes changes, so the highlight snakes.
- **(c) slack ripple:** two non-resonant travelling sinusoids (periods 7.9s and 3.4s, wavelengths
  `0.9*W` and `0.41*W`) shading the sheet **+/-0.05 L**, so the paper reads as a sheet under mild
  tension rather than a flat fill.
- **(d) idling wheel:** the slitter stays parked at the start edge and spins continuously at
  **1.4 rev/s** — a folder's wheels run whether or not a signature is in the machine — so there is
  always a rotating object with visible spokes.

- **t = 0s:** crest near its mean height, wheel spoke at 0 degrees, slack crest at `0.30*W`.
- **t = 2.5s:** ridge at 0.83x its t0 height; crest line displaced `0.008*M` near `x = 0.4*W`; wheel
  at 3.5 revolutions; slack crest at `0.62*W`.
- **t = 5s:** ridge back near maximum; the 2.17s component has run 2.3 cycles so the crest has a
  different shape entirely; the slack ripple's second sinusoid is in antiphase with t0.

## 7. Reduced-motion freeze frame
`STATIC_TIME = 3.9s`. At 3.9s the 5.3s ridge sine is near its minimum while the 2.17s component is
near its maximum, so the fold shows a shallow ridge with a strongly snaked crest — the frame where
it reads most clearly as a physical crease with a *shape*. **Not t0**, where the crest is straight
at nominal height and the whole thing looks like a drawn rule. On trigger under reduced motion the
component cuts hard between closed and open with no tween and no rAF.

## 8. Gate descriptor (the bug this has to avoid)
```jsonc
"gate": { "openBy": "[data-curtain-trigger]", "expect": "[data-curtain-open]", "resetBefore": true }
```
`data-curtain-open` is a **dedicated marker rect**, `0.06*M` square, drawn *beneath* the sheet in
paint order, centred at `(0.5*W, 0.5*H + 0.17*H)`. At rest that point is squarely inside the near
leaf's covered area; once the leaf has fallen to `theta = 92 degrees` it occupies only
`0.5*H .. 0.5*H + 0.02*H`, so the marker is clear by a wide margin and hittable at its own centre.
It is **not** the wheel, the anvil, the fold rule or a wrapper — all four render identically open or
shut, which is exactly the failure `docs/review-workflow.md` records three times. Follow
`registry/loud/curtain-austrian-gather/component.tsx:439`. Verify with `elementFromPoint` before AND
after the trigger; do not reason from paint order. The overlay goes `aria-hidden` once open and the
trigger button unmounts rather than staying focusable behind an `aria-hidden` ancestor;
`role=status` / `aria-live=polite` announces the loading state while closed.

## 9. Scroll behaviour
None — a route curtain is not scroll-driven. All geometry from `M = min(W, H)`; the fold orientation
flips with the container aspect so the mechanic reads in a wide card and a tall one alike.

## 10. Hue -> luminance, both themes
- Sheet: `mix(bg, fg, 0.13)` light / `mix(bg, fg, 0.17)` dark — always distinguishable from the page
  and always nearer background than foreground, because it is paper in both.
- Ridge highlight **+0.16 L**, ridge shadow **-0.13 L**, both relative to the sheet, so the crease
  reads by value in either theme without inverting.
- Revealed page beneath the curtain: `--background`.
- The ragged cut edge is carried by a **-0.20 L** 1px shade on the leaf side and **+0.10 L** on the
  revealed side — a real cut edge catches light on one face and shades on the other. No hue.
- `--ns-accent` touches only the Skip button's chrome and focus ring; it never touches the sheet, the
  ridge, the cut edge or the fall.
- `--border` only for the 1px card frame.
Tokens via `getComputedStyle` + `MutationObserver`, no literal fallbacks, no paint before the first
read (guard the rAF start, the `ResizeObserver` callback and the `IntersectionObserver` resume path).

## 11. Kill criteria
- If the ragged fibre edge is invisible at card scale, raise the noise amplitude first; if it still
  reads as a straight cut, the component is a wipe and must be **killed** — the destroyed-along-the-
  grain edge is the entire non-duplication argument against `blade-stop`.
- Measure the resting ridge breath: if the height swing is under 3px at `M = 340`, it is below the
  perceptual floor and this dies the way `seam-gild` and `starch-shear` died. Raise `h0` or the
  modulation depth.
- If the two leaves open as a symmetric hinge rather than as a wave following the wheel, kill.
