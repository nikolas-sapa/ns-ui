# cockle-swell

- **slug:** cockle-swell
- **tier:** core (2D canvas warp + real DOM text, card-to-section scale)
- **surface:** pull-quote / testimonial block (GAP-MAP gap #4, bucket count **2**; backlog queue item 7)
- **family:** paper

## 1. Surface replaced + the real material process

Replaces the **pull-quote / single-testimonial block**. GAP-MAP ranks testimonial
gap #4 with a bucket count of **2** (`testimonial-wall-reflow`, `seal-roll`) and
names the specific hole: "any quote surface where the *reading* is the mechanic".
That is what this is — the sheet the quote is printed on moves under the reading,
so the act of reading happens on a surface that is doing something. Backlog gap #7
(13 ecosystem hits) names the same block.

Real process: **cockling** — the buckling a paper sheet undergoes when moisture
is non-uniform across it. The driver is **hygroexpansivity**, and the reason
cockling has a characteristic look is that paper is strongly **anisotropic**:

| direction | hygroexpansivity |
|---|---|
| cross-direction (CD) | 0.10-0.30 % per 10% RH |
| machine-direction (MD) | 0.02-0.05 % per 10% RH |

A **4-6:1 ratio**, because fibres align with MD during forming and swell mostly
in girth. So a sheet picking up moisture expands mostly across the grain, the
expanded region does not fit, and it buckles into ridges that run **along the
grain** — cockling always has a direction, and that is the identity of the
component. Moisture diffusion through a 100 um sheet: `t ~ h^2/D` with
`D ~ 1e-9 m2/s` gives ~10 s in-plane-normalised, so a sheet visibly breathes on a
seconds timescale in changing RH. Cockle wavelength **10-40 mm**, amplitude
**0.3-2 mm**.

## 2. Nearest existing slug + why this is not a restyle

Nearest: **`crease-fall`** (paper concertina nav overlay, discrete folds released
under gravity), **`seal-roll`** (cylinder-seal quote rotator), **`grazing-light`**,
**`hero-cloth-type`** (headline re-drawn through a warped spring mesh).

Against `crease-fall`: creases are **discrete, plastic, and permanent**; cockling
is **continuous, elastic, and reversible** — the sheet breathes and never lands
in a folded state. Against `hero-cloth-type`: that warp is pointer-driven spring
dynamics on a generic mesh with no material law; here the warp field is generated
by an anisotropic hygroexpansion with a 5:1 direction ratio, and the ridges are
therefore always parallel to a fixed grain axis rather than following the
pointer. Against `grazing-light`: the type is **not embossed and not lit** — it is
flat, fully-opaque printed ink that is **geometrically distorted** by the sheet
under it. The reveal is displacement, not shading, which is the optical
differentiator this set uses to stay clear of that slug.

## 3. Mechanic

Fields on a **96 x 96** lattice (square, sampled into the block from the
**smaller** dimension so ridge spacing is constant at card and section scale):

1. **Moisture** `m(x,y)`, 0..1 around a mean of 0.5. Driven by:
   - Isotropic diffusion, `D = 0.10 * min(w,h)^2 units/s` normalised so a
     feature relaxes over ~4 s. Explicit 5-point laplacian, `dt` substepped x2.
   - **Three wandering humidity sources**, each a Gaussian
     (`sigma = 0.20 * min(w,h)`) drifting on independent Lissajous paths with
     periods **11.3 s, 17.9 s and 23.1 s** — mutually incommensurate, so the
     combined field is quasi-periodic and never repeats within any observation
     window. Amplitudes +-0.16, +-0.11, +-0.09.
   - **Edge exchange:** the sheet's perimeter equilibrates with ambient
     (`k = 0.30 /s`) — real sheets cockle at the edges first, and this is what
     puts visible ridges at the block's border rather than only in the middle.
2. **In-plane strain** from `m`: `eps_CD = 0.020 * (m - 0.5)`,
   `eps_MD = 0.0040 * (m - 0.5)` — the 5:1 ratio, taken straight from the table.
   Grain axis is fixed at MD = horizontal.
3. **Out-of-plane displacement** `z(x,y)`: a sheet buckles where compressive
   strain exceeds the plate's critical value. Solve cheaply and correctly enough
   with a **directional Helmholtz filter**: `z = G_aniso * (eps_CD - eps_c)_+`,
   where `G_aniso` is a separable gaussian with `sigma_x = 3.2 * sigma_y`
   (long along grain, short across it) and `eps_c = 0.0016`. That single
   anisotropy in the smoothing kernel is what produces ridges parallel to MD
   instead of blobs, and it is 2 separable passes per frame.
4. **Amplitude** `z_max = 0.028 * min(w,h)` px.

Render in two layers:
- **Sheet:** shaded from the `z` normal by **one fixed** light at elevation 22
  degrees, azimuth 200 degrees, plus a broad sky term. Deliberately low-contrast
  — the sheet shading is secondary. Grain (laid texture) is a faint 1.4 px
  horizontal streak field at 0.02 amplitude.
- **Type:** the quote is **real, selectable DOM text**, not rasterised, warped by
  a per-frame CSS grid of 4x3 `<span>` wrappers each carrying a
  `translate/skew/scale` derived by sampling `z` and its gradient at that span's
  centre (max translate 3.5 px, max skew 1.6 degrees, max scale 1.02). Sampling
  DOM warp coarsely is deliberate: a per-glyph warp destroys selection and
  screen-reader flow, and the whole point of a testimonial is that the quote is
  text.

If a build cannot hold the DOM-text approach, rasterising the quote is
acceptable **only** if an offscreen accessible copy carries the same string.

No pointer requirement. If added: pointer adds local moisture (a 4th, transient
source). Luminance only; **no `--ns-accent`** on the sheet's specular ridge — a
paper sheet has no accent-coloured highlight and reaching for one here is the
project's standing defect.

## 4. Resting loop with no input

- **t=0s:** ridges running horizontally, strongest near the left edge; the quote's
  second line rides over a crest and is displaced up ~2 px.
- **t=2.5s:** the fastest humidity source (11.3 s) has moved a quarter cycle. A
  crest that was left of centre has migrated right and flattened; a new one is
  forming at the bottom edge from edge exchange. The quote's warp is visibly
  different — a different line is now the displaced one.
- **t=5s:** the 11.3 s source has completed nearly half a cycle while the 17.9 s
  and 23.1 s sources have moved much less, so the ridge pattern is a genuinely
  new superposition rather than a return toward t=0.

**Named resting loop:** three incommensurate drifting moisture sources plus
continuous perimeter exchange. Quasi-periodic, unbounded, unforced, and it cannot
settle because the sources never stop moving and the sheet is always chasing a
target it never reaches.

## 5. Reduced-motion freeze frame

`STATIC_TIME = 8.2 s`. Chosen because at 8.2 s the three sources are near maximum
separation, which is the frame with the **most ridges and the highest ridge
count crossing the quote block** — the most-structured frame, and the one that
shows what the component is. `t=0` starts from a near-uniform `m` and is almost a
flat sheet, which is the automatic-reject static grey card. Freeze the DOM warp
transforms at the same instant so the type distortion is part of the frozen
frame. Byte stability: source paths are pure functions of `STATIC_TIME`, no
accumulated state, no clock.

## 6. Luminance in both themes

| stop | light | dark |
|---|---|---|
| ridge contact shadow | L 0.11 | L 0.06 |
| sheet in trough | L 0.55 | L 0.33 |
| sheet nominal | L 0.72 | L 0.44 |
| sheet on crest | L 0.86 | L 0.60 |
| grazing highlight on crest | L 0.96 | L 0.97 |

Direction identical in both themes: crest brighter than trough, shadow darkest.
Bias and contrast are what move — light theme is bright paper with a shallow
shading range and a deep contact shadow; dark theme is the same sheet in a dark
room, so the nominal sits lower and the crest highlight has to carry more of the
range. Light theme is checked first because "sheet nominal" and "sheet on crest"
compressing is the specific failure that makes the whole thing look flat; hold a
**0.10 L** floor between them by widening the light's contribution, never by
raising ridge amplitude past `0.028 * min` (past that, the type warp becomes
unreadable — see below).

## 7. Text on the surface

Yes, and this is the acute case in the set: a **quote sits directly on a
distorting surface**, so both contrast and geometry can fail.

- **Contrast clamp.** The quote text is a flat token fill (`--foreground`), not
  shaded. The sheet's shading under it is **compressed to 60% of its range**
  inside a 14 px dilation of the text block's bounding box, so the ground under
  the type has a narrower L span than the sheet at large. Text-to-ground delta
  floored at **7:1**; measured on the *lightest* ground pixel under the glyphs in
  light theme and the *darkest* in dark theme, not on the mean.
- **Worst frame, named:** the frame where a **crest ridge runs directly under a
  line of type and its grazing highlight lands on the x-height band**. That is
  the maximum-ground-L frame in light theme and the one to measure. It is not
  t=0, where the sheet is nearly flat and the check trivially passes.
- **Geometric clamp.** Per-span translate capped at 3.5 px and skew at 1.6
  degrees regardless of ridge amplitude. A quote that is *legibly on a rippling
  sheet* beats one that is *warped enough to be impressive*; the ridge amplitude
  can go higher on the sheet outside the text block, and should.

## 8. Canvas host

2D canvas for the sheet plus DOM for the type. `w-full h-full` on the canvas,
DPR-aware backing store capped at 2, verified at dsf 2. `ResizeObserver` on the
host — re-derive `z_max`, kernel sigmas and `D` from the new **smaller**
dimension. `IntersectionObserver` threshold 0 + `visibilitychange` pause the rAF
and freeze the DOM transforms where they are. Tokens via `getComputedStyle` +
`MutationObserver` on documentElement class; **no paint before the first token
read on mount, resize, or intersection resume**. Zero colour literals. The DOM
warp writes transforms on 12 spans per frame — batch them in one write phase
after all reads to avoid layout thrash.

## Kill criteria

- If ridges do not run visibly **parallel to a fixed grain axis**, the anisotropy
  is not reading and the component is generic paper wobble. Kill — the 5:1 ratio
  is the whole justification.
- If the quote's warp makes any line harder to read than flat text, cut the warp
  cap until it does not; if there is no cap at which the sheet still reads as
  cockled, kill.
