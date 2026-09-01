# damask-float

- **slug:** damask-float
- **tier:** core (2D canvas per cell, feature-grid scale)
- **surface:** feature grid (GAP-MAP gap #5, bucket count **6**, only 2 real; backlog queue item 6)
- **family:** textile

## 1. Surface replaced + the real material process

Replaces the **feature grid**. GAP-MAP ranks it gap #5 and states the hole
precisely: "a grid where the *cells* carry the mechanic and the grid earns being a
grid rather than being a picture with borders." That is the design here — each cell
is a piece of the same cloth, the take-up and the loom sway run across the whole
grid so the cells share one material, and the hover reversal propagates as a front
rather than being a per-card state. The backlog names the same block at #6, "the
single most repeated block out there", 19 ecosystem hits.

Real process: **damask weaving**. Damask is figured cloth made from **one thread
in one colour**. The pattern exists because the ground and the figure are woven in
**reciprocal satin structures**: in a 5-end satin the warp floats over 4 picks in
the ground, and in the figure the structure reverses so the **weft** floats over 4
ends instead. The two regions have identical fibre and identical colour and differ
only in **which direction the exposed thread runs**, which changes the specular
anisotropy of the surface. Measured warp-face vs weft-face reflectance ratio at 30
degrees incidence is about **1.6-2.2:1**, and it **inverts** when the cloth or the
viewer turns 90 degrees — which is why a damask tablecloth's pattern flips between
figure and ground as you walk past it.

This is the one textile process that is **natively monochrome**: a single-colour
cloth whose whole visual content is carried by luminance anisotropy. It is the
strongest theme argument available in this slice, because there is no hue to
remove — there never was one.

Real numbers: 5-end or 8-end satin; **30-60 ends/cm**; float length 4 or 7 picks;
thread diameter ~0.18 mm for a fine linen damask.

## 2. Nearest existing slug + why this is not a restyle

Nearest: **`grazing-light`** (feature-grid card, blind-embossed icon and heading,
revealed by a low-angle light raking across), **`background-truchet-weave`**,
**`warp-knit-tricot-lapping`**, **`jacquard-card-chain`**, **`hero-cloth-type`**.

Against `grazing-light` — the closest, and the one to argue: that component's
figure is **relief**, and it is revealed because a light source moves over a
height field. Damask cloth is **planar**. There is no relief, no height field, and
the figure would be invisible to a normal-map renderer. What differs between
figure and ground is the **azimuth of the exposed thread**, so the render is an
anisotropic BRDF evaluated per texel with a *fixed* light — a Kajiya-Kay lobe
whose highlight is a streak perpendicular to the thread direction. Reverse the
float direction and the same pixel goes from bright to dark **without any geometry
changing at all**. That is a categorically different rendering model, and it is
why the hover state here can invert the whole grid instantaneously.

Against `jacquard-card-chain`: that is the loom's **control mechanism** (a punched
card chain feeding past a needle bank). This is the **cloth the mechanism
produces** — no cards, no needles, no chain.

Against `warp-knit-tricot-lapping` and `background-truchet-weave`: both build a
scrolling geometric field from tile/stitch orientation. Neither has an anisotropic
reflectance model; both would look identical rendered with a lambert shader, and
this one would go blank.

## 3. Mechanic

Per grid cell, a canvas at **cloth resolution**: thread pitch
`P = 0.018 * min(w,h)` px, so a 260 px cell carries ~55 ends and reads as cloth
rather than as a checkerboard. Structure grid at `P`, 5-end satin, standard
counter-step 2.

Per texel:
- `S in {0,1}` — 0 = warp-face ground, 1 = weft-face figure. Taken from the cell's
  figure mask (the feature icon + a damask border motif), rasterised once.
- Exposed-thread azimuth `phi = S ? 90 : 0` degrees, plus a per-texel jitter of
  **+-4 degrees** from the twist (without this the surface reads as flat vector
  art).
- Satin float phase gives a per-texel binding-point mask; binding points break the
  float and drop reflectance to 0.35 of the float value. This is what stops the
  two regions being two flat greys.

Reflectance: **Kajiya-Kay anisotropic** with a fixed light (elevation 34 degrees,
azimuth 15 degrees) and a fixed view:

    L = ka + kd * sin(theta_LT) + ks * ( sin(theta_LT) * sin(theta_VT)
                                       - cos(theta_LT) * cos(theta_VT) )^n

with `n = 26`, `kd = 0.34`, `ks = 0.52`, where `T` is the thread tangent from
`phi`. At the fixed light/view this yields warp-face L ~1.9x weft-face L, matching
the measured 1.6-2.2:1 band.

**What makes it alive with no input — the cloth is on a loom and the cloth moves.**
Two unbounded mechanisms:

1. **Take-up.** The cloth advances upward at `TAKEUP = 0.021 * min(w,h) px/s`,
   wrapping. The figure mask advances with it, so the damask motif continuously
   traverses each cell and new cloth enters at the bottom. The feature **icon**
   region is pinned in cell coordinates (it must stay legible); the surrounding
   damask ground motif is not.
2. **Loom sway.** The light's azimuth is fixed, but the **cloth's grain azimuth**
   oscillates +-3.5 degrees on an 8.7 s period (a real web under take-up tension
   wanders). Because the highlight is a `^26` lobe, a 3.5-degree grain swing moves
   the specular streak across several thread widths and the whole surface visibly
   shimmers — a small cause with a large, legible effect, which is the correct way
   to buy aliveness in an anisotropic material. Second harmonic at 13.4 s,
   amplitude 1.2 degrees, so it is quasi-periodic and does not repeat on the 8.7 s
   beat.

