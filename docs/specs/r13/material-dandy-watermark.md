# dandy-watermark

- **slug:** dandy-watermark
- **tier:** core (2D canvas, badge/seal scale — derive from smaller dimension)
- **surface:** badge / seal mark, scoped to sit **on the closing CTA band or the trust row beneath it** (GAP-MAP gap #2, bucket count 0)
- **family:** paper

## 1. Surface replaced + the real material process

Replaces the **badge / seal mark** — the small authority mark that normally ships
as a static SVG rosette. Scoped deliberately: this is not a standalone texture (a
GAP-MAP note warns that decorative/texture is already 23 slugs and ambient
background 54, the two most crowded non-hero buckets). It is furniture **for the
closing CTA band and the trust row under it**, the block GAP-MAP ranks gap #2 with
a count of zero, and it composes with `peel-flow` in this same slice.

Real process: the **dandy roll watermark**. On a fourdrinier machine, a wire-mesh
cylinder rides on the still-wet, ~85-92% water web. Raised wire on the roll
locally **displaces fibre**, so that region ends up thinner — a genuine
watermark is a **caliper (thickness) modulation**, not a printed mark, and it is
invisible in reflected light and obvious in transmitted light. That last fact is
the entire component.

Real numbers: dandy roll diameter **700-900 mm**; watermark wire relief
**0.3-0.8 mm**; fine-paper web speed **60-200 m/min**; basis weight
**80-120 g/m2**; sheet caliper ~**100 um**, dropping **20-35%** in the
watermarked region; **Beer-Lambert** transmission `T = exp(-k * caliper)`, so a
30% caliper drop at `k*caliper_0 = 2.1` lifts transmittance from 0.12 to 0.27 —
a factor of 2.2, which is exactly how visible a watermark is when you hold paper
to a window. Formation flocs (the cloudiness of cheap paper) have a
characteristic scale of **2-10 mm** and are the source of the live texture.

## 2. Nearest existing slug + why this is not a restyle

Nearest: **`grazing-light`** (relief revealed by a raking low-angle light),
**`rating-stamp`** (seal impressions with an expanding impression ring),
**`badge-unread-tarnish`**. Removed-slug check: **`light-table`** (cut 2026-08-10)
was the registry's other backlit surface — it is on the never-rebuild ledger, and
this is not it: a light table is a *viewing instrument* (a lit surface you place
transparencies on), whereas this is a **running paper web with a caliper
modulation imprinted by a roll**, and the mark is the material's own thickness
rather than anything laid on top of a lamp.

Against `grazing-light` — and this is the deliberate optical separation for this
whole set: dandy-watermark has **no light source at all**. There is no normal,
no specular, no shading term. The image is `exp(-k * caliper)` against a backlight,
which means the mark is *brightest where the material is thinnest* — the exact
opposite response to relief-under-raking-light, where a raised feature is bright
on one side and dark on the other. Two components could share a height field and
still look nothing alike. Against `rating-stamp`: that is an impression event
driven by input, additive ink; this is a continuous web with no event and a
subtractive thickness field.

## 3. Mechanic

The web **runs**. Vertical scroll at `WEB_SPEED = 0.13 * min(w,h) px/s`, wrapping,
so material continuously enters and leaves — the badge is a window onto a moving
web, not a stamped object.

Fields on a **128 x 128** grid (square, derived from the badge's smaller
dimension so it reads identically at 48 px and at 320 px):

1. **Formation field** `f(x,y)`: fibre flocculation. Two octaves of value noise
   at floc scales `0.14 * min` and `0.055 * min` px, amplitudes 0.055 and 0.028
   of nominal caliper, advected downward with the web plus a small
   **cross-direction shear** of `0.012 * min px/s` (a real web wanders). This is
   the live texture and it never repeats because the noise is sampled in a
   scrolling coordinate whose offset is unbounded.
2. **Dandy imprint** `d(x,y)`: the watermark device (wordmark or a simple seal
   ring + glyph) rasterised once. Imprint depth **0.30 of nominal caliper** in the
   device, with a **1.4 px soft shoulder** — real watermark edges are soft
   because fibre flows back around the wire.
3. **Laid/chain lines** from the same roll: a periodic caliper ripple, laid wires
   at **1.1 mm** pitch (amplitude 0.035 caliper) and chain lines at **26 mm**
   pitch (amplitude 0.06). Both scroll with the web and are the cue that says
   "this is paper made on a machine", cheaply.
4. **Couch-roll shadow mark:** every `2.9 s` the dandy roll's own once-per-
   revolution seam passes, laying a faint 3 px transverse caliper band across the
   web. This is a real periodic artefact and it gives the loop a slow, legible
   beat that is not the scroll.

Composite caliper `c = 1 - d + f + laid + chain`, clamped to `[0.45, 1.25]`.
Render `L = L_back * exp(-K * c)` with `K` chosen so `c=1` maps to the mid stop.
**Straight Beer-Lambert, one exponential, no shading.**

No pointer interaction is required. If added: the pointer acts as a **local
backlight**, raising `L_back` in a soft disc — brightness only, **never** a
`--ns-accent` tint. The recipe's most repeated defect (`edge-yield`,
`granule-churn`, `shear-billow`) is precisely an accent-tinted pointer highlight,
and a warm-tinted "light through paper" is the most tempting version of it in the
whole set. Explicitly forbidden.

