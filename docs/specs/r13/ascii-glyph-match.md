# ascii-glyph-match — glyph selection by rasterized shape, not by tone

**Collection:** core · **Surface:** gallery / media tile

> **Ownership note (read before ranking).** This mechanic was specced twice in
> round 13 and then withdrawn twice. I wrote this spec, saw
> `docs/specs/r13/hero-glyph-correlate.md` land on disk, concluded scout-hero owned
> it, and deleted mine. scout-hero independently read my file and withdrew theirs on
> the thinner-bucket rule. Both scouts yielded, and the concept ended up on the
> floor. It is restored here, on my side, for one reason: scout-hero aimed it at a
> **hero wordmark** (48 shipped, the registry's most crowded bucket) and I aim it at
> a **gallery / media tile** (12 shipped). Same technique, thinner bucket. If the
> orchestrator prefers the hero framing, restore scout-hero's version instead and
> delete this one — but ship exactly one.

## 1. Surface + the real technique

**Surface replaced:** the gallery / media tile — the 720x480 panel that stands in
for photographic content in a gallery grid or a feature card's image slot.

**Real technique:** **structure-based ASCII art** — Xu, Zhang & Wong, *Structure-based
ASCII Art*, SIGGRAPH Asia 2010, and the older bitmap-correlation ASCII of Paul
Bourke. A cell's glyph is chosen by **2-D shape match against the glyph's own
rasterized bitmap**, not by mapping a scalar through a ramp string. The practical
descendants are `libcaca`'s shape-matching dither mode and `jp2a`'s glyph-fit
variants. Real, published, citable.

## 2. Nearest existing slug + why this is not a restyle

**Nearest:** `core/gallery-ascii-gradient-orientation` — a 3x3 Sobel on the raw
scalar buffer gives each cell a gradient angle, bucketed into `-`, `/`, `|`, `\`.
That is primitive structural selection **on the same surface**, which makes it the
correct comparison, not a distant one.

Three separations, in the order a reviewer will test them:

1. **The alphabet is discovered, not authored.** That component's glyph set (4) and
   its mapping (4 angle buckets) are both written by hand. Here, at mount and after
   `document.fonts.ready`, the component rasterizes every candidate glyph **in the
   font that actually resolved** and builds a feature vector per glyph; each cell
   picks the glyph minimising weighted L2 distance against its own sub-sampled
   patch. Change the font and the glyph-to-shape mapping changes by itself.
2. **The selection is non-monotone.** Every one of the ~73 ascii slugs computes
   `ramp[floor(v * (n - 1))]` — a 1-D index into a darkness-ordered string. Here
   `/`, `L`, `7`, `'` and `v` can all be selected at the *same* mean coverage
   because they differ in **where** the ink sits. A diagonal edge stays diagonal
   instead of stair-stepping through a ramp. You cannot reach this by editing a ramp
   string, which is the exact test the round's brief sets.
3. **Sobel throws away everything except direction.** A gradient angle is one
   number. A 12-element sub-tile coverage vector is a shape. This component never
   computes a gradient and never buckets an angle.

## 3. Mechanic — numbers

- **Cell:** `cellH = 12px`; `cellW` measured (GeistMono 12px → 7.20px).
- **Grid at 720x480:** `cols = floor(720 / 7.20) = 100`, `rows = floor(480 / 12) = 40`
  → **4000 cells**.
- **Glyph ramp string:** *none, and this is the point.* Candidate set = printable
  ASCII `0x20..0x7E` minus any glyph whose **measured** ink coverage exceeds 0.55
  (drops `@ # M W B % & $`, which otherwise win every dense cell on tone alone).
  Typical surviving set: **86 candidates**, including the space.
- **Feature vector, 13 dims:** the cell box splits into 4 rows x 3 cols = 12
  sub-tiles; each feature is that sub-tile's mean ink coverage at 4x supersample.
  Feature 13 = total coverage, weighted **x2.0** so tone dominates and structure
  breaks ties. Built once into a `Float32Array(86 * 13)`.
- **Match cost:** `sum_i w_i * (cell_i - glyph_i)^2`, `w = [1 x 12, 2.0]`.
- **Perf budget — the item that kills a naive build.** 4000 cells x 86 candidates x
  13 features = **4.47M multiply-adds per pass**. Two mitigations, both required:
  1. **Coverage binning.** Bucket the 86 candidates into 12 bins by total coverage
     (bin width `0.55 / 12 = 0.0458`). A cell searches its own bin ±1 → ~18
     candidates. Cost drops to 4000 x 18 x 13 = **936k MACs/pass**, ~1.5 ms in a
     flat typed-array loop.
  2. **Match at 20 Hz, draw at 60 Hz.** Re-run selection every 3rd frame. Glyph
     identity flipping at 60 Hz reads as noise churn; at 20 Hz it reads as a print
     resolving. Per-cell alpha still updates every frame.
- **Source field:** 3 metaball lobes on a 3:2 Lissajous, `w1 = 0.110 rad/s`,
  `w2 = 0.073 rad/s`, radii `0.22 / 0.17 / 0.13` of `min(w, h)` — geometry from the
  **smaller** dimension so it reads at card scale. Beat period
  `2*pi / (0.110 - 0.073) = 170 s`; no repeat inside any screenshot window.
- **Fill ratio:** cells below field value 0.14 map to the space candidate and draw
  nothing → **62% empty, 38% lit at rest**. Deliberately denser than the house
  85–97%-empty pattern: the mechanic is that a glyph's *shape* is legible, and a
  95%-empty grid has no shapes to compare. State this as a considered departure, not
  an oversight.

## 4. t=0s / 2.5s / 5s, no input

- **t=0s:** the three lobes overlap into one blob; 34% lit; the glyph histogram's
  top three are `-`, `=`, `o` — one closed rim, one dominant curvature.
- **t=2.5s:** the two fast lobes have separated by 0.31 of `min(w, h)`; a waist
  appears and the waist rows switch to `)`, `(`, `/`, `\` — the matcher finding real
  edge orientation, which a luminance ramp cannot express.
- **t=5s:** the third lobe enters from the lower right; lit fraction 41%; three
  distinct edge families on screen at once.

Aliveness is an always-running rAF over a field that is a pure function of `t`, with
no autoplay descriptor and no pointer requirement.

## 5. Reduced-motion freeze frame

**t = 7.4 s.** At 7.4 s the three lobes reach maximum mutual separation for the
first time in the beat cycle, so all three edge families — vertical waist, 45°
bridge, horizontal rim — are simultaneously present. That is the frame with the
largest number of **distinct matched glyph shapes**, which is the mechanic. t=0
shows one round blob whose entire border is the same two glyphs and would be
indistinguishable from a ramp renderer — the worst possible freeze for this
component specifically.

Byte-stable: the field is a pure function of `t` (no RNG, no `performance.now()`
inside it) and the glyph feature table is deterministic given the resolved font, so
the frozen frame is reproducible from a cold mount and stable over time.

## 6. Hue → luminance, both themes

Round-13 shared contrast ladder; full derivation in `INDEX-ascii.md` §4. Six stops
at target contrast against the page, solved in **encoded** sRGB space because
`ctx.globalAlpha` composites there:

| stop | C | light α | dark α |
|---|---|---|---|
| 1 | 1.35 | 0.144 | 0.134 |
| 2 | 1.80 | 0.267 | 0.221 |
| 3 | 2.60 | 0.407 | 0.324 |
| 4 | 4.00 | 0.551 | 0.450 |
| 5 | 7.00 | 0.715 | 0.633 |
| 6 | 16.0 | 0.955 | 0.973 |

**Light theme is the hard case, and for a reason unique to this component.**
Structural matching only reads if the glyph's *outline* is visible. In light theme
ink subtracts from white, and a glyph below C=1.8 is a grey smudge with no
discernible shape — the mechanic silently degrades into a tone map that looks
exactly like every other ascii slug, which is the worst possible failure here.
Therefore:

- **light:** clamp the alpha floor at **stop 2 (0.267)**. Let *sparseness*, not
  faintness, carry the low end — a cell below the field threshold draws nothing at
  all.
- **dark:** the **stop 1 floor (0.134)** is fine; ink adds on near-black and a thin
  stroke still resolves at C=1.35.

Check light theme first, not as a final pass. No `--ns-accent` anywhere — there is
no pointer highlight in this component at all, which removes the project's
most-repeated defect by construction. No `--border` as fill or stroke.

Token read: `getComputedStyle(document.documentElement)` in `useLayoutEffect` plus a
`MutationObserver` on `documentElement.class`. **No paint before the first token
read** — trace the rAF start, the `ResizeObserver` callback and the
`IntersectionObserver` resume path specifically; all three must be gated on both
`fonts.ready` and the token read.

## 7. Font handling

- **Metric assumption:** GeistMono advance = `0.600 x fontSize` (±0.002). Never
  hardcode it — measure post `document.fonts.ready` with
  `ctx.measureText("MMMMMMMMMM").width / 10`, and re-measure on `ResizeObserver`.
- **Fallback with a different advance:** the feature table is built by rasterizing
  the **resolved** font, so a fallback produces a correct table automatically. This
  is the component's one genuine advantage over every ramp-based sibling, whose
  authored ramp is tuned to a font it may not get. Two things still break and must
  be handled:
  1. `cols` must be recomputed from the measured `cellW`. Consolas at 0.550 →
     `cellW = 6.60`, `cols = 109`, not 100; a hardcoded 100 leaves a 66 px unpainted
     strip at the right edge.
  2. The per-glyph rasterization canvas must be sized to the **measured**
     `cellW x cellH`. Size it to the assumed 7.20 and every feature vector is
     horizontally cropped by 9%, which biases the matcher toward narrow glyphs — a
     silent, plausible-looking wrong render.
- **Guard:** if `measuredCellW / fontSize` falls outside `[0.45, 0.75]` the resolved
  face is not monospace. Abort the match path and fall back to a fixed
  `" .:-=+*#%@"` ramp. A proportional font makes the entire mechanic meaningless,
  and a documented degradation beats a silent wrong render.

## 8. Canvas host checklist

DPR-aware backing store capped at 2; `w-full h-full` on the canvas (verify at
dsf 2, not just dsf 1); `ResizeObserver` on the host, not `window.resize`; pause on
`IntersectionObserver` offscreen and on `visibilitychange`; adaptive render scale
only after a sustained measured slow stretch, never on a device heuristic and never
gated on frame count. Under adaptive step-down, drop the **match rate** from 20 Hz
to 12 Hz before dropping resolution — the match is the expensive part and glyph
identity tolerates a lower rate far better than the grid tolerates coarsening.
