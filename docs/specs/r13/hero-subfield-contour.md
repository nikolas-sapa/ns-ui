# subfield-contour — section-scale background / hero backdrop

## 1. Surface + real technique

**Surface:** full-bleed section background; also works as a hero backdrop with DOM type over it.

**Technique:** **plasma display panel (PDP) subfield drive** and its signature defect,
**dynamic false contour (DFC)**. A plasma cell has no analog brightness — it is on or off. A
frame is split into 8 weighted sustain subfields (the conventional binary set: 1, 2, 4, 8, 16,
32, 64, 128 sustain pulses, summing to 255) and a grey level is whichever subset of subfields
is lit. When the eye *tracks* a moving edge it integrates across cells that lit different
subfield subsets, and the integrated luminance departs from both neighbouring levels. The
result is dark and bright bands that exist in **no frame of the source image** — pure artifact
of the drive scheme meeting eye motion.

## 2. Nearest existing slug + why this is not a restyle

**Nearest: `bitplane-cascade`.** Secondary: `meter-matrix-scan`.

`bitplane-cascade` composites binary-weighted planes **spatially, over seconds**, and the planes
*are* the content — the viewer watches a 16-level image assemble from a 2-tone silhouette. Here
all 8 subfields fire inside a single 16.67ms frame and are **never individually visible**; what
is visible is an artifact that lives only in the temporal integral, and only where the image
*moves*. A static region of this component shows zero banding — which is the exact inverse of
`bitplane-cascade`, where a static region is precisely where the planes are legible.

`meter-matrix-scan` is 8-step PWM duty quantization on a row-multiplexed LED panel: a static
brightness quantization with a row-address gradient. It has no eye-tracking model, no
motion-dependent term, and its artifact is a slow drifting row band, not a contour locked to a
level boundary in the image.

## 3. Mechanic

**Panel grid.** `cell = clamp(round(min(w,h)/78), 4, 9)` px. At 900x520 → cell 7px → **129 x 74
cells**.

**Source image.** `L(x,y,t) ∈ [0,255]`, quantized to 8 bits:
`L = mean*255 + amp*255 * fbm2(x*k, y*k + t*0.10, t*0.04)`, `k = 3.1/min(w,h)`.
Drift is required for the artifact to exist at all: the field translates at **(17, 204) px/s**
— 3.4 px/frame vertically at 60Hz, squarely inside the 2–8 px/frame band where real DFC is
worst.

**Subfield timing.** Weights `W = [1,2,4,8,16,32,64,128]`. Subfield *j* occupies
`t_j = 16.67 * Σ(W[0..j-1]) / 255` ms into the frame and lasts `16.67 * W[j] / 255` ms. So the
128-weight subfield alone owns the last 8.4ms of every frame — which is why bit 7 dominates the
artifact.

**Eye-tracking integral (this is the whole component).** For each panel cell, with tracking
velocity `v` px/frame:

```
perceived = 0
for j in 0..7:
    src = level( cellPos + v * (t_j / 16.67) )     // where the eye is looking during subfield j
    if (src >> j) & 1: perceived += W[j]
perceived /= 255
```

**The artifact this produces.** Across the `127 → 128` contour, bit 7 flips on while bits 0–6 all
flip off. A tracking eye lands on the "128" cell during the long bit-7 window and on the "127"
cell during the short low-bit windows (or vice versa), so `perceived` collapses toward **0.25**
or spikes toward **0.75** in a band roughly `|v| * frames / cell = 3–4 cells wide` that rides
the 127/128 iso-line of the drifting field. Weaker secondary bands appear at 63/64, 31/32 and
15/16 at 1/2, 1/4 and 1/8 the amplitude — the classic DFC ladder.

**Draw.** Each cell is a filled square of side `cell`, luminance `perceived` mapped through the
token ramp. Nothing is overlaid; the artifact *is* the image.

**Cost.** 8 samples x 9,546 cells = 76k samples/frame. The level field is evaluated on a
`(cols + ceil(|vx|*8)) x (rows + ceil(|vy|*8))` scratch buffer once per frame and indexed, so
fbm is evaluated ~11k times, not 76k.

**Aliveness.** Unbounded: the field drifts forever, so the 127/128 contour is a closed curve
wandering the frame at ~204 px/s dragging its band with it, and the contour's *topology* changes
(pinching into loops, merging) as the fbm evolves at 0.04 rad/s.

## 4. t=0 / 2.5s / 5s, zero input

- **t=0** — one 127/128 contour crossing the upper third; a hard ~3-cell dark band along it.
- **t=2.5s** — 510px of vertical drift. Typically 2 contours: one leaving the bottom, one
  entering the top; the 63/64 secondary band is visible in the lower left at half amplitude.
- **t=5s** — 1020px of drift and the fbm has evolved 0.20 rad; a contour has pinched off into a
  closed loop, so the band is now a **ring** rather than a stripe. Topologically different, not
  just translated.

## 5. Reduced-motion freeze frame

`STATIC_TIME = 4.15`.

**Critical rule for the builder: reduced motion freezes the clock, not the model.** Setting `v = 0`
would remove the eye-tracking term and therefore the entire artifact, leaving a smooth grey
gradient — a dead frame that shows nothing the component is about. The freeze holds the field at
`t = 4.15s` *and* keeps `v` at its t=4.15 value, so all DFC bands are fully present and static.