## 4. Resting loop with no input

- **t=0s:** watermark device centred and legible; formation cloudiness in a
  particular arrangement; chain lines at a given phase.
- **t=2.5s:** web has scrolled ~0.33 of the badge height. Chain lines have
  visibly moved; the floc cloud around the device is a **different cloud** (it
  scrolled through and new noise entered at the top); the dandy seam mark has
  passed once and is partway down the frame.
- **t=5s:** ~0.65 height travelled, a second seam mark has entered, and the
  cross-direction shear has offset the laid lines by ~1.5 px relative to t=0 so
  they are not simply the same lines translated.

**Named resting loop:** unbounded web translation with noise sampled in a
non-repeating scrolling coordinate, plus a 2.9 s seam beat incommensurate with the
scroll period. The device itself is locked to the roll and so stays registered —
which is correct, and is what keeps the badge readable while everything around it
moves.

## 5. Reduced-motion freeze frame

`STATIC_TIME = 3.6 s`. At 3.6 s the dandy seam mark sits at ~0.72 of the height
— below the device, so it does not cross the mark, but present enough to show
that the web is a running web. `t=0` has the seam exactly at the top edge where
it reads as a clipping artefact rather than a feature. Byte stability: value
noise from an integer-hash lattice keyed on `(ix, iy + floor(scroll))`, no clock,
no `Math.random()`.

## 6. Luminance in both themes

Transmission is monotonic in caliper, so direction is fixed by physics in both
themes: **thinner = brighter, always**.

| stop | light | dark |
|---|---|---|
| heaviest floc + chain line | L 0.07 | L 0.04 |
| nominal sheet | L 0.30 | L 0.21 |
| light floc | L 0.52 | L 0.43 |
| watermark device | L 0.79 | L 0.72 |
| device + light floc coincidence | L 0.95 | L 0.98 |

Both themes span near-black to near-white; only bias and contrast move. Light
theme is checked first and its failure mode is specific: the **nominal sheet**
drifting up until the device stops standing out. Guard is a hard **0.24 L** floor
between "nominal sheet" and "watermark device", enforced by scaling `K`, not by
deepening the imprint (deepening the imprint past 0.35 caliper makes it read as a
die-cut hole, which is a different and wrong material).

`--border` is used only for the badge's 1 px outer ring. It is a ~1.1:1 separator
token in light theme and must never be used as a fill or as the device colour.

## 7. Text on the surface

Yes — the watermark device usually contains a short wordmark. Legibility is a
clamp, and the measurement is on the worst phase, not the mean:

- Device-to-ground delta floored at **3.5:1** on mean L of the device region vs.
  mean L of a 10 px annulus.
- **Worst frame, named:** when a **light floc passes directly under the device
  edge**. A light floc is itself thin, so it brightens the ground toward the
  device's own stop and locally collapses the delta — this is the only frame that
  can fail, and it is not t=0.
- Fix: clamp `f` to `<= +0.030 caliper` inside a 6 px dilation of the device mask,
  so flocs cannot brighten the immediate surround. Flocs elsewhere are unclamped.
- Badge label text sits outside the canvas as DOM.

## 8. Canvas host

2D canvas, not WebGL, but the host rules bind: `w-full h-full` with a DPR-aware
backing store capped at 2 and verified at dsf 2 (a badge is small enough that an
intrinsic-size fallback is easy to miss); `ResizeObserver` on the host with all
scales re-derived from the new smaller dimension; `IntersectionObserver`
threshold 0 + `visibilitychange` pause; tokens via `getComputedStyle` +
`MutationObserver` on documentElement class, **read before the first paint on
mount, on resize, and on the IntersectionObserver resume path**. Zero colour
literals. The whole field is one 128x128 `ImageData` scaled up with
`imageSmoothingEnabled = true`, which is both correct (paper is soft) and cheap
enough that no adaptive ladder is needed.

## Kill criteria

- If the mark reads as a light-grey printed shape rather than as **thinner
  material against a backlight**, the exponential is wrong or the floc texture is
  too weak. The tell: does the mark get brighter as the surrounding sheet gets
  denser? It must. Otherwise kill.
- If at 48 px the laid/chain lines alias into moire, drop them below 64 px rather
  than shipping a shimmering badge — and if the badge then reads as a plain blob,
  kill.
