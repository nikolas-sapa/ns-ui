# slip-wring — plan + add-on configurator as gauge blocks

**Collection:** core · **Surface:** plan/add-on configurator, total against a target budget

## 1. Surface and the real process

Replaces the "build your plan" configurator — a base tier plus a list of add-ons and a
running total.

Borrowed process: **Johansson slip gauges (gauge blocks)**. Blocks are lapped flat to
roughly 25 nm and **wring** together: placed at 90°, slid on, and twisted into alignment,
they adhere by surface adhesion and air exclusion and hold with 30+ N. Any target
dimension is built from a minimal combination out of a graded set (an 81-piece metric
set gives 0.001 mm steps). A wrung joint is optically invisible under the right light; a
block merely resting shows a gap. Blocks are separated by **sliding** them apart, never
by lifting.

## 2. Nearest existing slug and why this is not a restyle

Nearest: `storey-pole` (core) and `pin-register` (core).

`storey-pole`'s slabs are fixed and it is a *selector among* them; here the stack is
**composed** by the user and the load-bearing event is the wring — an add-on does not
appear in place, it arrives rotated 90° across the stack face, slides 18 px along its own
length and twists into register, and a block that will not wring is the model for a
mutually-exclusive add-on. `pin-register` disables a layer by parking it off the pins
(a lift); here removal is a **shear-off along the face**, which is both the physically
correct gesture and a visibly different one.

## 3. Mechanic

- Stack drawn edge-on, horizontal, growing rightward. Base block width by tier:
  34 / 58 / 86 px. Each add-on is a block whose width is proportional to its price,
  clamped to 12-40 px (12 px floor keeps a cheap add-on hittable).
- Widths derive from `min(w, h)`: `block_px = 0.055 * min(w,h) * price_ratio`, clamped.
- **Wring-on**, 480 ms total:
  - 180 ms — block enters at +90°, 24 px above the stack face
  - 90 ms — drops to contact
  - 210 ms — slides 18 px along the face at 210 px/s while rotating −90°, ease-in-out;
    final 60 ms is a 3° over-rotation and settle
- **Joint width is the state readout:** a wrung joint is 0.5 px; a block merely resting
  (hovered/considered, not committed) is 2.0 px. Committed vs considering is carried by
  seam width alone, no colour, no badge.
- **Shear-off:** 150 ms slide out along the face at 340 px/s, then the remaining blocks
  close the gap with a 220 ms spring (stiffness 190, damping 22, one small overshoot).
- **Datum line:** a fixed vertical hairline at the stated target budget. The stack's right
  face against that line is the entire readout. Over budget is drawn as the face crossing
  the line — never as a colour change.
- **Idle, unconditional:**
  - *Thermal drift:* total stack length oscillates ±0.9 px on a 7.30 s period. Real
    (20 °C ±0.5 °C moves a 100 mm stack by ~0.6 µm); exaggerated to be visible.
  - *Lapping sheen:* a 30 px band travels along the stack face at 22 px/s, wrapping
    every 9.00 s. When it crosses a wrung seam that seam briefly vanishes, which is
    what lapped steel actually does and is the strongest "this is metal" cue available
    without hue.

## 4. Alive at rest (no input)

- **t = 0.0 s** — sheen band at the left end of the stack, length at nominal.
- **t = 2.5 s** — band 55 px along, sitting on the second seam so that seam is invisible
  while the others read; stack +0.7 px longer.
- **t = 5.0 s** — band 110 px along veiling a different seam; stack −0.6 px. Which seam
  is visible has changed twice.

Both idle motions are sub-pixel-to-1 px in scale and confined to the stack, so they add
nothing to the reading load of the add-on list beside them.

## 5. Reduced-motion freeze frame

**Freeze at t = 3.10 s of the 9.00 s sheen cycle, with the configurator composed as:**
three blocks wrung, one block mid-wring at −18° and 6 px off contact, sheen band
sitting exactly on the newest seam.

Why: one frame showing a wrung joint, a not-yet-wrung joint, the entry attitude, and
the sheen doing its seam-veiling job. t=0 is a bare base block with no seam to compare
against, so the entire information mechanic (seam width = commitment) is unreadable.

## 6. Hue carried by luminance, both themes

- Block face: a 4-stop luminance ramp across the face height.
  - Light theme `0.72 -> 0.40` (steel is darker than paper)
  - Dark theme `0.30 -> 0.62` (steel is brighter than a dark room)
  - Direction flips; the ramp's **span is 0.32 in both**, so the "this is a cylindrical-ish
    ground surface" cue is identical.
- Sheen band: `−0.11 L` light, `+0.14 L` dark.
- Seam: a 0.5 px line at 0.9 of the local face luminance's complement, both themes.
- Block outline: `--ns-muted` at 0.40. `--border` is not used — it is invisible as a stroke.
- Datum hairline: `--foreground` at 0.55, 1 px, both themes.
- `--ns-accent`: add-on checkbox focus rings and the primary CTA only. Never on the
  sheen band — a travelling highlight is the exact place accent gets smuggled in.

## 7. Accessibility

- Canvas `aria-hidden="true"`. Every number is DOM text.
- Add-ons are real checkboxes in a `<ul>`, one `<li>` each, with visible `<label>`s.
  Space toggles. Focus order: target-budget `<input type="number">` (labelled) ->
  base-tier radiogroup -> add-on checkboxes in list order -> primary CTA.
- Mutually-exclusive add-ons use `aria-disabled` plus a `<p>` explaining why, wired via
  `aria-describedby`. They are not removed from the tab order.
- `aria-live="polite"` on the total, announced **on commit** (toggle or blur), debounced
  300 ms: `"Total PLACEHOLDER. Four units over target."` Over-budget is announced in
  words; it is never implied by the drawing alone.
- The wring animation never gates state: toggling three add-ons rapidly queues three
  wrings but the total and the announcement are correct immediately.

## 8. Placeholder copy

- base tiers: `Base A`, `Base B`, `Base C`
- add-ons: `Add-on one`, `Add-on two`, `Add-on three`, `Add-on four`
- budget field label: `Target budget`
- total: `TOTAL —`
- CTA: `Primary action`

No prices, no discounts, no "save X%".
