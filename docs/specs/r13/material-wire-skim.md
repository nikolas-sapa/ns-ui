# wire-skim

- **slug:** wire-skim
- **tier:** core (2D canvas + rasterised path, section-scale step block)
- **surface:** "how it works" / numbered step block (no GAP-MAP bucket of its own; nearest is feature grid #5 — a step block is a feature grid with an order)
- **family:** metal

## 1. Surface replaced + the real material process

Replaces the **"how it works" step block** — the 3-4 numbered stages every landing
page carries, normally shipped as icons in a row.

Real process: **wire EDM roughing and skim passes.** A wire EDM does not cut a
part in one go. It makes a **rough cut** that separates the slug, then **3-4 skim
(trim) passes** that each remove a smaller offset and each leave a better surface.
The steps of the block *are* the passes, which is why this is a step block and not
a decorative cut.

Real numbers, from ordinary production practice on ~50 mm steel:

| pass | offset removed | Ra achieved | feed |
|---|---|---|---|
| rough | (full kerf) | 2.5-3.0 um | ~2.5 mm/min |
| skim 1 | 0.030 mm | 1.2 um | ~9 mm/min |
| skim 2 | 0.015 mm | 0.60 um | ~14 mm/min |
| skim 3 | 0.008 mm | 0.35 um | ~20 mm/min |
| skim 4 | 0.005 mm | 0.20 um | ~26 mm/min |

Kerf on the rough pass = wire diameter **0.25 mm** + spark gap **0.02-0.05 mm per
side** = **0.29-0.35 mm**. Wire is consumed continuously and runs at **3-12 m/min**
under **10-25 N** tension. Pulse on-time **0.5-2 us** roughing, **0.1-0.3 us**
skimming, at **100-500 kHz** — which is why roughing throws visible sparks and
skimming barely does.

## 2. Nearest existing slug + why this is not a restyle

Nearest: **`edm-crater-field`** (full-bleed metal plate eroded by sinker EDM —
sparks pit the surface with raised-rim craters that fade as later discharges erode
the recast layer) and **`spark-test-id`**.

`edm-crater-field` is **sinker** EDM: a stationary electrode, a stochastic rain of
discharges over an area, and the visual content is a **crater texture statistic**.
wire-skim is **wire** EDM: a single moving cut front tracing a **contour**, and the
visual content is a **path with a kerf and a separating slug**. Different topology
(an area field vs. a 1D front through a 2D body), different outcome (a texture vs.
a part and a slug), different mechanic (crater birth/erosion vs. progressive offset
reduction with a measured Ra). Second reason: this component's subject is the
**sequence of passes** — a quantity `edm-crater-field` does not have and cannot
express, because a sinker has no pass structure.

Against `grazing-light`: the type here is not relief and not lit — it is the **kerf
path itself** (see item 7), read as an actual hole.

## 3. Mechanic

Geometry from the container's **smaller** dimension throughout.

**The workpiece** is a plate filling the block. A closed contour (the step block's
aperture: the step numeral's outline) is programmed once per cycle.

**The wire** is a 2 px vertical line with a slight bow (real wire lags by **0.5-2%
of plate thickness** under cutting force — render as a 3 px lateral offset that
trails the direction of travel). It traverses the contour at the current pass's
feed, scaled so the **rough pass takes 11.0 s** and skims 1-4 take 3.1 / 2.0 / 1.4
/ 1.1 s (the real feed ratios above, preserved exactly).

**Per-pass state**, kept in a `kerf` raster and a `roughness` raster at
`0.006 * min(w,h)` px/texel:

- Rough pass: opens the kerf to `KERF_PX = 0.011 * min(w,h)` px. Writes
  `roughness = 1.0` on both walls. Emits **flushing sparks**: 14-22 short bright
  ticks/s at the wire's contact point, each 2-4 px, lifetime 90 ms, velocity biased
  downward with the dielectric flush.
- Skim pass `k`: offsets the wire toward the part wall by the table's offset
  (scaled: 0.030 / 0.015 / 0.008 / 0.005 mm -> 0.086 / 0.043 / 0.023 / 0.014 of
  `KERF_PX`), widening the kerf slightly and **halving `roughness`** on the part
  wall each pass (1.0 -> 0.48 -> 0.24 -> 0.14 -> 0.08, tracking the Ra column).
  Spark rate drops with pulse energy: 6 / 3 / 1.5 / 0.8 ticks/s.
- Wall rendering: `roughness` drives a per-texel value dither on the wall band (a
  4x4 Bayer threshold around a value derived from `roughness`), so a rough wall is
  visibly grainy and a skimmed wall is visibly smooth **at a similar mean L**. That
  is what makes the passes legible as *surface finish* rather than as brightness
  changes alone.

**The slug.** After the rough pass closes the contour, the cut-out slug is released
and **drops 0.18 * min(w,h) px over 700 ms** with two decaying bounces, then slides
out of frame. This is the moment the block "opens".

**The unbounded loop, and this is the point:** on completion of skim 4 the machine
**indexes to the next blank**. The plate translates left by one full block width
over **1.6 s**, a fresh uncut plate arrives, and the sequence restarts with a
**new contour** (the next step numeral, cycling 1-2-3-4). The step block is a
production run, not a single part, so it never finishes. Total cycle
11.0 + 3.1 + 2.0 + 1.4 + 1.1 + 0.7 + 1.6 = **20.9 s**.

**Sparks must not use `--ns-accent`.** An EDM spark is the single most tempting
place on this project to reach for a warm/accent tint and it is explicitly
forbidden here — sparks are near-white derived from `--foreground`, and their read
comes from size, count and decay. This is the recorded defect from `edge-yield`,
`granule-churn` and `shear-billow`.

## 4. Resting loop with no input

- **t=0s:** rough pass, wire ~35% around the contour, sparks firing at the contact
  point, kerf trailing behind it, plate otherwise uncut.
- **t=2.5s:** wire at ~58% of the contour — visibly further round, more kerf drawn,
  a different local geometry. Sparks at a new position.
- **t=5s:** wire at ~80%; the kerf now nearly encircles the slug and the
  about-to-drop region is unmistakable. Different frame again.

At 11.0 s the slug drops; by 18.6 s the walls have visibly de-grained through four
skims; at 20.9 s the plate indexes and a new numeral begins. Every 2.5 s sample in
that window differs.

**Gate-visibility warning for the builder.** The t=0 / 2.5 s / 5 s screenshots the
verifier grades all land inside the **rough pass**. They will differ (the wire and
kerf advance), so the aliveness gate passes — but none of them shows a skim pass,
the slug drop, or the open aperture, which is the component's actual subject. This
is the same class of blind spot the round-playbook records for autoplay-latched
cards. Two acceptable answers, pick one and record it in the docblock:
**(a)** shorten the rough pass to **4.2 s** (keeping the real feed *ratios*, so
skims become 1.2 / 0.76 / 0.53 / 0.42 s) so that a skim boundary is on screen by
t=5s and the whole 8.0 s cycle fits inside a normal look; or **(b)** keep the
20.9 s cycle for legibility and require the **runtime audit to hash the framed
element over 45+ s**, not the usual 5 s window. (a) is preferred — a step block
nobody watches for 14 seconds is a step block whose steps are never seen.

**Named resting loop:** an unbounded production run — index, cut, skim, drop,
index. Material enters and leaves the frame; the contour changes each cycle, so it
is not a looping animation of one part.

## 5. Reduced-motion freeze frame

`STATIC_TIME = 13.9 s` — mid **skim 2**. Chosen because that single frame carries
every element of the mechanic at once: the slug is gone (the aperture is open and
the block's content is visible through it), the kerf is complete, the wire is
present and mid-traverse, and the wall shows a **visible boundary between the
already-skimmed arc and the still-rough arc** — the component's actual subject,
surface finish improving pass by pass. `t=0` shows an uncut plate: no kerf, no
aperture, no finish contrast, nothing. Byte stability: spark positions from a hash
of `(passIndex, floor(t*30))`, evaluated at `STATIC_TIME` only, no clock and no
`Math.random()`.

## 6. Luminance in both themes

| stop | light | dark |
|---|---|---|
| kerf void (through the plate) | L 0.06 | L 0.03 |
| recast layer on a rough wall | L 0.26 | L 0.18 |
| plate face | L 0.55 | L 0.40 |
| skimmed wall (pass 4) | L 0.80 | L 0.71 |
| spark tick | L 0.98 | L 0.99 |

Direction identical in both themes: void darkest, spark brightest, and a **skimmed
wall always brighter than a rough wall** (a real skimmed EDM wall is brighter
because the matte recast layer and its micro-crater texture have been removed).
Only bias and contrast move. Light theme first: the risk is "plate face" and
"skimmed wall" merging, which would erase the pass story. Hold **0.18 L** between
them and let the Bayer dither carry the rest — the dither works in both themes
because it modulates around the mean rather than shifting it. `--border` is the
block's outer rule only; never the kerf, which at ~1.1:1 in light theme would be
invisible — that is the recorded bug, not a hypothetical.

## 7. Text on the surface

The step **numeral** is the cut itself — the contour the wire traverses is the
numeral's outline, so the number is a **through-aperture**, read as the kerf-void
stop (L 0.06 light / L 0.03 dark) against the plate face. That is a large delta by
construction, and it is a different optics from every other spec in this set: no
relief, no shading, no transmission — an actual hole.

- **Worst frame, named:** during the **rough pass, before the slug drops**. There
  the numeral is outlined by a kerf only `KERF_PX` wide and its interior is still
  plate, so the number is a thin outline rather than a filled shape. Measured
  contrast at that frame is kerf-to-plate 0.06 vs 0.55, which passes — so the real
  risk is **stroke width**, not contrast. Floor `KERF_PX` at **2.5 CSS px** (5
  backing-store px at dsf 2) so the outline never sub-pixels away. That floor is
  the check.
- Step **title and body** are ordinary DOM beside the plate, unshaded, and carry
  the step number as text so the aperture is decorative to assistive tech.

## 8. Canvas host

2D canvas for the plate/kerf/roughness rasters, with the wire and sparks drawn over
it. `w-full h-full`, DPR-aware backing store capped at 2, verified at dsf 2 (the
`KERF_PX` floor above is exactly a dsf-2 bug waiting to happen).
`ResizeObserver` on the host, re-deriving `KERF_PX`, texel size and feeds from the
new **smaller** dimension. `IntersectionObserver` threshold 0 + `visibilitychange`
pause — and on resume, **do not restart the cycle**; hold the elapsed cycle clock
so the block does not jump back to an uncut plate when scrolled back into view.
Tokens via `getComputedStyle` + `MutationObserver` on documentElement class, read
before the first paint on mount, on resize, and on the intersection resume path.
Zero colour literals.

## Kill criteria

- If skim passes are not visibly distinguishable from each other in a screenshot
  pair at 13.9 s and 17.5 s, the Ra story failed and this is one cut with extra
  steps. Kill.
- If it reads as `edm-crater-field` with a path through it, kill — the slug drop
  and the pass sequence must be the primary reads, not the sparks.
