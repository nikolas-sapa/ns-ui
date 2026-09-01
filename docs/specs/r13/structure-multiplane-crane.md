# multiplane-crane

- **slug:** multiplane-crane
- **tier:** loud (full-bleed pinned scroll stage)
- **surface:** pinned scroll sequence / scroll-driven reveal

## 1. Surface it replaces + the real process
Pinned scroll sequence. Borrowed from the **Disney multiplane camera** (Burbank crane, 1937,
Garity/Iwerks): a vertical crane holds four to seven horizontal glass plates spaced apart under a
downward-pointing camera. Each plate carries opaque artwork; the plates track laterally at rates
inversely proportional to their distance from the lens; each plate is lit separately and **casts a
real shadow onto the plate below it**; exactly one plate at a time is in critical focus, so nearer
and farther plates go optically soft; dust and glass flaws sit ON each plate and are therefore in
focus at that plate's depth. The camera's vertical travel down the crane is the "zoom".

## 2. Nearest existing slug + why this is not a restyle
Nearest: `scroll-particle-tunnel` (scroll scrubs a camera through a monochrome point tunnel, cursor
drift adds parallax) and `grazing-light` (feature-grid card, low-angle raking light over blind
embossing). scroll-particle-tunnel's depth is a continuum of points with no opaque surfaces in it —
nothing in that component can occlude or shade anything else, and its parallax is a camera
translation through a cloud. Here the entire subject is a small number of **opaque planes** whose
separation is legible only because plate N throws a soft, separation-scaled cast shadow onto plate
N+1 and because exactly one plate at a time holds critical focus, and the scroll axis changes the
magnification *ratios* between planes (2.22x on the nearest against 1.21x on the deepest), which is
a different transform from a shared camera translation. Against `grazing-light`: that rakes one
light across one embossed surface at one depth; this has five surfaces at five depths, each
receiving light from a fixed lamp and shading the ones beneath it.

## 3. One-sentence mechanic
Five opaque glass plates at fixed depths under one camera: they slide at inverse-distance rates,
shadow each other, and rack in and out of focus, and scroll drives the camera down the crane.

## 4. Rendering approach
2D canvas, five offscreen plate canvases composited back-to-front. Each plate's artwork is a
seeded 1-D value-noise ridge silhouette (hard-edged and opaque, so it can occlude and shadow).
Per-plate blur = 3-pass box blur with an integer radius, recomputed only when the radius changes
by >= 0.5px. Cast shadow = the source plate's own alpha mask, offset and box-blurred, drawn as a
luminance multiply on the receiving plate before the receiving plate's own blur.

**Budget note — read this before writing the loop.** Five plate blurs plus four shadow blurs is up
to **nine box-blur passes per frame at full stage size**, on a full-bleed stage. That is not a small
term and it is the one place in this spec where a builder can hit a wall. The fix is structural, not
a later optimisation: **blur at reduced resolution**. A plate whose circle of confusion is large has
by definition already lost its high frequencies, so render it to a smaller offscreen and upscale on
composite:

| circle of confusion | offscreen scale |
|---|---|
| <= 0.02*M | full |
| 0.02*M .. 0.04*M | 1/2 |
| > 0.04*M | 1/4 |

Shadow masks are always generated at 1/2 scale — a penumbra of `0.014*M` per gap cannot resolve
anything finer. The sharp plate (the one at `z_f`) is the only one that is ever blurred at full
resolution, and by construction there is at most one of those.
`M = min(stageW, stageH)` governs every length below.

## 5. Real numbers
- **5 plates**, indices 0 (nearest) .. 4. Depths `z_i = 1.0 + 0.55*i` -> 1.00, 1.55, 2.10, 2.65, 3.20
  (camera at z = 0).
- **Parallax rate** `r_i = z_0 / z_i` -> 1.000, 0.645, 0.476, 0.377, 0.313. Inverse-distance, per the
  real crane.
- **Camera dolly** `delta`, scroll-mapped over [0, 0.55]. Plate magnification `m_i = z_i / (z_i - delta)`:
  nearest 1.00 -> 2.22, deepest 1.00 -> 1.21. Clamp `delta <= 0.55`; past that the near plate crosses
  the camera plane and `m_0` diverges.
