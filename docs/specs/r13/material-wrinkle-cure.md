# wrinkle-cure

- **slug:** wrinkle-cure
- **tier:** loud (WebGL, card-to-section scale)
- **surface:** feature card (GAP-MAP gap #5 bucket, count 6 and only 2 real) — the "made of something" backing for a heading + body
- **family:** coating

## 1. Surface replaced + the real material process

Replaces the **feature card** backing.

Real process: **wrinkle-finish coating** (the hammertone/crinkle enamel used on
instrument cases and optical tooling). It is not a defect being simulated — it is
a finish sold *for* the wrinkle. Mechanism: a thin skin at the film's free
surface cures and stiffens far faster than the bulk beneath it, so a stiff film
ends up bonded to a compliant substrate under compression, and it buckles. The
governing parameter is the **skin-on-substrate buckling wavelength**:

    lambda = 2 * pi * h_f * (E_f_bar / (3 * E_s_bar))^(1/3)

With a skin `h_f = 5 um` and a modulus ratio `E_f/E_s ~ 1000`, that gives
`lambda ~ 218 um`. The critical strain is
`eps_c = 0.25 * (3 E_s_bar / E_f_bar)^(2/3) = 0.0052` — **0.52% compressive
strain** and the surface goes from flat to patterned. Both numbers are set by the
skin thickness and the modulus ratio, nothing else, which is why a wrinkle finish
has a characteristic scale you can recognise across manufacturers.

Cure: IR bar, skin gels in **20-40 s**, bulk in **8-12 min**, so the skin/bulk
modulus ratio sweeps through the whole useful range during the pass.

## 2. Nearest existing slug + why this is not a restyle

Nearest: **`grazing-light`** (blind-embossed relief on a feature-grid card,
revealed by a raking light). Also `crease-fall` (paper concertina, discrete folds,
gravity-released) and `crack-polygon-order` (drying-mud fracture generations).

Against `grazing-light`: that component's relief is **fixed** and its light
**moves**. Here the light rig is fixed and the relief is generated live by a
buckling instability with a physically-set wavelength — the pattern at t=0 and
t=5s is a different pattern, not the same pattern differently lit. Against
`crack-polygon-order`: buckling is not fracture. Nothing separates, nothing
nucleates a crack tip, and the result is a smooth continuous height field with a
single dominant spatial frequency, where mud-crack is a piecewise-flat cell
tessellation with discontinuities. If the build starts producing polygonal cells
with hard edges, it has drifted into `crack-polygon-order` and should be killed.

## 3. Mechanic

Two coupled fields on a **160 x 160** grid (square; sample it into the card's
aspect from the **smaller** dimension so the wrinkle scale is constant at card
scale and at section scale):

- `c(x,y)` cure state, 0 = wet, 1 = fully cured bulk.
- `w(x,y)` out-of-plane displacement (the wrinkle height field).

**The process zone traverses.** An IR cure bar sweeps left-to-right across the
card at `BAR_SPEED = 0.19 * min(w,h) px/s`, and **wraps** — when it exits the
right edge it re-enters at the left over fresh, re-wetted film. The re-wet is not
a reset flash: a `RE_WET` band trails 0.14 of the width behind the bar's wrap
point, relaxing `c` toward 0 with `tau = 1.1 s` and decaying `w` amplitude at
`0.55 /s`. So at every instant the card carries wet film, a nucleating front, and
locked wrinkles simultaneously, and the pattern never repeats because the noise
seed advances with the wrap count.

Per frame, in the bar's influence zone (Gaussian, `sigma = 0.11 * min(w,h)`):

1. `c += CURE_RATE * dt`, `CURE_RATE = 0.85 /s` at the bar's centre.
2. Modulus ratio `R(c) = 1 + 1400 * smoothstep(0.05, 0.55, c) * (1 - 0.7 * c)` —
   rises as the skin gels, falls again as the bulk catches up. Wavelength in
   pixels: `lambda_px = LAMBDA_REF * (R/1000)^(1/3)`, with `LAMBDA_REF = 0.052 *
   min(w,h)` px (so ~11 px on a 220 px card, ~34 px on a 650 px section).
3. Compressive strain `eps(c) = 0.011 * smoothstep(0.1, 0.6, c)`. Where
   `eps > eps_c = 0.0052`, drive `w` with a **Swift-Hohenberg** step, which is the
   correct amplitude equation for this instability and gives one dominant
   wavelength rather than broadband noise:

       dw/dt = [ r - (lap + k0^2)^2 ] w - w^3,   k0 = 2*pi / lambda_px

   with `r = (eps - eps_c) * 260`, explicit Euler, `dt_sub = 0.16` in the field's
   own time units, 2 substeps/frame. Seed with `sigma = 0.004` noise only in the
   bar's leading 6 px so wrinkles genuinely **nucleate at the front** and are
   advected nowhere — they lock in place behind it.
4. Outside the bar, `r` falls below 0 and the `w^3` term holds the amplitude:
   cured wrinkles are frozen, not decaying.

Shading: central-difference normal from `w`, **fixed** two-strip-light rig
(elevation 24 and 58 degrees, azimuth 210 and 40 degrees) plus a broad sky term.
Gloss is a fixed narrow lobe (`rough = 0.11`) — a wrinkle finish is semi-gloss and
its read comes from the relief, not from a roughness field.

**No `--ns-accent` on the specular ridge line.** The bar's own glow is a luminance
lift added to L before the ramp, never a hue mix.

## 4. Resting loop with no input

- **t=0s:** bar at ~0.30 width. Left 30% carries locked wrinkles at full
  amplitude; a bright nucleation line sits at the bar; right 70% is flat
  wet film with only the sky reflection on it.
- **t=2.5s:** bar at ~0.78 width. The wrinkle field has grown across half the
  card; wrinkles that were 2.5 s old at t=0 have coarsened visibly (the `w^3`
  saturation merges adjacent ridges into longer, more connected labyrinths — a
  real and visible late-stage behaviour of this instability).
- **t=5s:** bar has wrapped. A re-wet band is visibly erasing the oldest
  wrinkles at the left while a **new** nucleation line runs at ~0.25 width, and
  the new pattern is demonstrably not the old one (different seed).

**Named resting loop:** the bar sweep is unbounded (wraps forever), the re-wet
band destroys locked wrinkles at exactly the rate the front creates them, and the
Swift-Hohenberg field is stochastically re-seeded every wrap so it is not a
looping animation. Nothing settles.

## 5. Reduced-motion freeze frame

`STATIC_TIME = 4.15 s`, seed fixed. At 4.15 s the bar sits at ~0.86 width: the
card shows the **complete story in one frame** — mature coarsened wrinkles on the
left, mid-growth wrinkles in the middle third, the bright nucleation line, and a
sliver of flat wet film at the right edge. `t=0` shows 70% flat card, which is the
static-grey-card automatic reject. Byte stability: all noise from a hash of
`(cellIndex, wrapCount)`, no clock.

## 6. Luminance in both themes

| stop | light | dark |
|---|---|---|
| ridge shadow (contact occlusion) | L 0.09 | L 0.05 |
| wet flat film | L 0.46 | L 0.26 |
| wrinkle flank mid-tone | L 0.62 | L 0.48 |
| sky on ridge crest | L 0.83 | L 0.74 |
| strip specular on crest | L 0.96 | L 0.99 |

Same direction in both themes (shadow darkest, crest specular brightest); bias
and contrast differ. The light-theme trap here is the **wet flat film** and the
**wrinkle flank** collapsing, which would make the card read as flat everywhere.
Hard floor 0.14 L between those two; if the tokens do not give it, deepen the
floor term of the environment.

## 7. Text on the surface

Yes, and this is the acute case for this component: the heading is **embossed
into the same `w` field** (a rasterised glyph bevel summed in before shading), so
the type is genuinely part of the finish. Legibility is a clamp:

- Glyph interiors get `r` suppressed by 0.75, so wrinkles inside counters stay
  low-amplitude. Wrinkles run **up to** the glyph and stop.
- Glyph-to-ground luminance delta floored at **4.5:1** measured on the mean L of
  the glyph body versus the mean L of a 16 px annulus around it, recomputed per
  frame; if the frame's measured delta falls under the floor, the glyph's own
  ambient term is biased until it clears.
- **Worst frame, named:** the moment the **nucleation line crosses the heading**.
  That is the frame with the brightest local specular and the highest local
  gradient variance, and it is the one to check — not t=0, where the type sits on
  flat film and trivially passes. Body copy is ordinary DOM on a scrim.

## 8. WebGL canvas host checklist

- DPR cap **2.0** (card-scale area, cheaper than peel-flow's banner).
- `w-full h-full` on the canvas; check at dsf 2.
- `ResizeObserver` on the host; re-derive `LAMBDA_REF` from the new smaller
  dimension on resize so the wrinkle scale is size-invariant.
- `IntersectionObserver` (threshold 0) + `visibilitychange` pause; token re-read
  before the first draw on every resume path.
- Tokens by `getComputedStyle` + `MutationObserver` on documentElement class.
  Zero literals in GLSL.
- Adaptive scale only after sustained measured slowness (~900 ms EMA over
  budget), never on frame count or device heuristics.
- Swift-Hohenberg needs float ping-pong textures; feature-detect and fall back to
  a half-resolution `RGBA8` packing rather than to a different mechanic.

## Kill criteria

- If the wrinkle field reads as broadband noise instead of one dominant
  wavelength, `k0` is not doing its job — kill, because the wavelength law is the
  entire justification.
- If the pattern becomes polygonal cells with hard edges, it has become
  `crack-polygon-order`. Kill.
