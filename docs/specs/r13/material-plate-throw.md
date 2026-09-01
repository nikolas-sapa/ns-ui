# plate-throw

- **slug:** plate-throw
- **tier:** core (2D canvas, image-frame scale)
- **surface:** image frame / matte for a screenshot or product shot — furniture for the feature/gallery blocks, not a standalone texture
- **family:** metal

## 1. Surface replaced + the real material process

Replaces the **image frame / matte** — the mount that normally ships as a 1 px
`--border` rule and a drop shadow.

Real process: **electroplating, and specifically the primary current
distribution** that decides where metal actually lands. Deposit thickness follows
**Faraday's law**, `d(thickness)/dt = M*i / (n*F*rho)`. For nickel at
`i = 3 A/dm2` (0.03 A/cm2), `M = 58.7 g/mol`, `n = 2`, `F = 96485 C/mol`,
`rho = 8.9 g/cm3`:

    (58.7 * 0.03) / (2 * 96485 * 8.9) = 1.03e-6 cm/s = 0.62 um/min

But `i` is not uniform. Current density concentrates at **edges and corners**,
typically **2-5x the mean**, because that is where the field converges — so a
plated frame grows a thick bead on its edges and stays thin in its middle. This is
**dog-boning**, and it is why a frame is the correct surface for this process
rather than a badge: the geometry the physics singles out *is* the frame.

The counter-measure is **pulse-reverse (PR) plating**: forward pulses deposit,
short reverse pulses dissolve, and because dissolution is also proportional to
local current density it strips **preferentially from the high points**. Real
duty: forward **10-100 ms** at nominal, reverse **0.5-5 ms** at **2-4x** the
forward amplitude. Throwing power is quantified by the **Wagner number**
`Wa = kappa * (d(eta)/di) / L` — low Wa means the deposit follows the field and
dog-bones, high Wa means it throws into recesses.

Two more real phenomena carried by the component: **hydrogen gas pitting** (H2
bubbles nucleate on the cathode, cling, mask the surface, and detach — leaving a
pit the deposit later heals over) and **rack reciprocation** (2-6 strokes/min,
25-50 mm stroke, used to break the diffusion layer; where agitation is poor the
deposit goes **burnt/dull**, where it is good the deposit goes **bright**).

## 2. Nearest existing slug + why this is not a restyle

Nearest: **`image-crop-mat`** (four mat boards sliding over a photo to define a
crop), **`braze-capillary-fill`** (molten filler drawn along a joint gap by
capillary action), **`border-chrome-ring`**, **`grazing-light`**.

`image-crop-mat` is a **crop tool**: rigid boards, input-driven, no material. This
frame is not adjustable and has no boards; it is a deposit whose thickness profile
is decided by a field solution.

`braze-capillary-fill` is a **1D front** advancing along a gap under capillary
pressure, with a leading edge and a solidified track behind it. Plating has no
front — the whole cathode plates **simultaneously at different rates**, and the
component's entire content is that rate *field*. Nothing propagates.

Against `grazing-light`: no raking light and no relief-reveal. The deposit is lit
by a fixed rig, and the readable cues are **thickness** (edge bead width) and
**brightness/burn** (a bright-vs-dull surface state driven by the local diffusion
layer). A burnt patch and a bright patch have identical geometry.

## 3. Mechanic

The frame is a rectangular annulus, thickness `FW = 0.085 * min(w,h)` px, wrapping
the image aperture. All geometry from the **smaller** dimension.

Two fields on a **1D-parameterised band** (the annulus unrolled) x **12 texels
across the band width** — cheap, and correct, because the interesting variation is
across the band, not along it. Resolution: 480 texels along the perimeter.

**Current density field `i(s,u)`** (`s` = along perimeter, `u` = across band,
0 = outer edge, 1 = inner/aperture edge):

    i = i_mean * ( 1 + EDGE_GAIN * (exp(-u/L_e) + exp(-(1-u)/L_e)) ) * A(s,t)

with `EDGE_GAIN = 2.2` and `L_e = 0.13` (so both edges run ~3.2x the mid-band
value at the outer texel — inside the real 2-5x band), and corners get an extra
`x1.4` because two edges converge. `A(s,t)` is the **agitation factor** from rack
reciprocation.

**Rack reciprocation.** The frame reciprocates vertically, **4 strokes/min**
(period **15.0 s**), amplitude `0.06 * min(w,h)` px. `A(s,t)` = 0.72 + 0.28 x the
normalised local flow speed, which peaks mid-stroke and vanishes at each reversal.
Where `A` is low the diffusion layer thickens and the deposit goes **burnt** —
rendered as a **matte, high-frequency dithered** surface rather than a darker one,
so the cue is texture, not brightness alone.

**Thickness `T(s,u)`, in dynamic equilibrium.** PR cycle at screen time
**forward 1.40 s / reverse 0.35 s** (the 10:1-ish real duty, slowed to be legible):

- Forward: `T += k_f * i * dt`.
- Reverse: `T -= k_r * i * (T / T_mean)^1.6 * dt`, with `k_r` set so the mean is
  net-positive but the **high points lose more than they gain**.

Because the reverse term is superlinear in local thickness, `T` does **not** run
away and does **not** settle: it reaches a **dynamic equilibrium that visibly
pulses on the 1.75 s PR cycle**, the edge bead fattening through each forward
phase and being wiped back through each reverse. This is the resting loop, and it
is a property of the real process rather than a decorative oscillation.

**Hydrogen pits.** Poisson process, **0.9 nucleations/s** over the band. A bubble
is a disc of radius `0.010-0.022 * min(w,h)` px that **masks plating underneath**
(local `i -> 0.08x`), clings for a lifetime drawn from an exponential with
`tau = 2.6 s`, then detaches. The masked patch is left as a measurable thin spot
that the deposit heals over the following ~4 s. So the surface always carries a
few live bubbles and a few healing pits, at all times, with no input.