- **Lamp**: fixed azimuth 208 degrees. Cast-shadow offset per plate gap = `0.021*M`, penumbra blur
  radius per gap = `0.014*M`, shadow strength 0.34 on the first gap falling linearly to 0.20 on the
  fourth (a real multiplane's deeper plates are further from the lamp and softer).
- **Focus**: critical depth `z_f`. Circle of confusion for plate i = `0.030*M * |z_i - z_f|`, capped at
  `0.055*M`. Scroll term: `z_f = 1.0 + 2.2*p` — a genuine rack from foreground-sharp at p=0 to
  background-sharp at p=1.
- **Glass flaws**: 14 static specks per plate (seeded from the plate index), radius
  `0.0018*M .. 0.0045*M`, plus 2 hairline scratches per plate. They blur with their own plate. This
  is the tell that the softness is per-plate optics and not a CSS filter over the scene.
- **Airborne motes**: 3 per inter-plate gap, drifting down at `0.006*M/s` with 1-octave lateral
  noise, respawning at the top.

## 6. Unconditional resting loop (no scroll, no pointer)
A real multiplane shot is exposed at 24fps continuously; the crane never idles. Always-running rAF,
independent of scroll:
- **(a) camera lateral drift** `X(t) = 0.045*M*sin(2*pi*t/9.7) + 0.019*M*sin(2*pi*t/4.1)`. Because the
  rates are 1.000 vs 0.313, plate 0 swings `0.064*M` peak-to-mean while plate 4 swings `0.020*M` —
  a differential slide, not a shared pan.
- **(b) focus breath** `z_f += 0.42*sin(2*pi*t/13.3)` on top of any scroll term, so which plate is
  sharp changes at rest.
- **(c) lamp sweep**: azimuth `208 + 7*sin(2*pi*t/17.9)` degrees, so every cast shadow rakes.
- **(d) motes** always falling.

- **t = 0s:** plate 2 sharp; drift at zero so all plates in nominal register; shadows at nominal rake.
- **t = 2.5s:** `z_f` has moved ~0.29 (plates 0-1 now sharp, plate 2 visibly soft); plates 0 and 4 have
  slid `~0.031*M` apart from each other; shadow offsets have raked ~4% of M; motes down `0.015*M`.
- **t = 5s:** `z_f` past its peak and plate 3 coming back in; lamp at the opposite end of its
  +/-7 degrees so shadows fall the other way; drift's 4.1s component in antiphase with t0; one mote
  has respawned.

## 7. Reduced-motion freeze frame
`STATIC_TIME = 11.4s`. At 11.4s the lamp is near its azimuth extreme (maximum shadow offset, so plate
separation is maximally legible), the two drift sinusoids are near a combined peak (plates maximally
spread laterally), and `z_f` sits on plate 1 — exactly one plate crisp with the depth ladder falling
away in both directions. **Not t0**, where drift is zero, every plate is in nominal register and the
frame is indistinguishable from flat CSS parallax, which is the reject-on-sight case.

## 8. Scroll behaviour (top, bottom, card viewport)
- Track = 260vh wrapper around a `position: sticky` 100vh stage.
- Progress read **once per rAF from layout**, mirroring `registry/loud/ebb-flat/component.tsx:613`:
  `s = rect.height - innerHeight; p = s <= 0 ? 0 : clamp(-rect.top / s, 0, 1)`. Never read in the
  scroll handler (bursty on a trackpad flick, delivered after paint on some engines).
- **Top (p=0):** camera at the top of the crane, foreground sharp, deepest plate smallest. No snap.
- **Bottom (p=1):** `delta` clamped at 0.55, foreground magnified 2.22x and mostly past the frame
  edges, background sharp. Overscroll/rubber-band cannot push past the clamp.
- **Card viewport (`/preview/<name>` and `/preview/<name>/embed`):** `rect.height - innerHeight <= 0`,
  so `p` pins at 0 permanently and section 6 is the entire read. This is the case the gate grades.
  All geometry from `M = min(stageW, stageH)`, so the ridge silhouettes and the shadow offsets scale
  down with the card instead of being tuned for a 1440px hero.

## 9. Hue -> luminance, both themes
Five plates take five value stops spanning near-`--background` to near-`--foreground`. The nearest
plate is the darkest silhouette in light theme and the brightest in dark theme, so the ladder always
runs high-contrast-at-front to low-contrast-at-back — real aerial perspective, achieved by contrast
against the local backdrop rather than by direction, so it does not invert between themes. Cast
shadows are a multiply of the receiving plate's own value toward `--foreground` in light theme and
toward `--background` in dark theme: in both cases a shadow *reduces* local contrast on the lamp
side. Focus is carried purely by spatial frequency. The lamp itself is never drawn and has no
colour. `--ns-accent` appears nowhere in the render — there is no pointer highlight at all.
`--border` is used only for the stage's 1px frame. All five tokens read via
`getComputedStyle(document.documentElement)` with a `MutationObserver` on documentElement's class,
with **no literal fallbacks** and no paint before the first read (guard the rAF start, the
`ResizeObserver` callback and the `IntersectionObserver` resume path).

## 10. Interaction
Optional pointer parallax, strictly **additive** to the resting drift and capped at `0.02*M`,
lead-compensated per `weld-pool`'s `POINTER_TAU` pattern. No pointer highlight, no accent tint.
Component renders no interactive controls, so the gate's Tab check does not apply.

## 11. Canvas host
DPR cap 1.5. `ResizeObserver` on the stage element. Pause on `IntersectionObserver` threshold 0 and
on `visibilitychange`. Adaptive scale ladder `[1, 0.72, 0.52]` stepping down only after ~900ms
sustained over budget in wall-clock ms, never on frame count, never on device heuristics.

## 12. Kill criteria
- If the inter-plate cast shadows are not individually visible at card scale, widen the per-gap
  offset first; if they still do not read, **kill** — the shadows are the entire non-duplication
  argument against `scroll-particle-tunnel`.
- Fallback ladder if the blur costs more than ~2ms/frame at dpr 2, **in this order**: (1) step the
  offscreen scale table above down one notch for every plate; (2) drop the DPR cap from 1.5 to 1.25;
  (3) drop from 5 plates to 4. **Never drop the blur** — the per-plate focus is the mechanic, and a
  scene with uniform sharpness is CSS parallax.
- If, un-scrolled, the frame reads as five layers sliding sideways, kill.
