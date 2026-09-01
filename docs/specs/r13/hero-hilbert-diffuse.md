# hilbert-diffuse — full-bleed background / hero backdrop

## 1. Surface + real technique

**Surface:** full-bleed section background; works as a hero backdrop with DOM type over it.

**Technique:** **Riemersma dithering** (Thiadmer Riemersma, *Dr. Dobb's*, 1998) — error diffusion
along a **Hilbert space-filling curve** with an exponentially decaying error queue, instead of a
raster scan with a spatial kernel.

## 2. Nearest existing slug + why this is not a restyle

**Nearest: `loader-ascii-diffuse-fill`** (Floyd–Steinberg serpentine error diffusion). Secondary:
`nav-blue-noise-scrim`. **This adjacency is the closest of the ten and must be argued exactly.**

Floyd–Steinberg distributes each cell's quantization error to four *spatial* neighbours
(7/16, 3/16, 5/16, 1/16) in a raster order. Riemersma has **no kernel and no raster**: it walks a
Hilbert curve and carries the error in a **1-D FIFO of the last 16 visited sites**, weighted by an
exponential with ratio `r = 16^(1/15) ≈ 1.2027`. Because a Hilbert curve is spatially local in
*both* axes, the diffusion neighbourhood is isotropic. The visible artifacts are opposites:
`loader-ascii-diffuse-fill`'s own meta names its signature as **"directional, frame-coherent
artifact drift"** and serpentine streaking; Riemersma's defining property is a **streak-free grain
with no preferred direction**, which is why it was published at all.

Two further separations so the two never read as siblings: this component is **not ASCII** — no
glyph grid, no ramp string, ink is **1-bit dots**; and the traversal head is **drawn**, so the
space-filling curve itself is visible as a moving thread, making the technique legible rather than
implied. Against `nav-blue-noise-scrim`: that is a spatial mask reshuffled per frame with no error
term at all and no ordering; here every decision depends on the 16 decisions before it along the
curve.

## 3. Mechanic

**Curve order from the smaller dimension.** `n = clamp(round(log2(min(w,h)/4.0)), 6, 8)`,
side `S = 2^n`. At `min(w,h) = 520` → `n = 7`, `S = 128`, **16,384 cells**, dot pitch **4.06px**.
Non-square containers tile `ceil(w/h)` S x S curves side by side, traversed in boustrophedon
order so the head crosses tile boundaries continuously.

**Source field.** `g(x,y,t) = 0.5 + 0.30*fbm3(x*k, y*k, t*0.055) + 0.18*radialVignette`,
`k = 2.6/min(w,h)`; the fbm advects at **11 px/s**.

**Head.** Walks the curve at **V = 5,200 cells/s** → one 16,384-cell tile per **3.15s**; at 3
tiles the whole frame refreshes every **9.45s**. At 60Hz the head advances **87 cells/frame**.

**Per visited cell i:**
```
e_avg = Σ_{j=0..15} r^(15-j) * e[j]  /  Σ_{j=0..15} r^(15-j)      // r = 1.2027
v     = g(cell) + e_avg * 0.72                                     // 0.72 = Riemersma error scale
out   = v >= 0.5 ? 1 : 0
push(v - out) into the 16-slot FIFO
```
The 0.72 matters: at 1.0 the queue oscillates and produces a checkerboard; at 0.5 the grain goes
mushy. 0.72 is the published working value.

**Ink.** `out = 1` paints a disc of diameter `pitch * D` in `--foreground`; `out = 0` leaves paper.
**No alpha ramp anywhere** — this is 1-bit, which is what makes it a dither component and not a
tone component.

**Visible curve head.** The last **220 cells** of the traversal are drawn as a hairline polyline
at **ladder stop 3** (§6 — light α 0.407, dark α 0.324). This is the identity cue.

**Persistence.** Cells the head has not yet reached this pass keep their previous pass's value, so
the frame is always fully painted and the refresh reads as a **fractal, quadrant-by-quadrant
front**, not a raster wipe. Pre-roll one complete pass at mount before first paint, so t=0 is never
a half-empty frame.

## 4. t=0 / 2.5s / 5s, zero input

- **t=0** — full field of dots from the pre-roll; head 220 cells into tile 1.
- **t=2.5s** — the head has re-decided **13,000 cells (79% of tile 1)**; the boundary between
  old and new decisions is visible as a blocky fractal front, and the fbm has drifted 27px so the
  new decisions differ from the old around the vignette edge.
- **t=5s** — head is 1,616 cells into tile 2; tile 1 is fully refreshed and its low-frequency
  density structure has visibly moved. The three frames differ in dot pattern, front position and
  head-thread shape.

## 5. Reduced-motion freeze frame

`STATIC_TIME = 6.30` — **exactly two complete tile passes**.

A partial re-decision front is the *least* structured thing this component produces: it is a
half-drawn frame with an arbitrary seam. At a completed pass there is no seam at all, and 6.30s is
also where the fbm's slow lobe (0.055 rad/s) and the radial vignette come into phase, giving the
**largest dot-density range across the frame** in the first cycle (target: local density spans
0.14 to 0.86 vs 0.28–0.71 at t=0). That is the frame where the isotropic Riemersma grain is most
obviously not a Bayer tile and not a serpentine streak. The head thread is still drawn (frozen) so
the mechanism is stated. Computed from the constant; byte-stable.

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

**Important scope limit: the ladder does not govern this component's ink.** The image is **1-bit** —
a cell is a full-strength `--foreground` dot or it is paper, and there is no alpha ramp to solve.
A builder should not try to apply ladder stops to the dots. Tone here is carried by **dot density
and dot area**, so this component's light-theme compensation is necessarily **geometric**, and it
stands unchanged:

| element | light | dark | governed by |
|---|---|---|---|
| dot ink | `--foreground` @ 1.0 | `--foreground` @ 1.0 | — (1-bit) |
| disc diameter `D` | **0.74** x pitch (43% area) | **0.88** x pitch (61% area) | coverage, not the ladder |
| head thread | stop 3 → **α 0.407** | stop 3 → **α 0.324** | the ladder |

**Calibration note — this spec was already right, and it is the only one that was.** The head
thread's original values (0.42 light / 0.30 dark) measured **2.69:1 against 2.38:1** — a 1.13x
spread, the tightest in the set, with both themes already landing on stop 3. Moving them to the
solved stop-3 alphas changes light by 3% and dark by 8%, which is below the visible threshold. It
is recorded here so a builder sees the value was checked rather than assumed.

The 0.88 / 0.74 diameter split is **not** superseded: at pitch 4.06px a 0.88-diameter dark disc on
a bright sheet gives 61% area coverage and crushes the midtones to solid ink, while 0.74 puts the
apparent midtone near 50% in both themes. That is a coverage problem the ladder does not model,
and the two compensations are independent.

`--border` unused. `--ns-accent` unused — including on the head thread, which is the component's
most eye-catching element and therefore exactly where accent must not go.

## 7. Interaction

**Pointer opens a local density bias on `g`:** `g += 0.26 * exp(-d²/(2σ²))`, `σ = 0.16*min(w,h)`.
The dots visibly thicken under the cursor — but **only as the head sweeps back through**, which is
what makes the traversal order legible: you can watch the change fill in along the Hilbert curve
rather than in a circle. Density only; no brightness lift, no halo, no accent.

Lead-compensated follower, advanced in the rAF loop:

```
velX = velX + (rawVelX - velX) * (1 - exp(-dt/VEL_TAU));   // VEL_TAU = 0.06
leadX = clamp(velX * POINTER_TAU, -LEAD_MAX, LEAD_MAX);    // POINTER_TAU = 0.012, LEAD_MAX = 24
ptrX += (tgtX + leadX - ptrX) * (1 - exp(-dt / POINTER_TAU));
```

## Host checklist
DPR cap 1.5 (full-bleed). `ResizeObserver` on the host re-derives `n`, `S` and the tile count and
re-pre-rolls. Pause on `IntersectionObserver` threshold 0 and `visibilitychange`. Tokens via
`useLayoutEffect` + `MutationObserver` on `documentElement` class; rAF start, resize callback and
IO resume all early-return before the first token read — **the pre-roll is an early-paint path and
is the specific place this bug will appear**. Canvas `w-full h-full`. Adaptive: lower `n` by 1
only after frame-time EMA > 15.5ms sustained 900ms; restore after 3.6s clean; double the wait on
each failure. Verified at dsf 1 and 2, both themes.
