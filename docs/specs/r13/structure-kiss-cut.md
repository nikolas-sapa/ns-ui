# kiss-cut

- **slug:** kiss-cut
- **tier:** core (card-scale canvas band)
- **surface:** marquee / logo ribbon

## 1. Surface it replaces + the real process
Marquee. Borrowed from **rotary die-cutting of pressure-sensitive labels**. A laminate web (face
stock + adhesive + silicone release liner) runs through a rotary die that **kiss-cuts**: the die
penetrates the face stock and adhesive but not the liner. The waste web between and around the
labels — the **matrix** — is then stripped away by peeling it off over a stripping bar at a sharp
angle (typically 30-45 degrees) and winding it onto a matrix rewind, leaving the labels sitting on
a continuous liner. Die corners are **radiused** because a square corner tears the matrix. The two
things an operator actually adjusts are strip angle and matrix tension; the two real failure modes
are **matrix break** (the waste web snaps, the line stops) and label lift at too steep an angle.

## 2. Nearest existing slug + why this is not a restyle
Nearest: `sticker-peel` ("drag a corner and the printed face lifts on a moving fold line, exposing a
pale adhesive underside with a sweeping specular sheen; release early and it re-sticks"), plus
`marquee-ticker-glyph`, `ticker-teleprinter` and `logo-cloud-settle`. sticker-peel is a single
user-driven object whose whole subject is peeling the **label**; here the label never moves — it
stays down on the liner and the thing peeling is the **waste around it**, continuously, unforced, at
a fixed strip angle, on a web that never stops. And the construction is inverted against every
existing ticker: the marquee's content is what **remains after a subtraction**, rather than content
added into a stream.

## 3. One-sentence mechanic
A label web is kiss-cut by a rotary die and the waste matrix around the labels peels continuously off
the liner at a fixed angle onto a filling rewind spool, leaving the marks behind.

## 4. Rendering approach
2D canvas band. Three stacked value layers (liner, face stock, matrix) plus a peel geometry: a strip
front whose local lift angle and the matrix's local width drive a single-lamp Lambert shade across the
curl. The rotary die, stripping bar and rewind spool are drawn objects. `M = min(bandW, bandH)`,
`W = bandW`.

## 5. Real numbers
Worked at a representative band of `W = 3*M`, `M = 340px`.
- **Web speed:** `v = 0.40*W/s` right-to-left (408 px/s); a label crosses in 2.5s.
- **Labels:** `0.13*M` wide, matrix gutter `0.022*M` between them, matrix margin `0.028*M` top and
  bottom. Kiss-cut line 1px, **corner radius `0.018*M`** — radiused because a square corner tears the
  matrix, and drawing it square would be a factual error a reader can see.
- **Rotary die:** a cylinder at the right edge, diameter `0.13*M` (44.2px, circumference 138.8px),
  **3 label repeats per revolution**, surface speed matched to the web -> `408/138.8` = **2.94 rev/s**.
- **Stripping bar** at `x = 0.62*W`; **strip angle 38 degrees**; the matrix runs up-right to a rewind
  spool at the top-right corner.
- **Peel front is not straight.** It advances label row by label row, and at each label's leading
  corner the matrix visibly **necks by 6%** in width over a `0.03*W` run before releasing. This is
  the corner-radius consequence and it is the component's characteristic micro-event, firing once per
  label at 2.5s spacing.
- **Rewind spool:** radius grows `0.045*M -> 0.11*M` over **40s**, then the roll is doffed over 700ms
  and a fresh core rises. Its RPM = `v_matrix / (2*pi*r)`, so it **visibly slows as it fills** — a
  second unconditional rotation whose rate changes.
- **Tension hunting:** matrix tension oscillates **+/-12% on a 9.3s sine** (a real dancer-controlled
  line hunts). When it crosses a 1.18 threshold — once per 9.3s — the matrix necks a further 9% for
  **620ms** without breaking.
- **Matrix break:** every **47s** the matrix parts: the free end whips upward over 260ms, the line
  decelerates to 0 over 900ms, the strip re-forms over 700ms and the line ramps back to `v` over
  1.1s. Total 3.0s. This is the once-per-47s drama; the 9.3s necking is the reliable mid-frequency
  event and the 2.5s corner release is the fast one.
- **Marks:** 7 seeded abstract placeholder marks on the face stock.

## 6. Unconditional resting loop
- **t = 0s:** web mid-run, matrix peeling at 38 degrees, spool at `r = 0.062*M`, die at 0 degrees.
- **t = 2.5s:** the web has advanced `1.0*W` so every label has been replaced; the die has made 7.35
  revolutions; the spool has grown `0.004*M` and its RPM has dropped ~4%; the peel front has crossed
  8 label corners, each with a visible neck and release.
- **t = 5s:** `2.0*W` of travel; spool at `0.070*M`; the 9.3s tension sine has taken the matrix
  through a full necking event (peaking around t = 2.3s and relaxed by 5s), so the matrix's width at
  5s differs measurably from t0.

## 7. Reduced-motion freeze frame
`STATIC_TIME = 2.32s`. The peel front exactly at a label's leading corner with the matrix necked to
its minimum width, the die mid-repeat with a partial kiss-cut outline on the web, and the spool at a
mid radius. This frame shows the kiss-cut, the strip angle, the neck and the rewind at once.
**Not t0**, where the peel front is in a straight run between labels and reads as a static diagonal
wedge.

## 8. Scroll behaviour
None. The component never reads scroll; geometry from `M = min(bandW, bandH)`, and below `M = 200px`
the label count drops from 7 to 5 and the necking amplitude rises to 10% so the micro-event stays
above the perceptual floor.

## 9. Hue -> luminance, both themes
- Liner: `mix(bg, fg, 0.06)` light / `mix(bg, fg, 0.12)` dark.
- Face stock: `mix(bg, fg, 0.14)` light / `mix(bg, fg, 0.20)` dark — always one step further from the
  background than the liner in **both** themes, because it is a second layer on top; the layer order
  therefore never inverts.
- Bare liner where the matrix has been removed is siliconised and slightly glossier: **+0.05 L** in
  both themes. (Note the correct physics: a kiss cut means the matrix carries its own adhesive away,
  so what is exposed is liner, not adhesive — this is where the component would otherwise slip into
  being `sticker-peel`.)
- The peeling matrix takes a single-lamp Lambert shade across its curl (azimuth 118 degrees) spanning
  **0.26 L**, so the 38-degree lift reads as a lift and not as a drawn triangle.
- Marks: `--foreground` at 0.78 alpha on the face stock.
- **Necking is carried by geometry only** — width — never by a luminance flash or a colour change.
- `--ns-accent`: a pause control's focus ring only, if one ships.
- `--border`: the band's hairlines.
Tokens via `getComputedStyle` + `MutationObserver`, no literal fallbacks, no paint before the first
read.

## 10. Interaction
None required, and no pointer highlight on the web. Any pause control is a real button with an
accessible name.

## 11. Scope tripwire
The marks are procedurally generated placeholders. No real brand marks, no customer counts, no trust
claims — surface those to the owner instead of writing them.

## 12. Kill criteria
- If the peel reads as a static diagonal wedge, raise the neck to 12% first; if it still reads
  static, **kill** — the neck-and-release at each corner is the entire aliveness argument at the fast
  timescale.
- If the exposed area ever reads as adhesive rather than liner, the physics is wrong and the
  component has become `sticker-peel`.
- Must not ship in the same wave as `flying-splice`. Both are web ribbons; the deciding test is
  whether the dominant moving object is a **peel front with a rewind** (this) or a **pair of rolls**
  (that). If a reviewer cannot tell them apart at a glance, one of the two must be dropped.
