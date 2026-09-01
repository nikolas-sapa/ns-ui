# spangle-freeze

- **slug:** spangle-freeze
- **tier:** loud (WebGL, large feature card / section masthead panel)
- **surface:** feature card at 2-up or full-width scale (GAP-MAP gap #5 bucket; WebGL is the smallest mechanic family at 20 slugs)
- **family:** metal

## 1. Surface replaced + the real material process

Replaces the **large feature card** — the panel that carries one heading and one
sentence and is otherwise a flat rectangle.

Real process: **hot-dip galvanising spangle formation.** Steel strip leaves a
molten zinc bath at **450 C**, an air knife wipes the coating to
**7-20 um per side** (100-275 g/m2 total), and the liquid zinc then solidifies on
the moving strip. Solidification is **nucleation and dendritic growth to
impingement**: grains nucleate at a density set by bath chemistry, grow
dendritically at **1-10 mm/s**, and stop where they meet a neighbour. Grain size
is **1-25 mm** — a large spangle needs **0.1-0.2% Pb** (or Sb) to lower the
nucleation rate; spraying zinc dust seeds nucleation everywhere and produces
"minimised spangle" with no visible pattern. Cooling rate **5-20 K/s**.

The reason spangle is visible at all is purely optical and purely achromatic:
zinc is hexagonal, and each grain's **basal (0001) plane is tilted 0-30 degrees**
from the strip surface. Every grain therefore reflects the same light to a
different degree. A spangled sheet is one metal, one colour, and a patchwork of
luminances — which makes it a monochrome-native process by construction.

## 2. Nearest existing slug + why this is not a restyle

Nearest: **`kamacite-etch`** (full-bleed ASCII Widmanstatten pattern — nickel-iron
crystal lathes locked to four octahedral lattice angles, surfacing as a slow
diagonal acid-etch front sweeps over ~90 s). Also `pancake-lap` (pancake sea ice)
and `crack-polygon-order`.

Against `kamacite-etch`, the closest and the one to argue: that pattern is
**predetermined**. The lathes lie on four fixed lattice angles, the geometry exists
before the animation starts, and the animation is a **reveal** — an etch front
uncovering a pattern that was always there. spangle-freeze has no predetermined
pattern: grains nucleate **stochastically**, grow at a rate set by the local
undercooling, and the tessellation is decided by **impingement** — where two
growth fronts meet. Run it twice and you get two different sheets. Second
difference: `kamacite-etch` is an ASCII glyph field with a value ramp; this is a
per-grain **anisotropic reflectance** render where the grains' brightness ordering
changes with the light, so the same tessellation can read inverted.

Against `pancake-lap`: pans are discrete rigid bodies that **drift, collide and
raft over each other**. Spangle grains never move — they grow in place from a
nucleus and lock. Nothing overlaps, nothing translates relative to a neighbour.

Against `crack-polygon-order`: fracture, not growth. Cracks propagate inward from
boundaries into intact material; dendrites propagate outward from points into
liquid. The resulting cell statistics differ visibly (crack cells are convex and
straight-edged; impinged dendritic grains have lobed, six-fold-biased boundaries).

## 3. Mechanic

**The strip runs.** Vertical scroll at `STRIP_SPEED = 0.045 * min(w,h) px/s`, with
three fixed zones in screen space — bath exit (bottom), air-knife wipe, and the
cooling tower where solidification happens. Unlike `peel-flow` and `frit-sinter`
(which use a moving band to carry a *monotonic* process past a fixed observer),
here the band is intrinsic to the process — a galvanising line is continuous by
definition — and the visible content is not a gradient but a **stochastic
tessellation being generated**.

Fields on a **256 x 256** float grid mapped so one texel is ~0.6 mm of real strip:

1. **Undercooling `dT(x,y)`**: rises as material moves up through the cooling
   tower, `5-20 K/s` scaled to screen time so a texel goes from 0 to full
   undercooling over **3.4 s** of travel.
2. **Nucleation**: Poisson, rate `N0 * exp(-B/dT^2)` (classical nucleation, so the
   rate is strongly gated by undercooling and grains nucleate in a narrow band
   rather than everywhere). Tuned to **2.1 nuclei/s** over the visible strip,
   giving a mean grain diameter of `0.16 * min(w,h)` px — a large spangle, which
   is the visually interesting case.
3. **Growth**: each nucleus stores an id, a nucleation time, and a random
   **basal tilt** `beta in [0, 30]` degrees and **azimuth** `psi in [0, 60)`
   degrees (hexagonal symmetry). Growth is a **six-fold anisotropic distance
   field** — `r_max(theta) = v * (t - t_nuc) * (1 + 0.22 * cos(6*(theta - psi)))`,
   which is what makes dendritic arms and lobed boundaries rather than circles.
   `v = 0.085 * min(w,h) px/s`. A texel belongs to whichever grain reaches it
   first (a Johnson-Mehl tessellation, which is the correct model and is one
   `min` reduction over nearby nuclei in the shader).
4. **Impingement**: where two grains meet, a **grain boundary groove** — a 1.5 px
   dark line, because a real boundary is a thermal groove that catches shadow.
5. **Liquid ahead of the fronts**: unsolidified zinc renders as a smooth, glossy,
   **grain-free mirror** — the visual contrast between the smooth liquid band and
   the tessellated solid above it is the component's strongest single read.

Rendering: no height field and no relief. Per texel, look up the grain's basal
normal from `(beta, psi)` and evaluate a **fixed** environment (broad sky, dark
floor, two strip lights at elevations 55 and 18 degrees) against that normal.
Grains differ in brightness only because their crystallographic orientation
differs — which is exactly the physical cause, and it means the panel needs no
bump map at all.

**Light drift:** the strip lights' azimuth rotates **1 degree per 0.60 s**
(1.67 deg/s), unbounded. This rate is set by a requirement, not by taste: it must
move grains across each other in **brightness rank** within a 2.5 s screenshot
gap, which needs ~4 degrees given the environment's angular structure. 1 deg/2.7 s
was the first draft and it is too slow — 0.9 degrees over 2.5 s does not reshuffle
rank on a broad-sky-plus-two-strips rig, it only dims everything slightly, and
that is a spec that would read as a still photo sliding. If a build measures that
4 degrees still does not cross ranks, raise the rate before shipping.

**6. Interfacial alloy growth — the mechanism that keeps the MATURE field alive.**
This is the fix for the one dead region the strip scroll leaves behind. The
tessellation, once impinged, is permanent, so without this the upper two-thirds of
the panel is a fixed image translating slowly. Real galvanising does not stop at
solidification: while the strip is still hot, the **Fe-Zn intermetallic layer**
(zeta/delta phases) keeps growing from the steel interface, and it grows with
**parabolic kinetics**, `x = k * sqrt(t)`. Where it reaches the free surface the
grain goes **grey and matte** — this is the well-known greying/spangle-fade of
galvanised sheet, and it advances **from the grain boundaries inward**, because
boundaries are the fast diffusion paths.

Implementation: per texel store `age` since solidification. Alloy penetration
`a = K * sqrt(age) * (1 + 2.4 * exp(-d_boundary / 0.018*min(w,h)))`, with `K` set
so a grain's boundary halo is clearly visible **3.0 s** after impingement and the
grain's centre begins dulling at **9 s**. `a` raises the specular roughness from
0.06 toward 0.40 and compresses the grain's luminance toward the mid stop. So the
mature field is continuously changing texture — boundaries thickening into haloes,
grain centres slowly going matte — for the entire time it is on screen, and it
leaves the top of the panel duller than it entered. Nothing in that region is
static.

**No `--ns-accent`** on any grain highlight. Every value here is a luminance
lookup.

## 4. Resting loop with no input

- **t=0s:** lower fifth is smooth liquid; a nucleation band just above it with a
  few small hexagonal grains; the upper two thirds fully impinged spangle with a
  particular light/dark patchwork.
- **t=2.5s:** the strip has moved ~0.11 of the panel height. Grains that were
  small at t=0 have grown and impinged with new neighbours, so boundaries that did
  not exist at t=0 are now drawn. Four to six new nuclei have appeared in the
  nucleation band. The light has rotated **~4.2 degrees**, enough that several
  grains in the mature field have crossed each other in brightness rank. In the
  mature field itself, boundary haloes have visibly thickened on the youngest
  grains (parabolic, so growth is fastest right after impingement).
- **t=5s:** ~0.23 height travelled; the t=0 nucleation band is now fully mature
  spangle in the middle of the panel; the light has rotated **~8.3 degrees** and
  the bright/dark patchwork is substantially re-dealt. The grains nearest the top
  of the panel are now visibly matte at their centres, not just at their
  boundaries — the upper third at t=5s is a measurably duller material than the
  upper third at t=0, which is the check that the mature field is not a static
  image translating.

**Named resting loop:** four independent unbounded mechanisms, and the fourth is
the one that matters most. The strip is unbounded (material is continuously
produced at the bath and leaves at the top); nucleation is a memoryless Poisson
process so the pattern never repeats; the light azimuth rotates without limit and
without period; and **interfacial alloy growth means every texel on screen is
still changing texture, including in the fully-impinged region where the
tessellation is frozen**. Without the fourth, the upper two-thirds of the panel
would be a still image sliding — a component that diffs green on the gate and
reads dead to the owner, which is the failure mode the round-playbook records.

## 5. Reduced-motion freeze frame

`STATIC_TIME = 11.3 s`. At 11.3 s the panel is fully populated in all four
regimes — a liquid band at the bottom, a nucleation-and-growth band with grains
mid-growth and not yet impinged (the only phase where you can see a **dendrite**
rather than a finished cell), a freshly impinged field with sharp boundaries, and
an older field at the top already showing alloy-grey grain centres — and the light
azimuth sits at 18.8 degrees, off the symmetry point, so no two adjacent grains
share a brightness. `t=0` is an all-liquid mirror: no grains at all, and the
static-grey-card automatic reject. Byte stability: nuclei from a fixed PRNG keyed
on `(nucleusIndex)`; growth radii evaluated analytically at `STATIC_TIME`; no
accumulated state, no clock, no `Math.random()`.

## 6. Luminance in both themes

| stop | light | dark |
|---|---|---|
| grain boundary groove | L 0.07 | L 0.04 |
| alloy-grey (fully interfaced) grain | L 0.40 | L 0.32 |
| grain at high basal tilt (off-specular) | L 0.28 | L 0.19 |
| grain at mid tilt | L 0.54 | L 0.42 |
| grain near basal-parallel (broad sky) | L 0.82 | L 0.75 |
| liquid zinc mirror / specular grain | L 0.96 | L 0.99 |

Direction identical in both themes — groove darkest, mirror brightest, and grain
brightness monotone in `cos(beta)` throughout. Only bias and contrast move: light
theme is a sheet in a bright room, dark theme the same sheet in a dark one, and in
both the five stops span near-black to near-white per weld-pool's rule. Light
theme is checked first; the failure there is the **mid-tilt** and **near-parallel**
grains compressing so the patchwork stops reading. Hold **0.18 L** between adjacent
grain stops by widening the environment's sky/floor split — never by tinting
grains, and never by adding a fake bump.

`--border` is the panel's outer 1 px rule only. The grain boundary groove is drawn
from the darkest luminance stop, not from `--border`, which at ~1.1:1 in light
theme would erase the tessellation entirely — that is the single most likely way
to break this component.

## 7. Text on the surface

Yes. The heading is a **bare spot** — a real galvanising defect where flux failed
and the zinc did not wet the steel, leaving unplated substrate. Optically this is
**planar reflectance, not relief**: the bare region has a different, matte BRDF
(broad lobe, `rough = 0.42`) and no grains, so it reads as a distinct material
even where its mean L is close to a neighbouring grain's. Deliberately different
from `grazing-light`'s embossed type and from `wrinkle-cure`'s relief type — no
normal is perturbed anywhere in this component.

- Growth fronts **route around** the bare region (it is not liquid zinc, so no
  dendrite can cross it) — which is physically correct and visually is what sells
  the type as part of the sheet.
- Heading-to-ground delta floored at **6:1**, measured against the **brightest**
  grain adjacent to the glyph in light theme and the **darkest** in dark theme,
  recomputed as the light rotates.
- **Worst frame, named:** the frame where the rotating light brings a
  **near-basal-parallel grain (L 0.82) directly against a glyph stem**. Since the
  light rotates continuously this frame *will* occur — it is not hypothetical, it
  is periodic. Guard: clamp any grain whose boundary lies within 8 px of the glyph
  mask to at most L 0.62 (light) / at least L 0.30 (dark). The clamp is local and
  invisible because grain brightness already varies.
- Body copy is ordinary DOM on a scrim outside the sheet.

## 8. WebGL canvas host checklist

- DPR-aware backing store **capped at 1.5** (a section-scale panel, and the
  Johnson-Mehl `min` reduction is the per-pixel cost).
- Canvas `w-full h-full`; verify at dsf 2, not just dsf 1.
- `ResizeObserver` **on the host**, re-deriving grain size, growth velocity and
  strip speed from the new **smaller** dimension so the spangle reads at card scale
  and at full width.
- `IntersectionObserver` threshold 0 + `visibilitychange` pause. On resume, hold
  the strip and light clocks — restarting would wipe the tessellation and the
  panel would flash back to liquid.
- Tokens via `getComputedStyle(document.documentElement)` at mount +
  `MutationObserver` on documentElement class. **No paint before the first token
  read** on the mount, resize and intersection-resume paths specifically. Zero
  colour literals, including in GLSL — every colour is a uniform.
- Nuclei live in a small texture (up to 96 active) and the shader reduces over the
  ~12 nearest via a coarse binning texture; a naive all-pairs loop will not hold
  frame rate at 1.5 DPR on a full-width panel.
- Adaptive render scale steps down only after a sustained ~900 ms EMA over budget,
  steps back up after a much longer clean stretch, doubling the wait each failure.
  Never on frame count, never on device heuristics.

## Kill criteria

- If the grains read as a flat Voronoi diagram rather than as **oriented
  reflecting crystals**, the orientation-driven BRDF is not doing its job and this
  is a restyle of any cell-tessellation background. Kill.
- If the six-fold growth anisotropy does not produce visibly lobed boundaries
  (i.e. the result is indistinguishable from a plain Voronoi), raise the 0.22
  anisotropy term before shipping; if it still reads as straight-edged cells, it
  has become `crack-polygon-order` and should be killed.
- If the light-drift reshuffle is not visible over a **2.5 s** screenshot pair at
  1.67 deg/s, raise the rate; the mature field depends on it.
- **The decisive check:** crop the upper third of the panel (fully impinged, no
  nucleation) and compare t=0 against t=5s. If that crop differs only by
  translation, the interfacial alloy growth is not working and the component is a
  still image sliding. Fix or kill — this is the gate the round-playbook says a
  green verify cannot see.