Rendering: `T` drives a bevel (a single fixed light, elevation 30 degrees, azimuth
205 degrees) and `A` drives a roughness that switches the specular lobe between a
tight bright lobe and a broad dull one. **The bright specular is pure luminance.
No `--ns-accent` anywhere on it** — a plated highlight is exactly the "climactic
moment" the recipe warns about.

## 4. Resting loop with no input

- **t=0s:** frame plated, edge beads visible on both the outer and aperture edges;
  reciprocation near mid-stroke so most of the band is bright; two bubbles clinging
  on the left rail; one healing pit on the top rail.
- **t=2.5s:** the PR cycle has run one and a half times — the bead is at a
  different phase (measurably narrower, having just come out of a reverse pulse).
  The reciprocation has moved a sixth of its period, so the burnt band has migrated
  along the rails. One of the t=0 bubbles has detached, leaving a fresh thin spot;
  a new bubble has nucleated elsewhere.
- **t=5s:** a third PR cycle; the reciprocation is approaching a stroke reversal so
  a broad **burnt** (matte, dithered) region has opened across the lower rail that
  did not exist at t=0. The pit population is entirely different.

**Named resting loop:** three unbounded, mutually incommensurate mechanisms — the
1.75 s PR equilibrium (never settles because the reverse term is superlinear), the
15.0 s reciprocation (never stops), and a Poisson bubble process (memoryless, so it
cannot converge). No traversing band and no indexing; this is the one component in
the set whose aliveness comes from a **dynamic equilibrium** rather than from
material entering and leaving frame.

## 5. Reduced-motion freeze frame

`STATIC_TIME = 9.6 s`. Chosen because at 9.6 s the reciprocation sits at ~0.64 of
its period — near a reversal, so a **burnt band is present and legible on the
lower rail** while the rest of the frame is bright, which is the frame that shows
the process has a field rather than a uniform finish. The PR cycle is captured at
0.35 into a forward phase, so the edge bead is at its median width rather than at
either extreme. `t=0` has zero thickness, no bead, no bubbles: an empty frame.
Byte stability: bubble seeds from a hash of `(pitIndex)` with all lifetimes
evaluated analytically at `STATIC_TIME`, no accumulated state, no clock.

## 6. Luminance in both themes

| stop | light | dark |
|---|---|---|
| pit shadow / bead undercut | L 0.08 | L 0.04 |
| burnt (dull) deposit body | L 0.31 | L 0.22 |
| bright deposit body | L 0.57 | L 0.45 |
| bead crown, broad reflection | L 0.81 | L 0.74 |
| specular on the bead crown | L 0.97 | L 0.99 |

Direction identical in both themes: undercut darkest, specular brightest, burnt
always darker than bright. Bias and contrast are what move. Light theme first —
the risk is **burnt** and **bright** collapsing, which would erase the agitation
field entirely. Hold **0.20 L** minimum, and note the burnt region is additionally
distinguished by its dither texture, so even at the floor the cue survives. The
edge bead must not be drawn with `--border`: at ~1.1:1 in light theme it would
vanish, which is the recorded bug, and the bead is the component's main geometric
read.

## 7. Text on the surface

No type sits on the deposit, so the constraint this spec has to solve instead is
the harder one for a frame: **the frame must stay legible against arbitrary
image content it does not control.** Solved, not exempted:

- An unconditional **1 px inner rule at the aperture edge**, `--foreground` at
  14%, drawn on top of the deposit and never derived from `--border` (which at
  ~1.1:1 in light theme would leave the aperture edge undefined).
- **Worst frame, named:** a near-black photograph in dark theme, where the
  deposit's darkest stop (L 0.04) and the image are both near-black and the
  aperture boundary would otherwise disappear. The inner rule is what carries that
  case — the deposit cannot, at any thickness. The light-theme mirror case (a
  blown-out white photo against the L 0.97 bead specular) is carried by the same
  rule. Both must be checked with an actual near-black and near-white test image,
  not with the default sample.
- Aperture-edge-to-image delta floored at **3:1** in both directions, measured on
  the rule, not on the deposit.

The caption sits **outside** the plated band as ordinary DOM against
`--background`. Having no type on the material is also this set's deliberate
diversification point — every other material spec here defends type-on-surface
legibility, and one frame that does not is correct rather than a gap.

## 8. Canvas host

2D canvas sized to the frame's bounding box with the aperture punched via
`destination-out`. `w-full h-full`, DPR-aware backing store capped at 2, verified
at dsf 2 — the 12-texel band across a `0.085 * min` width is thin enough that an
intrinsic-size fallback would collapse it. `ResizeObserver` on the host,
re-deriving `FW`, bubble radii and stroke amplitude from the new **smaller**
dimension. `IntersectionObserver` threshold 0 + `visibilitychange` pause; on
resume, hold the PR and reciprocation clocks rather than restarting (a bead that
jumps back to zero thickness on scroll is the visible bug). Tokens via
`getComputedStyle` + `MutationObserver` on documentElement class, read before the
first paint on mount, resize and intersection resume. Zero colour literals.

## Kill criteria

- If the edge bead does not visibly pulse on the PR cycle in a 0.9 s screenshot
  pair, the dynamic equilibrium is not reading and the component is a static
  bevelled frame. Kill — that is the entire aliveness claim.
- If burnt and bright regions are only distinguishable by brightness and not by
  texture, the diffusion-layer story failed; fix the dither before shipping, and
  if it cannot be made to read at 0.20 L separation in light theme, kill.