**Hover / focus (the card reveal at grid scale):** hovering a cell **reverses its
satin** — `S -> 1 - S` propagating from the pointer as a front at
`0.9 * min(w,h) px/s`. Figure becomes ground and ground becomes figure, so the
icon inverts from dark-on-light to light-on-dark with no fade and no translate.
This is exactly what a real damask does when you turn it, and it is a reveal no
other slug in the registry can produce.

**No `--ns-accent` in the specular streak.** The highlight is the component's
climactic moment and it stays pure luminance.

## 4. Resting loop with no input

- **t=0s:** grid of cloth cells; figure regions bright, ground dark; specular
  streak sitting at one grain angle.
- **t=2.5s:** loom sway has moved the grain ~2.5 degrees. The specular streak has
  visibly travelled across the ground; contrast between figure and ground has
  changed measurably (the anisotropic lobe is steep, so this is not subtle). The
  damask border motif has advanced ~0.05 of a cell height.
- **t=5s:** sway has passed its extreme and is returning through a different point
  of the 13.4 s harmonic, so the shimmer state is not the t=0 state; the motif has
  advanced ~0.10 cell.

**Named resting loop:** unbounded take-up translation (cloth is continuously
produced and leaves the frame) x two incommensurate sway harmonics acting on a
`^26` specular lobe. Nothing converges; a still cloth is not a state this component
has.

## 5. Reduced-motion freeze frame

`STATIC_TIME = 5.4 s`. At 5.4 s the grain sway is near +2.9 degrees — off-centre,
which puts the specular streak **inside the cell body rather than along its edge**,
so the frozen frame shows the anisotropic highlight doing its job. It is also a
take-up phase where the border motif's repeat is centred in the cell. `t=0` puts
the grain at 0 degrees, where the streak sits exactly along the horizontal thread
axis and figure/ground contrast is at its **minimum** — the worst possible still.
Byte stability: sway is a pure function of `STATIC_TIME`; satin jitter from an
integer hash of `(ix, iy)`, never `Math.random()`.

## 6. Luminance in both themes

| stop | light | dark |
|---|---|---|
| binding point in weft-face figure | L 0.08 | L 0.05 |
| weft-face figure body | L 0.29 | L 0.20 |
| warp-face ground body | L 0.58 | L 0.46 |
| ground under specular streak | L 0.84 | L 0.78 |
| streak peak on a float crown | L 0.96 | L 0.98 |

Direction is identical in both themes — warp-face brighter than weft-face, binding
points darkest, streak brightest. Bias and contrast are all that move. The
light-theme check comes first and the specific risk is the **figure body** and the
**ground body** compressing until the pattern disappears: hold a hard **0.22 L**
floor between them by raising `ks`/`n`, never by tinting one region. `--border` is
the 1 px cell separator only.

## 7. Text on the surface

Yes — each cell carries a heading and a short body, and after a hover reversal the
ground **inverts**, so a fixed text colour would fail in one of the two states.
Handled explicitly:

- Text is drawn on a **plain woven tabby patch** — a small region where the satin
  is replaced by a 1/1 plain weave, which is optically flat (no floats, no
  anisotropy) and sits at a fixed L 0.68 (light) / L 0.24 (dark) regardless of the
  surrounding satin state. This is a real damask convention: plain-weave panels
  are used exactly where the cloth must not shimmer.
- Text-to-patch delta floored at **8:1**.
- **Worst frame, named:** mid-reversal, when the propagating satin front is
  **crossing the tabby patch boundary**, because that is the frame where the
  surround is inverting and any bleed of satin shading into the patch would show.
  Check there. The patch mask is applied *after* the front, so the front visibly
  passes behind the patch and the patch never changes L — verify that empirically
  with `elementFromPoint`-equivalent pixel sampling rather than reasoning from
  draw order.

## 8. Canvas host

2D canvas per cell (or one canvas for the grid with per-cell viewports if cell
count exceeds 9). `w-full h-full`, DPR-aware backing store capped at 2, checked at
dsf 2 — the satin's `P` is small enough that a dsf-2 intrinsic-size fallback would
alias visibly. `ResizeObserver` on the host, re-deriving `P`, `TAKEUP` and the
motif scale from the new **smaller** dimension. `IntersectionObserver` threshold 0
+ `visibilitychange` pause. Tokens via `getComputedStyle` + `MutationObserver` on
documentElement class; no paint before the first token read on any resume path.
Zero colour literals. Render each cell into an `ImageData` at 1/2 device
resolution and upscale — the anisotropic term is the cost, and halving it is
invisible at satin pitch. Adaptive step-down only after ~900 ms sustained EMA over
budget, never on frame count or device heuristics.

## Kill criteria

- If figure and ground read as two flat greys, the anisotropic BRDF is not earning
  its place and this is a two-tone pattern card. Kill.
- If the loom sway does not visibly move the specular streak in a 2.5 s screenshot
  pair, the aliveness claim is unverified — raise `n` before raising the sway
  amplitude, and if neither works, kill.
- If the hover reversal reads as a colour swap rather than as the **same cloth seen
  the other way**, the binding-point structure is missing. Kill.