4.15s is chosen because at that time the 127/128 contour reaches its **longest in-frame arc
length of the first cycle** (target ≥ 2.3x the frame diagonal, vs ~0.9x at t=0), so the maximum
possible amount of banding is on screen, and both the primary 127/128 band and two secondary
bands are simultaneously visible.

## 6. Hue → luminance, both themes

Weights are **not derived here.** They are taken from the six-stop ladder in
`INDEX-ascii.md` §4, which solves canvas alpha for target contrast ratios
`C = [1.35, 1.80, 2.60, 4.00, 7.00, 16.0]` in **encoded sRGB**, because `ctx.globalAlpha`
composites in the encoded space rather than in linear light.

| stop | 1 | 2 | 3 | 4 | 5 | 6 |
|---|---:|---:|---:|---:|---:|---:|
| target C | 1.35 | 1.80 | 2.60 | 4.00 | 7.00 | 16.0 |
| light α | 0.144 | 0.267 | 0.407 | 0.552 | 0.716 | 0.929 |
| dark α | 0.134 | 0.221 | 0.324 | 0.449 | 0.633 | 0.974 |

All washes below are `--foreground` over `--background` at a ladder alpha. **`--ns-muted` is not
used as a wash anywhere in this spec any more:** it is a different token with its own luminance
(measured 8.45:1 in light, 6.12:1 in dark at full strength), so `--ns-muted` at an alpha lands on
an uncontrolled ratio that differs between themes. Where the intent is "a lighter version of the
ink", the correct expression is `--foreground` at a stop.

**`perceived` maps to a ladder position, not to a token lerp.** Ladder index `= perceived * 5`,
alpha linearly interpolated between the two bracketing stops. The previous three-stop lerp
(`--background` → `--ns-muted` → `--foreground`) is **withdrawn**: interpolating between three
tokens in encoded space gives a curve nobody solved, and it was the source of the theme
asymmetry below.

**Field pedestal and amplitude are unchanged** (dark mean 0.52 / amplitude 0.30; light mean 0.44 /
amplitude 0.36 — these are mechanic, not weight). What changes is what they render as:

| | ladder idx | light α | light C | dark α | dark C |
|---|---:|---:|---:|---:|---:|
| field mean | 2.20 light / 2.60 dark | 0.436 | **2.82:1** | 0.399 | **3.37:1** |
| DFC dark band, `perceived` 0.25 | 1.25 | 0.302 | **1.96:1** | 0.247 | **1.97:1** |
| DFC bright spike, `perceived` 0.75 | 3.75 | 0.675 | **6.06:1** | 0.587 | **6.14:1** |

**Calibration note — this is the clearest single result of the pass.** The old §6 asserted a
theme-asymmetric requirement ("≥ 0.18 luminance distance in light theme") because the raw-luminance
ramp genuinely did read differently in the two themes. Interpolating on the ladder instead removes
the asymmetry outright: the dark band lands at **1.96:1 light vs 1.97:1 dark** and the bright spike
at **6.06:1 vs 6.14:1** — within 1.5% of each other. The theme-specific rule was compensating for
the ramp, not for the artifact.

**Replacement acceptance test, and it is now theme-independent:** the DFC band must sit at least
**0.9 ladder stops** from the local field. Measured worst case across both themes at the specified
pedestal and amplitude: **0.95 stops** (light, field idx 2.20 against band idx 1.25). The old
"≥ 0.18 luminance distance" figure is superseded.

`--border` unused. `--ns-accent` unused — including on the bands, which are the component's
climactic moment and therefore exactly where accent must not appear.

## 7. Interaction

**The pointer velocity is the eye velocity.** That is the honest interaction, and it reproduces
the real reason DFC is worse on fast pans: `v = clamp(pointerVel_pxPerFrame, -6.5, 6.5)` blended
65% into the base drift. Moving the cursor fast **widens the bands and jumps them**; holding
still narrows them toward the base 3.4 px/frame. Luminance-only by construction — the pointer
never adds light, it changes the integration path.

Velocity is a first-class quantity here, so the follower must be lead-compensated and the
velocity estimate must outlive a frame with no pointer event:

```
velX = velX + (rawVelX - velX) * (1 - exp(-dt/VEL_TAU));   // VEL_TAU = 0.06
leadX = clamp(velX * POINTER_TAU, -LEAD_MAX, LEAD_MAX);    // POINTER_TAU = 0.012, LEAD_MAX = 24
ptrX += (tgtX + leadX - ptrX) * (1 - exp(-dt / POINTER_TAU));
```

A plain exponential follower would put a `v*tau` steady-state error into the *velocity* term as
well as the position, i.e. the bands would lag the cursor by more than the cursor itself lags.

## Host checklist
DPR cap 1.5 (full-bleed area cost dominates). `ResizeObserver` on the host. Pause on
`IntersectionObserver` threshold 0 and `visibilitychange`. Tokens read in `useLayoutEffect` +
`MutationObserver` on `documentElement` class; rAF start, resize callback and IO resume path all
early-return until the first token read lands. Canvas `w-full h-full`. Adaptive cell size only
after frame-time EMA > 15.5ms sustained 900ms. Verified at dsf 1 and 2, both themes.
