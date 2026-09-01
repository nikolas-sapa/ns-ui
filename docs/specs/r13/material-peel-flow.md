# peel-flow

- **slug:** peel-flow
- **tier:** loud (full-bleed / section-scale WebGL)
- **surface:** CTA closing band (GAP-MAP gap #2, bucket count **0**) with a hover/reveal state
- **family:** coating

## 1. Surface replaced + the real material process

Replaces the **closing CTA band** — the full-width final section carrying one
headline and one button. GAP-MAP ranks this gap #2 and counts it at **zero**: the
17 slugs in the CTA bucket are 13 destructive confirms and success payoffs plus
four pieces of button chrome, and none of them is a section. This spec is a
section that is made of something, with the button as real chrome on top of it.

Real process: **powder-coat orange peel** — the residual waviness left in a
thermoset powder film after melt levelling. The driving physical parameter is
**Orchard's levelling equation**:

    da/dt = -(16 pi^4 / 3) * (gamma * h^3 / (eta * lambda^4)) * a

so the levelling time constant is `tau = 3 * eta * lambda^4 / (16 pi^4 * gamma * h^3)`.
With a realistic polyester powder at cure — surface tension `gamma = 0.030 N/m`,
minimum melt viscosity `eta = 100 Pa.s`, film build `h = 70 um` — that gives:

| waviness lambda | tau |
|---|---|
| 0.2 mm | ~1.0 s |
| 0.5 mm | ~39 s |
| 1.0 mm | ~10 min |
| 2.0 mm | ~2.8 h |

The **lambda^4 term is the whole component**. Short-wavelength texture from the
atomised droplets disappears almost immediately; long-wavelength texture is
frozen in when the film gels. Orange peel is not "bumpy paint", it is a
wavelength-selective low-pass filter you can watch running.

Deposition side: electrostatic spray at **60-90 kV**, transfer efficiency
**60-95%**, droplet/agglomerate size **25-45 um**, with genuine **Faraday-cage
starvation** in recesses (field lines terminate on the raised edges, so
recessed regions receive measurably less powder).

## 2. Nearest existing slug + why this is not a restyle

Nearest: **`grazing-light`** (feature-grid card, blind-embossed icon/heading,
revealed by a low-angle light raking across at idle). Second nearest:
`edge-burnish-glaze` (a gloss field saturating under a sweeping contact zone).

`grazing-light` holds *static relief revealed by a moving light source*. peel-flow
inverts both halves: the light rig is **fixed**, and the relief itself is
changing every frame under a levelling PDE. And the type is not relief at all —
the headline is a **knockout mask in the deposit**, read as a **gloss/matte
contrast** (a wide diffuse specular lobe over bare substrate versus the tight
lobe of the levelled film), not as a bevel shadow. Two panels with identical
height fields would still read differently here, which is the test `grazing-light`
cannot pass. Against `edge-burnish-glaze`: that is a scalar gloss field with a
saturate/decay pair; this is a wavelength-selective spatial filter, and its whole
identity is that different spatial frequencies decay at different rates in the
same patch.

## 3. Mechanic

Field: film thickness `h(x,y)` on a **192 x 108 float texture** (derive the long
axis from the host's larger dimension, but scale the physical `mm/px` mapping from
the host's **smaller** dimension so texture size is constant at card scale).

The banner is a **moving strip**: the coated band scrolls right-to-left at
`BAND_SPEED = 0.055 * min(w,h) px/s`, so the process is a **spatial zone, not a
temporal one** and it never completes.

Three zones across the band, expressed as fractions of width:

- `0.00 - 0.22` **deposition zone.** An electrostatic bell reciprocates
  vertically on a 3.1 s triangle wave. Powder lands as a Gaussian fan,
  `sigma = 0.09 * min(w,h)`, depositing `18 um/s` mean. Deposit is multiplied by a
  local Faraday factor `1 / (1 + 2.4 * |grad h|_norm)` so raised areas starve their
  own recesses. Per-frame the deposit carries white noise at `sigma_h = 4.5 um` —
  this is the source of all short-wavelength texture.
- `0.22 - 0.78` **melt/levelling zone.** Viscosity ramps `eta: 3000 -> 100 -> 3000
  Pa.s` across the zone (cold in, melt, gel out) on a smooth cubic. Each frame,
  apply Orchard levelling in the spatial domain as a **variable-strength
  biharmonic diffusion**: `h -= k(x) * dt * lap(lap(h))`, with
  `k(x) = (16 pi^4 / 3) * gamma * h_mean^3 / eta(x)` mapped into px units. A
  biharmonic operator is exactly the `lambda^4` selectivity — no FFT needed, and it
  reproduces the table above to within a few percent. Substep the laplacian pair
  twice per frame for stability (`CFL`: `k * dt / dx^4 <= 0.06`).
- `0.78 - 1.00` **frozen zone.** `k = 0`. Whatever waviness survived is now
  permanent and scrolls out of frame.

Because the band scrolls, **every column is at a different stage of the same
process at every instant**, and fresh powder keeps entering at the left. Nothing
ever settles.

Shading: one height field -> central-difference normal (`eps = 1 px`) -> a fixed
analytic achromatic environment (broad sky, dark floor, **three** strip lights at
elevations 62/34/11 degrees, azimuths 20/155/265 degrees). Gloss is a
Beckmann/GGX lobe whose roughness comes from the *residual* short-wavelength
energy: `rough = 0.06 + 0.5 * clamp(|lap(h)| * 40, 0, 1)`. That is what makes the
deposition zone read matte and the levelled zone read glossy without touching
hue.

**Pointer (optional):** moves the bell's vertical centre, which changes the
deposition profile. Luminance only. **No `--ns-accent` anywhere on the specular
peak** — the hottest pixels are pure `--foreground`-derived value. This is the
project's most repeated defect and this component's brightest moment is exactly
where it happens.

Hover/reveal state at section scale: on hover of the band, `h_target` for the
headline knockout region is raised `12 um` and gel viscosity drops 30% locally, so
the headline's surround levels *smoother* than the field around it and lifts out
of the texture over ~900 ms. Nothing translates; the reveal is a gloss change.

**The CTA button.** The band's single button is ordinary DOM chrome sitting above
the canvas on an opaque surface — **this is the one place `--ns-accent` is
legitimate in this component** (button fill and focus ring), and it is legitimate
precisely because it is interaction chrome and not part of the material. The
material must never borrow it back: no accent in the specular, no accent bloom
around the button, no accent in the hover reveal.

## 4. Resting loop with no input

- **t=0s:** band mid-scroll. Left third coarse and matte with the bell fan
  visible as a soft vertical column. Mid band shows medium-lambda waviness
  actively smoothing. Right third glossy with only 1-2 mm peel.
- **t=2.5s:** the bell has traversed ~0.8 of its stroke and reversed once; the
  deposition column sits at a visibly different height. Material that was mid
  band at t=0 has scrolled ~0.14 of the width and lost its 0.2-0.5 mm texture
  entirely — that patch is measurably glossier than it was.
- **t=5s:** the bell has completed a full 3.1 s cycle plus, so the deposit
  column is back near its t=0 height but the *film* under it is different
  material; the patch that was in deposition at t=0 is now in the frozen zone
  carrying only its surviving long-lambda peel.

**The resting loop, named:** the band scroll (unbounded translation) x the bell
reciprocation (3.1 s, incommensurate with the scroll period) x per-frame deposit
noise. No steady state exists because material is continuously created at the
left boundary and destroyed at the right. This is the auger-flighting-spoil
pattern: retire at the rate you add.

## 5. Reduced-motion freeze frame

`STATIC_TIME = 7.4 s` from a fixed seed. Chosen because at 7.4 s the bell sits at
`0.30` of its stroke (off both ends, so the fan is a legible ellipse rather than a
clipped edge) and the band has scrolled far enough that all three zones are
populated with the same seeded material — the frozen right third shows the full
survived-peel texture, which is the component's thesis. `t=0` shows an empty
right third and would be a lie about what the component does. Frames must be
byte-stable: seed the deposit noise from `(cellIndex, floor(scrollDistance))`,
never `Math.random()` or `performance.now()`.

## 6. Luminance in both themes

Five stops from `--background`, `--foreground`, `--ns-muted`, plus `--border` used
only for the 1px band edge rule. In **both** themes the stops span near-black to
near-white; what changes is bias and contrast, per weld-pool's rule:

| stop | light theme | dark theme |
|---|---|---|
| deepest shadow / floor | L 0.06 | L 0.03 |
| matte deposit body | L 0.34 | L 0.22 |
| levelled film body | L 0.58 | L 0.44 |
| broad sky reflection | L 0.80 | L 0.72 |
| strip-light specular | L 0.97 | L 0.99 |

Direction is identical in both themes (matte darker than levelled, specular
brightest). Light theme is the harder case and gets checked first: the risk is
the levelled body and the sky reflection collapsing together. Guard is a hard
floor of **0.18 L separation** between adjacent stops; if the token set gives
less, widen the environment's floor/sky split, do not add hue.

## 7. Text on the surface

Yes — the headline is a knockout in the film. Legibility is guaranteed by
**contrast clamp, not by hope**: the knockout region's shading is forced through
a separate ramp whose mean L is held at least **0.42 L** from the local mean L of
the surrounding 24 px annulus, recomputed per frame. Worst frame of the loop is
when a **strip-light specular band crosses the knockout boundary** — the film
outside momentarily hits L 0.97 while the matte knockout sits at L 0.34, which is
fine, but the inverse case (specular *inside* a wide counter) is the one that
bites. Fix in the shader: suppress the specular lobe inside the knockout mask by
0.7 so the knockout is always the flatter, lower-variance region. Subhead, CTA
and eyebrow are ordinary DOM over an opaque scrim, not shaded.

## 8. WebGL canvas host checklist

- DPR-aware backing store, **capped at 1.5** (banner area cost dominates, same
  reason weld-pool caps there).
- Canvas gets `w-full h-full`; verify at `deviceScaleFactor` 2, not just 1.
- `ResizeObserver` **on the host element**, not `window.resize`.
- `IntersectionObserver` threshold 0 pauses the rAF loop offscreen;
  `visibilitychange` pauses on hidden tab. On both resume paths, **re-read tokens
  before the first draw** — no paint before the first token read.
- Tokens via `getComputedStyle(document.documentElement)` at mount +
  `MutationObserver` on `documentElement`'s class attribute. Zero colour
  literals, including inside GLSL — every colour is a uniform.
- Adaptive render scale steps down only after a **sustained ~900 ms** stretch of
  EMA frame time over budget, steps back up after a much longer clean stretch,
  doubling the wait after each failure. Never gate on frame count, never on
  device heuristics.
- Two float textures ping-ponged for `h`; `OES_texture_float_linear` /
  `EXT_color_buffer_float` feature-detected with a `RGBA8`-packed fallback at
  reduced precision (peel amplitude quantises but the mechanic survives).

## Kill criteria

- If the levelled zone and the deposition zone are not obviously different
  materials in a light-theme screenshot at dsf 2, kill it.
- If the biharmonic step reads as a plain blur rather than as *short texture
  vanishing while long texture survives*, the lambda^4 selectivity failed and the
  component is a restyle of any gloss-field card. Kill.
