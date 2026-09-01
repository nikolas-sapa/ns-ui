# frit-sinter

- **slug:** frit-sinter
- **tier:** core (2D canvas, card scale)
- **surface:** stat / KPI number block (GAP-MAP runner-up #12; backlog queue item 9)
- **family:** glass / ceramic

## 1. Surface replaced + the real material process

Replaces the **stat tile / KPI number block**. GAP-MAP counts three
(`stat-row-baseline-spark`, `stat-tile-ascii-arrive`, `cathode-stack-glow`) and
records that **all three are app-register** — a KPI row on a landing page is not
covered. The backlog names the same gap at #9 (7 ecosystem hits).

Real process: **viscous sintering of glass frit** (enamelling, glass-solder seals,
frit-bonded ceramics). Loose glass powder held above its softening point does not
melt and flow; it **necks**. Adjacent particles grow a contact neck driven by
surface tension against viscous flow, per **Frenkel's law**:

    (x / R)^2 = (3 * gamma * t) / (2 * pi * eta * R)

where `x` is neck radius, `R` particle radius, `gamma` surface tension
(~0.30 N/m for a soda-lime frit), `eta` viscosity. As necks grow, the compact
densifies, the interconnected pore network pinches into isolated closed pores,
those pores shrink, and the body goes from **opaque white powder to transparent
glass** — that opacity change is pure light scattering at pore surfaces, not
pigment, which is why this process is natively monochrome.

Real numbers: frit particle `R = 8-20 um`, firing 620-700 C, `eta = 1e6-1e8 Pa.s`,
linear shrinkage **12-18%**, full densification 4-25 min. Scattering: opacity
falls roughly with pore volume fraction, and the last 2-3% porosity is what keeps
a body milky — closing it is the whole difficulty of the process.

## 2. Nearest existing slug + why this is not a restyle

Nearest: **`stat-tile-ascii-arrive`** (dot-matrix digit, each dot eases from a
random ramp step to its true value) and **`counter-carry-ripple`**.

`stat-tile-ascii-arrive` is a **glyph-assembly** mechanic: the numeral is a fixed
5x7 raster and the animation is per-dot interpolation toward a known target,
driven by a value arriving. frit-sinter has no target and no arrival — the
numerals are the **negative** of the process (a resist-masked region the frit
does not densify in), and what animates is a **material state field** with a
physical law behind it, running whether or not any value ever changes. Second
difference: `stat-tile-ascii-arrive` reads as ink density; this reads as
**opacity from scattering**, so the numerals are legible in *transmission*
against a lit backing, not as marks on a ground. Third: it runs unbounded because
of a moving kiln zone, where the ASCII tile finishes and holds.

## 3. Mechanic

A **belt kiln**, which is what makes it unbounded: the frit compact sits on a
belt travelling right-to-left at `BELT_SPEED = 0.085 * min(w,h) px/s`, passing
through four zones fixed in screen space. Material leaves at the left; fresh
powder is charged at the right. Nothing ever finishes because the thing that
finishes leaves the frame.

Field: particle-level, not continuum. **N = 900** disc particles seeded by
Poisson-disc sampling with `R` drawn from a lognormal, median
`R0 = 0.011 * min(w,h)` px, sigma 0.35 (a real frit is not monodisperse and the
size spread is what makes the necking read).

Per particle, state `s` = densification 0..1. Per frame, for the local zone
temperature `T(x)`:

- `eta(T) = ETA0 * exp(-B * T)`, with the mapping tuned so the melt zone gives a
  Frenkel neck growth of `d(x/R)/dt` such that `x/R` goes 0 -> 0.5 in **2.6 s** of
  screen time (the compression of 4-25 real minutes; state it in the docblock).
- Neck radius between neighbours `i,j` within `1.15*(Ri+Rj)`:
  `x_ij = min(0.5*(Ri+Rj), sqrt(K * gamma * t_hot / (eta * Rbar)))` per Frenkel.
- **Shrinkage:** centres pull together, linear shrink `0.15 * s`, so the compact
  visibly contracts 15% as it crosses the melt zone — this is a real, measurable,
  and visually strong consequence that a purely-visual sinter fake would miss.
- **Opacity:** porosity `phi = 1 - packing(s)`. Alpha of the compact
  `= clamp(1.6 * phi, 0.03, 1)`, so the body goes from opaque to near-clear over
  the last third of densification, faster than the geometry does. The last 3%
  porosity holds a visible haze — do not let it reach zero.

Zones across width: `0.78-1.00` charge (loose powder, no necks), `0.50-0.78`
ramp (`x/R` 0 -> 0.25), `0.20-0.50` soak (`x/R` 0.25 -> 0.5, shrinkage and
opacity collapse), `0.00-0.20` anneal (frozen, transparent, only the numerals'
resist region still opaque).

Rendering: 2D canvas. Each particle a filled disc; necks drawn as the union via
a **metaball threshold** on a 2x-downsampled scalar buffer (`sum of
exp(-d^2/(1.1 R)^2)`, threshold 0.62) — that gives real necking geometry cheaply,
where drawing discs alone would read as dots.

## 4. Resting loop with no input

- **t=0s:** right third granular and opaque, discrete particles readable. Middle
  necked and contracting. Left third clear glass with the numerals standing as
  the only opaque region.
- **t=2.5s:** the belt has moved ~0.21 of the width. A patch that was discrete
  particles at t=0 now shows visible necks and has contracted; the compact's
  right boundary has advanced because new powder was charged.
- **t=5s:** ~0.42 width travelled. The t=0 granular patch is now in the soak zone
  and is measurably more transparent than anything was at t=0; a fresh granular
  patch has entered at the right with a different particle seed.

**Named resting loop:** belt translation (unbounded), continuous charging at the
right boundary, continuous discharge at the left — steady-state turnover, retiring
at the rate it charges. The stat value does not have to change for any of this;
the gate runs with no input and sees all of it, which is exactly what `seam-gild`
and `starch-shear` failed.

## 5. Reduced-motion freeze frame

`STATIC_TIME = 6.9 s` with a fixed particle seed. At 6.9 s all four zones are
populated and the numerals sit fully inside the anneal zone, so the frozen frame
shows the numeral **at maximum contrast against clear glass** while still showing
loose powder at the right edge. `t=0` has the numerals half-buried in the soak
zone, which is exactly the frame where the number is least readable. Byte
stability: particle positions and radii from a fixed PRNG seeded on
`(chargeIndex)`; no `Math.random()`, no clock-derived jitter.

## 6. Luminance in both themes

Every cue is scattering opacity, so it maps to L directly:

| stop | light | dark |
|---|---|---|
| kiln backing seen through clear glass | L 0.10 | L 0.06 |
| clear annealed body | L 0.20 | L 0.14 |
| necked, part-dense body | L 0.48 | L 0.40 |
| loose opaque powder | L 0.78 | L 0.70 |
| particle rim highlight | L 0.94 | L 0.97 |

Direction is identical in both themes: **more porosity = brighter**, because
scattering is what makes powder white and that is true under any illumination.
This is the cleanest theme argument in the set — the physical law fixes the
direction, so the themes only move bias and contrast. Light theme check first:
the risk is "clear annealed body" and "kiln backing" merging; hold **0.09 L**
minimum and, if the tokens will not give it, darken the backing rather than
lightening the glass (glass that is not near the darkest stop stops reading as
transparent).

## 7. Text on the surface

Yes — the KPI numerals are a **resist mask**: a region where the frit is
prevented from densifying, so it stays loose powder at L 0.78 while the body
around it collapses to L 0.20. Legibility clamp:

- Numeral fill L is forced to the **loose-powder stop** and its `s` is pinned at
  0.08 regardless of zone, so the numeral never becomes transparent.
- Delta floored at **7:1** against the local body L.
- **Worst frame, named:** while the numeral is inside the **soak zone** — the
  surrounding body is at its most granular-to-clear transition there and its mean
  L crosses up through the middle of the ramp, so that is where delta is
  minimum. Check at that phase, not at the anneal-zone phase where it trivially
  passes. If measured delta drops under floor, bias the body darker locally
  rather than brightening the numeral (brightening blows the powder stop out).
- The label and delta indicator are ordinary DOM below the canvas, unshaded.

## 8. Canvas host (2D, not WebGL)

Not WebGL, but the host rules still apply: `w-full h-full` on the canvas with a
DPR-aware backing store capped at 2 (verify at dsf 2); `ResizeObserver` on the
host with particle radii re-derived from the new smaller dimension;
`IntersectionObserver` + `visibilitychange` pause; token read via
`getComputedStyle` + `MutationObserver`, and **no paint before the first token
read on any resume path**. Metaball buffer at half resolution keeps 900 particles
under 3 ms/frame; if measured EMA frame time exceeds budget for a sustained
~900 ms, drop to `N = 520` — never pre-emptively on a device heuristic.

## Kill criteria

- If particles read as a field of dots rather than a **necking, contracting
  compact**, the metaball threshold failed and the component is a particle toy.
  Kill.
- If the 15% shrinkage is not visible as the compact narrowing across the melt
  zone, the strongest non-obvious cue is missing — fix or kill.
